# Future RL Roadmap

## Purpose

Preserve the long-term RL option without letting it distort the v1 production plan.

## Rule

Do not start RL work until the baseline simulator, action encoding, and benchmark stack are mature enough to support it responsibly.

## Preconditions

All of the following should exist before RL starts:

- pure in-memory simulation
- stable legal action encoding
- reproducible self-play
- benchmark harness
- evaluator baseline
- replay and telemetry exports
- difficulty-tier baseline for comparison

If any of these are missing, RL work is premature.

## Staged Roadmap

### Stage A: Imitation Learning From Search Traces

Goal:
- train a model to imitate strong search-generated decisions

Expected value:
- faster policy approximation
- better candidate ordering priors

### Stage B: Value Model For Ranking And Pruning

Goal:
- use a learned value model to improve search ordering or reduce simulation load

Expected value:
- stronger pruning
- better mid-search evaluation

### Stage C: Policy Prior For Search

Goal:
- guide search expansion toward stronger candidate branches

Expected value:
- more efficient use of the same latency budget

### Stage D: Self-Play RL

Goal:
- improve beyond the search or imitation baseline when justified

Expected value:
- long-term strategic improvement in a stable environment

## Stop And Go Gates

Do not start RL if:

- the search baseline still has obvious untapped gains
- action encoding is unstable
- simulator fidelity is unproven
- benchmarks are not reproducible
- telemetry cannot explain regressions

Proceed only if:

- the v1 search-based CPU opponent is stable and benchmarked
- action interfaces are stable enough for dataset reuse
- offline evaluation shows likely value from a learned prior or value model

## Acceptance Criteria

- RL is clearly separated from the v1 production path
- prerequisites and stop/go gates are explicit
- the roadmap keeps learning work in a practical order

## Risks

- RL started too early will hide simulator flaws instead of solving them
- unstable action encoding will make training data disposable
- a weak baseline will make RL progress impossible to measure honestly
