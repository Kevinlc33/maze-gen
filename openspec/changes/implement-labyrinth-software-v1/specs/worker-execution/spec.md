# Spec Delta

## Purpose

Defines responsive, bounded background execution and accurate job lifecycle behavior for generation and verification work.

## ADDED Requirements

### Requirement: Expensive work runs asynchronously
Generation, physical validation, optimization, and long verification SHALL execute off the main thread where necessary.

#### Scenario: Generation starts
- **WHEN** a generation or reconstruction job begins
- **THEN** the interface SHALL remain usable and SHALL receive structured stage progress

### Requirement: Worker pool is bounded
The application SHALL use a conservative fixed or resource-aware worker pool and SHALL avoid transferring unnecessary candidate data.

#### Scenario: Candidate count exceeds worker capacity
- **WHEN** optimization has more candidates than available worker slots
- **THEN** candidates SHALL execute in bounded queued work without affecting deterministic selection

### Requirement: Progress is accurate
Progress reporting SHALL identify the active stage and SHALL distinguish measurable percentages from indeterminate work.

#### Scenario: Candidate progress is known
- **WHEN** a candidate budget or completed candidate count is measurable
- **THEN** the interface SHALL report actual candidate or stage counts rather than elapsed time

### Requirement: Cancellation preserves completed state
Cancellation SHALL stop queued and active work safely and SHALL preserve the last completed rendered design.

#### Scenario: Cancellation occurs during verification
- **WHEN** the user cancels a verification job
- **THEN** no false Solvable or Unsolvable result SHALL be presented

### Requirement: Stale jobs cannot publish results
Every job SHALL have a stable identifier and revision association.

#### Scenario: A newer job supersedes an older job
- **WHEN** a newer submitted generation job explicitly supersedes an older job before the older result is published
- **THEN** the application SHALL discard the superseded result

#### Scenario: Pending configuration changes after submission
- **WHEN** the user edits pending configuration while a job is running from its immutable submitted configuration snapshot
- **THEN** that edit alone SHALL NOT invalidate the submitted job or prevent its result from publishing

#### Scenario: A job is explicitly invalidated
- **WHEN** the user cancels a job or another documented invalidation event occurs
- **THEN** the application SHALL stop or reject that job's result according to the event and SHALL report the corresponding outcome

### Requirement: Resource exhaustion is explicit
The application SHALL report technical resource limits or worker failures without silently relaxing constraints.

#### Scenario: Work cannot be completed
- **WHEN** resource limits or worker failure prevent a conclusive result
- **THEN** the interface SHALL show an actionable incomplete or failure state

### Requirement: Resource safeguards are explicit
The application SHALL apply documented technical safeguards for dimensions, wall counts, payload sizes, and verification state without imposing an arbitrary product-level maze size limit.

#### Scenario: Technical limit is reached
- **WHEN** a technical safeguard prevents completion
- **THEN** the interface SHALL report the limit and SHALL not silently relax mandatory geometry or progression constraints

### Requirement: Worker availability and worker failure
The application SHALL handle unavailable, failed, or repeatedly crashing workers without corrupting project state.

#### Scenario: Worker pool fails
- **WHEN** generation cannot continue in workers
- **THEN** the application SHALL provide an actionable failure state and SHALL preserve the last completed design

### Requirement: Deterministic worker scheduling
Candidate evaluation SHALL use deterministic inputs and SHALL not let worker completion order affect ranking.

#### Scenario: Workers finish out of order
- **WHEN** identical candidates are evaluated by workers with different completion timing
- **THEN** candidate seeds and ranking SHALL remain unchanged

### Requirement: Processing stage reporting
The interface SHALL distinguish candidate generation, topology screening, physical construction, geometry validation, solvability verification, difficulty optimization, and final rendering.

#### Scenario: Stage changes
- **WHEN** processing advances from one stage to another
- **THEN** the displayed stage SHALL match the actual completed or active work

### Requirement: Progress integrity
Determinate percentages SHALL represent measurable completed work, while indeterminate progress SHALL be used when no reliable percentage exists.

#### Scenario: Candidate count is available
- **WHEN** an exact candidate or verification count is measurable
- **THEN** the interface SHALL show candidate counts and SHALL avoid elapsed-time estimates presented as completion percentages

### Requirement: Bounded incremental stage scheduling
The scheduler SHALL bound active workers and queued stage work, apply backpressure, and advance each candidate as soon as its preceding stage completes.

#### Scenario: A candidate finishes construction early
- **WHEN** a candidate's construction completes while other candidates are still constructing
- **THEN** physical validation SHALL start as capacity permits without a batch-wide wait

#### Scenario: Stage capacity is full
- **WHEN** all configured worker or stage-queue capacity is occupied
- **THEN** additional candidate work SHALL remain bounded and SHALL be scheduled as capacity becomes available

### Requirement: Completion-order-independent candidate publication
Candidate IDs, evaluated candidate set, ranking, and publication SHALL be determined by stable inputs and SHALL not depend on worker completion order.

#### Scenario: Completion order is permuted
- **WHEN** identical candidates finish in different worker orders
- **THEN** the same candidate results, selected candidate, and search outcome SHALL be published

#### Scenario: A partial search is published
- **WHEN** cancellation or resource limits stop work before the configured budget is complete
- **THEN** progress SHALL identify completed, active, and queued work and the outcome SHALL be explicitly incomplete
