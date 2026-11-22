# Spec Delta

## Purpose

Defines independent physical traversal validation so intended graphs cannot mask wall gaps, clearance failures, or unintended shortcuts.

## ADDED Requirements

### Requirement: Physical geometry is authoritative
The application SHALL validate traversal against actual wall footprints rather than treating the intended topology as proof of correctness.

#### Scenario: Intended connection is physically blocked
- **WHEN** an intended corridor is obstructed or below the required clearance
- **THEN** the candidate SHALL be invalid and SHALL not proceed to selection

### Requirement: Independent connectivity reconstruction
The application SHALL reconstruct navigable regions and connections independently from the intended navigation graph.

#### Scenario: Reconstructed topology matches intended topology
- **WHEN** valid physical geometry is analyzed
- **THEN** intended connections SHALL be traversable and all unexpected shortcuts or disconnected regions SHALL be reported

#### Scenario: Curved clearance is checked
- **WHEN** straight or circular geometry is analyzed
- **THEN** both forms SHALL use consistent minimum-clearance predicates and numerical tolerances

### Requirement: Door portals are physical and logical entities
A door SHALL have explicit physical opening, clearance, connected regions, and logical accessibility conditions.

#### Scenario: Door opening is undersized
- **WHEN** a portal does not provide the required traversable opening
- **THEN** the candidate SHALL be invalid

#### Scenario: Door states remain separate
- **WHEN** a secret or restricted door is assessed
- **THEN** visual concealment SHALL not change physical reachability or logical accessibility rules

### Requirement: Geometric integrity prevents candidate selection
Physical validation SHALL reject gaps, overlaps, unresolved intersections, invalid footprints, insufficient chamber areas, boundary violations, and inconsistent clearance or increment rules.

#### Scenario: Adversarial geometry is encountered
- **WHEN** nearly touching walls, tangent arcs, coincident boundaries, diagonal gaps, or curved pinch points are analyzed
- **THEN** the candidate SHALL be rejected unless all geometric predicates conclusively validate

### Requirement: Geometry and navigation agree
Validated physical navigation SHALL be the sole navigation input used by formal progression verification.

#### Scenario: Intended and reconstructed topology disagree
- **WHEN** intended connections or region membership differ from reconstructed physical traversal
- **THEN** the candidate SHALL be invalid and SHALL not proceed to formal verification

### Requirement: Clearance uses physical obstacle surfaces
Clearance SHALL be evaluated from actual physical wall footprints using one consistent metric-clearance rule.

#### Scenario: Minimum clearance is configured
- **WHEN** the minimum passage width is evaluated
- **THEN** obstacle surfaces SHALL determine whether center-point traversability preserves the configured clear width

### Requirement: Physical navigation consistency
The reconstructed navigation model SHALL report physically traversable regions, valid connections, blocked intended connections, unintended shortcuts, disconnected chambers, invalid portals, and clearance violations.

#### Scenario: A validation result is reported
- **WHEN** independent reconstruction finds inconsistency
- **THEN** the result SHALL identify the affected physical regions or intended connections

### Requirement: Reconstructed model handling
Equivalent subdivisions of one valid corridor SHALL not produce false topology mismatches.

#### Scenario: Navigation decomposition differs
- **WHEN** a valid corridor is decomposed into different planar regions across runs
- **THEN** the navigation comparison SHALL preserve equivalent connectivity
