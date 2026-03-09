# Goals And Scope

## Purpose

This document freezes the intent and boundaries of the AI player program so implementation work does not drift into a research-only system, a cheating oracle, or an overbuilt platform before the first production CPU ships.

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

The v1 production CPU is not intended to:

- use an online LLM as the live move chooser
- start with reinforcement learning as the primary implementation path
- cheat by reading exact opponent hand, deck order, or facedown shield identity
- become a full research platform before the first strong CPU ships
- solve every future AI mode in the same milestone

## Scope

### In Scope

- a production `strong CPU` that runs in the TypeScript backend
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

- exact opponent hand contents
- exact opponent deck order
- exact facedown shield card identities

Production AI may use:

- public board state
- public trash/exile data
- counts of hand, deck, shield, energy
- previously revealed cards
- observed colors, factions, card families, and deck composition clues
- coarse probability or belief estimates over unseen cards

## Design

### Product Positioning

The first production target is a fair CPU opponent that feels strong because it reasons through legal actions and future states, not because it cheats with hidden information or relies on an external model.

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

- A written architecture and implementation plan exists for a fair production CPU.
- Every downstream spec assumes the AI uses the existing backend execution path.
- The hidden-information rules are unambiguous and consistent across all documents.
- The move-time budget and v1 scope boundaries are frozen.

## Risks

- If hidden-information rules are not enforced at the spec level, later search work will accidentally depend on server-only state.
- If v1 tries to include live Python or RL too early, delivery risk increases and benchmarking becomes unclear.
- If the spec prioritizes human-like behavior too early, strength and legality can regress.
