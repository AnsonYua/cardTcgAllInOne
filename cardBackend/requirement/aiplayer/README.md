# AI Player Program Requirements

## Purpose

This directory defines the full requirement set for the card game AI player program. It is intended to be a handoff-quality specification for engineering work, not a loose research note or brainstorming dump.

The primary outcome is the first production-ready `CPU opponent` for the game. Its decision-making logic runs inside the existing TypeScript backend, follows the same legality rules as a human player, and handles hidden information fairly. The longer-term roadmap covers offline Python tooling and later learning-based work, but those are explicitly downstream of the baseline production AI.

## Current Repo Reality

The backend already contains a working AI/autoplay foundation:

- hidden-information player view generation
- heuristic AI decision code
- AI autoplay coordination
- normal game execution through the existing engine and controller flow

Relevant existing files include:

- `src/services/ai/GameAiService.ts`
- `src/services/ai/AiAutoplayCoordinator.ts`
- `src/services/ai/AiDecisionExecutor.ts`
- `src/services/views/GameEnvViewBuilder.ts`

This means the project does not need a brand new AI runtime. It needs a stronger planning layer on top of the current backend architecture.

## Locked Architecture Stance

The requirement set in this folder is based on these decisions:

- live gameplay AI stays inside the TypeScript backend
- v1 is a fair `CPU opponent`, not an oracle and not an online LLM move chooser
- production AI must not know the exact cards in the opponent's hand. It must also treat the exact order of cards in either player's main deck and the exact identities of facedown shield cards on either side as unknown by default, unless that information was legally revealed or explicitly established by a game effect and has not since been invalidated by shuffling or other randomization
- v1 strength comes from `legal action enumeration + simulation + board evaluator + bounded search`
- Python is reserved for offline tooling and analysis later
- reinforcement learning is deferred until the simulator, action encoding, telemetry, and benchmark stack are mature

## Target End State

The target system should provide:

- a fair CPU opponent suitable for real matches
- deterministic and debuggable execution
- multiple difficulty tiers without cheating
- a stable simulation/search baseline that later research can build on
- clear metrics for strength, latency, legality, and failure rate

## Naming Convention

Use these terms consistently across this folder:

- `AI player`
  - technical term for the decision-making system, architecture, search, evaluator, and simulation logic
- `CPU opponent`
  - player-facing term for the in-game computer-controlled opponent and its difficulty levels
- `heuristic bot`
  - the current simpler rules-based baseline
- `production AI`
  - the live backend decision system behind the CPU opponent

## Reading Order

1. [01-goals-and-scope.md](./01-goals-and-scope.md)
2. [02-domain-definitions.md](./02-domain-definitions.md)
3. [03-architecture-decision.md](./03-architecture-decision.md)
4. [04-v1-strong-cpu-spec.md](./04-v1-strong-cpu-spec.md)
5. [05-search-and-evaluation-spec.md](./05-search-and-evaluation-spec.md)
6. [06-simulation-and-action-enumeration-spec.md](./06-simulation-and-action-enumeration-spec.md)
7. [07-telemetry-benchmark-and-test-plan.md](./07-telemetry-benchmark-and-test-plan.md)
8. [08-python-offline-tooling-plan.md](./08-python-offline-tooling-plan.md)
9. [09-future-rl-roadmap.md](./09-future-rl-roadmap.md)
10. [10-subtasks-and-delivery-phases.md](./10-subtasks-and-delivery-phases.md)
11. [11-open-questions-and-assumptions.md](./11-open-questions-and-assumptions.md)

## Document Map

| File | Purpose |
| --- | --- |
| `README.md` | Executive summary and navigation |
| `01-goals-and-scope.md` | Product goals, boundaries, and v1 expectations |
| `02-domain-definitions.md` | Shared terminology |
| `03-architecture-decision.md` | Option comparison and final architecture choice |
| `04-v1-strong-cpu-spec.md` | Production CPU opponent requirements |
| `05-search-and-evaluation-spec.md` | Search design and board evaluator details |
| `06-simulation-and-action-enumeration-spec.md` | Engine contracts for search and simulation |
| `07-telemetry-benchmark-and-test-plan.md` | Measurement, benchmarking, and validation |
| `08-python-offline-tooling-plan.md` | Offline Python responsibilities and interfaces |
| `09-future-rl-roadmap.md` | Post-baseline learning roadmap |
| `10-subtasks-and-delivery-phases.md` | Execution breakdown and delivery phases |
| `11-open-questions-and-assumptions.md` | Product unknowns and locked defaults |

## Global Rules Across All Documents

- The AI must act through the normal backend legality and execution path.
- The AI must not inspect exact hidden-card identities in production-hidden zones unless that information was legally revealed and is still valid.
- The AI may use public information, public counts, observed history, and inferred probabilities.
- The AI must be compatible with current autoplay and player-view flows.
- Advanced methods must degrade to safe legal heuristics on timeout or internal failure.
- Any future improvement must be benchmarked against the v1 search baseline.
