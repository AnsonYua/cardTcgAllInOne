# Architecture Decision

## Purpose

This document records the architecture options considered for the AI player program and the final decision selected for implementation.

## Requirements

The architecture choice must optimize for:

- legality correctness
- integration fit with the current backend
- low operational complexity
- strong near-term delivery value
- ability to benchmark and debug

## Design

### Option A: Heuristics Only

Description:
- Keep extending the current heuristic bot without adding simulation or bounded search.

Strengths:
- lowest implementation complexity
- fastest incremental changes
- directly compatible with current AI files

Weaknesses:
- tactical ceiling is limited
- difficult to capture complex timing and line planning
- strength degrades as card pool complexity grows

Fit With Current Repo:
- strong

Legality Risk:
- low if it uses existing execution paths

Latency Risk:
- very low

Operational Cost:
- low

Debugging Cost:
- moderate, because heuristics become brittle and ad hoc over time

Expected Time-To-Value:
- fast short-term, poor long-term payoff

### Option B: TypeScript Search AI In Backend

Description:
- Keep live AI inside the backend and add legal action enumeration, in-memory simulation, board evaluation, and bounded search.

Strengths:
- highest fit with current architecture
- authoritative legality stays in one codebase
- easy to benchmark against current heuristic AI
- compatible with current autoplay and hidden-info player view
- supports graceful fallback and deterministic debugging

Weaknesses:
- more engineering work than heuristics-only
- search and simulation performance need careful control
- hidden-information handling requires explicit belief-state design

Fit With Current Repo:
- highest

Legality Risk:
- low, because it can reuse the current engine path

Latency Risk:
- moderate but manageable with bounded budgets and pruning

Operational Cost:
- moderate

Debugging Cost:
- moderate, but structured and tractable

Expected Time-To-Value:
- strong balance of short-term delivery and long-term value

### Option C: Python Sidecar For Live Decisioning

Description:
- Keep the engine in TypeScript, but ask a Python process or service to choose moves during live matches.

Strengths:
- easier access to analysis and ML libraries
- can separate research code from production engine code

Weaknesses:
- adds inter-process or service communication
- creates duplicated integration logic
- increases deployment and debugging complexity
- risks schema drift between the engine and the decision service

Fit With Current Repo:
- medium

Legality Risk:
- medium, because candidate generation and payload mapping can drift

Latency Risk:
- medium to high

Operational Cost:
- medium to high

Debugging Cost:
- high

Expected Time-To-Value:
- worse than in-backend search for the first production CPU

### Option D: Online LLM Or Agent

Description:
- Use a live model call as the main move chooser.

Strengths:
- flexible language-driven reasoning
- useful for explanations or offline analysis

Weaknesses:
- poor determinism
- high latency and cost
- hard to guarantee legality
- weak fit for a rule-heavy event engine

Fit With Current Repo:
- low

Legality Risk:
- high

Latency Risk:
- high

Operational Cost:
- high

Debugging Cost:
- high

Expected Time-To-Value:
- poor for the production CPU goal

### Option E: RL-First System

Description:
- Build the first strong CPU around self-play reinforcement learning from the start.

Strengths:
- long-term upside if the simulator and action encoding are mature
- can eventually improve beyond hand-tuned heuristics

Weaknesses:
- requires stable simulator, action encoding, datasets, and benchmark loops first
- large infrastructure cost
- hard to interpret and debug early
- likely slower to first shippable CPU

Fit With Current Repo:
- low for v1, higher only after groundwork exists

Legality Risk:
- medium, depending on action masking quality

Latency Risk:
- variable

Operational Cost:
- high

Debugging Cost:
- very high

Expected Time-To-Value:
- poor for v1

## Decision

Choose `TypeScript search AI in backend` for the production path.

The chosen v1 architecture is:

- legal action enumeration from the current backend state
- in-memory simulation using the authoritative engine path
- board evaluator that scores resulting states
- bounded search under strict time limits
- fallback to current-style legal heuristics when search fails or times out

Supporting decisions:

- keep the existing heuristic bot as fallback and baseline
- keep live decisioning inside the TypeScript backend
- allow Python only for offline analysis and tooling later
- defer RL until after simulator fidelity, action encoding, and benchmark maturity are proven

## Acceptance Criteria

- There is a single clear production-path decision.
- Rejected alternatives are documented with concrete reasons.
- The decision explains why live Python, online LLMs, and RL-first are not v1 choices.

## Risks

- Search performance may become difficult if candidate enumeration is too broad.
- Without strict hidden-information rules, the in-backend search path could accidentally cheat.
- Without benchmark discipline, later offline experiments may distract from production progress.
