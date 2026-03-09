# Subtasks And Delivery Phases

## Purpose

Turn the requirement set into an execution sequence with clear outputs, dependencies, and completion criteria.

## Delivery Principles

- lock contracts before optimization
- keep legality and simulation fidelity ahead of search sophistication
- benchmark each major step before moving deeper into research work
- treat fallback behavior as part of the production design, not a last-minute patch

## Phase 0: Requirement Lock

Objective:
- freeze terminology, scope, fairness policy, and the v1 architecture

Inputs:
- current backend AI structure
- rule constraints
- this requirement set

Outputs:
- finalized requirement documents
- frozen difficulty-tier policy
- frozen hidden-information policy

Done when:
- the production path is unambiguous
- fairness rules are explicit
- no architecture ambiguity blocks implementation

## Phase 1: Simulation Foundation

Objective:
- define and implement a pure in-memory simulation contract

Inputs:
- current `GameEnvironment` serialization and reconstruction path
- authoritative execution path

Outputs:
- clone contract
- simulation API
- simulation trace schema
- equivalence test policy

Done when:
- simulated actions run without touching persisted game files
- equivalence expectations are documented and testable
- the simulation contract is stable enough for search work

## Phase 2: Legal Action Enumeration

Objective:
- define every AI-owned action type and its payload contract

Inputs:
- current AI decision kinds
- controller and execution payload shapes
- timing-window rules

Outputs:
- action family inventory
- payload schemas
- candidate metadata for pruning
- choice-ownership rules

Done when:
- all AI-owned action families are represented
- candidate actions are serializable and executable
- search can consume enumeration output without inventing new payload formats

## Phase 3: Evaluator Foundation

Objective:
- define the board evaluator and its scoring breakdown

Inputs:
- simulated state output
- tactical priorities
- hidden-information policy

Outputs:
- feature definitions
- score bands
- breakdown schema
- deterministic debug mode policy

Done when:
- evaluator formulas and score hierarchy are documented
- uncertainty handling is explicit
- engineering can implement the evaluator directly from the spec

## Phase 4: Bounded Search

Objective:
- define the bounded search loop and fallback behavior

Inputs:
- enumerated legal candidates
- simulation API
- evaluator

Outputs:
- search loop definition
- pruning rules
- budget handling policy
- fallback ordering

Done when:
- each difficulty tier has a documented search budget
- fallback order is deterministic and safe
- the production AI search path is fully specified

## Phase 5: Benchmark And Telemetry

Objective:
- define how to measure strength, latency, legality, and stability

Inputs:
- search outputs
- evaluator outputs
- replay capability

Outputs:
- metric catalog
- scenario suites
- matchup benchmark plan
- telemetry field list

Done when:
- success criteria are measurable
- telemetry is sufficient to explain search and evaluator behavior
- the team can compare versions of the AI objectively

## Phase 6: Offline Python Tooling

Objective:
- support offline analysis and experimentation without changing the live architecture

Inputs:
- replay exports
- telemetry exports
- benchmark outputs

Outputs:
- export schemas
- Python analysis job definitions
- tooling boundaries

Done when:
- Python responsibilities are useful and bounded
- production decisioning still belongs to the TypeScript backend
- offline analysis can proceed without architecture ambiguity

## Phase 7: Future Research Gate

Objective:
- decide whether learned priors, imitation, or RL are justified after the baseline matures

Inputs:
- stable search baseline
- benchmark history
- replay datasets

Outputs:
- a go or no-go decision for imitation, value-model, or RL work

Done when:
- stop/go gates are evaluated using benchmark evidence
- future learning work is either justified by data or explicitly deferred

## Cross-Phase Risks

- changing phase order without reason can put later work on unstable contracts
- marking a phase complete before its outputs are testable will weaken downstream work
- expanding research before benchmark maturity will blur the production path
