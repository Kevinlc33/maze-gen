# Proposal

## Why

The read-only audit against Labyrinth Software PRD v0.7 confirmed that physical validation can accept an unintended shortcut, out-of-bounds endpoints, and non-finite geometry; it also found that formal verification and wall-toggle/classification helpers are not connected to validated physical routes. These gaps make optimization inputs untrustworthy, so task 6 must remain paused until remediation and a fresh audit establish correctness.

## What Changes

- Preserve the eight audit findings as distinct tracked items: F-01 shortcut false acceptance (Critical, confirmed); F-02 endpoint/portal bounds and connectivity (High, confirmed); F-03 non-finite values (High, confirmed); F-04 verifier not bound to physical navigation (Critical, confirmed integration gap); F-05 abstract-only wall toggles (High, confirmed integration gap); F-06 unverified route classification and region-count distances (High, confirmed limitation); F-07 unenforced construction increments (High, confirmed); F-08 missing generation-to-worker production integration (High, confirmed integration gap).
- Stage A: add failing regression tests, then validate finite numeric inputs, actual bounds, endpoint accessibility, portal-to-region connectivity, and construction increments.
- Stage B: map intended nodes, passages, and barriers to physical witnesses; derive explicit regions, connections, and portal information from physical free space; introduce a controlled validated-navigation artifact for the existing finite-state verifier.
- Stage C: mutate real geometry for wall toggles and independently reconstruct and verify both states. Derive legal completion routes from verified progression states, use physical travel distances, account for all tied shortest routes and wall bypasses, condense zero-cost state cycles without losing encounter outcomes, and return Incomplete if exact bounded analysis cannot finish.
- Stage D: provide one React-independent production candidate-pipeline entry point used by both the UI and integration tests. Preserve pending-versus-rendered configuration: pending edits do not invalidate a submitted job; a newer generation request or explicit cancellation does. Test production-path cancellation, stale-result rejection, and worker completion-order independence.
- Preserve compatible existing seeds and behavior. Explicitly document any reproducibility change caused by enforcing a configured construction increment.
- Keep task 6 blocked until remediation acceptance criteria pass and a fresh audit is complete. Curved/mixed geometry implementation and persistence/schema validation remain deferred to their existing future tasks.

## Capabilities

### New Capabilities

- `geometry-validation`: finite numeric input, geometric bounds, physical endpoint/portal integrity, and construction-increment enforcement.
- `physical-navigation`: independently reconstructed physical connectivity and a validated navigation artifact.
- `progression-verification`: controlled physical-graph verification, physical wall toggles, and verified distance-based progression classification.
- `generation-pipeline`: production integration of configuration, deterministic candidates, workers, validation, verification, and publication.

### Modified Capabilities

None. `openspec list --specs` found no established main-spec capabilities; the new capabilities establish these durable contracts without modifying the existing V1 implementation change.

## Impact

Impacted areas include `src/core/config`, `src/core/geometry`, `src/core/navigation`, `src/core/verification`, `src/core/workers`, `src/core/state`, `src/App.tsx`, and the corresponding unit, property, integration, and browser tests. Corrective tasks cite PRD v0.7 requirements directly: FR-010, FR-012–018, FR-021, FR-024, FR-030–034 and AC-105, AC-107, AC-301–304. The existing `implement-labyrinth-software-v1` tasks and the PRD will not be edited by this remediation change.
