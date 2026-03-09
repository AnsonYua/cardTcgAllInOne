# Domain Definitions

## Purpose

This document defines the vocabulary used throughout the AI player requirement set. These terms should be used consistently in design docs, code comments, telemetry, and benchmark reports.

## Requirements

The following definitions are normative for this AI program.

## Definitions

### Core AI Terms

- `strong CPU`
  - A production AI opponent that plays legally, finishes games reliably, and materially outperforms the current heuristic bot under fair information constraints.
- `legal action`
  - An action that the current game state, rules, timing window, and engine validators would accept if submitted through the normal backend flow.
- `candidate action`
  - A legal action considered by the AI during selection, usually enriched with metadata used for pruning, simulation, and ranking.
- `simulation`
  - Executing a candidate action against an in-memory cloned game state using the same authoritative rule path as real gameplay.
- `simulation fidelity`
  - The degree to which a simulated result matches real execution for the same starting state and action, ignoring only approved non-semantic fields.
- `determinization`
  - Sampling one plausible fully specified hidden-information world from the set of states consistent with the public information.
- `belief state`
  - A structured representation of what hidden cards are still plausible, with optional coarse probabilities or risk tags.
- `evaluation function`
  - A scoring function that converts a simulated state into a scalar score plus a structured breakdown.
- `rollout policy`
  - A cheaper default action-selection policy used when search depth is capped or when continuation requires fast approximations.
- `principal variation`
  - The best action sequence found by the search procedure within its budget.
- `search budget`
  - The maximum time, nodes, determinizations, or depth allowed for one decision.
- `difficulty tier`
  - A configuration profile that changes search depth, pruning aggressiveness, and evaluation sophistication without cheating.
- `production AI`
  - The user-facing fair CPU opponent used in normal gameplay.
- `research tooling`
  - Non-production tools used for analysis, self-play, telemetry processing, or experimental model work.

### Game-AI Concepts

- `tactical line`
  - A short sequence of actions whose value comes from immediate consequences such as lethal, removal, blocker denial, or protecting against lethal.
- `tempo`
  - Short-term initiative measured by the ability to apply pressure, deploy threats, gain action value, or force opponent responses before long-term card advantage matters more.
- `board control`
  - Advantage in current battlefield influence, including ready attackers, blockers, paired strength, durable threats, and denial of opponent combat options.
- `shield race`
  - A game state where relative speed toward breaking shields or base defense matters more than incremental resource gain.
- `crackback risk`
  - The risk of becoming vulnerable to a strong opposing attack sequence on the opponent's next turn or next action window.
- `burst exposure`
  - The likelihood that a line is weak against plausible facedown shield burst outcomes.
- `overextension`
  - Committing too many resources to the current line such that common opposing responses create a large negative swing.
- `lethal line`
  - A line that leads to immediate game win or to a forced win sequence if the opponent has no adequate answer.
- `forced response`
  - A situation where the opponent must answer a specific threat or lose substantial value, often immediate lethal or near-lethal pressure.

### Execution Terms

- `tactical override`
  - A hard-priority rule that short-circuits normal scoring, such as immediate lethal, required defense against immediate loss, or mandatory choice resolution.
- `pruning`
  - Removing low-value, redundant, or dominated candidate actions before deeper simulation.
- `fallback mode`
  - A safe policy used when search or enumeration fails, usually a simpler heuristic chooser that still respects legality.
- `deterministic mode`
  - A debugging mode where random seeds, candidate ordering, and sampling are fixed for reproducibility.
- `equivalence test`
  - A test that checks simulated execution and real execution produce the same meaningful outcome.

## Design

### Terminology Policy

- Use `fair` to mean hidden information is respected.
- Use `oracle` only for explicit debug or analysis modes.
- Use `strong CPU` to refer to the production target, not to any one algorithm.
- Use `search` to mean bounded lookahead over legal actions; do not use it as a synonym for simple heuristics.

## Acceptance Criteria

- All downstream documents can reference these terms without re-defining them inconsistently.
- Hidden-information and simulation terminology is explicit enough for engineering and test work.
- The difference between production AI and research tooling is unambiguous.

## Risks

- If `legal action` and `candidate action` are conflated, later enumeration and pruning code will become inconsistent.
- If `fair_cpu` and `oracle` are not clearly separated, benchmark results will be misleading.
