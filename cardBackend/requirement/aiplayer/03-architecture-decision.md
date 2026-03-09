# Architecture Decision

## Purpose

Record the architecture options considered for the AI player and the chosen production path for v1.

## Decision Criteria

The v1 architecture should optimize for:

- legality correctness
- fit with the current backend
- low operational complexity
- near-term delivery value
- debuggability and benchmarkability

## Options Considered

### Option A: Extend The Heuristic Bot

Summary:
- Keep improving the current heuristic bot without adding simulation or bounded search.

Pros:
- lowest implementation cost
- fastest short-term iteration
- direct compatibility with current AI files

Cons:
- limited tactical ceiling
- brittle as the card pool grows
- poor fit for multi-step timing and line planning

Assessment:
- good emergency fallback path
- not strong enough as the main long-term production direction

### Option B: TypeScript Search AI In Backend

Summary:
- Keep live AI inside the backend and add legal action enumeration, in-memory simulation, board evaluation, and bounded search.

Pros:
- best fit with the current architecture
- legality stays anchored to one authoritative rules path
- easy to benchmark against the current heuristic bot
- compatible with current autoplay and hidden-info player views
- supports deterministic debugging and safe fallback

Cons:
- more engineering work than heuristics only
- requires careful control of simulation cost and search breadth
- hidden-information handling must be explicit

Assessment:
- best balance of delivery speed, strength ceiling, and operational simplicity

### Option C: Python Sidecar For Live Decisioning

Summary:
- Keep the engine in TypeScript but ask a Python process or service to choose moves during live matches.

Pros:
- convenient for analysis and ML experimentation
- separates research code from production code

Cons:
- adds runtime communication and deployment complexity
- creates schema drift risk between engine and chooser
- makes legality mapping and debugging harder

Assessment:
- useful for offline tooling later
- unnecessary complexity for the first production bot

### Option D: Online LLM Or Agent

Summary:
- Use live model calls as the main move chooser.

Pros:
- flexible reasoning
- potentially useful for offline explanation or analysis tools

Cons:
- poor determinism
- high latency and cost
- weak legality guarantees
- poor fit for a rules-heavy event engine

Assessment:
- not suitable for the v1 production path

### Option E: RL-First System

Summary:
- Build the first strong CPU opponent around self-play RL from the start.

Pros:
- long-term upside if the simulator and data pipeline are mature
- may eventually surpass hand-tuned heuristics

Cons:
- depends on stable simulation, encoding, and benchmarks first
- expensive to build and hard to debug early
- slower route to a reliable production opponent

Assessment:
- viable only after the search baseline is proven
- wrong starting point for v1

## Chosen Architecture

The v1 production path is `TypeScript search AI in backend`.

That means:

- enumerate legal actions from the current backend state
- simulate candidate lines in memory through the authoritative engine path
- score resulting states with a board evaluator
- run bounded search inside strict time limits
- fall back to safe legal heuristics when search fails or times out

Supporting decisions:

- keep the existing heuristic bot as the fallback and baseline
- keep live decisioning in the TypeScript backend
- keep Python offline-only in v1
- defer RL until simulator fidelity, action encoding, and benchmark maturity are proven

## Why This Choice Wins

- It preserves legality by reusing the current engine path.
- It fits the existing repository and avoids cross-runtime drift.
- It can be shipped incrementally and benchmarked against the current bot.
- It leaves room for offline tooling and later learned components without committing to them too early.

## Acceptance Criteria

- one clear production architecture is selected
- rejected options are documented with concrete reasons
- the document explains why live Python, online-model decisioning, and RL-first are not v1 choices

## Risks

- search latency can spike if candidate generation is too broad
- hidden-information mistakes can still create accidental cheating if view boundaries are weak
- offline research can distract from production delivery if not gated by benchmarks
