# Open Questions And Assumptions

## Purpose

This document captures unresolved product and delivery questions without blocking the overall architecture and requirement set.

## Open Questions

### Product Questions

- Which deck sets must the first release support?
- Is the first release expected to support all currently implemented cards or a limited release pool?
- Which difficulty tiers must ship first: `normal` only, or `easy/normal/hard` together?
- Should the AI optimize purely for win rate, or should it also preserve some human-like style goals?
- Is AI-vs-AI simulation for balance testing a first-class deliverable or a later bonus?

### Runtime Questions

- What server hardware should the production latency targets assume?
- What background CPU load is acceptable when autoplay and polling are active?
- How much determinization sampling is acceptable before latency becomes too visible?

### Quality Questions

- What minimum win rate improvement over the current heuristic bot qualifies as success?
- Which benchmark suites are mandatory before rollout?
- Which telemetry fields are required in production logs versus debug-only logs?

## Assumptions Locked Now

- language: English
- scope: full roadmap, with the v1 production CPU opponent as the center
- first shipping target: one solid `normal/hard` fair CPU opponent
- live architecture: TypeScript backend
- preferred move budget: `2-3s`
- acceptable hard cap: `5s`
- production AI does not know the exact cards in the opponent's hand, the exact order of cards in the opponent's main deck, or the exact identities of facedown shield cards
- Python is offline-only at first
- RL is deferred until simulation, action encoding, and benchmarks are mature

## Default Policies

### Fairness Default

Use `fair_cpu` as the default release mode.

### Difficulty Default

If only one difficulty ships first, it should be equivalent to `normal` or `normal/hard` quality, not a weak demo bot.

### Research Default

Do not start learning-based work until the search baseline is stable and benchmarked.

## Acceptance Criteria

- Unknowns are captured explicitly instead of remaining implicit assumptions.
- The current defaults are strong enough for implementation to proceed.
- Future changes can refine the AI program without replacing the chosen architecture.

## Risks

- If open questions are ignored instead of captured, implementation may hardcode accidental product decisions.
- If assumptions are not written down, later benchmark or rollout disputes will be harder to resolve.
