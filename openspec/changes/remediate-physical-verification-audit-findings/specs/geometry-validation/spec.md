# Spec Delta

## Purpose

Ensures configuration and constructed geometry use finite, bounded, physically accessible metric values and honor configured construction increments before a candidate can proceed.

## ADDED Requirements

### Requirement: Numeric geometry inputs are finite
Configuration and physical geometry validation SHALL reject non-finite numeric values before geometric calculations or candidate eligibility are determined.

#### Scenario: Non-finite configuration value
- **WHEN** a required dimension, clearance, thickness, increment, or chamber measure is NaN or infinite
- **THEN** validation SHALL return an actionable issue and SHALL prevent candidate construction or selection

#### Scenario: Non-finite geometry coordinate
- **WHEN** a wall, portal, chamber, entrance, or exit contains a non-finite coordinate or dimension
- **THEN** physical validation SHALL reject the geometry and SHALL NOT treat the invalid feature as absent or traversable

### Requirement: Physical bounds are authoritative
Every endpoint and physical entity SHALL be validated against the configured design bounds without coordinate clamping or edge-cell substitution.

#### Scenario: Endpoint lies outside the design
- **WHEN** an entrance or exit is outside the configured bounds
- **THEN** the candidate SHALL be invalid even if a nearby in-bounds free-space region exists

#### Scenario: Physical entity lies outside the design
- **WHEN** a wall footprint, chamber, or portal opening exceeds the configured bounds
- **THEN** the candidate SHALL be rejected with the affected entity identified

### Requirement: Endpoints and portals reference physical connectivity
Entrance, exit, and portal region references SHALL agree with independently reconstructed physical regions and connections.

#### Scenario: Portal names the wrong regions
- **WHEN** a portal's declared regions do not match the two physically connected regions at its opening
- **THEN** the candidate SHALL be invalid and the portal SHALL NOT be exposed as a valid connection

#### Scenario: Portal opening is physically inaccessible
- **WHEN** a portal is outside free space, blocked, or narrower than required clearance
- **THEN** the candidate SHALL be rejected before formal progression verification

### Requirement: Construction increments constrain generated geometry
When a construction increment is configured, applicable generated dimensions and placements SHALL lie on that increment without silently violating clearance or bounds.

#### Scenario: Geometry is generated with an increment
- **WHEN** construction uses a configured increment
- **THEN** every applicable generated dimension and placement SHALL respect it or construction SHALL fail with an actionable constraint conflict

#### Scenario: Increment enforcement changes prior output
- **WHEN** increment enforcement changes geometry produced by an existing seed and configuration
- **THEN** the effective construction algorithm version and reproducibility impact SHALL be documented
