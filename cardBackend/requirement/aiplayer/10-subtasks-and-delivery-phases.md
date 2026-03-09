# Subtasks And Delivery Phases

## Purpose

This document breaks the AI player program into execution-ready phases. Each phase is defined by objective, inputs, outputs, dependencies, risks, acceptance criteria, and definition of done.

## Design

## Phase 0: Requirement Lock

### Objective

Freeze terminology, scope, fairness policy, and v1 architecture.

### Required Inputs

- current backend AI structure
- rule constraints
- this requirement set

### Outputs

- finalized requirement documents
- frozen difficulty-tier policy
- frozen hidden-information policy

### Dependencies

- none

### Risks

- architecture drift before implementation starts

### Acceptance Criteria

- all documents in `requirement/aiplayer` exist
- production path is unambiguous
- fairness rules are explicit

### Definition Of Done

- no unresolved architecture ambiguity blocks Phase 1

## Phase 1: Simulation Foundation

### Objective

Define and implement a pure in-memory simulation contract.

### Required Inputs

- current `GameEnvironment` serialization and reconstruction path
- authoritative execution path

### Outputs

- clone contract
- simulation API
- simulation trace schema
- equivalence test policy

### Dependencies

- Phase 0

### Risks

- simulation drift from real execution
- accidental file persistence during simulation

### Acceptance Criteria

- simulated actions can run without touching persisted game files
- equivalence expectations are documented and testable

### Definition Of Done

- simulation contract is stable enough for search work

## Phase 2: Legal Action Enumeration

### Objective

Define every AI-owned action type and its payload contract.

### Required Inputs

- current AI decision kinds
- controller and execution payload shapes
- timing-window rules

### Outputs

- action class inventory
- payload schemas
- candidate metadata for pruning
- choice-ownership rules

### Dependencies

- Phase 1

### Risks

- missing action families
- payload mismatch with real execution

### Acceptance Criteria

- all AI-owned action families are represented
- candidate actions are serializable and executable

### Definition Of Done

- enumeration can feed search without inventing new payload formats

## Phase 3: Evaluator Foundation

### Objective

Define the board evaluator and its scoring breakdown.

### Required Inputs

- simulated state output
- tactical priorities
- hidden-information policy

### Outputs

- feature definitions
- score bands
- breakdown schema
- deterministic debug mode policy

### Dependencies

- Phase 2

### Risks

- wrong score hierarchy
- overfitting to simple board stats

### Acceptance Criteria

- evaluator formula and score hierarchy are documented
- risk and uncertainty handling are explicit

### Definition Of Done

- evaluator can rank simulated states in a way that engineering can implement directly

## Phase 4: Bounded Search

### Objective

Define the bounded search loop and fallback behavior.

### Required Inputs

- enumerated legal candidates
- simulation API
- evaluator

### Outputs

- search loop definition
- candidate pruning rules
- budget handling policy
- fallback ordering

### Dependencies

- Phase 3

### Risks

- latency spikes
- pruning removes critical tactical lines

### Acceptance Criteria

- each difficulty tier has a documented search budget
- fallback order is deterministic and safe

### Definition Of Done

- the production AI search path for the CPU opponent is fully specified

## Phase 5: Benchmark And Telemetry

### Objective

Define how to measure strength, latency, legality, and stability.

### Required Inputs

- search outputs
- evaluator outputs
- game replay capability

### Outputs

- metric catalog
- scenario suites
- matchup benchmark plan
- telemetry field list

### Dependencies

- Phase 4

### Risks

- subjective success criteria
- weak regression visibility

### Acceptance Criteria

- measurable strength and stability targets exist
- telemetry can explain search and evaluator choices

### Definition Of Done

- the team can compare versions of the AI objectively

## Phase 6: Offline Python Tooling

### Objective

Support offline analysis and experimentation without changing the live architecture.

### Required Inputs

- replay exports
- telemetry exports
- benchmark outputs

### Outputs

- export schemas
- Python analysis job definitions
- tooling boundaries

### Dependencies

- Phase 5

### Risks

- tooling drift into live runtime responsibilities

### Acceptance Criteria

- Python responsibilities are useful and bounded
- production decisioning still belongs to the TypeScript backend

### Definition Of Done

- offline analysis can proceed without architecture ambiguity

## Phase 7: Future Research Gate

### Objective

Decide whether learned priors, imitation, or RL are justified after the baseline matures.

### Required Inputs

- stable search baseline
- benchmark history
- replay datasets

### Outputs

- go or no-go decision for imitation/value model/RL work

### Dependencies

- Phase 6

### Risks

- research expansion before baseline maturity

### Acceptance Criteria

- stop/go gates are evaluated using benchmark evidence

### Definition Of Done

- future learning work is either justified by data or explicitly deferred

## Acceptance Criteria

- Phases cover the full path from requirements to future research gating.
- Each phase has concrete outputs and completion conditions.
- The phase breakdown is detailed enough to convert into implementation tickets later.

## Risks

- If the phase order changes without reason, later work can build on unstable contracts.
- If a phase is marked complete before its outputs are benchmarkable, downstream work will be built on weak assumptions.
