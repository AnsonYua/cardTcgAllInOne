# Computer Opponent Requirements

## Overview

This folder is the implementation plan for the next-generation computer opponent. The immediate goal is a production-ready `CPU opponent` that runs inside the current TypeScript backend, uses the normal game engine, and respects hidden information.

This is not a greenfield AI project. The backend already has:

- hidden-information player views
- heuristic AI decision code
- AI autoplay coordination
- normal game execution through the existing engine and controller flow

Relevant files:

- `src/services/ai/GameAiService.ts`
- `src/services/ai/AiAutoplayCoordinator.ts`
- `src/services/ai/AiDecisionExecutor.ts`
- `src/services/views/GameEnvViewBuilder.ts`

The plan in this folder builds on that foundation instead of replacing it.

## Locked Decisions

These decisions are assumed across the whole requirement set:

- live gameplay decision logic stays in the TypeScript backend
- v1 is a fair `CPU opponent`, not an oracle and not an online-model system
- v1 strength comes from legal action enumeration, in-memory simulation, board evaluation, and bounded search
- Python is offline-only in v1
- RL is explicitly deferred until the simulator, action encoding, and benchmark stack are mature

## Global Rules

- Production bot must act through the normal backend execution path.
- Production bot must not use exact hidden-card identities unless that information was legally revealed and is still valid.
- Production bot may use public information, observed history, revealed cards, public counts, and probability-based inference.
- The system must remain compatible with current autoplay and player-view flows.
- Advanced decision logic must degrade to safe legal fallback behavior on timeout or internal failure.

## Outcome For V1

The v1 release should deliver:

- a fair CPU opponent suitable for real matches
- deterministic debugging and replay-friendly diagnostics
- configurable difficulty tiers without cheating
- measurable progress against the current heuristic bot
- a clean baseline for future offline analysis and research

## Terminology

- `computer opponent` or `CPU opponent`: the player-facing in-game bot
- `decision logic`: the backend code that chooses legal actions for the computer opponent
- `heuristic bot`: the current simpler rules-based baseline
- `production bot`: the live backend computer-opponent logic used in normal matches

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
12. [12-computer-opponent-implementation-plan.md](./12-computer-opponent-implementation-plan.md)
13. [13-v1-computer-opponent-protocol.md](./13-v1-computer-opponent-protocol.md)

## Document Map

| File | Purpose |
| --- | --- |
| `README.md` | Executive summary and navigation |
| `01-goals-and-scope.md` | Product goals, boundaries, and release targets |
| `02-domain-definitions.md` | Shared terminology |
| `03-architecture-decision.md` | Architecture options and final v1 choice |
| `04-v1-strong-cpu-spec.md` | Functional and non-functional v1 requirements |
| `05-search-and-evaluation-spec.md` | Search design and evaluator behavior |
| `06-simulation-and-action-enumeration-spec.md` | Engine-facing contracts for search and simulation |
| `07-telemetry-benchmark-and-test-plan.md` | Measurement, benchmarking, and validation |
| `08-python-offline-tooling-plan.md` | Offline tooling boundaries and data contracts |
| `09-future-rl-roadmap.md` | Post-baseline learning roadmap |
| `10-subtasks-and-delivery-phases.md` | Delivery sequence and implementation phases |
| `11-open-questions-and-assumptions.md` | Open product questions and current defaults |
| `12-computer-opponent-implementation-plan.md` | Concrete plan for the first playable computer opponent |
| `13-v1-computer-opponent-protocol.md` | Runtime protocol and ordered subtasks for v1 implementation |
