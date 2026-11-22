# Labyrinth Software
## Product Requirements Document & Software Implementation Plan

**Version:** 0.7  
**Status:** Draft — Product Owner Review  
**Product:** Parameter-Driven Procedural Maze & Labyrinth Generator  
**Platform:** Desktop-first, embeddable web application  
**Proposed stack:** React, TypeScript, Vite, SVG, Web Workers  
**Implementation authorization:** Pending explicit approval

---

# 1. Executive Summary

## 1.1 Product Vision

Labyrinth Software is a browser-based application for generating, validating, optimizing, visualizing, sharing, and exporting physically accurate mazes and labyrinths.

Users configure their designs through a parameter sidebar. The application generates candidates, validates their physical geometry, independently reconstructs navigable connectivity, formally verifies progression requirements, and selects the highest-ranked eligible design according to configurable difficulty preferences.

The default generation strategy is **Optimize for Preferences**.

Generated designs are displayed in a read-only, top-down viewport. Users can inspect the maze, view analytical overlays, share it through a URL, save a project, or export an image.

No direct geometry editing is supported.

## 1.2 Product Objectives

| ID | Objective |
|---|---|
| PO-001 | Generate physically scaled mazes and labyrinths |
| PO-002 | Support maze, unicursal labyrinth, and hybrid topology |
| PO-003 | Support orthogonal, circular-arc, and mixed geometry |
| PO-004 | Enforce configurable physical construction constraints |
| PO-005 | Generate chambers, goals, and subgoals |
| PO-006 | Support ordered and unordered objective progression |
| PO-007 | Support secret and logically restricted doors |
| PO-008 | Formally verify solvability and unsolvability |
| PO-009 | Generate single-wall solvability toggles |
| PO-010 | Analyze and optimize structural difficulty |
| PO-011 | Independently validate physical traversability |
| PO-012 | Provide accurate progress and cancellation |
| PO-013 | Preserve deterministic reproducibility |
| PO-014 | Export PNG, SVG, and native project JSON |
| PO-015 | Support static hosting and iframe embedding |
| PO-016 | Support shareable maze URLs without a backend |
| PO-017 | Preserve extensibility for future multi-level generation |

## 1.3 Version 1 Scope

Version 1 includes:

- One level.
- One entrance.
- One final exit.
- Multiple required and optional subgoals.
- Parameter-driven procedural generation.
- Read-only visualization.
- Physical geometry and connectivity validation.
- Formal progression verification.
- Multi-candidate difficulty optimization.
- Progress reporting and cancellation.
- Versioned JSON persistence.
- PNG and SVG export.
- Versioned, shareable maze links.
- Automatic reconstruction of compatible shared designs.
- Static deployment without a backend.

## 1.4 Explicit Exclusions

Version 1 excludes:

- Manual wall, chamber, objective, or door placement.
- Drag-and-drop geometry editing.
- Interactive snapping and construction handles.
- Geometry undo/redo.
- AI-controlled maze explorers.
- Animated exploration simulations.
- Three-dimensional rendering.
- Multi-level generation.
- Multiple entrances or exits.
- Multiplayer editing.
- User accounts.
- Cloud project storage.
- Hosted maze databases.
- Server-generated maze thumbnails.
- Timed doors and complex switch networks.
- Direct game-engine integration.
- Undocumented terrain-clipping exploits.

---

# 2. User Experience

## FR-001 — Primary Workflow

The application follows:

**Configure → Generate → Validate → Optimize → Verify → Render → Inspect → Share or Export**

Candidate generation and evaluation may repeat multiple times.

The user must not be required to repair generated geometry manually.

Mandatory constraints cannot be silently relaxed to produce a result.

## FR-002 — Configuration Sidebar

The sidebar is the sole interface for modifying design requirements.

| Group | Configuration |
|---|---|
| Design Area | Width, depth, units |
| Topology | Maze, labyrinth, hybrid |
| Geometry | Orthogonal, circular, mixed |
| Construction | Wall thickness, minimum passage width, increment |
| Corridors | Optional uniform corridor width |
| Chambers | Enablement, area defaults, permitted ranges |
| Objectives | Required and optional subgoal counts |
| Progression | Ordered or unordered |
| Doors | Ordinary, secret, restricted, dependent |
| Solvability | Standard, wall-addition toggle, wall-removal toggle |
| Wall Placement | Automatic, Early, Middle, Late |
| Difficulty | Structural targets and metric weights |
| Optimization | Generate Once or Optimize for Preferences |
| Effort | Fast, Balanced, Thorough |
| Reproducibility | Seed |
| Display | Grid, dimensions, scale, overlays |
| Output | Export and sharing options |

Changing a parameter does not modify the currently displayed design.

The application distinguishes pending configuration from the configuration that produced the current maze.

## FR-003 — Read-Only Viewport

The viewport supports:

- Zoom.
- Pan.
- Fit-to-view.
- Grid visibility.
- Scale indicators.
- Dimension annotations.
- Objective and chamber markers.
- Secret and restricted door overlays.
- Designated-wall overlays.
- Verified completion routes.
- Difficulty candidate overlays.

The viewport does not permit physical or logical design edits.

## FR-004 — Primary Controls

The application provides:

- Generate.
- Regenerate.
- Cancel.
- Copy Share Link.
- Copy Share Text.
- Export PNG.
- Export SVG.
- Save Project.
- Load Project.

The last successfully rendered design remains available while another generation operation runs.

---

# 3. Physical Geometry

## FR-005 — Units and Coordinates

1. Meters are the default unit.
2. Feet are supported.
3. Internal geometry uses canonical metric coordinates.
4. Unit conversion preserves physical dimensions.
5. Zoom and pan do not modify geometry.
6. Export preserves physical proportions.
7. Dimension annotations are available.

## FR-006 — Maximum Design Area

1. Users configure maximum rectangular width and depth.
2. A 160 m × 80 m area must be supported.
3. The rectangle is a spatial constraint, not an automatically generated perimeter wall.
4. Generated geometry must remain within the configured area.
5. Physical perimeter walls may be generated when necessary.
6. Physical boundaries must be explicitly represented.

## FR-007 — Wall Thickness

1. Default thickness is 1.0 m.
2. Thickness is configurable.
3. Walls have explicit physical footprints.
4. Thickness affects passage clearance.
5. Solid walls block movement.
6. Solid walls block line of sight.
7. Exported geometry preserves thickness.

## FR-008 — Minimum Passage Width

1. Default minimum clear width is 1.0 m.
2. The value is configurable.
3. Clearance is measured between physical obstacle surfaces.
4. Required traversable connections must meet minimum clearance.
5. Wider passages are permitted.
6. Curved passages must satisfy the same requirement.

## FR-009 — Uniform Corridor Width

1. Uniform corridor width is optional.
2. It is disabled by default.
3. When enabled, it applies to ordinary corridors.
4. Chambers, halls, and intersections are exempt.
5. Uniform width cannot be less than minimum passage width.
6. The generator distinguishes constrained corridors from exempt regions.

## FR-010 — Construction Increments

1. Construction increments are optional.
2. They are configurable.
3. A 0.5 m increment must be supported.
4. Construction increments are independent of display-grid spacing.
5. Applicable wall dimensions and placements must respect the increment.
6. Circular-arc defining dimensions and endpoints must respect the increment.
7. Not every mathematical point on an arc must lie on the construction grid.
8. Invalid parameter combinations produce actionable errors.

## FR-011 — Geometry Modes

Supported modes:

**Orthogonal:** Horizontal and vertical segments, right-angle corners and intersections.

**Circular:** Circular arcs with explicit defining parameters.

**Mixed:** Straight and circular-arc geometry within the same design.

Bézier curves are not required.

## FR-012 — Geometric Integrity

Generated geometry must:

1. Have valid physical wall footprints.
2. Resolve intersections during construction.
3. Avoid unintended gaps and overlaps.
4. Respect minimum clearance.
5. Respect construction increments.
6. Remain inside the maximum design area.
7. Preserve chamber area constraints.
8. Agree with the validated navigation model.

Invalid geometry cannot be selected as a successful final design.

---

# 4. Physical Navigation Correctness

## FR-013 — Authoritative Geometry

Physical geometry is authoritative for clearance and connectivity validation.

The generator's intended navigation graph is not proof of physical traversability.

## FR-014 — Topology-First Generation

The generator must:

1. Construct an intended navigation topology.
2. Assign corridors, chambers, objectives, and doors.
3. Construct physically scaled geometry.
4. Validate physical geometry.
5. Independently reconstruct navigable connectivity.
6. Compare actual and intended connectivity.
7. Perform formal progression verification.

## FR-015 — Clearance Validation

Clearance validation must operate on actual physical obstacles.

The recommended approach is obstacle inflation.

For configured minimum passage width \(w\), obstacles are expanded by \(w/2\) when evaluating center-point traversability.

The resulting free space must support required connections.

Straight and curved geometry must use consistent clearance rules and numerical tolerances.

## FR-016 — Independent Connectivity Reconstruction

A constrained triangulation or equivalent planar free-space decomposition is recommended.

The reconstructed navigation model must identify:

- Physically traversable regions.
- Valid connections.
- Blocked intended connections.
- Unintended shortcuts.
- Disconnected chambers.
- Invalid door portals.
- Clearance violations.

Equivalent subdivisions of a valid corridor must not produce false topology mismatches.

## FR-017 — Physical Door Portals

Doors are represented as explicit geometric portals.

Each portal includes:

- Physical location.
- Opening geometry.
- Clearance.
- Connected regions.
- Logical accessibility conditions.

Physical validation determines whether a portal can be traversed.

Progression verification determines whether it is accessible in a given completion state.

Visual concealment is independent of logical accessibility.

## FR-018 — Physical Navigation Consistency

Mandatory requirements:

1. Intended traversable connections must be physically valid.
2. Physical connections must be represented in the reconstructed navigation model.
3. Unintended shortcuts must be detected.
4. Wall thickness must affect connectivity validation.
5. Curved passages must satisfy clearance.
6. Door portals must connect expected regions.
7. Invalid geometry prevents candidate selection.
8. Formal verification uses validated physical connectivity.

---

# 5. Topology and Procedural Generation

## FR-019 — Topology Modes

### Maze

Supports branching passages, intersections, dead ends, and optional loops.

### Labyrinth

Supports one continuous nonbranching traversal from entrance to final destination.

Required objectives must lie along the legal traversal sequence.

### Hybrid

Combines branching maze regions and unicursal regions.

Generated topology must satisfy the selected mode.

## FR-020 — Generation Parameters

Generation accounts for:

- Dimensions and units.
- Topology.
- Geometry mode.
- Passage width.
- Corridor width.
- Wall thickness.
- Construction increments.
- Chambers.
- Subgoals.
- Progression ordering.
- Doors.
- Solvability mode.
- Designated-wall placement.
- Structural complexity.
- Difficulty weights.
- Seed.
- Generation strategy.
- Optimization effort.

Mandatory constraints take precedence over optimization preferences.

## FR-021 — Deterministic Generation

1. Users may enter a seed.
2. The application may generate a seed.
3. Candidate seeds are derived deterministically.
4. Identical parameters, seeds, and algorithm versions reproduce identical results.
5. Candidate selection is deterministic.
6. Algorithm versions are recorded in project files and share links.
7. Parallel worker completion order must not affect selected results.

## FR-022 — Structural Complexity

Configurable characteristics include:

- Junction density.
- Branching degree.
- Dead-end density.
- Route length.
- Loop structure.
- Alternative-route availability.

Structural complexity is distinct from composite difficulty.

Achieved values must be available for inspection.

---

# 6. Chambers and Objectives

## FR-023 — Chamber Areas

Chambers are constrained by actual traversable floor area.

| Chamber | Default | Permitted range |
|---|---:|---:|
| General | 16 m² | 16–64 m² |
| Subgoal | 24 m² | 16–64 m² |
| Final goal | 36 m² | 16–64 m² |

Requirements:

1. Area excludes wall footprints.
2. Chambers may be rectangular, circular, irregular, or combinations of supported geometry.
3. Default areas are configurable.
4. Chambers are exempt from uniform corridor width.
5. Chambers respect design bounds and clearance.
6. Goal and subgoal chambers can be enabled independently.

## FR-024 — Entrance and Exit

1. Version 1 has exactly one entrance.
2. Version 1 has exactly one final exit.
3. The generator determines their locations.
4. Both must have valid physical access.
5. Both must be represented explicitly in the navigation model.

## FR-025 — Subgoals

Subgoals have:

- Stable identifier.
- Generated location.
- Required or optional classification.
- Permanent completion flag.
- Optional dependencies.

### Unordered Progression

Default mode.

Required subgoals may be completed in any legally permitted order.

### Ordered Progression

Users may configure ordered progression.

The generator assigns a valid completion sequence.

### Requirements

1. Completion flags never revert.
2. Required subgoals are included in completion verification.
3. Optional subgoals are not required for completion.
4. Door and exit dependencies are independent of global ordering mode.
5. All legally possible completion sequences must be considered.
6. Impossible dependencies must be detected.

## FR-026 — Progression Dependencies

The generator may create:

- Subgoal-dependent doors.
- Gated regions.
- Exit requirements.
- Ordered objective sequences.

Dependencies must be explicit and included in verification.

Intentionally unsolvable designs must remain geometrically valid.

---

# 7. Doors and Concealed Passages

## FR-027 — Door Types

Supported types:

- Ordinary.
- Secret.
- Permanently inaccessible.
- Subgoal-dependent.

## FR-028 — Door Accessibility

Doors may be:

- Traversable.
- Traversable after dependencies.
- Permanently inaccessible.
- Concealed but logically traversable.

Permanently inaccessible doors are barriers.

Secret-door concealment affects presentation, not mathematical reachability.

The system does not simulate human discovery probability.

## FR-029 — Door Generation

1. Door configuration is parameter-driven.
2. The generator selects valid locations.
3. Door portals must satisfy clearance.
4. Door dependencies must be logically consistent.
5. Door states must affect verification correctly.
6. Door information persists through save/load and sharing.

---

# 8. Formal Solvability Verification

## FR-030 — Verification Engine

The engine must formally determine whether a legal completion sequence exists.

Verification considers:

- Validated physical navigation.
- Entrance and exit.
- Required subgoals.
- Ordered or unordered progression.
- Permanent completion flags.
- Door restrictions.
- Exit dependencies.

Finite-state graph search is required.

## FR-031 — Verification Status

| Status | Meaning |
|---|---|
| Solvable | A legal completion sequence has been verified |
| Unsolvable | Exhaustive search proves no legal completion sequence exists |
| Invalid Geometry | Mandatory physical constraints are violated |
| Verification Incomplete | No conclusive result was established |

Requirements:

1. Solvable results include a completion sequence.
2. Unsolvable results require exhaustive verification.
3. Invalid geometry is not reported as confirmed unsolvable.
4. Resource exhaustion produces Verification Incomplete.
5. Cancellation cannot produce a false conclusive result.
6. Results correspond to the correct candidate and algorithm version.

## FR-032 — Solvability Modes

### Standard Solvable

Generate a verified solvable maze.

### Single-Wall Addition Toggle

Generate a solvable maze that becomes unsolvable when one designated wall is added.

### Single-Wall Removal Toggle

Generate an unsolvable maze that becomes solvable when one designated wall is removed.

Both relevant states must be formally verified.

## FR-033 — Designated-Wall Placement

Preferences:

- Automatic.
- Early.
- Middle.
- Late.

The generator selects placement.

The designated wall must:

1. Be physically valid.
2. Completely block a traversable passage.
3. Respect construction constraints.
4. Produce the required solvability change.
5. Satisfy the requested progression classification.

If no qualifying placement exists, generation must report failure.

## FR-034 — Progression Classification

Classification considers:

1. Earliest legal encounter progression.
2. Latest legal encounter progression.
3. Position along a shortest valid completion route.

Supported classifications:

- Early.
- Middle.
- Late.
- Variable.

Initial classification uses three equal normalized progression bands.

A candidate whose legal encounter timing spans multiple bands is classified as Variable.

Alternative legal subgoal orders must be considered.

---

# 9. Difficulty Analysis

## FR-035 — Difficulty Metrics

Five independent metrics:

**1. Minimum Completion Distance**

Shortest valid physical route satisfying all required objectives.

**2. Decision Complexity**

Meaningful junction choices along valid completion routes.

**3. Required Backtracking**

Minimum repeated traversal required by geometry or progression dependencies.

**4. Misleading Branches**

Reachable dead ends and non-contributory optional routes.

**5. Progression Complexity**

Required subgoals, gating dependencies, progression transitions, and mandatory returns.

Each metric must have a deterministic, documented calculation.

## FR-036 — Weighted Difficulty Score

| Metric | Default weight |
|---|---:|
| Minimum completion distance | 20% |
| Decision complexity | 25% |
| Required backtracking | 20% |
| Misleading branches | 25% |
| Progression complexity | 10% |

Requirements:

1. Weights are configurable.
2. Weights normalize to 100%.
3. Raw metrics remain available.
4. Normalization is deterministic.
5. Candidates are compared using consistent normalization.
6. Degenerate cases are handled.
7. The score is a structural heuristic, not a validated prediction of human difficulty.

---

# 10. Optimization Architecture

## FR-037 — Generation Strategies

### Generate Once

Generate and evaluate one deterministic candidate.

If it fails mandatory constraints, report failure.

### Optimize for Preferences

**Default strategy.**

Generate and evaluate multiple candidates, selecting the highest-ranked candidate satisfying all mandatory constraints.

The system does not claim a global optimum unless mathematically established.

## FR-038 — Optimization Effort

Supported levels:

- Fast.
- Balanced.
- Thorough.

Balanced is the default.

Provisional benchmarking budgets:

| Level | Candidate budget |
|---|---:|
| Fast | 10 |
| Balanced | 50 |
| Thorough | 200 |

Budgets are initial implementation values and may be tuned through benchmarking.

Higher effort must not weaken mandatory constraints.

## FR-039 — Three-Tier Candidate Evaluation

### Tier 1 — Topology Screening

Evaluate:

- Graph connectivity.
- Topology classification.
- Objective dependency feasibility.
- Preliminary complexity.
- Preliminary designated-wall feasibility.

Reject candidates failing mandatory requirements.

### Tier 2 — Physical Construction and Verification

Perform:

- Physical geometry construction.
- Wall footprint validation.
- Clearance validation.
- Chamber area validation.
- Independent physical connectivity reconstruction.
- Intended-versus-actual connectivity comparison.
- Formal progression and solvability verification.

Only eligible candidates proceed.

### Tier 3 — Full Difficulty Analysis

Perform:

- Exact difficulty metric calculations.
- Composite scoring.
- Relevant wall and door candidate analysis.
- Ranking.

Select the highest-ranked eligible candidate.

## FR-040 — Candidate Selection

1. All mandatory constraints must be satisfied.
2. Only fully verified eligible candidates may be selected.
3. Ranking uses configured difficulty weights.
4. Ties resolve deterministically.
5. Selected candidate metadata is preserved.
6. Budget exhaustion is distinguished from verification failure.
7. A valid completed candidate may be returned if optimization ends early.
8. If no eligible candidate exists, the application reports failure or incomplete status accurately.

## FR-041 — Wall and Door Candidate Analysis

Evaluate relevant modifications involving:

- Physical walls.
- Permanently inaccessible doors.
- Conditionally restricted doors.

Calculate:

- Solvability impact.
- Completion-distance impact.
- Decision-complexity impact.
- Backtracking impact.
- Misleading-branch impact.
- Progression-complexity impact.

Candidate overlays are informational.

Users cannot manually apply candidate modifications.

The generator may incorporate eligible modifications during optimization.

## FR-042 — Optimization Caching

Reusable calculations may be cached when safe.

Examples:

- Unchanged topology metrics.
- Geometry validation.
- Navigation connectivity.
- Progression states.
- Difficulty metrics.

Cache keys must include all relevant parameters, geometry, and algorithm versions.

Stale results must not be reused.

## FR-043 — Candidate Rendering

1. Candidate evaluation operates on data structures.
2. Candidates are not fully rendered merely for evaluation.
3. Only the selected candidate requires final rendering.
4. Lightweight progress statistics may be shown during optimization.
5. The previous completed design remains visible during regeneration.

---

# 11. Background Processing and Progress

## FR-044 — Web Workers

Web Workers must be introduced with the first computationally expensive generation operation.

Requirements:

1. Expensive generation runs off the main thread.
2. Verification runs off the main thread where necessary.
3. Optimization runs off the main thread.
4. Candidate evaluation uses a bounded worker pool.
5. Worker concurrency is conservative.
6. Workers report structured progress.
7. Large unnecessary data transfers are avoided.
8. Stale jobs cannot overwrite newer results.

## FR-045 — Progress Reporting

The interface distinguishes:

- Candidate generation.
- Topology screening.
- Physical construction.
- Geometry validation.
- Solvability verification.
- Difficulty optimization.
- Final rendering.

Determinate progress is shown when measurable.

Indeterminate progress is shown when a reliable percentage is unavailable.

## FR-046 — Progress Integrity

1. Percentages represent actual completed work.
2. Candidate progress is not mislabeled as total elapsed-work progress.
3. Candidate counts are displayed where available.
4. Fully verified candidate counts should be displayed.
5. Final rendering has a separate progress status.
6. Completion estimates must not be fabricated.

## FR-047 — Cancellation

1. Generation can be cancelled.
2. Optimization can be cancelled.
3. Long-running verification can be cancelled.
4. Cancellation preserves the last completed design.
5. Cancellation does not corrupt project state.
6. Cancelled verification cannot produce false Unsolvable results.
7. Stale worker results cannot replace current results.

## FR-048 — Resource Handling

1. No arbitrary product-level maze-size or wall-count maximum is required.
2. Documented technical resource safeguards may be enforced.
3. Resource exhaustion produces explicit feedback.
4. The UI remains responsive where technically feasible.
5. Optimization is bounded.
6. Resource safeguards cannot silently relax mandatory constraints.

---

# 12. Visualization

## FR-049 — Read-Only SVG Viewport

The viewport must:

1. Render physically accurate geometry.
2. Preserve scale.
3. Support zoom and pan.
4. Support fit-to-view.
5. Render straight and curved walls.
6. Render wall thickness.
7. Render chambers and objectives.
8. Display verification status.
9. Prevent direct geometry editing.

## FR-050 — Overlays

Supported overlays:

- Grid.
- Scale.
- Dimensions.
- Entrance and exit.
- Required and optional subgoals.
- Chambers.
- Secret doors.
- Restricted doors.
- Designated wall.
- Verified completion route.
- Difficulty candidates.

Overlays do not modify geometry.

---

# 13. Export and Project Persistence

## FR-051 — PNG Export

PNG export must be available whenever a maze has rendered.

Requirements:

1. Solvability is not required.
2. Incomplete designs may be exported.
3. Unsolvable designs may be exported.
4. Renderable invalid designs may be exported.
5. Physical proportions are preserved.
6. Resolution is configurable.
7. Grid, dimensions, objectives, and overlays are optional.
8. Export does not modify project state.

## FR-052 — SVG Export

1. SVG export is supported.
2. Circular arcs are preserved.
3. Physical proportions are preserved.
4. Optional annotations and overlays are supported.
5. Export does not modify project state.

## FR-053 — Native Project JSON

Project files preserve:

- Schema version.
- Generator and algorithm versions.
- Seed.
- Selected candidate.
- Generation strategy.
- Optimization effort.
- Dimensions and units.
- Physical constraints.
- Topology and geometry settings.
- Chambers and objectives.
- Progression dependencies.
- Doors.
- Solvability mode.
- Designated-wall metadata.
- Difficulty weights.
- Generated geometry.

Loaded geometry must be revalidated.

Malformed or unsupported files produce actionable errors.

## FR-054 — Static Hosting

1. Static hosting is supported.
2. Iframe embedding is supported.
3. Core functionality requires no backend.
4. The UI adapts to its container.
5. Current stable Chrome, Firefox, and Edge releases are supported.

---

# 14. Shareable Maze Links

## FR-055 — Shareable URL Generation

Users must be able to create a shareable URL for a completed maze.

The URL must contain sufficient information to reconstruct the same selected design using a compatible generator implementation.

No user account, database, or hosted project record is required.

## FR-056 — URL Format

The recommended format uses a versioned payload in the URL fragment.

Illustrative structure:

`https://labyrinth.example/#maze=v1.<encoded-payload>`

The URL fragment is processed by the browser application.

The payload should use a compact, versioned encoding rather than numerous independent query parameters.

## FR-057 — Required Share Payload

The share payload must preserve:

1. Share-payload schema version.
2. Generator algorithm version.
3. Seed.
4. Dimensions and units.
5. Topology and geometry mode.
6. Physical construction constraints.
7. Corridor configuration.
8. Chamber configuration.
9. Required and optional subgoals.
10. Progression configuration.
11. Door configuration.
12. Solvability mode.
13. Designated-wall configuration.
14. Difficulty weights.
15. Generation strategy.
16. Optimization effort.
17. Selected candidate identifier.
18. Any additional deterministic parameters required for exact reconstruction.

The payload must not depend on mutable application defaults for values that could change the generated result.

## FR-058 — Deterministic Reconstruction

Opening a compatible shared link must:

1. Decode the payload.
2. Validate its schema.
3. Validate its parameters.
4. Identify the required generator implementation.
5. Reconstruct the selected maze.
6. Validate physical geometry.
7. Reconstruct physical connectivity.
8. Verify the applicable solvability status.
9. Render the result.
10. Restore the associated configuration.

The receiving user must not need to manually press Generate.

The application must reconstruct the selected candidate directly rather than rerun the full optimization search when sufficient candidate metadata is available.

## FR-059 — Generator Compatibility

1. Share links identify the generator algorithm version.
2. Compatible generator implementations must reproduce identical geometry and logical configuration.
3. The application must not silently substitute a different generator algorithm.
4. Unsupported versions produce an explicit compatibility error.
5. The application must not claim exact reproduction when it cannot guarantee it.
6. The project documentation must define the supported compatibility policy.

A seed-and-configuration link is a reproducible generation recipe, not a permanent archive of physical geometry.

## FR-060 — Shared-Link Validation and Safety

Shared URLs are untrusted input.

Requirements:

1. Payloads must be schema-validated.
2. Encoded payload length must be bounded.
3. Decoded payload size must be bounded.
4. Numerical parameters must be validated.
5. Invalid values must not bypass geometry constraints.
6. Resource safeguards remain active.
7. Malformed payloads produce actionable errors.
8. Unsupported schema versions produce actionable errors.
9. Shared links must not execute arbitrary code.
10. Reconstruction failure must not corrupt an existing project.

## FR-061 — Shared-Link Progress

Shared-maze reconstruction uses the existing progress system.

The interface must distinguish:

- Payload decoding.
- Compatibility validation.
- Geometry reconstruction.
- Physical validation.
- Solvability verification.
- Rendering.

Determinate progress is shown when measurable.

Indeterminate progress is shown otherwise.

## FR-062 — Copy Share Link

A Copy Share Link control must:

1. Generate the URL from the currently completed design.
2. Include the correct selected candidate metadata.
3. Copy the URL to the clipboard.
4. Provide success or failure feedback.
5. Avoid modifying the maze.
6. Remain unavailable when no reproducible completed design exists.

## FR-063 — Copy Share Text

A Copy Share Text control must produce a concise, human-readable description suitable for Reddit, Discord, or other communities.

The generated text may include:

- Product name.
- Maze dimensions.
- Topology.
- Geometry mode.
- Required subgoal count.
- Selected difficulty or optimization information.
- A brief challenge description.
- The share URL.

All displayed claims must reflect the actual saved configuration or verified result.

The user may copy the text without connecting a social-media account.

## FR-064 — Sharing Limitations

Version 1 does not require:

- Server-side link shortening.
- Hosted maze storage.
- User accounts.
- Server-rendered preview images.
- Social-media API integration.
- Permanent support for every historical generator version.

The application must document that link compatibility depends on supported generator versions.

---

# 15. Technical Architecture

## 15.1 Proposed Technology Stack

| Layer | Technology |
|---|---|
| UI | React |
| Language | TypeScript |
| Build system | Vite |
| State management | Zustand |
| Geometry | TypeScript with established computational-geometry libraries where appropriate |
| Navigation | TypeScript |
| Progression verification | TypeScript |
| Rendering | SVG |
| Background processing | Web Workers |
| Unit testing | Vitest |
| Property-based testing | fast-check |
| Component testing | React Testing Library |
| End-to-end testing | Playwright |
| Deployment | Static hosting |

## 15.2 Architectural Modules

**Configuration Module**

Stores sidebar parameters and defaults.

**Topology Generator**

Constructs intended navigation and objective relationships.

**Geometry Constructor**

Builds physical walls, passages, chambers, and portals.

**Geometry Validator**

Checks physical integrity, clearance, bounds, and intersections.

**Physical Navigation Builder**

Independently reconstructs traversable connectivity.

**Progression Verifier**

Performs finite-state completion analysis.

**Difficulty Engine**

Calculates structural metrics and scores.

**Optimization Engine**

Screens, evaluates, and ranks candidates.

**Worker Coordinator**

Schedules background jobs, progress, and cancellation.

**Rendering Module**

Produces viewport and export representations.

**Persistence Module**

Handles versioned project serialization.

**Sharing Module**

Encodes, decodes, validates, and reconstructs shared designs.

## 15.3 Geometry Precision

Use canonical metric coordinates and centralized numerical tolerances.

Construction increments must use consistent quantization.

Geometric predicates must not rely on inconsistent floating-point equality checks.

## 15.4 Circular Arcs

Circular arcs use explicit defining geometry.

Construction increments constrain applicable radii and endpoints.

Intersection and clearance validation operate on actual resulting geometry.

## 15.5 Physical Navigation

The physical navigation builder must not reuse intended topology as its proof of correctness.

It reconstructs traversability from physical geometry.

A constrained triangulation or equivalent free-space decomposition is recommended.

## 15.6 Verification State

The state-space model includes:

- Current navigable region.
- Permanent subgoal-completion flags.
- Additional progression state only when necessary.

Door accessibility is derived from the state and dependency configuration.

## 15.7 Worker Scheduling

Worker jobs have stable identifiers.

Candidate evaluation is deterministic for fixed inputs.

Worker completion order must not influence candidate ranking.

Cancellation and revision tracking prevent stale results from replacing newer ones.

## 15.8 Rendering

Viewport and export rendering should share an authoritative geometry-to-SVG representation.

Only selected candidates require full rendering.

## 15.9 Sharing Architecture

The sharing module must:

1. Serialize deterministic generation inputs.
2. Encode a compact versioned payload.
3. Decode and validate untrusted payloads.
4. Resolve compatible generator versions.
5. Reconstruct selected candidates.
6. Verify reconstruction.
7. Restore configuration and render the result.

Sharing must remain independent of backend services.

---

# 16. Jira Implementation Backlog

## Epic MZ-100 — Foundation and Physical Correctness

### MZ-101 — Initialize Application

- AC-101.1: React, TypeScript, and Vite are configured.
- AC-101.2: Strict TypeScript compilation is enabled.
- AC-101.3: Core logic is independent of React.
- AC-101.4: Zustand is configured.
- AC-101.5: Vitest, fast-check, React Testing Library, and Playwright are configured.
- AC-101.6: Production builds succeed.

### MZ-102 — Sidebar and Coordinate System

- AC-102.1: Parameter-driven sidebar is implemented.
- AC-102.2: Meters and feet are supported.
- AC-102.3: Meters are the default.
- AC-102.4: Dimensions are physically preserved.
- AC-102.5: Pending configuration is distinguishable from rendered configuration.
- AC-102.6: No manual geometry editing controls exist.

### MZ-103 — Physical Construction Constraints

- AC-103.1: Minimum passage width defaults to 1.0 m.
- AC-103.2: Wall thickness defaults to 1.0 m.
- AC-103.3: Uniform corridor width is optional and disabled by default.
- AC-103.4: Uniform width applies only to corridors.
- AC-103.5: Construction increments are configurable.
- AC-103.6: A 0.5 m increment is supported.
- AC-103.7: Physical wall footprints are validated.
- AC-103.8: Invalid parameter combinations are reported.

### MZ-104 — Geometry and Domain Model

- AC-104.1: Straight walls and circular arcs are represented.
- AC-104.2: Wall thickness is explicit.
- AC-104.3: Corridors, halls, and chambers are distinguishable.
- AC-104.4: Entrances, exits, doors, and subgoals have stable IDs.
- AC-104.5: A level ID exists.
- AC-104.6: Version 1 supports exactly one level.
- AC-104.7: Geometry is serializable.
- AC-104.8: Invalid geometry is detectable.

### MZ-105 — Physical Navigation Consistency

**Priority: Critical**

- AC-105.1: Physical wall footprints are authoritative for clearance and connectivity.
- AC-105.2: Traversable connectivity is independently reconstructed from physical geometry.
- AC-105.3: Intended connections must be physically valid.
- AC-105.4: Unintended physical connections must be detected.
- AC-105.5: Door portals must satisfy physical clearance.
- AC-105.6: Invalid geometry prevents candidate selection.
- AC-105.7: Adversarial straight and curved geometries are tested.
- AC-105.8: Formal verification uses validated physical navigation.

### MZ-106 — Early Project Persistence

**Priority: High**

- AC-106.1: A versioned JSON schema exists during foundation development.
- AC-106.2: Configuration and geometry can be serialized.
- AC-106.3: Basic save/load is available by the first usable release.
- AC-106.4: Loaded geometry is revalidated.
- AC-106.5: Unsupported schema versions produce explicit errors.
- AC-106.6: Schema changes support migration or explicit rejection.

### MZ-107 — Worker Infrastructure

**Priority: Critical**

- AC-107.1: Expensive generation can run in Web Workers.
- AC-107.2: Jobs have stable identifiers.
- AC-107.3: Workers report structured progress.
- AC-107.4: Jobs can be cancelled.
- AC-107.5: Stale results cannot overwrite current results.
- AC-107.6: Worker failures do not corrupt project state.

---

## Epic MZ-200 — Procedural Generation

### MZ-201 — Orthogonal Generator

- AC-201.1: Orthogonal mazes are generated from parameters.
- AC-201.2: Maximum design dimensions are respected.
- AC-201.3: Wall thickness and clearance are respected.
- AC-201.4: Optional uniform corridor width is respected.
- AC-201.5: Construction increments are respected.
- AC-201.6: Seeds produce deterministic results.
- AC-201.7: Invalid configurations are reported.

### MZ-202 — Topology Modes

- AC-202.1: Maze mode is supported.
- AC-202.2: Unicursal labyrinth mode is supported.
- AC-202.3: Hybrid mode is supported.
- AC-202.4: Generated topology is validated.
- AC-202.5: Objective placement respects topology.

### MZ-203 — Structural Complexity

- AC-203.1: Structural complexity parameters are configurable.
- AC-203.2: Junction and branching metrics are available.
- AC-203.3: Dead-end and loop metrics are available.
- AC-203.4: Achieved complexity is reported.
- AC-203.5: Results are deterministic.

### MZ-204 — Circular and Mixed Geometry

- AC-204.1: Circular arcs are supported.
- AC-204.2: Mixed geometry is supported.
- AC-204.3: Arc defining geometry respects construction increments.
- AC-204.4: Curved clearance is validated.
- AC-204.5: Invalid intersections are rejected.
- AC-204.6: Physical connectivity is reconstructed for curved geometry.

### MZ-205 — Objectives and Chambers

- AC-205.1: Required and optional subgoals are generated.
- AC-205.2: Unordered progression is the default.
- AC-205.3: Ordered progression is supported.
- AC-205.4: Goal and subgoal chambers are independently configurable.
- AC-205.5: Chamber areas remain within 16–64 m².
- AC-205.6: Default areas are 16, 24, and 36 m² by type.
- AC-205.7: Nonrectangular chambers are supported.
- AC-205.8: Objective placement respects progression.

### MZ-206 — Generation Strategies

- AC-206.1: Generate Once is supported.
- AC-206.2: Optimize for Preferences is the default.
- AC-206.3: Fast, Balanced, and Thorough effort levels are supported.
- AC-206.4: Balanced is the default.
- AC-206.5: Candidate generation is deterministic.
- AC-206.6: Mandatory constraints are never relaxed.
- AC-206.7: Selected candidate metadata is preserved.

### MZ-207 — Tiered Optimization Pipeline

**Priority: Critical**

- AC-207.1: Topology screening precedes expensive physical validation.
- AC-207.2: Physical validation precedes full difficulty analysis.
- AC-207.3: Final candidates pass all mandatory checks.
- AC-207.4: Candidate evaluation uses a bounded worker pool.
- AC-207.5: Effort levels control candidate budgets.
- AC-207.6: Budget exhaustion is distinguished from verification failure.
- AC-207.7: Candidate progress is reported accurately.
- AC-207.8: Only the selected candidate requires full rendering.
- AC-207.9: Cache reuse respects geometry and logical state.

---

## Epic MZ-300 — Formal Solvability

### MZ-301 — Verification Engine

- AC-301.1: Verified physical navigation is used.
- AC-301.2: Required subgoals are included.
- AC-301.3: Ordered and unordered progression are supported.
- AC-301.4: Door and exit dependencies are included.
- AC-301.5: Four verification states are distinguished.
- AC-301.6: Solvable results include a completion sequence.
- AC-301.7: Unsolvable results require exhaustive verification.
- AC-301.8: Resource exhaustion produces Verification Incomplete.
- AC-301.9: Results correspond to the correct candidate.

### MZ-302 — Single-Wall Addition Toggle

- AC-302.1: Initial design is verified solvable.
- AC-302.2: A valid designated wall is identified.
- AC-302.3: Adding the wall makes completion impossible.
- AC-302.4: Removing it restores solvability.
- AC-302.5: Both states are verified.
- AC-302.6: Construction constraints are respected.
- AC-302.7: Placement preferences are supported.
- AC-302.8: The wall can be highlighted.

### MZ-303 — Single-Wall Removal Toggle

- AC-303.1: Initial design is verified unsolvable.
- AC-303.2: A designated removable wall is identified.
- AC-303.3: Removing the wall restores solvability.
- AC-303.4: Restoring the wall prevents completion.
- AC-303.5: Both states are verified.

### MZ-304 — Progression Classification

- AC-304.1: Early, Middle, Late, and Variable are supported.
- AC-304.2: Required progression is considered.
- AC-304.3: Alternative legal subgoal orders are considered.
- AC-304.4: Completion-route position is considered.
- AC-304.5: Variable timing is detected.
- AC-304.6: Unsatisfied placement constraints are reported.

### MZ-305 — Secret and Restricted Doors

- AC-305.1: Ordinary doors are supported.
- AC-305.2: Secret doors are supported.
- AC-305.3: Permanently inaccessible doors are supported.
- AC-305.4: Subgoal-dependent doors are supported.
- AC-305.5: Door states affect verification.
- AC-305.6: Concealment is independent of accessibility.
- AC-305.7: Door portals satisfy physical clearance.

---

## Epic MZ-400 — Difficulty Analysis

### MZ-401 — Difficulty Metrics

- AC-401.1: Completion distance is calculated.
- AC-401.2: Decision complexity is calculated.
- AC-401.3: Required backtracking is calculated.
- AC-401.4: Misleading branches are calculated.
- AC-401.5: Progression complexity is calculated.
- AC-401.6: Raw values are available.
- AC-401.7: Calculations are deterministic.

### MZ-402 — Weighted Scoring

- AC-402.1: Five configurable weights are supported.
- AC-402.2: Defaults are 20/25/20/25/10.
- AC-402.3: Weights normalize to 100%.
- AC-402.4: Metric normalization is deterministic.
- AC-402.5: Candidate scores are comparable.
- AC-402.6: Individual contributions are visible.

### MZ-403 — Candidate Ranking

- AC-403.1: Multiple candidates are evaluated.
- AC-403.2: Invalid candidates are excluded.
- AC-403.3: Mandatory solvability constraints are verified.
- AC-403.4: Eligible candidates are ranked.
- AC-403.5: The highest-ranked eligible candidate is selected.
- AC-403.6: Ties resolve deterministically.
- AC-403.7: Effort controls search budget.
- AC-403.8: Reproducibility metadata is preserved.

### MZ-404 — Wall and Door Analysis

- AC-404.1: Physical wall candidates are evaluated.
- AC-404.2: Permanently inaccessible door candidates are evaluated.
- AC-404.3: Conditionally restricted door candidates are evaluated.
- AC-404.4: Solvability impact is calculated.
- AC-404.5: Difficulty impact is calculated.
- AC-404.6: Candidate overlays are supported.
- AC-404.7: Overlays are read-only.

---

## Epic MZ-500 — Visualization and Progress

### MZ-501 — Read-Only Viewport

- AC-501.1: Top-down rendering is supported.
- AC-501.2: Zoom and pan are supported.
- AC-501.3: Fit-to-view is supported.
- AC-501.4: Physical proportions are preserved.
- AC-501.5: Straight and curved geometry render correctly.
- AC-501.6: Wall thickness is visible.
- AC-501.7: Geometry cannot be manually edited.

### MZ-502 — Overlays

- AC-502.1: Grid overlay is supported.
- AC-502.2: Scale and dimensions are supported.
- AC-502.3: Objectives and chambers are displayed.
- AC-502.4: Secret and restricted doors can be highlighted.
- AC-502.5: Designated walls can be highlighted.
- AC-502.6: Completion routes can be displayed.
- AC-502.7: Difficulty candidates can be displayed.
- AC-502.8: Overlays do not modify geometry.

### MZ-503 — Progress and Cancellation UI

- AC-503.1: Current processing stage is displayed.
- AC-503.2: Measurable progress uses a determinate bar.
- AC-503.3: Unmeasurable progress uses an indeterminate indicator.
- AC-503.4: Candidate counts are displayed where available.
- AC-503.5: Final rendering has its own progress status.
- AC-503.6: Cancellation is available.
- AC-503.7: Cancellation preserves the last completed design.
- AC-503.8: Stale results cannot replace current results.

---

## Epic MZ-600 — Export, Persistence, and Sharing

### MZ-601 — PNG Export

**Priority: Critical**

- AC-601.1: PNG export is available after rendering.
- AC-601.2: Solvability is not required.
- AC-601.3: Incomplete and unsolvable designs can be exported.
- AC-601.4: Renderable invalid designs can be exported.
- AC-601.5: Physical proportions are preserved.
- AC-601.6: Resolution is configurable.
- AC-601.7: Grid and dimensions are optional.
- AC-601.8: Objective and secret-door overlays are optional.
- AC-601.9: Designated-wall and difficulty overlays are optional.
- AC-601.10: Export does not modify project state.

### MZ-602 — Complete Project Persistence

- AC-602.1: Versioned JSON projects are supported.
- AC-602.2: Parameters and seeds are preserved.
- AC-602.3: Generated geometry is preserved.
- AC-602.4: Progression and door configuration are preserved.
- AC-602.5: Solvability configuration is preserved.
- AC-602.6: Difficulty weights are preserved.
- AC-602.7: Generator and candidate metadata are preserved.
- AC-602.8: Loaded projects are revalidated.
- AC-602.9: Malformed files produce actionable errors.

### MZ-603 — SVG Export

- AC-603.1: SVG export is supported.
- AC-603.2: Circular arcs are preserved.
- AC-603.3: Physical proportions are preserved.
- AC-603.4: Optional overlays and annotations are supported.
- AC-603.5: Export does not modify project state.

### MZ-604 — Static Hosting and Embedding

- AC-604.1: Static hosting is supported.
- AC-604.2: Iframe embedding is supported.
- AC-604.3: Core functionality requires no backend.
- AC-604.4: The UI adapts to its container.
- AC-604.5: Current stable Chrome, Firefox, and Edge releases are supported.

### MZ-605 — Shareable Maze Links

**Priority: High**  
**Target: First usable public release**

- AC-605.1: Users can generate a shareable URL for a completed maze.
- AC-605.2: The URL contains the seed and all deterministic configuration parameters.
- AC-605.3: The URL identifies the generator algorithm version.
- AC-605.4: The URL identifies the selected candidate.
- AC-605.5: Compatible links reconstruct identical geometry and logical configuration.
- AC-605.6: Reconstruction validates geometry and solvability.
- AC-605.7: Reconstruction displays progress.
- AC-605.8: Malformed or unsupported links produce actionable errors.
- AC-605.9: Sharing requires no account, backend, or database.
- AC-605.10: Copy Share Link is supported.
- AC-605.11: Copy Share Text is supported.
- AC-605.12: Unsupported versions do not silently produce different mazes.
- AC-605.13: Payloads are validated and size-limited.
- AC-605.14: Shared input cannot bypass resource safeguards.
- AC-605.15: The share format is versioned.
- AC-605.16: Shared links work with static hosting.

---

# 17. Testing Strategy

## 17.1 Unit Tests

Test:

- Unit conversion.
- Geometry predicates.
- Wall intersections.
- Wall thickness.
- Construction increments.
- Clearance.
- Chamber areas.
- Topology generation.
- Door portals.
- Subgoal dependencies.
- Difficulty metrics.
- Scoring normalization.
- Share-payload encoding and decoding.

## 17.2 Property-Based Tests

Verify:

1. Accepted geometry remains within bounds.
2. Required passages satisfy clearance.
3. Chambers satisfy area constraints.
4. Deterministic inputs reproduce deterministic outputs.
5. Completed subgoal flags never revert.
6. Designated-wall toggles change solvability as specified.
7. Resource exhaustion never produces false Unsolvable results.
8. Physical navigation agrees with validated geometry.
9. Share-payload round trips preserve deterministic configuration.

## 17.3 Adversarial Geometry Tests

Include:

- Nearly touching walls.
- Tangent circular arcs.
- Coincident boundaries.
- Narrow diagonal gaps.
- Curved corridor pinch points.
- Construction-increment edge cases.
- Disconnected chambers.
- Unintended shortcuts.
- Undersized door portals.
- Microscopic wall gaps.

## 17.4 Independent Reference Cases

Maintain reference mazes with independently established expected connectivity.

Expected results must not be derived solely from the generator's own intended graph.

## 17.5 Sharing Tests

Test:

1. A generated maze can produce a share URL.
2. Opening that URL reconstructs identical geometry.
3. Logical configuration is preserved.
4. Selected candidate identity is preserved.
5. Compatible generator versions reproduce results.
6. Unsupported generator versions produce explicit errors.
7. Invalid payloads are rejected.
8. Excessively large payloads are rejected.
9. Shared reconstruction respects resource safeguards.
10. Shared reconstruction does not rerun unnecessary optimization.
11. Copy Share Link produces the expected URL.
12. Copy Share Text accurately describes the maze.
13. Reconstruction remains deterministic under different worker completion orders.

## 17.6 Integration Tests

Test:

- Configuration to generation.
- Topology to physical geometry.
- Geometry to reconstructed navigation.
- Navigation to progression verification.
- Tiered optimization.
- Worker cancellation.
- Progress reporting.
- JSON save/load.
- URL reconstruction.
- Rendering and export consistency.

## 17.7 End-to-End Tests

Test:

- Standard solvable maze.
- Unicursal labyrinth.
- Hybrid maze.
- Ordered subgoals.
- Unordered subgoals.
- Secret doors.
- Single-wall addition toggle.
- Single-wall removal toggle.
- Difficulty optimization.
- Cancellation.
- PNG export.
- SVG export.
- JSON save/load.
- Share URL creation.
- Opening a shared maze.
- Unsupported share-link handling.

---

# 18. Nonfunctional Requirements

## NFR-001 — Mathematical Correctness

No unverified result may be presented as mathematically proven.

## NFR-002 — Physical Accuracy

Geometry preserves dimensions, wall thickness, and clearance.

## NFR-003 — Navigation Consistency

Logical navigation agrees with independently reconstructed physical connectivity.

## NFR-004 — Reproducibility

Identical parameters, seeds, and algorithm versions reproduce identical results.

## NFR-005 — Responsiveness

Expensive operations execute asynchronously where necessary.

## NFR-006 — Cancellation Safety

Cancellation does not corrupt project state or create false verification results.

## NFR-007 — Progress Integrity

Determinate progress reflects measurable completed work.

## NFR-008 — Resource Handling

No arbitrary product-level maze-size or wall-count maximum is required.

Technical resource limits are handled explicitly.

## NFR-009 — Accessibility

Applicable controls and workflows should target WCAG 2.2 AA.

## NFR-010 — Testability

Geometry, navigation, progression, generation, optimization, and sharing are independently testable.

## NFR-011 — Extensibility

The architecture supports future multi-level expansion.

## NFR-012 — Share-Link Safety

Shared payloads are untrusted input and must be validated before processing.

## NFR-013 — Compatibility Transparency

The application must not silently substitute incompatible generator versions when reconstructing shared designs.

---

# 19. Revised Implementation Phases

| Phase | Deliverable | Primary stories |
|---|---|---|
| 1 | Foundation, geometry model, JSON schema, worker infrastructure, share-payload schema | MZ-101–104, MZ-106–107, MZ-605 foundation |
| 2 | Orthogonal generator and independent physical navigation validation | MZ-105, MZ-201–203 |
| 3 | Basic formal solvability verification | MZ-301 |
| 4 | Read-only viewport, progress UI, PNG export, basic save/load, share-link reconstruction | MZ-501–503, MZ-601, MZ-605 core |
| 5 | Objectives, chambers, doors, full progression verification | MZ-205, MZ-305 |
| 6 | Single-wall toggles and progression classification | MZ-302–304 |
| 7 | Difficulty metrics and tiered optimization | MZ-206–207, MZ-401–404 |
| 8 | Circular-arc and mixed geometry | MZ-204 |
| 9 | Complete persistence, SVG export, embedding, compatibility QA, sharing polish | MZ-602–605 completion |

## Milestone A — Foundational Correctness

- Geometry model established.
- Worker infrastructure operational.
- Orthogonal generation functional.
- Physical connectivity independently validated.
- JSON and share-payload schemas defined.

## Milestone B — First Usable Public Generator

- Sidebar configuration.
- Read-only viewport.
- Basic solvability verification.
- Progress reporting.
- PNG export.
- Basic JSON save/load.
- Copy Share Link.
- Automatic reconstruction of compatible shared mazes.

The first public release may support a documented subset of the eventual Version 1 generation modes, but must not misrepresent unsupported features.

## Milestone C — Full Progression

- Chambers.
- Required and optional subgoals.
- Ordered and unordered progression.
- Restricted and secret doors.
- Single-wall solvability toggles.

## Milestone D — Optimized Generator

- Five difficulty metrics.
- Weighted scoring.
- Tiered candidate evaluation.
- Bounded worker-pool optimization.
- Candidate analysis overlays.

## Milestone E — Version 1 Release

- Circular and mixed geometry.
- Complete JSON persistence.
- SVG export.
- Static deployment and embedding.
- Share-link compatibility testing.
- Copy Share Text.
- Final automated and manual QA.

---

# 20. Resolved Technical Decisions

| ID | Decision | Resolution |
|---|---|---|
| TD-001 | Geometry precision | Canonical metric coordinates with centralized tolerances |
| TD-002 | Circular-arc increments | Constrain defining dimensions and endpoints |
| TD-003 | Navigation model | Independently reconstruct connectivity from physical geometry |
| TD-004 | Clearance | Obstacle inflation or equivalent physical-clearance analysis |
| TD-005 | Difficulty normalization | Deterministic normalization with raw values preserved |
| TD-006 | Progression classification | Normalized progression bands with Variable classification |
| TD-007 | Candidate search | Bounded, seeded, generator-produced candidates |
| TD-008 | Optimization | Three-tier candidate evaluation |
| TD-009 | Concurrency | Bounded Web Worker pool |
| TD-010 | Validation scheduling | Job IDs, cancellation, revision tracking |
| TD-011 | Rendering | Shared geometry-to-SVG representation |
| TD-012 | Wall intersections | Resolve during generation |
| TD-013 | Verification state | Navigable region plus permanent completion flags |
| TD-014 | Persistence | Versioned JSON schema from foundation phase |
| TD-015 | Progress | Determinate when measurable, otherwise indeterminate |
| TD-016 | Candidate rendering | Fully render only the selected candidate |
| TD-017 | Optimization budgets | Fast/Balanced/Thorough with benchmark-adjusted limits |
| TD-018 | Share URL format | Versioned, compact URL-fragment payload |
| TD-019 | Share reconstruction | Reconstruct selected candidate directly |
| TD-020 | Generator compatibility | Explicit algorithm versions; no silent substitution |
| TD-021 | Share-link safety | Validate schema, size, numerical values, and resource limits |
| TD-022 | Share deployment | Entirely client-side for Version 1 |

---

# 21. Definition of Done

A Jira story is complete when:

1. Its acceptance criteria pass.
2. Applicable automated tests exist and pass.
3. TypeScript compilation succeeds.
4. Linting succeeds.
5. Invalid inputs are handled.
6. Errors are actionable.
7. No known critical correctness defects remain.
8. Documentation is updated.
9. Physical and logical integrity is preserved.
10. The implementation is reviewed against this PRD.

Version 1 is complete when all approved Version 1 stories are implemented, integration and end-to-end tests pass, and the application can be deployed as a static web application.

---

# 22. Product Owner Approval

**Document version:** 0.7  
**Status:** Draft — Awaiting Product Owner Approval  
**Functional scope:** Consolidated  
**Architecture:** Defined  
**Physical correctness strategy:** Defined  
**Optimization strategy:** Defined  
**Sharing strategy:** Defined  
**Implementation authorization:** Pending

Version 0.7 supersedes Version 0.6.

It retains all previously approved capabilities and adds:

- Shareable maze URLs.
- Compact versioned share payloads.
- Deterministic reconstruction of selected candidates.
- Explicit generator compatibility handling.p
- Shared-link validation and resource safeguards.
- Automatic reconstruction progress.
- Copy Share Link.
- Copy Share Text.
- Sharing in the first usable public release.

**Next step:** Product owner approval and implementation planning.

---

**End of Document — Version 0.7**