# Spec Delta

## Purpose

Defines independent and adversarial verification required to establish physical, logical, persistence, sharing, and UI correctness.

## ADDED Requirements

### Requirement: Unit verification coverage
Unit tests SHALL cover unit conversion, geometry predicates, wall intersections, wall thickness, construction increments, clearance, chamber areas, topology, door portals, subgoal dependencies, difficulty metrics, score normalization, and payload round trips.

#### Scenario: Core unit behavior is validated
- **WHEN** a core unit module changes
- **THEN** applicable tests SHALL prove the external result or rejection behavior independently of React

### Requirement: Property-based verification
Property tests SHALL verify bounded geometry, required passage clearance, chamber areas, deterministic output, permanent completion flags, designated-wall toggles, non-conclusive resource exhaustion, physical-navigation agreement, and share round trips.

#### Scenario: A property holds across generated inputs
- **WHEN** random or adversarial property inputs are tested
- **THEN** the result SHALL remain within the stated physical and logical invariant

### Requirement: Adversarial geometry coverage
Tests SHALL include nearly touching walls, tangent arcs, coincident boundaries, narrow diagonal gaps, curved pinch points, increment edges, disconnected chambers, unintended shortcuts, undersized portals, and microscopic gaps.

#### Scenario: Adversarial geometry is rejected or validated
- **WHEN** an adversarial geometry case is evaluated
- **THEN** it SHALL produce a conclusive valid or invalid result and SHALL never be presented as a valid candidate by a false topology match

### Requirement: Independent reference cases
Reference mazes SHALL have connectivity and verification expectations established independently from the generator's intended graph.

#### Scenario: A reference case is run
- **WHEN** the reference geometry is validated
- **THEN** reconstructed connectivity SHALL match the independent expected result

### Requirement: Sharing verification matrix
Sharing tests SHALL cover URL creation, compatible reconstruction, configuration preservation, candidate identity, generator compatibility, malformed and oversized payloads, resource safeguards, direct reconstruction, copy controls, and worker completion-order independence.

#### Scenario: A share round trip completes
- **WHEN** a generated maze is opened by URL
- **THEN** deterministic geometry and logical configuration SHALL match while unsupported or invalid input SHALL fail explicitly

### Requirement: Integration verification matrix
Integration tests SHALL cover configuration-to-generation, topology-to-geometry, geometry-to-navigation, navigation-to-verification, tiered optimization, cancellation, progress, JSON persistence, URL reconstruction, and rendering/export consistency.

#### Scenario: Modules exchange a candidate
- **WHEN** an integration stage completes
- **THEN** the following stage SHALL receive the candidate and metadata required for conclusive verification

### Requirement: End-to-end verification matrix
End-to-end tests SHALL cover standard solvable and labyrinth/hybrid designs, ordered and unordered objectives, secret doors, both wall toggle modes, optimization, cancellation, PNG and SVG export, JSON persistence, and share creation/reconstruction.

#### Scenario: Browser workflow completes
- **WHEN** a supported browser executes one of the V1 workflows
- **THEN** the interface SHALL report accurate success or actionable failure

### Requirement: Independent objective-action fixtures
Progression reference fixtures SHALL specify expected positions, explicit objective actions, dependencies, and completion outcomes independently of verifier implementation assumptions.

#### Scenario: Objective location is entered
- **WHEN** a reference sequence reaches an objective location without taking its action
- **THEN** the expected completion flag SHALL remain unset

#### Scenario: Legal objective action is taken
- **WHEN** a reference sequence takes an available action at its objective location
- **THEN** the expected permanent flag and legal successor states SHALL match the fixture

### Requirement: Verification-scope regression coverage
Tests SHALL prove that navigation-only, full-progression, conclusive-unsolvable, and incomplete results retain distinct scopes and provenance.

#### Scenario: Pipeline receives incomplete progression input
- **WHEN** a production-path candidate lacks authoritative progression configuration
- **THEN** tests SHALL reject any full-progression or fully-verified claim

#### Scenario: Candidate cannot rank as solvable
- **WHEN** a candidate has a navigation-only, unsolvable, incomplete, or mismatched-provenance result
- **THEN** tests SHALL prove it is excluded from solvable-maze ranking

### Requirement: Streaming scheduler regression coverage
Scheduler tests SHALL establish bounded concurrency, validation before all construction finishes, and completion-order-independent candidate selection.

#### Scenario: Construction completes out of order
- **WHEN** controlled workers complete candidates in multiple permutations
- **THEN** the same candidate set and selected result SHALL be produced while respecting worker and queue bounds

#### Scenario: One candidate is ready before the batch
- **WHEN** one candidate finishes construction while another remains blocked
- **THEN** its validation SHALL begin before the blocked construction is released

### Requirement: Structural-target regression coverage
Tests SHALL establish deterministic topology sizing from a configured structural target and physical constraints without conflating target and achieved difficulty.

#### Scenario: Target is infeasible
- **WHEN** a target cannot satisfy the design area's physical constraints and construction increments
- **THEN** the generator SHALL report infeasibility without relaxing those constraints

### Requirement: Unavailable-operation feedback coverage
UI tests SHALL prove that unimplemented Save, Load, and Share operations do not report success and that implemented operations report success only after completion.

#### Scenario: Placeholder control is activated
- **WHEN** an unavailable persistence or sharing control is inspected or activated
- **THEN** it SHALL be disabled or clearly labeled unavailable and SHALL not emit success feedback

### Requirement: Independent difficulty metric reference fixtures
Difficulty metric tests SHALL use manually specified graphs and hand-calculated raw and normalized expectations, independent of generator output and metric implementation helpers.

#### Scenario: Required objective spur requires a return
- **WHEN** the graph has S-J=2 m, J-O=3 m with required O, and J-X=5 m to exit
- **THEN** S-J-O-action-J-X SHALL yield `(D,C,B,M,P)=(13,2,3,0,2)`, `O/A/G/R=1/0/0/1`, and normalized `(13/113,1/9,3/43,0,1/9)`

#### Scenario: Two non-objective leaves are reachable
- **WHEN** S-J=2 m, J-X=4 m to exit, and non-objective leaves J-A=3 m and J-B=5 m are available
- **THEN** the expected raw tuple SHALL be `(6,log2(3),0,2,0)` and normalized tuple SHALL be `(3/53,log2(3)/(16+log2(3)),0,1/9,0)`

#### Scenario: Optional objective detour is not misleading
- **WHEN** S-J=2 m, J-X=4 m to exit, and J-O=3 m reaches an optional objective
- **THEN** the expected raw tuple SHALL be `(6,1,0,0,0)` and normalized tuple SHALL be `(3/53,1/17,0,0,0)`

#### Scenario: Off-route loop has two canonical attachments
- **WHEN** S-A=2 m, canonical A-X=2 m to exit, and off-route A-B=1 m, B-C=2 m, C-X=1 m
- **THEN** the A-B/B-C/C-X component SHALL count once with raw `(D,C,B,M,P)=(4,1,0,1,0)` and normalized `(1/26,1/17,0,1/17,0)`

#### Scenario: Tied shortest completions differ in repeated travel
- **WHEN** S-J=2 m, J-O=3 m with required O, O-X=8 m, and J-X=5 m to exit
- **THEN** both S-J-O-X and S-J-O-J-X SHALL have length 13 m, B SHALL be 0, `P_short` SHALL include J-X, M SHALL be 0, and the raw tuple SHALL be `(13,1,0,0,1)`

#### Scenario: Dependency gate requires a return
- **WHEN** S-A=2 m, A-B=3 m through a gate requiring a at A, b at B depends on a, and exit A requires b
- **THEN** S-A-action(a)-B-action(b)-A SHALL yield `O/A/G/R=2/3/1/1`, raw `(8,0,3,0,7)`, and normalized `(2/27,0,3/43,0,7/23)`

#### Scenario: Objective entry does not complete an objective
- **WHEN** S-J=2 m, J-X=3 m to exit, and required a is located at J
- **THEN** entering and leaving J without its action SHALL retain `a=false`, while the explicit zero-distance action SHALL set permanent `a=true`; the shortest metric tuple SHALL be `(5,0,0,0,1)` with normalized `(1/21,0,0,0,1/17)`

#### Scenario: Off-canonical passage joins route locations
- **WHEN** S-A=2 m, canonical A-X=2 m to exit, and distinct off-route passage loop-A-X=6 m joins A and X
- **THEN** the off-route passage component SHALL count once as M=1 and the complete raw tuple SHALL be `(4,1,0,1,0)`

#### Scenario: Gate opens only after objective action
- **WHEN** S-J=2 m, direct J-X=2 m to exit, required a is at J, and parallel gate-a J-X=6 m requires a
- **THEN** gate-a SHALL be absent before action(a), present after it, count once as M=1, and yield raw `(4,1,0,1,2)` with `O/A/G/R=1/1/0/0` and normalized progression `1/9`

#### Scenario: A tied shortest passage is outside the canonical route
- **WHEN** S-A-X and S-B-X are equal-length exact shortest completions and lexical tie-breaking selects S-A-X
- **THEN** the B passages SHALL be in `P_short` but not `P*`, remain in U during component construction, and their component SHALL contribute Q=0

#### Scenario: Shortest passages do not count as L leaves or Q components
- **WHEN** S-J=2 m, direct J-X=2 m, J-B=1 m, gated B-X=1 m and B-C=1 m both require objective a at J, and the canonical route selects direct J-X
- **THEN** J-B SHALL remain in U at both flag states; its pre-action B leaf SHALL be excluded from L, the post-action component SHALL be excluded from Q because it contains `P_short`, and non-shortest leaf C SHALL contribute L=1

#### Scenario: Leaves and loops do not double-count one component
- **WHEN** an off-canonical component has a loop, multiple canonical attachments, and two noncanonical non-objective leaves
- **THEN** it SHALL contribute L=2 and Q=0

#### Scenario: Objective locations are excluded without hiding other leaves
- **WHEN** an off-canonical component contains an objective location, a non-objective leaf, and a loop or multiple attachments
- **THEN** the objective location SHALL not count toward L, the non-objective leaf SHALL contribute L=1, and Q SHALL be 0

#### Scenario: Optional dependencies do not inflate progression complexity
- **WHEN** optional objective z depends on optional objective y and neither is in the mandatory completion closure
- **THEN** their objective prerequisite arc SHALL not contribute to A or P

#### Scenario: Larger composite graph exceeds reference scales
- **WHEN** a 50-edge T0–T50 trunk has 2.4 m edges, 24 required-objective spurs of 10/3 m at T1,T3,…,T47, and 24 non-objective 1 m leaves at T2,T4,…,T48
- **THEN** the ascending-objective route with returns and omitted leaves SHALL yield O/A/G/R=24/0/0/24, raw `(280,72,80,24,48)`, and normalized `(14/19,9/11,2/3,3/5,3/4)`

### Requirement: Metric invariance and incompleteness properties
Difficulty metrics SHALL be invariant to irrelevant input ordering and unanchored degree-two subdivision, and SHALL report incomplete work rather than approximate values.

#### Scenario: Graph inputs are reordered
- **WHEN** states, transitions, or completion IDs are permuted without changing the graph
- **THEN** raw metrics, normalized metrics, and canonical route keys SHALL be identical

#### Scenario: A passage is subdivided with distinct physical IDs
- **WHEN** a physical corridor is split at an unanchored degree-two location into distinct physical passage IDs that share the same validated `corridorGroupId` and total group length
- **THEN** all five raw and normalized metrics SHALL remain unchanged

#### Scenario: Exact shortest-transition graph is acyclic
- **WHEN** movement edges have positive lengths and objective actions only add permanent flags at zero distance
- **THEN** an independent reference fixture SHALL verify that the shortest-transition graph has a deterministic topological ordering

#### Scenario: Many shortest objective orders share completion states
- **WHEN** nine unordered required objectives are colocated at J on S-J=2 m and J-X=3 m, yielding 9! shortest action orders but only 2^9 flag combinations at J
- **THEN** exact bounded DAG dynamic programming SHALL complete with D=5 m and all nine explicit actions, without enumerating every route

#### Scenario: Canonical dynamic programming reaches its limit
- **WHEN** exact augmented passage-usage dynamic programming exceeds its resource budget
- **THEN** the result SHALL be incomplete and SHALL contain no approximate canonical route or metric tuple

#### Scenario: Production adapter requires validated physical provenance
- **WHEN** metric evidence is offered for production publication without a matching validated-navigation artifact and candidate/configuration/progression provenance
- **THEN** the adapter SHALL reject the evidence and SHALL not label the metric result physically validated or fully verified

#### Scenario: Consistent corridor IDs do not prove physical validity
- **WHEN** pure metric evidence assigns one consistent group ID to every occurrence of each physical passage
- **THEN** that check SHALL NOT establish contiguity, nonbranching topology, semantic-anchor boundaries, or authoritative navigation provenance; the production adapter SHALL independently derive and validate those properties

#### Scenario: Metric search is cancelled or exceeds its budget
- **WHEN** canonical-route or branch analysis cannot finish
- **THEN** the result SHALL be explicitly incomplete and SHALL contain no approximate metric tuple
