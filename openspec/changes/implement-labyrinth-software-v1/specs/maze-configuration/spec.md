# Spec Delta

## Purpose

Defines the parameter contract for configuring, validating, rendering, and reproducing one-level maze designs.

## ADDED Requirements

### Requirement: Parameter sidebar controls configuration
The application SHALL provide one sidebar as the only interface for changing design requirements.

#### Scenario: Configuration changes remain pending
- **WHEN** a user changes a parameter before generation
- **THEN** the pending configuration SHALL change while the currently rendered design remains unchanged

#### Scenario: Rendered configuration is identified
- **WHEN** a completed design is displayed
- **THEN** the interface SHALL distinguish the rendered configuration from pending ungenerated parameters

### Requirement: Physical units are convertible
The application SHALL support meters and feet while using canonical metric coordinates internally.

#### Scenario: Unit conversion preserves dimensions
- **WHEN** a user changes the display unit
- **THEN** physical width, depth, wall thickness, and passage width SHALL retain equivalent metric dimensions

### Requirement: Invalid parameter combinations are actionable
The application SHALL reject unsupported or contradictory parameters before generation.

#### Scenario: Uniform corridor width is too small
- **WHEN** uniform corridor width is enabled below the minimum passage width
- **THEN** the interface SHALL report the conflicting values and prevent generation

### Requirement: Reproduction uses explicit seeds
The application SHALL allow a user seed or generate a seed and SHALL derive candidate seeds deterministically.

#### Scenario: Identical inputs reproduce results
- **WHEN** identical parameters, seed, and algorithm version are supplied
- **THEN** candidate generation and selection SHALL produce identical geometry and logical configuration

### Requirement: Configuration includes the complete V1 parameter set
The sidebar SHALL expose design area and units, topology, geometry mode, wall thickness, minimum passage width, construction increment, corridor width, chambers, objectives, progression, doors, solvability mode, designated-wall placement, structural-complexity target, difficulty weights, optimization strategy, effort, seed, display, export, and sharing options.

#### Scenario: A parameter is changed
- **WHEN** a user adjusts a supported V1 parameter
- **THEN** the sidebar SHALL update only pending configuration and SHALL not alter the rendered configuration

#### Scenario: Display unit is meters or feet
- **WHEN** the user selects meters or feet
- **THEN** canonical metric geometry SHALL remain unchanged while annotations and entry values use the selected unit

#### Scenario: Structural target is configured
- **WHEN** the user changes the structural-complexity target
- **THEN** it SHALL update pending configuration separately from achieved structural measurements and difficulty score

### Requirement: Primary controls retain operation boundaries
The application SHALL provide Generate, Regenerate, Cancel, Copy Share Link, Copy Share Text, Export PNG, Export SVG, Save Project, and Load Project controls; each operation SHALL be functional or visibly unavailable.

#### Scenario: Generate is unavailable without configuration
- **WHEN** validation identifies invalid pending parameters
- **THEN** the application SHALL prevent generation and SHALL show the conflicting configuration

#### Scenario: Export control follows rendered state
- **WHEN** no completed or renderable design exists
- **THEN** export and copy-sharing controls SHALL be unavailable

#### Scenario: Cancel is selected
- **WHEN** generation or optimization is in progress
- **THEN** Cancel SHALL stop publication of the job and SHALL preserve the last completed design

#### Scenario: Operation is not implemented
- **WHEN** Save, Load, or Share functionality is not implemented
- **THEN** its control SHALL be disabled or clearly labeled unavailable and SHALL NOT report success

#### Scenario: Operation succeeds or fails
- **WHEN** an implemented Save, Load, or Share operation completes or rejects
- **THEN** the interface SHALL report success only after completion and SHALL report failure without success-shaped feedback

### Requirement: Wall-placement preferences are explicit
When a designated-wall toggle is enabled, the configuration SHALL support Automatic, Early, Middle, and Late placement preferences.

#### Scenario: Placement preference cannot be satisfied
- **WHEN** no physically valid designated-wall placement satisfies the requested preference
- **THEN** the generator SHALL report failure without presenting a false toggle result

### Requirement: Subgoal and door configuration
The sidebar SHALL allow required and optional subgoal counts, ordered or unordered progression, ordinary, secret, inaccessible, and dependent door configuration.

#### Scenario: An impossible dependency is configured
- **WHEN** configured objectives or doors create impossible legal progression
- **THEN** validation SHALL report an actionable error or generation SHALL report exhaustive unsolvability

### Requirement: Generation workflow
The application SHALL present the workflow Configure, Generate, Validate, Optimize, Verify, Render, Inspect, and Share or Export.

#### Scenario: Mandatory constraints fail
- **WHEN** a candidate violates a mandatory constraint
- **THEN** the application SHALL reject it rather than silently relaxing the constraint

#### Scenario: Candidate evaluation repeats
- **WHEN** Optimize for Preferences requires additional candidates
- **THEN** the application SHALL repeat generation and evaluation until selection, exhaustion, cancellation, or resource failure

### Requirement: Uniform corridor width defaults
Uniform corridor width SHALL be disabled by default and SHALL be enabled only by explicit configuration.

#### Scenario: Uniform corridor width is disabled
- **WHEN** the parameter is disabled
- **THEN** ordinary corridors SHALL remain eligible for generation without a uniform-width requirement

### Requirement: Display and export configuration
The sidebar SHALL support grid, dimensions, scale, objective and chamber markers, door and designated-wall overlays, verified routes, candidate overlays, and export options.

#### Scenario: Display setting is changed
- **WHEN** a display-only parameter changes
- **THEN** the pending and rendered geometry SHALL remain unchanged
