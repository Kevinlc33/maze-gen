# Spec Delta

## Purpose

Ensures progression search, wall-toggle verification, and placement classification operate on validated physical navigation and physically measured legal completion routes.

## ADDED Requirements

### Requirement: Formal verification consumes validated navigation
Production progression verification SHALL consume only a validated physical-navigation result and SHALL NOT accept a caller-supplied boolean as proof of geometric validity.

#### Scenario: Candidate has validated physical navigation
- **WHEN** a candidate is submitted to formal verification
- **THEN** its regions, connections, portals, entrance, and exit SHALL come from the validated navigation result

#### Scenario: Candidate has no validated navigation
- **WHEN** geometry is invalid, unsupported, or incompletely reconstructed
- **THEN** formal verification SHALL return an invalid or incomplete outcome and SHALL NOT search an independently supplied graph

### Requirement: Finite-state progression outcomes remain conclusive
Verification SHALL preserve permanent completion flags, legal objective ordering, door and exit dependencies, and exhaustive unsolvable semantics over the validated navigation state space.

#### Scenario: Search exhausts all reachable states
- **WHEN** no legal completion exists and every reachable state has been examined
- **THEN** verification SHALL report Unsolvable

#### Scenario: Search is interrupted or bounded
- **WHEN** cancellation or a configured resource limit stops search before exhaustion
- **THEN** verification SHALL report Incomplete and SHALL NOT report Solvable or Unsolvable

### Requirement: Wall toggles mutate physical geometry
Designated-wall verification SHALL create the wall-present and wall-absent physical states, reconstruct each state independently, and formally verify both states.

#### Scenario: Wall addition toggle is evaluated
- **WHEN** a designated wall is added to a solvable candidate
- **THEN** the reconstructed wall-present state SHALL be verified unsolvable and the wall-absent state SHALL be verified solvable

#### Scenario: Wall removal toggle is evaluated
- **WHEN** a designated wall is removed from an unsolvable candidate
- **THEN** the reconstructed wall-absent state SHALL be verified solvable and the wall-present state SHALL be verified unsolvable

### Requirement: Progression routes are derived from legal states
Progression classification SHALL derive legal required-objective orders and completion routes from the validated progression-state graph rather than trusting caller-supplied paths.

#### Scenario: Alternative legal objective orders exist
- **WHEN** multiple required-objective orders have legal completion routes
- **THEN** classification SHALL account for every legal order that can be exhaustively evaluated

### Requirement: Progression distances use physical travel
Route length and normalized encounter position SHALL use cumulative physical distance along validated route geometry, not region counts, node indices, or edge count.

#### Scenario: Route crosses a progression target
- **WHEN** a legal completion route reaches a required objective or designated wall crossing
- **THEN** encounter position SHALL be the cumulative physical distance to the first encounter divided by that route's total physical completion distance

#### Scenario: Route only approaches a wall
- **WHEN** a route enters a region adjacent to a designated wall but does not traverse its validated wall-crossing passage
- **THEN** the route SHALL NOT count as encountering that wall

### Requirement: Shortest-route ties preserve encounter extrema
For each legal required-objective order, classification SHALL consider all equally shortest physical completion routes and SHALL account for their earliest and latest encounter positions.

#### Scenario: Equally short routes differ in wall encounter
- **WHEN** tied shortest routes for an objective order include both a route through the designated wall passage and a route that bypasses it
- **THEN** the wall placement classification SHALL be Variable

#### Scenario: Tied routes have different encounter bands
- **WHEN** tied shortest routes encounter the target at positions in different progression bands
- **THEN** classification SHALL be Variable regardless of stable route or candidate ID ordering

### Requirement: Zero-cost transitions preserve exact route outcomes
Shortest-route analysis SHALL handle zero-cost progression transitions and cycles exactly, preserving objective-state reachability and encounter/bypass outcomes without enumerating unbounded zero-cost walks.

#### Scenario: Shortest-path subgraph contains a zero-cost cycle
- **WHEN** progression-state transitions of zero physical length form a cycle among shortest routes
- **THEN** analysis SHALL condense the zero-cost strongly connected component before computing route extrema and SHALL preserve all reachable exits and encounter labels

#### Scenario: Zero-cost component has encounter and bypass alternatives
- **WHEN** routes through a zero-cost component can both encounter and bypass the designated passage before leaving it
- **THEN** analysis SHALL preserve both outcomes and classify the candidate Variable when both occur among evaluated shortest routes

#### Scenario: Zero-cost component cannot be analyzed exactly
- **WHEN** bounded analysis cannot establish exact reachability or encounter extrema within a zero-cost component
- **THEN** classification SHALL return Incomplete rather than discard a route or approximate its outcome

### Requirement: Wall encounter outcomes are explicit
Wall placement classification SHALL distinguish routes that encounter a designated wall passage from routes that bypass it or never encounter it.

#### Scenario: Every evaluated route bypasses the wall
- **WHEN** no evaluated legal shortest completion route traverses the designated wall passage
- **THEN** classification SHALL return Not Encountered or reject the placement candidate, and SHALL NOT force an Early, Middle, or Late result

#### Scenario: Only some evaluated routes encounter the wall
- **WHEN** at least one evaluated route traverses the designated wall passage and at least one bypasses it
- **THEN** classification SHALL be Variable

#### Scenario: Every evaluated route encounters the wall in one band
- **WHEN** all evaluated legal shortest routes encounter the designated wall passage and every normalized encounter position lies in the same band
- **THEN** classification SHALL be that band

### Requirement: Progression classification is bounded and explicit
Shortest-route tie analysis SHALL use bounded deterministic analysis; zero-length routes SHALL not be normalized, and exhausted analysis SHALL remain inconclusive without silent approximation.

#### Scenario: Route has zero physical length
- **WHEN** total completion distance is at or below the geometry tolerance
- **THEN** classification SHALL return invalid evidence or an incomplete outcome and SHALL NOT divide by zero or assign a band

#### Scenario: Route analysis exceeds its resource bound
- **WHEN** legal-order or tied-route analysis cannot be completed within its configured bound
- **THEN** classification SHALL report Incomplete and SHALL NOT publish a partial Early, Middle, Late, or Variable result

#### Scenario: Encounter lies on a band boundary
- **WHEN** a normalized position is exactly one-third or two-thirds
- **THEN** one-third SHALL belong to Early and two-thirds SHALL belong to Middle, with positions above two-thirds classified Late
