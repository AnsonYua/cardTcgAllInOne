# Open Questions And Assumptions

## Purpose

Capture the remaining product decisions and the defaults already locked so implementation can proceed without pretending every question is settled.

## Open Questions

### Product

- Which deck sets must the first release support?
- Should the first release support all implemented cards or a smaller launch pool?
- Which difficulty tiers must ship first: one strong default tier, or `easy/normal/hard` together?
- Should the AI optimize strictly for win rate, or also preserve some human-like play style?
- Is AI-vs-AI simulation for balance testing a launch deliverable or a later bonus?

### Runtime

- What server hardware defines the latency target?
- How much background CPU load is acceptable while autoplay and polling are active?
- How much determinization sampling is acceptable before move time becomes too visible?

### Quality

- What win-rate improvement over the current heuristic bot counts as success?
- Which benchmark suites are mandatory before rollout?
- Which telemetry fields are required in production logs versus debug-only logs?

## Locked Assumptions

- language: English
- live architecture: TypeScript backend
- first shipping target: one solid fair CPU opponent
- preferred move budget: `2-3s`
- hard cap: `5s`
- production AI does not use exact hidden-card identities unless they were legally revealed and remain valid
- Python is offline-only in v1
- RL stays deferred until simulation, action encoding, and benchmarks are mature

## Default Policies

- fairness default: `fair_cpu`
- release default: if only one tier ships first, it should be roughly `normal` or `normal/hard`, not a weak demo bot
- research default: no learning-based work before the search baseline is stable and benchmarked

## Acceptance Criteria

- unknowns are explicit instead of hidden in implementation guesses
- the current defaults are strong enough to start engineering work
- future product decisions can refine the plan without replacing the architecture

## Risks

- unresolved product choices may get hardcoded accidentally
- undocumented assumptions will make later rollout and benchmark debates harder
