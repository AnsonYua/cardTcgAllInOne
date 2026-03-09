# Simulation And Action Enumeration Spec

## Purpose

This document defines the engine-facing contracts that the AI relies on: which actions can be enumerated, how they are represented, and how in-memory simulation must behave.

## Requirements

The AI runtime must:

- enumerate only legal actions the engine should currently accept
- represent actions in a serializable form compatible with existing decision execution
- simulate actions using cloned in-memory state
- avoid file persistence during simulation
- use the authoritative engine path rather than a duplicated rules implementation

## Design

## Candidate Action Contract

The AI needs a canonical candidate shape.

```ts
type AiActionCategory =
  | 'play_card'
  | 'activate_ability'
  | 'attack_shield'
  | 'attack_unit'
  | 'confirm_battle'
  | 'choice_blocker'
  | 'choice_target'
  | 'choice_token'
  | 'choice_option'
  | 'choice_prompt'
  | 'choice_burst'
  | 'end_turn';

type AiActionCandidate = {
  id: string;
  category: AiActionCategory;
  decisionKind: string;
  decisionPayload: Record<string, unknown>;
  timingClass?: string;
  source: 'enumerator' | 'tactical_override' | 'fallback';
  estimatedComplexity: 'low' | 'medium' | 'high';
  tags: string[];
};
```

`decisionKind` and `decisionPayload` should align with the existing `AiDecision` execution model so simulated and real execution share the same payload shape whenever possible.

## Timing Descriptor Contract

The enumerator and search layer must use normalized timing metadata.

```ts
type CompiledEffectTiming = {
  eventTrigger?: string;
  activationWindows?: string[];
  duration?: string;
  timingClass:
    | 'event_triggered'
    | 'player_activated'
    | 'continuous_passive'
    | 'temporary_effect'
    | 'engine_internal';
};
```

Rules:

- source card authoring uses `timing.eventTrigger`, `timing.activationWindows`, and `timing.duration`
- AI enumeration should prefer `compiledTiming`
- `internalHook` is runtime-only and must not be treated as a normal player-facing action window

## Action Families To Enumerate

The enumerator must support these categories:

- play card as unit
- play card as pilot
- play card as base
- play card as command
- activate ability
- attack shield/base side
- attack unit
- confirm battle
- blocker choice
- target choice
- token choice
- option choice
- prompt choice
- burst choice
- end turn

### Enumeration Rules

- emit only actions legal in the current timing window
- include all required payload fields for later execution
- preserve target ordering for ordered multi-target actions
- preserve grouped target selections when an effect resolves multiple targets together
- use only hidden-information-safe state when building candidates in production mode
- never fabricate payload shapes the engine would not accept
- determine legality from compiled timing descriptors
- distinguish event-driven rules from player-activated windows instead of treating all timing as one `trigger` string

### Choice Ownership Rule

The enumerator must only emit a choice action if:

- the queue head or current owned choice belongs to the AI player
- the choice is currently declared and unresolved
- the AI is allowed to act now under the existing backend state

## Simulation Contract

The AI search requires a pure in-memory simulation path.

```ts
type AiSimulationRequest = {
  rootState: Record<string, unknown>;
  aiPlayerId: string;
  candidate: AiActionCandidate;
  mode: 'fair_cpu' | 'debug_oracle' | 'benchmark_selfplay';
  deterministicSeed?: string;
};

type AiSimulationResult = {
  success: boolean;
  candidateId: string;
  resultingState?: Record<string, unknown>;
  terminalStatus?: 'win' | 'loss' | 'draw' | 'non_terminal';
  actionMetadata?: Record<string, unknown>;
  traceSummary?: string[];
  error?: string;
  timedOut?: boolean;
};
```

### Simulation Guarantees

- clone from the game state snapshot in memory
- do not write game files during simulation
- do not bump persisted version counters
- do not send frontend side effects or network-visible state changes
- route the action through the same authoritative logic path used in real execution

### Cloning Policy

Preferred cloning approach:

- serialize the current in-memory state into a non-persistent snapshot
- reconstruct a cloned `GameEnvironment` from that snapshot
- simulate on the cloned object only

The simulation path must not depend on reading or writing saved game files.

## Equivalence Requirement

If the same starting state and same action are:

- simulated in memory
- then executed for real through normal flow

the resulting outcome must match except for approved non-semantic differences such as:

- timestamps
- version counters
- log-only metadata
- transient debug-only IDs

Equivalence must hold for:

- resulting phase
- resulting board state
- resulting ownership and zone placement
- resulting queue and choice progression semantics
- win/loss status

## Search Contracts

The search layer depends on these internal shapes.

```ts
type AiBeliefState = {
  unseenHandPoolSize: number;
  unseenDeckPoolSize: number;
  plausibleBurstRisk: 'low' | 'medium' | 'high';
  plausibleRemovalRisk: 'low' | 'medium' | 'high';
  notes: string[];
};

type AiSearchResult = {
  chosenCandidateId: string;
  principalVariation: string[];
  exploredNodes: number;
  elapsedMs: number;
  totalScore: number;
  fallbackUsed: boolean;
};
```

These are internal contracts for the AI program, not public gameplay API contracts.

## Acceptance Criteria

- Every action family the AI may own is represented in the enumeration contract.
- Candidate payloads are serializable and compatible with the real execution path.
- Simulation requirements forbid file persistence and duplicated rules.
- Equivalence requirements are concrete enough for automated validation.
- AI timing checks can classify rules from compiled timing descriptors alone.

## Risks

- If simulation uses a different logic path from real gameplay, search results will be untrustworthy.
- If candidate payloads drift from real execution payloads, the AI can search one action model and execute another.
- If choice ownership is not encoded clearly, the AI can act at illegal times or miss required responses.
