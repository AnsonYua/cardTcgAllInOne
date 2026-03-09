# Python Offline Tooling Plan

## Purpose

This document defines the role of Python in the AI program without allowing Python to become the live production decision path for v1.

## Requirements

Python is permitted only for offline or batch responsibilities in the initial roadmap.

## Design

## Allowed Python Responsibilities

- batch self-play orchestration
- replay analysis
- evaluator weight search
- telemetry aggregation
- dataset export and transformation
- benchmark report generation
- offline model experiments

These uses are valuable because Python has a rich ecosystem for data analysis and experimentation, but they do not need to sit in the live match loop.

## Prohibited V1 Python Responsibilities

- real-time live move choice in production matches
- duplicated rule engine implementation
- direct mutation of authoritative game state files without validation
- bypassing the TypeScript execution path for live gameplay

## Interface Requirements

Offline tooling should consume exports from the backend, not raw ad hoc scraping.

### Replay Export Format

Must capture:

- initial state snapshot
- ordered action trace
- resulting states or state hashes
- winner and termination reason
- metadata such as difficulty and seed

### State Snapshot Format

Must support:

- fair-mode player-visible snapshot
- optional oracle snapshot for benchmark or debug experiments
- clear mode labeling so fair and oracle data are never mixed accidentally

### Action Trace Format

Must capture:

- action kind
- payload
- acting player
- timestamps or ordering index
- search metadata when available

### Benchmark Result Format

Must capture:

- matchup identity
- game count
- win rate
- latency summaries
- fallback rate
- legality failures
- notes on mode and config

## Acceptance Criteria

- Python's role is explicitly offline-only for v1.
- Export formats are defined well enough to support later tooling.
- The document prevents accidental drift into a live Python sidecar without a separate architecture decision.

## Risks

- If Python exports are not standardized, later offline analysis will become fragmented and untrustworthy.
- If Python begins to own live decisioning informally, the system will split across two runtimes without a clear contract.
