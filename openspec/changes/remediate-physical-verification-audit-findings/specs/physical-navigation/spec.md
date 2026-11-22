# Spec Delta

## Purpose

Defines a navigation representation whose regions, connections, and portal links are derived from validated physical free space rather than inferred from intended topology.

## ADDED Requirements

### Requirement: Physical free space determines navigation
The application SHALL reconstruct traversable regions and connections from physical wall footprints, clearance, design bounds, and valid portal openings independently of the intended graph.

#### Scenario: A physical passage bypasses an intended barrier
- **WHEN** free space connects regions around the end of a wall although the intended topology has no connection
- **THEN** validation SHALL report an unintended physical connection and reject the candidate

#### Scenario: Wall thickness blocks a passage
- **WHEN** physical wall thickness and required clearance leave no traversable opening
- **THEN** the reconstructed navigation SHALL contain no connection through that blocked passage

### Requirement: Navigation connections have physical evidence
Each reconstructed connection SHALL identify its connected physical regions and the traversable geometric opening or portal that supports it.

#### Scenario: Portal region pair is inconsistent
- **WHEN** a portal does not physically join its declared regions
- **THEN** reconstruction SHALL mark the portal invalid and SHALL NOT create that navigation connection

#### Scenario: Equivalent decomposition is used
- **WHEN** the same physical corridor is represented by different valid free-space subdivisions
- **THEN** connectivity comparison SHALL produce the same topology result

### Requirement: Intended features correspond to physical witnesses
Every intended node, traversable edge, and blocked boundary SHALL correspond to a validated physical anchor, passage, or barrier witness, independent of free-space subdivision and global connected-component identity.

#### Scenario: Intended node has no physical anchor
- **WHEN** an intended topology node maps to a blocked, out-of-bounds, or otherwise non-traversable physical location
- **THEN** the candidate SHALL be invalid even if another node maps to the same global free-space component

#### Scenario: Intended passage or barrier is compared at its boundary
- **WHEN** an intended edge or non-edge separates mapped topology regions
- **THEN** validation SHALL establish a traversable physical passage for an edge and a continuous physical barrier for a non-edge, including all crossings of that boundary

#### Scenario: Shortcut remains inside one connected component
- **WHEN** an unintended physical passage joins mapped topology regions that already belong to the same global free-space component
- **THEN** validation SHALL still report the local shortcut and reject the candidate

#### Scenario: Physical subdivision changes
- **WHEN** equivalent physical geometry introduces or removes decomposition cells without changing mapped anchors, passage witnesses, or barriers
- **THEN** topology correspondence SHALL remain unchanged

### Requirement: Intended and physical connectivity agree
A candidate SHALL proceed only when intended traversable connections and reconstructed physical connectivity agree, including disconnected regions and unintended shortcuts.

#### Scenario: Independent reference geometry is evaluated
- **WHEN** a reference fixture has known physical connectivity independent of the generator
- **THEN** reconstructed regions and connections SHALL match the fixture's expected result

### Requirement: Unsupported geometry cannot produce validated navigation
Geometry not supported by the active physical reconstruction SHALL fail closed and SHALL NOT be represented as traversable or eligible for formal verification.

#### Scenario: Curved geometry is not implemented
- **WHEN** curved geometry is supplied to an orthogonal-only reconstruction
- **THEN** the candidate SHALL receive an explicit unsupported-geometry outcome and SHALL not receive a validated navigation artifact

### Requirement: Validated navigation is an explicit result
The application SHALL expose a validated navigation result only after physical and intended connectivity checks complete successfully; invalid or resource-limited analysis SHALL remain non-conclusive.

#### Scenario: Physical analysis is incomplete
- **WHEN** a bounded physical reconstruction cannot complete
- **THEN** the candidate SHALL be reported incomplete and SHALL not be treated as valid or invalid by silent fallback
