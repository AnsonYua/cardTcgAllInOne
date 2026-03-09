# Python Offline Tooling Plan

## Purpose

Define where Python is useful in this program without allowing it to become the live production decision path for v1.

## Policy

Python is allowed only for offline, batch, or research workflows in the initial roadmap.

## Allowed Responsibilities

- batch self-play orchestration
- replay analysis
- evaluator weight search
- telemetry aggregation
- dataset export and transformation
- benchmark report generation
- offline model experiments

These jobs benefit from Python's data and analysis ecosystem, but none of them need to sit inside the live match loop.

## Prohibited Responsibilities In V1

- real-time move choice in production matches
- a duplicated rule engine
- direct mutation of authoritative game state files without validation
- bypassing the TypeScript execution path for live gameplay

## Data Contracts

Offline tooling should consume structured exports from the backend, not ad hoc scraping.

### Replay Export

Must include:

- initial state snapshot
- ordered action trace
- resulting states or state hashes
- winner and termination reason
- metadata such as difficulty and seed

### State Snapshot

Must support:

- fair-mode player-visible snapshots
- optional oracle snapshots for benchmark or debug experiments
- explicit mode labels so fair and oracle data are never mixed accidentally

### Action Trace

Must include:

- action kind
- payload
- acting player
- timestamps or an ordering index
- search metadata when available

### Benchmark Result

Must include:

- matchup identity
- game count
- win rate
- latency summaries
- fallback rate
- legality failures
- notes on mode and config

## Acceptance Criteria

- Python is clearly limited to offline use in v1
- backend export formats are defined well enough for later tooling
- the document blocks accidental drift into a live Python sidecar without a new architecture decision

## Risks

- weak export contracts will fragment later analysis work
- informal live Python decisioning will split the system across runtimes without a clear boundary
