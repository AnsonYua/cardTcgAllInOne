# V1 Strong CPU Spec

## Purpose

This document defines the requirements for the first production AI opponent.

## Requirements

### Functional Requirements

The v1 CPU must:

- take only legal actions available through the normal backend flow
- support all AI-owned decision classes that a human player can legally trigger
- resolve its own choice events without human intervention
- intentionally choose to end turn when appropriate
- prioritize immediate win and immediate loss prevention
- operate on a hidden-information-safe player view
- remain compatible with current autoplay and controller flows

Supported action families must include:

- play card as unit
- play card as pilot
- play card as base
- play card as command
- activate card or field ability
- attack shield/base side
- attack unit
- confirm battle in action step
- blocker choice
- target choice
- token choice
- option choice
- prompt choice
- burst choice
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

- opponent exact hand contents
- opponent exact deck order
- exact facedown shield identities

Production mode may use:

- public zones and counts
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

### Fallback Policy

The v1 CPU architecture must explicitly support:

- tactical override path
- bounded search path
- heuristic fallback path
- emergency legal fallback path

Priority order:

1. legal tactical override
2. bounded search result
3. heuristic fallback
4. legal emergency fallback

## Acceptance Criteria

- The v1 CPU can play complete games through the backend flow.
- The v1 CPU can resolve all AI-owned choice events.
- Difficulty tiers are documented and fair.
- Failure and fallback behavior is explicit and safe.
- Hidden-information boundaries are clear and enforceable.

## Risks

- If every legal action type is not covered, the AI may freeze in uncommon timing windows.
- If fallback rules are weak, timeouts can create obviously bad play or illegal choices.
- If fairness policy is not enforced in implementation, hard mode can drift into oracle behavior.
