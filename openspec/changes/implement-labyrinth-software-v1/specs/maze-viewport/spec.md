# Spec Delta

## Purpose

Defines the read-only, physically scaled maze viewport and the overlay and processing controls used to inspect completed designs.

## ADDED Requirements

### Requirement: Read-only SVG viewport
The application SHALL render completed geometry through a top-down SVG viewport that preserves physical proportions.

#### Scenario: Viewport opens a completed maze
- **WHEN** a selected candidate finishes rendering
- **THEN** walls, passages, chambers, objectives, doors, entrance, and exit SHALL be visible at physical scale

#### Scenario: Geometry cannot be edited
- **WHEN** a user interacts with the viewport
- **THEN** zoom and pan SHALL be supported without changing wall, chamber, objective, or door geometry

### Requirement: Viewport navigation
The viewport SHALL support zoom, pan, and fit-to-view.

#### Scenario: Fit-to-view is requested
- **WHEN** the user selects fit-to-view
- **THEN** the complete design SHALL be framed while preserving aspect ratio and physical scale

### Requirement: Analytical overlays
The viewport SHALL allow grid, dimensions, scale, objective, chamber, door, designated-wall, completion-route, and difficulty-candidate overlays.

#### Scenario: Overlay is toggled
- **WHEN** an overlay is enabled or disabled
- **THEN** presentation SHALL change without modifying geometry or project configuration

### Requirement: Processing feedback
The interface SHALL expose generation stage, candidate counts, final rendering status, and cancellation while preserving the last completed design.

#### Scenario: Regeneration is running
- **WHEN** a new generation job starts
- **THEN** the previous completed design SHALL remain visible until the new selected design successfully renders

### Requirement: Accessible viewport and controls
Applicable viewport, sidebar, and export controls SHALL target WCAG 2.2 AA behavior, including keyboard access and visible focus.

#### Scenario: Controls are operated by keyboard
- **WHEN** a keyboard user opens, navigates, or activates an applicable control
- **THEN** the control SHALL expose a visible focus state and an operable keyboard interaction

#### Scenario: Visual state changes
- **WHEN** verification, export, or progress status changes
- **THEN** the interface SHALL communicate the state through text or status semantics in addition to color

### Requirement: Viewport displays physical geometry
The SVG viewport SHALL display wall thickness, straight and curved walls, chambers, objectives, entrance, exit, and verification status at physical scale.

#### Scenario: Selected design renders
- **WHEN** a selected candidate is rendered
- **THEN** the viewport SHALL preserve physical proportions and SHALL prevent direct geometry editing

### Requirement: Scale and annotation presentation
The viewport SHALL support grid visibility, scale indicators, and dimension annotations.

#### Scenario: Annotation settings change
- **WHEN** grid, scale, or dimension display is toggled
- **THEN** geometry SHALL remain unchanged
