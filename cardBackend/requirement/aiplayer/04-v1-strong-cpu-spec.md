# V1 Strong CPU Spec

## Purpose

This document defines the requirements for the first production CPU opponent and the AI player that powers it.

## Requirements

### Functional Requirements

The v1 CPU opponent must:

- take only legal actions available through the normal backend flow
- support all AI-owned decision classes that a human player can legally trigger
- resolve its own choice events without human intervention
- intentionally choose to end turn when appropriate
- prioritize immediate win and immediate loss prevention
- operate on a hidden-information-safe player view
- remain compatible with current autoplay and controller flows

Supported action families must include:

- play unit card as unit
- play printed pilot card as pilot
- play command card as pilot when it has `designate_pilot`
- play base card as base
- play command card as command
- activate unit ability
- activate pilot ability
- activate base ability
- activate a card effect that resolves through `[Main]`, `[Action]`, or burst-triggered `activate this card's [Main]`
- attack shield/base side
- attack unit
- confirm battle in action step
- resolve blocker choice
- resolve target choice
- resolve token choice
- resolve option choice
- resolve prompt choice
- resolve burst choice
- end turn

### Non-Functional Requirements

- preferred decision latency: `2-3s`
- hard cap latency: `5s`
- deterministic debug mode must exist
- fallback mode must exist
- no malformed action payloads may be submitted
- AI must not stall the queue through unresolved owned choices
- logs must include enough metadata to explain why a move was selected

### Fairness Requirements

Production mode must not use:

- the exact cards in the opponent's hand
- the exact order of cards in the opponent's main deck
- the exact identities of facedown shield cards

Production mode may use:

- public zones
- public counts such as hand size, deck count, shield count, and energy count
- revealed cards
- discard/trash history
- inferred deck composition
- probability or coarse hidden-info risk tags

### Failure Behavior

- if search times out, the AI falls back to a safe legal heuristic choice
- if deeper evaluation fails, the AI can still use shallower search or heuristics
- if action enumeration fails partially, the AI must only choose from the remaining verified legal candidates
- if no confident legal move remains, the AI may end turn only if end turn is legal
- the AI must never mutate game state directly to bypass execution issues

## Design

### Observed Effect Taxonomy

The supported action families above are based on the actual rule system and current GD/ST card pool, not a generic card game action list.

Observed rule types in the card data:

- `triggered`
- `play`
- `continuous`
- `special`
- `activated`

Observed high-frequency trigger families:

- `BURST_CONDITION`
- `ENTERS_PLAY`
- `continuous`
- `PAIRING_COMPLETE`
- `ATTACK_PHASE`
- `ATTACK_REDIRECT`
- `BATTLE_DESTROY`
- `DESTROYED`
- `END_OF_TURN`

Observed effect families that the AI must be ready to evaluate or respond to:

- burst add-to-hand
- burst deploy
- enters-play swing
- pairing swing
- attack-step AP swing
- blocker redirect
- repair, heal, and prevention
- attack-target permission
- shield-damage and breach pressure
- command-card-as-pilot designation

This taxonomy is included here to justify why action coverage in the AI spec must be broader than a simple play/attack/end-turn model.

### Runtime Modes

- `fair_cpu`
  - production mode
  - hidden information respected
- `debug_oracle`
  - non-production
  - may inspect hidden information to debug evaluator gaps
- `benchmark_selfplay`
  - controlled test mode for comparing strategies or modes

### Difficulty Tiers

`easy`
- current heuristic bot or very shallow search
- aggressive pruning
- low determinization count

`normal`
- bounded search under `2-3s`
- moderate pruning
- stronger evaluator breakdown
- fair hidden-information inference

`hard`
- deeper bounded search up to `5s`
- more candidate expansion
- more hidden-info sampling or richer uncertainty handling
- still fair, never hidden-info cheating

Difficulty tiers must vary by:

- search depth
- candidate limits
- pruning rules
- evaluator detail
- determinization count

Difficulty tiers must not vary by:

- hidden-info cheating
- illegal action shortcuts
- different game rules

### Action Coverage Notes

Activated effects are a required action family, not an implementation detail hidden inside search.

The AI must explicitly support activation from:

- units
- pilots
- bases
- card effects that resolve through `[Main]`
- card effects that resolve through `[Action]`
- burst-triggered effects that instruct the player to activate that card's `[Main]`

Command cards with `designate_pilot` must be treated as a distinct playable family, not as a special case of printed pilot cards. They change:

- play targeting
- link behavior
- pairing logic
- candidate generation

Action windows also matter. The AI must distinguish whether an action is available in:

- main phase
- action step
- burst resolution
- end-of-turn related timing when applicable

### Card-Pool Examples

Short examples from the current card pool:

- command as pilot
  - `GD01-101 Deep Devotion`
- activated ability
  - `GD01-014 G-Sky Easy`
  - `GD02-011 Moebius (Peacemaker Team)`
- burst-activated main
  - command cards in `st01` and `st03` whose burst text says `Activate this card's [Main]`
- combat access and redirect
  - `GD01-019 Byarlant Custom`
- shield damage and breach pressure
  - `GD01-027 Big Zam`

These are examples only. They illustrate the required action families and are not the complete implementation list.

### Fallback Policy

The production AI behind the v1 CPU opponent must explicitly support:

- tactical override path
- bounded search path
- heuristic fallback path
- emergency legal fallback path

Priority order:

1. legal tactical override
2. bounded search result
3. heuristic fallback
4. legal emergency fallback

### Implementation Note

The supported action-family list in this document is normative for the AI program. Adjacent contracts and enumerators must match it.

This means:

- if `PROMPT_CHOICE` is a required action family, AI decision contracts must expose a prompt-choice resolution path
- if command cards can be played as pilots, play-card candidate generation must expose that family separately from printed pilot play
- if activated abilities are required, action enumeration must distinguish source card category and timing window

Current implementation note:

- the queue and game systems already acknowledge `PROMPT_CHOICE`
- the current AI decision-kind contract does not yet expose a `confirmPromptChoice` path
- this is a required interface-alignment gap, not a reason to remove prompt choice from the v1 spec

## Acceptance Criteria

- The v1 CPU opponent can play complete games through the backend flow.
- The AI player behind the v1 CPU opponent can resolve all AI-owned choice events.
- Difficulty tiers are documented and fair.
- Failure and fallback behavior is explicit and safe.
- Hidden-information boundaries are clear and enforceable.
- Supported action families reflect the real card pool and rules, including command-as-pilot and source-aware activation.
- The spec explicitly identifies interface alignment requirements for prompt choice and activation coverage.

## Required Test Scenarios

- playing a printed pilot as pilot
- playing a command card as pilot through `designate_pilot`
- activating a unit ability in main phase
- activating a pilot ability
- activating a base ability
- resolving a burst option that says `activate this card's [Main]`
- resolving prompt choice, option choice, token choice, blocker choice, target choice, and burst choice
- attack-step confirmation after combat interaction
- attack shield/base side and attack unit as separate action families
- end-turn legal fallback when no stronger action remains

## Risks

- If every legal action type is not covered, the AI may freeze in uncommon timing windows.
- If fallback rules are weak, timeouts can create obviously bad play or illegal choices.
- If fairness policy is not enforced in implementation, hard mode can drift into oracle behavior.
- If activation families are collapsed into one generic bucket, the AI can miss timing-window or source-card differences.
- If command-as-pilot play is not modeled separately, the AI can underplay a large and important part of the command card pool.
- If prompt choice remains absent from AI decision contracts, the v1 action-family coverage will be incomplete.
