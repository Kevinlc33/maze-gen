# Spec Delta

## Purpose

Defines generation of bounded, physically constructed maze and labyrinth geometry for orthogonal, circular, and mixed designs.

## ADDED Requirements

### Requirement: Supported topology modes
The generator SHALL support maze, unicursal labyrinth, and hybrid topology modes.

#### Scenario: Maze topology
- **WHEN** maze mode is selected
- **THEN** the generator SHALL create branching passages, dead ends, intersections, and optional loops consistent with the mode

#### Scenario: Unicursal topology
- **WHEN** labyrinth mode is selected
- **THEN** required objectives SHALL lie along one continuous legal traversal sequence

#### Scenario: Hybrid topology
- **WHEN** hybrid mode is selected
- **THEN** the result SHALL combine branching maze regions and unicursal regions

### Requirement: Physical bounds and construction constraints
The generator SHALL keep generated geometry inside the configured maximum area and SHALL respect wall thickness, clearance, and construction increments.

#### Scenario: Maximum area is configured
- **WHEN** a design area of up to 160 meters by 80 meters is generated
- **THEN** all physical wall footprints SHALL remain within the configured rectangle

#### Scenario: Invalid geometry is rejected
- **WHEN** a candidate has an unintended gap, overlap, clearance violation, increment violation, or boundary violation
- **THEN** the candidate SHALL be excluded from successful selection

### Requirement: Corridor and chamber geometry
The generator SHALL distinguish ordinary corridors from exempt chambers and SHALL apply uniform corridor width only when enabled.

#### Scenario: Uniform corridor width is enabled
- **WHEN** uniform width is enabled
- **THEN** ordinary corridors SHALL use the configured width while chambers, halls, and intersections remain exempt

#### Scenario: Chamber areas are constrained
- **WHEN** a chamber is generated
- **THEN** its traversable area SHALL exclude wall footprints and SHALL satisfy the configured permitted range

### Requirement: Geometry mode support
The generator SHALL support orthogonal, circular-arc, and mixed geometry.

#### Scenario: Circular geometry uses valid arcs
- **WHEN** circular geometry is generated
- **THEN** arc defining dimensions and endpoints SHALL satisfy the construction increment and physical clearance rules

### Requirement: Design area and perimeter walls
The maximum rectangular design area SHALL be an explicit spatial constraint, not an automatically assumed perimeter wall.

#### Scenario: Perimeter wall is unnecessary
- **WHEN** the topology does not require a physical perimeter wall
- **THEN** the design SHALL remain within the area without assuming unconfigured walls

#### Scenario: Perimeter wall is generated
- **WHEN** perimeter walls are necessary
- **THEN** their physical footprints SHALL be explicit and SHALL remain inside the maximum area

### Requirement: Physical construction values
The default wall thickness SHALL be 1.0 meter and the default minimum passage width SHALL be 1.0 meter.

#### Scenario: Construction parameters are changed
- **WHEN** wall thickness or minimum passage width is configured
- **THEN** all applicable wall footprints and required clearances SHALL use those values

### Requirement: Entrance and exit invariants
A V1 level SHALL contain exactly one entrance and exactly one final exit.

#### Scenario: Entrance or exit has invalid access
- **WHEN** the entrance or exit lacks valid physical access
- **THEN** the candidate SHALL be rejected

### Requirement: Chamber configuration
Chambers SHALL support general, subgoal, and final-goal types with independent enablement and configurable permitted areas.

#### Scenario: Default chamber areas are used
- **WHEN** no chamber override is supplied
- **THEN** general, subgoal, and final-goal chambers SHALL default to 16, 24, and 36 square meters

#### Scenario: Chamber area is outside range
- **WHEN** a configured chamber area is outside 16–64 square meters
- **THEN** the application SHALL report an invalid parameter combination

#### Scenario: Chamber boundary is irregular
- **WHEN** a nonrectangular chamber is generated
- **THEN** its actual traversable floor area SHALL exclude wall footprints and satisfy the configured range

### Requirement: Topology-first construction
Generation SHALL construct intended topology, assign objectives and doors, construct physical geometry, validate geometry, reconstruct physical navigation, compare connectivity, and verify progression.

#### Scenario: Generation sequence reaches verification
- **WHEN** a candidate has valid intended topology and physical geometry
- **THEN** formal progression SHALL use only the independently reconstructed validated navigation model

### Requirement: Generation parameters participate in reproducibility
A candidate SHALL account for dimensions, units, topology, geometry mode, passage width, corridor width, wall thickness, increments, chambers, objectives, progression, doors, solvability, wall placement, structural targets, weights, seed, strategy, and effort.

#### Scenario: Deterministic candidate selection
- **WHEN** all relevant parameters and algorithm versions are identical
- **THEN** candidate seeds, candidate evaluation, selection, and geometry SHALL be reproducible

### Requirement: Physical wall and intersection integrity
Wall footprints SHALL be valid, intersections SHALL resolve during construction, and geometry SHALL avoid unintended gaps or overlaps.

#### Scenario: Straight and curved walls meet
- **WHEN** straight segments or circular arcs intersect
- **THEN** construction SHALL resolve the result consistently without gaps or unintended overlap

### Requirement: Configurable structural-complexity target
The generator SHALL use a configurable structural-complexity target to derive topology dimensions under the design area's physical constraints, independently of measured difficulty and achieved complexity.

#### Scenario: Target and physical constraints determine topology size
- **WHEN** a candidate is generated from a structural target and validated physical parameters
- **THEN** a deterministic, versioned sizing policy SHALL derive its topology dimensions

#### Scenario: Target conflicts with hard constraints
- **WHEN** the requested target cannot fit the design area, wall thickness, passage width, and construction increments
- **THEN** generation SHALL report infeasibility without relaxing a hard physical constraint

#### Scenario: Structural target is changed
- **WHEN** the target changes while physical constraints remain fixed
- **THEN** the resulting topology dimensions SHALL be derived from the changed target and SHALL not be represented as a difficulty score
