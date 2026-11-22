# Design

## Context

See `proposal.md` for the audit findings and scope. The current orthogonal physical-navigation code flood-fills free-space cells but compares topology using direct center segments; the verifier accepts a caller-built graph with a `geometryValid` boolean; wall-toggle and route-classification helpers accept abstract inputs; and the UI does not run a generation pipeline. Existing finite-state search behavior is correct for a trustworthy graph and should be retained.

The controlling behavior contracts are in the four capability specs. This design deliberately does not implement curved/mixed physical geometry or persistence; those remain in their existing future tasks.

## Goals / Non-Goals

**Goals:**

- Make a single validated physical-navigation result the provenance boundary for all production verification.
- Preserve the existing progression-state search while removing caller authority to assert physical validity.
- Make physical changes, weighted routes, and candidate publication testable end to end.
- Bound exhaustive analyses and represent resource exhaustion as incomplete.

**Non-Goals:**

- Reimplement the finite-state search without evidence of a defect in its graph-search behavior.
- Add curved or mixed free-space reconstruction, persistence/schema migration, or task 6 optimization.
- Relax mandatory geometry, progression, or worker constraints to obtain a successful candidate.

## Decisions

### 1. Validate inputs before geometric arithmetic

Reject NaN and infinite configuration and geometry values at validation boundaries. Check actual point and footprint bounds before coordinate-to-cell lookup; never clamp an invalid endpoint or portal into a valid region. Portal validation must establish its clearance and actual pair of connected physical regions. Construction applies the configured increment to placements and dimensions or returns a specific infeasible-construction result; it must not round in a way that silently violates clearance or bounds.

Alternative considered: rely on downstream geometry arithmetic to reject malformed input. Rejected because NaN comparison behavior already demonstrates that malformed values can bypass ordinary range checks.

### 2. Derive and mint an opaque validated navigation result

The physical-navigation boundary consumes geometry, intended topology, and applicable validation parameters. On success it returns an immutable, opaque validated artifact containing candidate identity, physical regions, explicit connections and portal evidence, endpoint mappings, and the validation outcome needed by verification. Invalid geometry and resource exhaustion return distinct non-success outcomes. Only the validation boundary can mint the artifact; production verification APIs accept that artifact rather than `geometryValid: boolean` or arbitrary regions/connections.

Reconstruct connectivity from physical free space and opening geometry, then compare graph connectivity rather than direct centerline tests. Establish a deterministic correspondence from each intended topology node to a physical anchor or cell zone; require every physical free-space component to be represented by at least one intended node; map each intended edge to a traversable crossing witness at its mapped boundary; and map each intended non-edge to a physical barrier/cut witness. Reject disconnected free-space components that have no intended mapping. Check all physical crossings of those mapped boundaries, including shortcuts whose endpoints already belong to one global free-space component. Retain the witnesses while contracting decomposition-only subdivisions, so subdivision changes cannot hide or invent a topology edge. Keep unsupported curves fail-closed until their separately planned implementation.

Apply clearance inflation once and use deterministic half-open cell lookup at decomposition boundaries. Do not erode the already-inflated free space by another epsilon: an opening exactly equal to the configured minimum clearance must remain traversable.

Alternative considered: pass a public `geometryValid` flag beside a graph. Rejected because it allows callers to certify a graph that was never derived from geometry.

### 3. Preserve the finite-state search behind a controlled adapter

Adapt validated regions, connections, portals, entrance, and exit into the existing search model inside the production verification boundary. Keep completion flags, objective-order semantics, door access, exit dependencies, breadth-first state exploration, exhaustive unsolvable results, cancellation, and state limits. A valid artifact may be used for multiple searches, but callers cannot manufacture one by setting a flag.

Alternative considered: rewrite the search while changing its input boundary. Rejected because the audit found no defect in the search over an accurate graph, and changing both would increase regression risk.

### 4. Apply wall toggles to immutable geometry snapshots

For each toggle, derive a wall-present and wall-absent geometry snapshot from the same base candidate, differing only by the designated wall operation. Independently validate each snapshot, produce each physical-navigation artifact, and run formal verification on both. Bind the designated wall ID to the single physical connection it blocks or opens; a string ID alone is not evidence of a physical change.

### 5. Classify progression from a bounded physical-distance state graph

Use the validated progression-state graph with non-negative physical edge lengths. The physical navigation artifact records the entrance, exit, passage-side witness locations, and shortest collision-free Euclidean travel distances within each topology region. Intra-region distances are derived from the clearance-inflated wall footprints with a bounded obstacle-vertex visibility graph; route analysis never substitutes region count, edge count, or straight-line distance through an obstacle. A passage transition crosses its validated witness and records the crossing distance within that transition. Progression objectives retain the existing region-entry completion semantics, represented as zero-distance state transitions at the current physical position. If the route metric cannot be reconstructed within its work bound, return Incomplete.

Find shortest physical completion distance for each legal required-objective order and include every route tied at that minimum under the centralized geometry-distance tolerance. The shortest-route subgraph may contain zero-cost cycles and therefore is not assumed to be a DAG: find zero-cost strongly connected components, condense them, and preserve exact objective-order and encounter-labelled reachability through each component. Dynamic programming over the resulting acyclic condensation graph computes earliest/latest normalized first-encounter positions and whether encounter-free tied routes exist. Do not enumerate all tied paths or resolve ties by stable ID. A bounded state/order/SCC-analysis budget is mandatory; if exact extrema or encounter/bypass reachability cannot be established, return Incomplete, never a partial classification.

For designated-wall classification, an encounter is traversal of the validated physical passage affected by that wall in the reference state, measured at its geometric crossing event. Merely approaching the wall or entering an adjacent region is not an encounter. If some tied shortest routes traverse that passage and others bypass it, classify Variable; if no evaluated route traverses it, return Not Encountered and reject the requested placement. If every route encounters it, normalize cumulative physical distance to the first crossing by total route distance. Use PRD bands `[0, 1/3]` Early, `(1/3, 2/3]` Middle, and `(2/3, 1]` Late; differing bands across legal orders or tied routes yield Variable. A total route distance at or below geometry epsilon is invalid evidence and is not normalized.

For required-objective timing, use the same validated legal-order and shortest-route evidence, with first required-objective encounter on each route. Do not infer order completeness from a caller-provided list of route paths.

Alternative considered: enumerate all route walks. Rejected because cycles create unbounded detours and arbitrary late encounters. Alternative considered: select one stable-ID shortest route. Rejected because it hides tied-route timing variability.

### 6. Use one production pipeline and separate configuration/job revisions

Expose one React-independent candidate-pipeline entry point that accepts a submitted immutable configuration snapshot and owns generation, construction, physical validation, formal verification, and result publication. Both the UI and integration tests call this entry point; UI components do not duplicate orchestration. Preserve candidate seed derivation from the configured seed and stable candidate index. Candidate IDs hash the canonical configuration snapshot, stable index, and combined topology, construction, physical-navigation, and verifier versions; workers return indexed results. Selection uses stable candidate order and deterministic tie-breaking, not completion order. Only fully eligible results publish, and the application retains the full verified candidate alongside its matching rendered configuration and identity. Production progress includes the active generation-job revision separately from the configuration-edit revision.

The physical-navigation v2 boundary handling accepts passages exactly at their configured minimum clearance; earlier erosion could reject those passages. This can change eligibility and candidate identity for affected configurations, but does not change candidate seed derivation or generated topology. The navigation version included in candidate identity makes this behavior change explicit.

Maintain a pending-configuration edit revision separately from a generation-job revision. Editing pending settings does not invalidate a submitted job; that job may publish its captured settings as the rendered configuration while the newer pending settings remain pending. Keep the Generate action available during an active job so a new submission supersedes earlier work; explicit cancellation invalidates the active job. Both cases prevent late publication and preserve the last completed design. Resource exhaustion is surfaced as an incomplete job outcome and visible UI state, not as success, an exhaustive unsolvable result, or a job left running.

Alternative considered: let worker completion order choose the first acceptable candidate. Rejected because it makes output scheduling-dependent.

### 7. Preserve compatible reproducibility and version intentional changes

Keep seed derivation and behavior unchanged when the configured increment is absent and correctness permits. Enforcing a non-null increment, rejecting formerly accepted invalid geometry, or changing the physical-connectivity algorithm can change canonical geometry or the selected candidate for the same seed. Record these as intentional algorithm-version changes and update compatibility metadata; do not claim bit-for-bit reproduction across incompatible versions. Add regression fixtures to show unchanged output for compatible existing inputs and explicit new-version behavior for affected inputs.

The orthogonal-construction increment enforcement is versioned as `orthogonal-construction-v2`. Candidate metadata publishes the combined version string `topology-generator-v1+orthogonal-construction-v2+physical-navigation-v2+finite-state-verifier-v1`; candidate identity hashes that version with the canonical configuration and index. `physical-navigation-v2` records the exact-clearance decomposition-boundary correction. Keep the construction-version token visible within the combined value so the output-affecting construction behavior remains traceable.

## Risks / Trade-offs

- **Free-space graph construction may expose decomposition edge cases** → Compare connected physical paths and portal evidence, not raw decomposition IDs; use independent fixtures for open, blocked, shortcut, disconnected, portal, and subdivision cases.
- **Construction increments may make prior configurations infeasible or change output** → Fail with actionable constraints, preserve seed derivation, version output-affecting behavior, and document the compatibility boundary.
- **Shortest-route ties, legal objective orders, and zero-cost SCCs may be expensive** → Use a deterministic bounded augmented-state graph, exact SCC condensation, and dynamic programming over the condensed shortest-route graph; return Incomplete when the bound is reached.
- **Test-only graph fixtures could bypass the production boundary** → Keep abstract search tests for the search algorithm but require branded validated artifacts in production entry points and add end-to-end physical-to-verification tests.
- **A worker pipeline can regress last-design preservation or admit stale results** → Verify production-path cancellation, stale revision, and varied completion-order behavior while asserting the previously completed candidate remains rendered.

## Migration Plan

1. Add failing regression tests for F-02/F-03/F-07, then implement Stage A.
2. Add independent physical reference fixtures for F-01/F-04, then implement the validated navigation artifact and verifier adapter in Stage B.
3. Add physical wall-toggle and route-classification regressions for F-05/F-06, then implement Stage C.
4. Add production-path integration tests for F-08, then wire and validate Stage D.
5. Run required unit, property, integration, TypeScript, lint, and build checks; perform a fresh read-only audit of all affected paths.
6. Keep task 6 blocked until every remediation acceptance criterion passes and the fresh audit has no unresolved critical/high findings.

Rollback is limited to reverting the remediation change. Do not restore acceptance of invalid candidates or publish results produced by unvalidated graphs as a compatibility fallback.

## Open Questions

None. Route-set, tie, encounter, boundary, zero-length, and incomplete-analysis semantics are specified above.
