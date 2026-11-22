# Spec Delta

## Purpose

Defines reproducible project and share data, physical exports, static compatibility, and validation of untrusted reconstruction input.

## ADDED Requirements

### Requirement: PNG export
The application SHALL export rendered designs as PNG at a configurable resolution while preserving physical proportions.

#### Scenario: Rendered invalid or unsolvable design is exported
- **WHEN** a rendered design lacks solvability or has an allowed renderable geometry issue
- **THEN** PNG export SHALL remain available without changing project state

### Requirement: SVG export
The application SHALL export rendered designs as SVG and SHALL preserve physical proportions and circular arcs.

#### Scenario: Export annotations are selected
- **WHEN** the user enables optional grid, dimensions, objectives, doors, or candidate overlays
- **THEN** the export SHALL include the selected presentation without altering the stored geometry

### Requirement: Versioned project JSON
The application SHALL save and load a versioned native project containing parameters, geometry, metadata, and algorithm versions.

#### Scenario: Project loads successfully
- **WHEN** a supported project file is loaded
- **THEN** configuration and generated geometry SHALL be restored and the geometry SHALL be revalidated

#### Scenario: Project file is unsupported or malformed
- **WHEN** a project file has an invalid schema, unsupported version, or invalid physical values
- **THEN** the application SHALL report an actionable error without corrupting the current project

### Requirement: Static and iframe deployment
The application SHALL provide core functionality without a backend and SHALL adapt to iframe or static-host containers.

#### Scenario: Application is loaded statically
- **WHEN** a supported browser loads the application from static hosting
- **THEN** generation, rendering, persistence, export, and sharing SHALL operate without server APIs

### Requirement: Versioned share links
The application SHALL generate and reconstruct compact URL-fragment payloads containing every value required for deterministic reconstruction.

#### Scenario: Compatible link is opened
- **WHEN** a supported share payload identifies a compatible generator
- **THEN** the application SHALL reconstruct the selected candidate and validate it before rendering

#### Scenario: Unsupported link is opened
- **WHEN** a payload uses an unsupported schema or incompatible generator version
- **THEN** the application SHALL report explicit compatibility or reconstruction failure

### Requirement: Share payload is untrusted input
The application SHALL enforce bounded encoded and decoded payload sizes and SHALL schema-validate all numerical and structural values.

#### Scenario: Malformed payload is provided
- **WHEN** a share payload exceeds limits or contains invalid values
- **THEN** the application SHALL reject it safely and SHALL preserve the existing project

### Requirement: Share and copy controls
The application SHALL provide Copy Share Link and Copy Share Text controls for reproducible completed designs.

#### Scenario: Share link is copied
- **WHEN** the user copies a share link
- **THEN** the URL SHALL identify the completed candidate and provide success or clipboard-failure feedback

#### Scenario: Share text is copied
- **WHEN** the user copies share text
- **THEN** the text SHALL accurately describe the maze dimensions, topology, geometry, subgoals, and verified result

### Requirement: Export output remains non-destructive
PNG, SVG, Save Project, and share operations SHALL preserve the currently completed project and generated geometry.

#### Scenario: Export is initiated
- **WHEN** a resolved export or save operation runs
- **THEN** configuration, pending edits, verification state, and viewport state SHALL remain unchanged

### Requirement: Share reconstruction is direct
Opening a compatible share link SHALL reconstruct the selected candidate directly without rerunning the full optimization search.

#### Scenario: Reconstruction is staged
- **WHEN** a compatible link is opened
- **THEN** progress SHALL identify payload decoding, compatibility, reconstruction, physical validation, verification, and rendering stages

### Requirement: PNG export availability and options
PNG export SHALL be available whenever a maze is rendered, regardless of solvability or geometry verification status, and SHALL preserve physical proportions.

#### Scenario: Renderable incomplete design is exported
- **WHEN** a renderable invalid or unsolvable design is selected
- **THEN** PNG export SHALL remain available and SHALL allow configurable resolution and optional grid, dimension, objective, and overlay presentation

### Requirement: Native project payload
Project JSON SHALL preserve schema version, generator and algorithm versions, seed, selected candidate, strategy, effort, units and dimensions, constraints, topology, geometry, chambers, objectives, progression, doors, solvability, designated wall, difficulty weights, and generated geometry.

#### Scenario: Supported project is loaded
- **WHEN** a project JSON is decoded
- **THEN** the application SHALL restore configuration and geometry and SHALL revalidate loaded geometry

### Requirement: Complete share payload
The URL payload SHALL include share schema version, generator algorithm version, seed, dimensions and units, topology and geometry mode, physical constraints, corridor, chamber, objective, progression, door, solvability, designated-wall, difficulty, strategy, effort, candidate metadata, and all additional deterministic reconstruction values.

#### Scenario: Payload has mutable defaults
- **WHEN** encoding a share URL
- **THEN** values that can change reconstruction SHALL be written explicitly rather than inherited from mutable application defaults

### Requirement: Share URL format and compatibility
The application SHALL use a bounded, compact, versioned URL-fragment payload and SHALL identify generator compatibility explicitly.

#### Scenario: Payload schema is unsupported
- **WHEN** the URL payload schema or generator version is unsupported
- **THEN** the application SHALL show an actionable compatibility error and SHALL not substitute another generator

#### Scenario: Compatible payload reconstructs
- **WHEN** a link is generated by a compatible generator implementation
- **THEN** geometry, logical configuration, and candidate identity SHALL be reproducible without full optimization

### Requirement: Share payload safety
Encoded and decoded payload lengths SHALL be bounded, every value SHALL be schema-validated, resource safeguards SHALL remain active, and reconstruction SHALL not execute arbitrary code.

#### Scenario: Unsafe payload is opened
- **WHEN** a malformed, oversized, unsupported, or numerical-invalid payload is received
- **THEN** the application SHALL reject it with an actionable error and SHALL preserve the existing project

### Requirement: Share link copy availability
Copy Share Link SHALL generate the URL from the currently completed reproducible design, copy it, provide success or failure feedback, avoid modifying the design, and remain unavailable without a reproducible completed design.

#### Scenario: Clipboard write fails
- **WHEN** the browser rejects clipboard access
- **THEN** the application SHALL report the failure without claiming that copying succeeded

### Requirement: Share text accuracy
Copy Share Text SHALL generate concise text naming the product, dimensions, topology, geometry mode, required subgoal count, selected difficulty or optimization information, challenge summary, and share URL when accurate.

#### Scenario: Text is copied
- **WHEN** share text is requested
- **THEN** every included claim SHALL reflect the actual configuration or verified result and SHALL require no social account

### Requirement: Sharing limitations
Version 1 SHALL not require server-side link shortening, hosted maze storage, accounts, server thumbnails, social APIs, or permanent support for every historical generator version.

#### Scenario: Compatibility policy is reviewed
- **WHEN** a historical or unsupported generator is encountered
- **THEN** documentation SHALL state whether reconstruction is supported and SHALL fail explicitly otherwise

### Requirement: Persistence and sharing feedback reflects completed operations
Save, Load, and Share controls SHALL remain unavailable or clearly identify their unavailable state until their operations are implemented, and SHALL report success only after the requested operation succeeds.

#### Scenario: Placeholder operation is selected
- **WHEN** a Save, Load, or Share operation has no implementation
- **THEN** its control SHALL be disabled or clearly labeled unavailable and SHALL NOT claim success

#### Scenario: Implemented operation fails
- **WHEN** an implemented file or clipboard operation rejects or fails
- **THEN** the interface SHALL report failure and SHALL NOT show success feedback

#### Scenario: Implemented operation succeeds
- **WHEN** an implemented file or clipboard operation completes successfully
- **THEN** the interface SHALL report success only after that completion
