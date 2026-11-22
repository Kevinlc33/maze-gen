# Tasks

## 1. Foundation and Tooling

- [x] 1.1 Add strict core TypeScript structure under `src/core/`, typed UI state, and a feature-oriented `src/components/` layout; verify `npm run build` succeeds.
- [x] 1.2 Install and configure Zustand, Vitest, fast-check, React Testing Library, and Playwright; verify test and lint commands run successfully.
- [x] 1.3 Replace the starter application shell with the parameter/sidebar and viewport layout; verify `npm run build` and a rendering smoke test pass.
- [x] 1.4 Define central configuration, units, geometry, topology, chamber, objective, door, candidate, and verification types; verify unit tests cover default values and conversions.
- [x] 1.5 Document supported browsers, static deployment assumptions, and project setup in README; verify the documented setup commands complete.
- [x] 1.6 Implement Generate, Regenerate, Cancel, export, save/load, and copy-share control states; verify component tests cover enabled, disabled, success, and failure states.
- [ ] 1.7 Disable or clearly label unimplemented Save, Load, and Share operations; verify no placeholder path reports success and implemented operations report success only after completion.

## 2. Geometry and Configuration

- [x] 2.1 Implement canonical metric coordinates, centralized tolerances, unit conversion, and construction quantization; verify property tests preserve physical dimensions and increments.
- [x] 2.2 Implement wall segments, circular arcs, wall footprints, chambers, portals, entrance, and exit models with stable IDs; verify serialization round-trip tests pass.
- [x] 2.3 Implement parameter defaults and validation for area, wall thickness, passage width, corridor width, increments, chamber ranges, and topology; verify invalid combinations produce actionable errors.
- [x] 2.4 Implement pending-versus-rendered configuration state and seed derivation; verify configuration changes do not mutate the current design and deterministic seeds reproduce metadata.
- [x] 2.5 Implement wall-placement preference and default chamber-area configuration; verify unit tests cover Automatic, Early, Middle, Late and 16/24/36 square-meter defaults.
- [x] 2.6 Implement exactly-one entrance and exactly-one exit invariants and perimeter-wall representation; verify candidate validation rejects missing or inaccessible endpoints.

## 3. Orthogonal Generation and Physical Navigation

- [x] 3.1 Implement orthogonal topology generation for maze, labyrinth, and hybrid modes; verify deterministic reference seeds and topology classification tests pass.
- [x] 3.2 Implement orthogonal wall, corridor, chamber, and perimeter construction; verify bounds, wall thickness, clearance, and uniform-corridor property tests pass.
- [x] 3.3 Implement independent physical navigation reconstruction from wall footprints and door portals; verify an independent reference case proves equivalent intended and actual connectivity.
- [x] 3.4 Implement intended-versus-actual connectivity comparison and unintended-shortcut/disconnected-region detection; verify adversarial geometry tests reject invalid candidates.
- [x] 3.5 Add adversarial tests for tangent arcs, coincident boundaries, narrow gaps, curved pinch points, and nearly touching walls; verify invalid candidates cannot reach formal verification.

## 4. Worker Execution and Progress

- [x] 4.1 Implement stable worker job IDs, revision tracking, bounded worker scheduling, and stale-result rejection; verify worker cancellation and stale completion tests pass.
- [x] 4.2 Implement generation-stage, candidate-count, and final-render progress messages; verify UI progress tests distinguish determinate and indeterminate states.
- [x] 4.3 Implement cancellation-safe worker jobs and explicit resource-exhaustion outcomes; verify cancelled verification never publishes a conclusive solvability status.
- [x] 4.4 Preserve the last completed design while a new job runs; verify UI integration tests retain and then replace it correctly.

## 5. Progression and Formal Verification

- [x] 5.1 Implement required and optional subgoals, stable completion flags, and ordered/unordered progression state; verify property tests ensure completion flags never revert.
- [x] 5.2 Implement ordinary, secret, permanently inaccessible, and subgoal-dependent doors; verify portal clearance and dependency tests pass.
- [x] 5.3 Implement finite-state solvability search across navigation regions and progression flags; verify solvable, unsolvable, invalid, and incomplete outcomes against reference graphs.
- [x] 5.4 Implement single-wall addition and removal toggle verification and designated-wall placement preferences; verify both relevant states change solvability exactly as configured.
- [x] 5.5 Implement progression classification for Early, Middle, Late, and Variable timing; verify legal alternative orders and shortest-route cases pass unit tests.
- [x] 5.6 Implement exactly-one entrance-to-exactly-one-exit completion verification and explicit exit dependencies; verify reference sequences cover satisfied and unsatisfied exits.

## 6. Difficulty and Tiered Optimization

- [x] 6.1 Correct pure metric branch accounting (`P*`, P_short exclusions, L/Q, objective locations) and mandatory prerequisite arcs; replace recursive shortest-route enumeration with exact bounded DAG dynamic programming; add distinct-physical-ID subdivision tests; distinguish pure corridor-ID consistency from future adapter validation of physical groups; rerun all metric fixtures, properties, build, and lint without production integration.
- [ ] 6.2 Implement configurable 20/25/20/25/10 weights, normalized scoring, raw metric output, and deterministic tie-breaking; verify scoring tests and UI values agree.
- [ ] 6.8 Replace objective auto-completion on region entry with explicit zero-distance objective-action transitions subject to location, dependency, and ordering rules; verify independent reference-graph regression tests.
- [ ] 6.9 Add verification scope and provenance for candidate, algorithm, configuration, and complete progression inputs; verify navigation-only, full-progression solvable/unsolvable, mismatched, and incomplete results are classified and ranked correctly.
- [ ] 6.10 Replace fixed 4×4 topology sizing with a deterministic, versioned policy derived from an approved structural-complexity target and physical constraints; obtain product-owner approval of target representation and sizing policy before implementation, and test determinism, infeasibility, and hard-constraint preservation.
- [ ] 6.3 Implement Generate Once and Optimize for Preferences strategies with Fast/Balanced/Thorough budgets; verify mandatory constraints are never relaxed, only full-progression solvable candidates rank, and budget exhaustion is distinguishable.
- [ ] 6.4 Implement bounded tiered candidate scheduling that validates each completed construction without a batch-wide barrier and selects deterministically across worker completion orders; verify queue/concurrency bounds, candidate budgets, stopping rules, and incomplete outcomes with controlled workers.
- [ ] 6.5 Implement wall and door candidate impact analysis by mutating physical geometry, reconstructing validated navigation, and verifying both states; calculate impact from verified legal routes and physical distances, not caller-supplied routes or region-count proxies, and verify overlay tests pass.
- [ ] 6.6 Implement achieved structural-complexity metrics and cache compatibility keys; verify tests keep targets separate from achieved values and weighted difficulty, and reject stale cache entries.
- [ ] 6.7 Add candidate-status reporting for screened, scope/provenance-verified, selected, exhausted, failed, incomplete, and cancelled cases; verify UI and worker tests distinguish candidate verification from optimization-search completion.

## 7. Read-Only Viewport and Overlays

- [ ] 7.1 Implement authoritative geometry-to-SVG scene construction for straight walls and circular arcs; verify reference scene snapshots and physical proportions pass.
- [ ] 7.2 Implement zoom, pan, fit-to-view, grid, scale, and dimension controls; verify component tests prevent geometry mutation.
- [ ] 7.3 Implement entrance, exit, chamber, objective, secret-door, restricted-door, designated-wall, completion-route, and candidate overlays; verify toggles affect presentation only.
- [ ] 7.4 Add verified-status and resource/error presentation in the viewport shell; verify accessibility and error-state component tests pass.
- [ ] 7.5 Audit applicable controls for WCAG 2.2 AA keyboard, focus, and status semantics; verify automated accessibility checks and manual keyboard smoke tests pass.

## 8. Persistence, Export, and Sharing

- [ ] 8.1 Implement versioned project JSON with schema validation, save/load, migration rejection, and geometry revalidation; verify round-trip and malformed-project tests pass.
- [ ] 8.2 Implement configurable-resolution PNG export and SVG export from the shared scene model; verify physical proportions and optional overlays in integration tests.
- [ ] 8.3 Implement compact versioned URL-fragment payload encoding and selected-candidate metadata; verify share round-trip tests preserve configuration and candidate identity.
- [ ] 8.4 Implement payload length limits, schema validation, numerical bounds, generator compatibility checks, and reconstruction progress; verify malformed, oversized, and unsupported payload tests pass.
- [ ] 8.5 Implement Copy Share Link and Copy Share Text feedback; verify both controls include accurate, completed-design-only information.
- [ ] 8.6 Preserve project and viewport state across export, save/load, share, and reconstruction operations; verify integration tests prove each operation is non-destructive.

## 9. Circular and Mixed Geometry

- [ ] 9.1 Implement circular-arc defining geometry and construction-increment constraints; verify arc unit and edge-case tests pass.
- [ ] 9.2 Implement mixed straight-and-circular geometry and wall-intersection resolution; verify adversarial tangent, overlap, and pinch-point tests pass.
- [ ] 9.3 Extend physical navigation and export rendering to curved geometry; verify independent curved-connectivity and SVG arc tests pass.

## 10. Integration, Accessibility, and Release

- [ ] 10.1 Implement static-host and iframe layout behavior; verify Playwright smoke tests pass in supported desktop browsers and embedded-width layouts.
- [ ] 10.2 Add production-path integration coverage for configuration-to-generation, physical navigation, authoritative full-progression verification, incremental tiered optimization, and result publication; verify provenance is preserved and empty/fallback progression cannot be published as fully verified.
- [ ] 10.3 Add end-to-end coverage for solvable, labyrinth, hybrid, objectives, secret doors, wall toggles, cancellation, exports, persistence, and sharing; verify Playwright tests pass.
- [ ] 10.4 Run unit, property, integration, lint, build, and end-to-end verification; verify no known critical correctness defects remain and production builds succeed.
- [ ] 10.5 Complete V1 PRD review against implementation, update compatibility and deployment documentation, and verify every requirement has a passing test or explicit documented limitation.
- [ ] 10.6 Add independent reference mazes and sharing reconstruction tests across compatible and unsupported generator versions; verify identical geometry and explicit incompatibility behavior.
- [ ] 10.7 Add the complete unit, property, adversarial, independent-reference, sharing, integration, and end-to-end test matrix; verify every PRD test category has executable coverage or an explicit V1 limitation.

## Dependency Graph and Review Gates

- Task 1.7 is independent of task 6.1 and MUST be complete before Save/Load/Share integration tasks 8.1, 8.5, and 10.3.
- Task 6.1 is an isolated metric task and has no dependency on objective-action, provenance, topology-sizing, or production-pipeline integration work.
- Task 6.2 depends on 6.1 and remains a metric-scoring task; it does not establish production verification scope.
- Task 6.9 depends on 6.8 so provenance describes the explicit objective-action state model.
- Task 6.10 is blocked until the product owner approves both the structural-target representation and deterministic sizing policy. The interim 4×4 grid is not an acceptance criterion.
- Tasks 6.3–6.7 are gated on tasks 6.8, 6.9, and 6.10. Task 6.3 also depends on 6.1 and 6.2; task 6.4 depends on 6.3; task 6.5 and 6.7 depend on 6.4 and 6.9; task 6.6 depends on 6.10.
- Task 10.2 is the production-path integration gate: isolated unit tests do not satisfy progression-scope, scheduler, or result-publication acceptance criteria.

## Workflow follow-up

- Archive the change after implementation review and verification are complete.
