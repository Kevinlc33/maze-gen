# Design

## Context

See `proposal.md` for motivation and scope. The repository is a React 19, TypeScript, and Vite starter with no generation domain or established application architecture. The implementation must introduce React-independent correctness modules and keep the PRD requirements in `storyDetails.md` authoritative.

## Goals / Non-Goals

**Goals:**

- Establish a typed domain model for configuration, geometry, topology, objectives, doors, verification, and candidate metadata.
- Separate intended topology from independently reconstructed physical navigation.
- Run expensive candidate work in deterministic Web Workers with cancellation and stale-result protection.
- Share one geometry-to-SVG representation between viewport and exports.
- Define versioned, validated JSON and URL payloads from the foundation.
- Preserve the last successfully rendered design while new work runs.

**Non-Goals:**

- Manual geometry editing, multi-level designs, accounts, backend storage, AI explorers, or 3D rendering.
- A general-purpose CAD engine beyond straight walls, circular arcs, chambers, and required construction constraints.
- Global proof of optimization optimality.

## Decisions

### 1. Modularized core with a React adapter

Use a `src/core/` package with independent configuration, topology, geometry, navigation, verification, difficulty, optimization, persistence, and sharing modules. React components should call a worker-coordinated application service and contain no generation or mathematical correctness logic.

Rationale: core logic remains unit-testable and can run identically in a worker and the main thread. Alternative coupling logic to React would make worker reuse and correctness testing difficult.

### 2. Canonical metric geometry model

Represent generated geometry using metric coordinates, explicit wall footprints, straight segments, circular arcs, chamber regions, stable IDs, entrance, exit, doors, and objectives. Centralize tolerances and construction-increment quantization.

Rationale: rendering, clearance, JSON, and sharing need one representation with deterministic predicates. Alternative unit-specific geometry would duplicate conversion and precision behavior.

### 3. Independent navigation reconstruction

The topology generator produces intended graph relationships, while a separate navigation builder reconstructs traversable regions from wall footprints and door portals. Candidate eligibility requires agreement between intended connections and reconstructed physical connectivity, plus detection of unintended shortcuts.

Rationale: intended topology is not sufficient proof of physical correctness. Alternative reuse of the intended graph would hide geometric false positives.

### 4. Finite-state progression verification

Represent verification state as the validated navigable region and permanent objective completion flags, with doors and exit dependencies derived from that state. Reaching an objective location does not complete it: a zero-distance completion-action transition is available there only when progression rules permit it. V1 models no puzzle-solving time or effort. Use exhaustive finite-state search for conclusive results and an explicit incomplete state for resource exhaustion or cancellation.

Rationale: explicit actions preserve a stable extension point for future mechanisms and puzzles while keeping V1 distance metrics physical. Alternative automatic region-entry completion conflates location with interaction; route heuristics would not prove absence of a completion sequence.

### 5. Three-tier worker pipeline

Run topology screening, geometry construction and physical validation, full-progression verification, and difficulty analysis as ordered candidate stages. Each candidate advances as soon as its preceding stage completes, subject to bounded stage queues. Worker jobs carry stable IDs and revision IDs, and the candidate ranking input includes every algorithm and configuration version relevant to its result.

Rationale: expensive work is avoided for low-quality topology, completed construction is not held behind a batch barrier, and worker completion order cannot affect ranking. Alternative batch-wide barriers delay useful validation; first-success selection would make output scheduling-dependent.

### 6. Bounded and deterministic optimization

Derive candidate seeds from the base seed and candidate index, use initial effort budgets of 10/50/200, cache only parameter- and geometry-compatible calculations, and resolve ties by a stable key. Generate Once evaluates one candidate. Preference optimization does not stop at the first valid result; it evaluates its budget unless cancelled, resource-limited, or a deterministic proof establishes optimality. A partial search is explicitly incomplete even when it preserves the best fully verified candidate evaluated so far.

Rationale: reproducibility remains independent of worker scheduling and incomplete search cannot be mistaken for completed optimization. Alternative first-success stopping would produce completion-order-dependent selection and overstate search completeness.

### 7. Verification scope and candidate provenance

Every verification result records whether it proves `navigation-reachability` or `full-progression` and binds that claim to candidate identity, algorithm version, configuration, and the authoritative progression inputs. Full progression requires the complete configured objectives, ordering rules, door dependencies, and exit requirements; an explicit empty configuration is distinct from a missing or fallback input. Only a conclusive `Solvable` full-progression result with matching provenance qualifies for solvable-candidate ranking. Conclusive `Unsolvable` remains valid evidence but is not rank-eligible; incomplete results never qualify.

Rationale: an entrance-to-exit check cannot stand in for configured progression, and a bare boolean cannot communicate what was verified. Scope and provenance make the production claim auditable.

### 8. Zustand application state

Use Zustand for pending configuration, rendered configuration, job status, worker results, viewport state, errors, and export availability. The store may remain active while the selected candidate is rendered, but worker publication must check revision and job IDs.

Rationale: Zustand is already specified and keeps UI state small. Alternative React context alone would require more rerender-heavy state wiring.

### 9. Structural-complexity target and topology sizing

Expose a user-configurable structural-complexity target distinct from achieved structural measurements and the weighted difficulty score. Derive topology dimensions from the target together with design area, wall and passage dimensions, construction increments, and other hard physical constraints. The existing 4×4 topology grid is an interim implementation constraint, not the final sizing model. Never relax hard constraints to satisfy a target; report an infeasible target explicitly.

The target's input scale and the deterministic, versioned mapping from target and physical constraints to topology dimensions are a product-owner design gate before task 6.10 implementation. No sizing formula or scale is presumed by this plan.

Rationale: fixed dimensions prevent meaningful complexity configuration, while conflating target and achieved difficulty would make preference ranking ambiguous.

### 10. Truthful unavailable actions

Save, Load, and Share controls remain disabled or clearly labeled unavailable until their operations are implemented. Success feedback is emitted only after the actual operation completes successfully; rejected operations report failure.

Rationale: a success-shaped placeholder misrepresents persisted or copied data and can cause users to rely on an operation that did not occur.

### 11. Shared SVG representation

Build an authoritative geometry-to-SVG scene model, render it in the viewport, and serialize the same scene for SVG export. PNG export rasterizes that representation with the selected resolution and overlays.

Rationale: one representation prevents SVG and PNG export from drifting. Alternative independent canvas and SVG renderers would duplicate geometry and annotation logic.

### 12. Versioned persistence and sharing

Define explicit JSON schemas and share-payload schemas from foundation work. JSON preserves the project and geometry. URL fragments preserve sufficient deterministic inputs and selected-candidate metadata, with algorithm and payload versions. Decode, validate size and numeric bounds, and reconstruct compatible candidates without rerunning optimization.

Rationale: static hosting has no backend and URL data is untrusted. Alternative seed-only links would silently depend on mutable defaults.

### 13. Test-first correctness and staged delivery

Implement domain modules with Vitest and fast-check. Add independent reference geometries and adversarial cases for navigation and clearance. Use React Testing Library for stateful UI and Playwright for critical workflows. Add Vitest/Playwright only after the toolchain dependencies are established.

Rationale: the PRD makes geometry and formal verification correctness central. Alternative UI-first implementation would allow visual demos to conceal invalid candidates.

### 14. Technical safeguards and release acceptance

Expose resource safeguards as typed technical-limit outcomes. Do not impose product-level maze-size limits beyond the configured design area and documented technical resource bounds. Release acceptance combines unit, property, adversarial, independent-reference, integration, and browser end-to-end evidence with an explicit unsupported-feature review.

Rationale: correctness claims must remain distinguishable from UI success or heuristic ranking. Alternative silent bounds or UI-only tests could misrepresent invalid or incomplete work as a result.

## Risks / Trade-offs

- Physical free-space reconstruction is algorithmically complex → Start with robust orthogonal decomposition and add curved-region handling through equivalently tested geometry predicates.
- Circular arc and mixed geometry can be computationally expensive → Keep exact defining arcs in the core model and use conservative worker resource limits.
- Three-tier optimization may produce partial progress → Display stage and candidate counts separately and never infer a conclusive status.
- Streaming worker completion may tempt first-result publication → Keep candidate identity and final selection independent of completion order; label partial searches incomplete.
- A structural target can conflict with physical constraints → Use a versioned sizing policy, preserve hard constraints, and report infeasibility.
- A reachability-only result may be mistaken for full verification → Carry explicit scope and provenance through candidate publication and ranking.
- Share payloads can become large → Bound input sizes and preserve selected candidate metadata while omitting unnecessary intermediate candidates.
- Static deployment lacks server-backed compatibility checks → Encode versions and fail explicitly rather than substituting algorithms.
- A single implementation change can be large → Deliver it through the milestones and tasks in this change while retaining one candidate contract.

## Migration Plan

This is a greenfield replacement of the starter UI. Implement incrementally: establish domain schemas and worker infrastructure, add orthogonal generation and navigation, add formal verification and the viewport, then add objectives, optimization, circular geometry, exports, persistence, and sharing.

Rollback is application-level: until implementation is complete, retain the existing starter as source under version control and validate production builds after each milestone. Unsupported or malformed persisted data must be rejected, not migrated silently.
