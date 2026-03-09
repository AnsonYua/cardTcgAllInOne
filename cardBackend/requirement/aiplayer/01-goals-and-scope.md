# Goals And Scope

## Purpose

Define what the AI player project is trying to ship in v1, what is explicitly out of scope, and which user-facing constraints are fixed.

## Primary Goal

Build a fair, legal, and stable `CPU opponent` for real matches in this backend.

The v1 AI must:

- play through the existing backend game logic
- choose only legal actions
- resolve AI-owned choice events without human input
- finish games reliably
- outperform the current heuristic bot under fair-information constraints

## Secondary Goals

- support configurable difficulty tiers
- support deterministic debugging and replay analysis
- support later self-play for QA and benchmarking
- emit enough reasoning metadata for logs and diagnostics

## V1 Non-Goals

The first release does not aim to:

- use an online LLM or live external model to choose moves
- make RL the primary implementation path
- cheat by reading hidden information
- become a full research platform before the production bot is stable
- solve every future AI mode in the same milestone

## In Scope

- a production `CPU opponent` that runs in the TypeScript backend
- legal action enumeration
- in-memory simulation over cloned game states
- a board evaluator with risk and uncertainty handling
- bounded search within a move-time budget
- difficulty tiers implemented through budget and policy differences
- telemetry, benchmarks, and regression validation
- offline Python tooling design for later phases

## Out Of Scope For V1

- live Python decision services in production matches
- online model calls in the move-selection hot path
- full RL training infrastructure
- policy or value neural models in production
- human-like personality as a higher priority than strength, legality, or stability

## Release Targets

### Experience Targets

- preferred move time: `2-3s`
- hard cap: `5s`
- no illegal move submissions
- no queue deadlocks caused by AI decision flow
- no unresolved AI-owned choice loops
- stable operation under autoplay and frontend polling

### Fairness Targets

Production AI must treat the following as unknown unless legally revealed and still valid:

- the exact cards in the opponent's hand
- the exact order of cards in either main deck
- the exact identities of facedown shield cards on either side

Production AI may use:

- public board state
- public discard or exile information
- public counts such as hand size, deck count, shield count, and energy count
- previously revealed cards
- observed deck clues such as colors, factions, and card families
- coarse belief or probability estimates over unseen cards

## Operational Modes

- `fair_cpu`: production mode and the only player-facing release target
- `debug_oracle`: internal mode for debugging and upper-bound studies
- `benchmark_selfplay`: controlled benchmark mode for fair-vs-fair or fair-vs-oracle experiments

## Acceptance Criteria

- v1 scope is clear enough to guide implementation without re-opening architecture decisions
- fairness rules are explicit and consistent with the rest of the document set
- latency targets and release boundaries are fixed

## Risks

- unclear fairness rules will leak hidden server state into search or evaluation
- expanding v1 toward Python sidecars or RL will increase delivery risk
- optimizing for style before strength and legality will weaken the first release
