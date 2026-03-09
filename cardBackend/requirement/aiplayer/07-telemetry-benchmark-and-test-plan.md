# Telemetry, Benchmark, And Test Plan

## Purpose

This document defines how the AI program will be measured, tested, and compared so that `strong CPU opponent` has a concrete meaning rather than a subjective one.

## Requirements

The AI program must be measurable across:

- strength
- legality
- latency
- stability
- hidden-information fairness
- regression safety

## Design

## Core Metrics

- `win_rate_by_matchup`
  - AI win rate against the current heuristic bot and future baselines
- `illegal_action_rate`
  - percentage of AI decisions rejected by the engine
- `fallback_rate`
  - percentage of moves that use heuristic fallback or emergency fallback
- `unresolved_choice_stall_rate`
  - percentage of games where AI-owned choices are not resolved correctly
- `nodes_explored`
  - average and percentile search nodes per decision
- `move_latency_ms`
  - average and percentile decision latency
- `determinization_disagreement_rate`
  - disagreement variance across sampled hidden-information worlds
- `game_completion_rate`
  - percentage of games that finish without AI-caused deadlock or failure
- `average_turn_length`
  - turn count and time trend across matchups

## Benchmark Categories

### AI vs Current Heuristic Bot

Purpose:
- establish whether the new CPU opponent actually improves strength

### AI Mirror Matches

Purpose:
- check stability, determinism behavior, and game completion under equal policy

### Curated Tactical Scenarios

Purpose:
- test whether the AI finds obvious tactical wins, defenses, and priority lines

### Hidden-Info Robustness Tests

Purpose:
- ensure production AI does not depend on illegal hidden-state access

### Stress And Performance Tests

Purpose:
- validate move-time budgets and bounded-search behavior under complex states

### Regression Replay Suites

Purpose:
- ensure past engine bugs and timing incidents remain handled correctly

## Scenario Suites

The benchmark plan must include scenario groups for:

- opening development
- pairing tempo spike
- shield race
- base defense
- burst-heavy board states
- must-remove enemy threat
- closeout lethal
- no-good-attack board
- action-step trick timing
- blocker redirection decisions

Each scenario should define:

- input state
- acting player
- expected safe action set
- expected preferred action or score ordering when applicable
- notes about hidden-information assumptions

## Telemetry Requirements

For each AI decision, telemetry should capture:

- game ID and turn number
- acting player ID
- difficulty tier
- elapsed time
- candidate count before pruning
- candidate count after pruning
- nodes explored
- whether fallback was used
- chosen action category
- top evaluation breakdown
- flags such as `hasImmediateLethal` or `facesImmediateLethal`

Telemetry must not leak hidden information into production-facing logs when running in fair mode.

## Validation Strategy

### Unit-Level Validation

- candidate enumeration legality
- evaluator component scoring
- equivalence of simulated and real execution

### Integration Validation

- complete AI turns through existing controller and autoplay flow
- AI-owned choice resolution
- timeout fallback behavior

### Benchmark Validation

- compare the new CPU opponent against the heuristic baseline under fixed deck matchups
- compare difficulty tiers under the same fairness rules

## Acceptance Criteria

- The AI program has defined metrics for strength, legality, latency, and stability.
- Benchmark suites include both tactical scenarios and whole-game matchups.
- Telemetry requirements are detailed enough to diagnose search and evaluator behavior.
- Hidden-information robustness is explicitly tested.

## Risks

- Without fixed benchmark suites, subjective impressions will replace measurable progress.
- Without telemetry breakdowns, evaluator and pruning mistakes will be difficult to diagnose.
- If regression replays are omitted, engine-rule edge cases may silently break AI behavior.
