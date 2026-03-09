# Goals And Scope

## Purpose

This document defines the goal and limits of the AI player project so development stays focused on releasing the first fair, production-ready CPU opponent for the game.

## Requirements

### Primary Goal

Build a fair, legal, stable AI opponent for real matches in this backend.

The AI must:

- play through the existing backend game logic
- make decisions without bypassing legality checks
- resolve its own choice events
- finish games reliably
- provide stronger decision quality than the current heuristic-only bot

### Secondary Goals

- provide configurable difficulty tiers
- support deterministic debugging and reproducible replay analysis
- support later self-play for QA, balance testing, and benchmarking
- produce auditable reasoning metadata for logs and diagnostics

### Explicit Non-Goals For V1

The first production CPU opponent is not intended to:

- use an online LLM as the live move chooser
- start with reinforcement learning as the primary implementation path
- cheat by reading the exact cards in the opponent's hand, the exact order of cards in either player's main deck, or the exact identities of facedown shield cards on either side
- become a full research platform before the first production release is ready
- solve every future AI mode in the same milestone

## Scope

### In Scope

- a production `CPU opponent` whose AI logic runs in the TypeScript backend
- legal action enumeration
- in-memory simulation on cloned game states
- a board evaluator with risk and uncertainty handling
- bounded search under a move-time budget
- difficulty tiers based on budget and pruning policy
- telemetry, benchmark suites, and regression validation
- offline Python tooling design for later phases

### Out Of Scope For V1

- live Python decision service in production matches
- online model calls in the hot path
- end-to-end RL training infrastructure
- policy/value neural models in production
- human-like personality simulation as a top priority over strength and legality

## User-Facing Targets

### Experience Targets

- preferred move time: `2-3s`
- acceptable hard cap: `5s`
- no illegal move submissions
- no queue deadlocks caused by AI decision flow
- no unresolved AI-owned choice loops
- stable operation under autoplay and frontend polling

### Fairness Targets

Production AI must not know:

- the exact cards in the opponent's hand
- the exact order of cards in either player's main deck, unless that order was legally revealed and has not been invalidated by shuffling or other randomization
- the exact identities of facedown shield cards on either side, unless those identities were legally revealed and are still known

Production AI may use:

- public board state
- public trash/exile data
- public counts such as hand size, deck count, shield count, and energy count
- previously revealed cards
- observed colors, factions, card families, and deck composition clues
- coarse probability or belief estimates over unseen cards

## Design

### Product Positioning

The first production target is a fair CPU opponent that feels strong because its AI player reasons through legal actions and future states, not because it cheats with hidden information or relies on an external model.

### Required Operational Modes

- `fair_cpu`
  - production mode
  - hidden information respected
- `debug_oracle`
  - internal testing mode only
  - may inspect hidden zones for evaluator debugging or upper-bound studies
- `benchmark_selfplay`
  - controlled benchmark mode
  - may run fair-vs-fair or fair-vs-oracle experiments explicitly

Only `fair_cpu` is in scope for player-facing release.

## Acceptance Criteria

- A written architecture and implementation plan exists for a fair production CPU opponent.
- Every downstream spec assumes the AI uses the existing backend execution path.
- The hidden-information rules are unambiguous and consistent across all documents.
- The move-time budget and v1 scope boundaries are frozen.

## Risks

- If hidden-information rules are not enforced at the spec level, later search work will accidentally depend on server-only state.
- If v1 tries to include live Python or RL too early, delivery risk increases and benchmarking becomes unclear.
- If the spec prioritizes human-like behavior too early, strength and legality can regress.
