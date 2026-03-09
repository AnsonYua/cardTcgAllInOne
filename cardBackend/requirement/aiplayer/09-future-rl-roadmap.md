# Future RL Roadmap

## Purpose

This document preserves the long-term option of reinforcement learning without letting it distort the v1 production plan.

## Requirements

RL must not begin until the baseline simulator and benchmark stack are mature enough to support it responsibly.

## Design

## Preconditions Before RL

All of the following must exist first:

- pure in-memory simulation path
- stable legal action encoding
- benchmark harness
- reproducible self-play loop
- evaluator baseline
- replay and telemetry dataset export
- difficulty-tier baseline for comparison

If any of these prerequisites are missing, RL work is premature.

## Staged Roadmap

### Stage A: Imitation Learning From Search Traces

Goal:
- train a model to imitate strong search-generated decisions

Expected value:
- faster policy approximation
- potential candidate ranking prior

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
- improve beyond the search-generated or imitation baseline when justified

Expected value:
- long-term strategic improvement if the environment is stable enough

## Stop/Go Gates

Do not start RL if:

- the search baseline still has obvious untapped strength
- action encoding is unstable
- simulator fidelity is not proven
- benchmarks are not reproducible
- telemetry does not explain regressions clearly

Proceed to RL only if:

- v1 search CPU is stable and benchmarked
- action interfaces are frozen enough for training data reuse
- offline evaluation shows likely value from a learned prior or value model

## Acceptance Criteria

- RL is clearly separated from the v1 production path.
- Preconditions and stop/go gates are explicit.
- The staged roadmap preserves a practical order of work.

## Risks

- RL started too early can hide simulator flaws instead of solving them.
- If action encoding changes constantly, training data becomes disposable.
- Without a strong baseline, RL progress cannot be measured honestly.
