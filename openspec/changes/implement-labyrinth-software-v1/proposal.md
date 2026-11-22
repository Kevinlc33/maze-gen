# Proposal

## Why

The existing project is a Vite/React starter and has no implementation of the maze generator described in `storyDetails.md`. Version 1 needs a coherent, physically accurate, reproducible application rather than an isolated UI or topology demo.

## What Changes

- Replace the starter screen with a parameter-driven maze and labyrinth application.
- Add orthogonal, circular-arc, and mixed geometry generation with topology modes for mazes, unicursal labyrinths, and hybrids.
- Add chambers, objectives, doors, progression dependencies, and formal finite-state solvability verification.
- Model objective completion as explicit actions at objective locations, and distinguish navigation-only results from full-progression verification.
- Add independent physical-geometry validation and navigable-connectivity reconstruction.
- Add seeded candidate generation, a configurable structural-complexity target, difficulty metrics, and bounded, incremental, deterministic candidate evaluation.
- Add a read-only SVG viewport with zoom, pan, fit, overlays, progress, and cancellation.
- Add PNG/SVG export, versioned project JSON, and versioned, safety-validated share links.
- Keep unimplemented Save, Load, and Share operations visibly unavailable and report success only after the operation completes.
- Add focused unit, property, integration, and end-to-end coverage for physical and logical correctness.

## Capabilities

### New Capabilities

- `maze-configuration`: Parameter editing, units, pending-versus-rendered configuration, validation, and reproducible seeds.
- `geometry-generation`: Physical design areas, walls, corridors, chambers, topology modes, and orthogonal/circular/mixed geometry.
- `physical-navigation`: Clearance validation, independent free-space reconstruction, door portals, and intended-versus-actual connectivity checks.
- `progression-verification`: Objectives, ordered/unordered progression, door dependencies, designated-wall toggles, and finite-state solvability.
- `candidate-optimization`: Structural complexity, difficulty metrics, weighted ranking, tiered candidate evaluation, caching, and effort budgets.
- `worker-execution`: Bounded background generation, structured progress, cancellation, stale-job prevention, and resource feedback.
- `maze-viewport`: Read-only SVG visualization, navigation controls, display options, overlays, and verified route presentation.
- `export-persistence-sharing`: PNG/SVG export, versioned JSON projects, static deployment, and validated share-link reconstruction.
- `release-quality`: Accessible controls, browser compatibility, static/iframe delivery, and correctness-oriented acceptance verification.
- `verification-quality`: Independent unit, property, adversarial, reference, sharing, integration, and end-to-end verification coverage.

### Modified Capabilities

None.

## Impact

- Replaces [src/App.tsx](/C:/Users/kevin/coding/maze/maze/src/App.tsx) and starter styling with the application shell and viewport.
- Adds React-independent domain, geometry, navigation, verification, generation, optimization, rendering, persistence, and sharing modules.
- Adds dependencies for state management, geometry support, tests, and export as justified by the implementation design.
- Requires Web Workers and static-hosting-compatible browser APIs.
- The PRD in [storyDetails.md](/C:/Users/kevin/coding/maze/maze/storyDetails.md) remains the requirement source.
- PRD FR-025 and FR-030–031 govern explicit objective actions, required progression data, and full-progression verification; the structural target's scale and topology-sizing policy require a documented design approval before implementation.
