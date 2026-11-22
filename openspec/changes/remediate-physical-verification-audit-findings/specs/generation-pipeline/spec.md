# Spec Delta

## Purpose

Connects pending configuration to deterministic candidate generation, physical validation, formal verification, and publication through bounded asynchronous execution.

## ADDED Requirements

### Requirement: Generate executes the production candidate pipeline
The Generate action SHALL capture an immutable pending-configuration snapshot and run candidate generation, construction, physical validation, and formal verification before publishing a result.

#### Scenario: Valid candidate completes
- **WHEN** a candidate passes physical validation and formal verification
- **THEN** the application SHALL publish that candidate and its matching configuration and identity

#### Scenario: Candidate fails or is incomplete
- **WHEN** a candidate is physically invalid, formally unsolvable where solvability is required, or verification-incomplete
- **THEN** the application SHALL NOT present it as a successfully verified design

### Requirement: Candidate pipeline has one framework-independent entry point
Generation orchestration SHALL be implemented in one production pipeline entry point that is independent of React and is used by both the UI and integration tests.

#### Scenario: UI starts generation
- **WHEN** the user starts generation from the UI
- **THEN** the UI SHALL submit an immutable configuration snapshot to the shared candidate-pipeline entry point and SHALL NOT duplicate its orchestration

#### Scenario: Integration test runs generation
- **WHEN** an integration test exercises candidate generation
- **THEN** it SHALL invoke the same production entry point used by the UI

### Requirement: Worker completion order does not affect output
Candidate identity and selection SHALL derive from deterministic inputs and stable candidate order rather than worker scheduling or completion timing.

#### Scenario: Workers finish in a different order
- **WHEN** the same candidate set completes in different worker orders
- **THEN** candidate identities, eligible results, and deterministic selection SHALL be unchanged

### Requirement: Cancellation and stale revisions prevent publication
Cancelled or superseded generation jobs SHALL NOT publish results, and cancellation SHALL preserve the last completed design. Pending-configuration edit revisions SHALL be distinct from submitted generation-job revisions.

#### Scenario: Active generation is cancelled
- **WHEN** the user cancels an active generation or verification job
- **THEN** the job SHALL stop or become non-publishable, report an incomplete outcome, and preserve the last completed design

#### Scenario: Pending configuration changes after submission
- **WHEN** the user edits pending sidebar settings while a submitted job is running
- **THEN** the submitted job SHALL remain valid for its captured configuration snapshot and MAY publish that snapshot as the rendered configuration without overwriting the newer pending settings

#### Scenario: A newer generation request supersedes a job
- **WHEN** the user submits a new generation request while an earlier job is active
- **THEN** the earlier job SHALL become stale and SHALL NOT publish, even if its captured configuration is otherwise unchanged

#### Scenario: Explicit cancellation invalidates a job
- **WHEN** the user explicitly cancels a submitted job
- **THEN** its generation-job revision SHALL be invalidated and no late result from that job SHALL publish

### Requirement: Production progress reflects actual pipeline work
Progress updates SHALL be emitted by the active candidate pipeline stage and SHALL identify the active revision and measurable candidate work.

#### Scenario: Candidate stage advances
- **WHEN** work moves through generation, physical construction, validation, verification, or final publication
- **THEN** the reported stage and candidate counts SHALL reflect actual work and SHALL not be synthesized by UI-only state changes
