# Spec Delta

## Purpose

Defines deterministic multi-candidate screening, structural difficulty analysis, ranking, and optimization budget behavior.

## ADDED Requirements

### Requirement: Generation strategies
Generate Once SHALL evaluate one candidate and SHALL not relax mandatory constraints. Optimize for Preferences SHALL be the default and SHALL rank multiple eligible candidates.

#### Scenario: Generate Once failure
- **WHEN** the single candidate fails a mandatory constraint
- **THEN** generation SHALL fail without substituting a relaxed result

#### Scenario: Preference optimization
- **WHEN** Optimize for Preferences is selected
- **THEN** the highest-ranked fully verified eligible candidate SHALL be selected

### Requirement: Three-tier candidate evaluation
Candidate evaluation SHALL screen topology first, construct and verify physical candidates second, and calculate full difficulty and rank candidates third.

#### Scenario: Topology failure is screened early
- **WHEN** a candidate fails topology or dependency screening
- **THEN** expensive physical construction SHALL not be performed for that candidate

#### Scenario: Invalid physical candidate is rejected
- **WHEN** a topology-screened candidate fails geometry or progression verification
- **THEN** it SHALL be excluded before full ranking

### Requirement: Difficulty metrics
The application SHALL calculate deterministic minimum completion distance, decision complexity, required backtracking, misleading branches, and progression complexity.

#### Scenario: Raw and normalized values are visible
- **WHEN** an eligible candidate is analyzed
- **THEN** the interface SHALL expose raw metric values and a consistently normalized score

### Requirement: Weighted difficulty ranking
Five configurable weights SHALL normalize to 100 percent and SHALL rank candidates with deterministic tie-breaking.

#### Scenario: Ranking uses mandatory constraints
- **WHEN** candidates have different weighted scores
- **THEN** only fully eligible candidates SHALL participate and the highest-ranked eligible candidate SHALL win

#### Scenario: Scores tie
- **WHEN** weighted scores tie
- **THEN** a stable candidate identifier or equivalent deterministic rule SHALL resolve the tie

### Requirement: Optimization effort budgets
Fast, Balanced, and Thorough SHALL provide bounded candidate budgets and SHALL not weaken mandatory constraints.

#### Scenario: Budget is exhausted
- **WHEN** the optimization budget ends
- **THEN** the interface SHALL distinguish exhaustion from candidate or verification failure

### Requirement: Structural complexity metrics
The application SHALL expose deterministic achieved junction density, branching degree, dead-end density, route length, loop structure, and alternative-route availability.

#### Scenario: Complexity differs from difficulty
- **WHEN** structural measurements are calculated
- **THEN** they SHALL remain separate from the composite weighted difficulty score

### Requirement: Wall and door candidate analysis
The optimization pipeline SHALL analyze eligible physical wall, inaccessible-door, and restricted-door modifications for effect on solvability and the five difficulty metrics.

#### Scenario: Modification candidate is informational
- **WHEN** candidate modifications are shown
- **THEN** the application SHALL identify them as overlays and SHALL not apply geometry changes automatically

### Requirement: Optimization caching
Reusable topology, geometry, connectivity, progression, and difficulty results SHALL be cached only when all relevant parameters and algorithm versions match.

#### Scenario: Candidate inputs change
- **WHEN** geometry, logical state, parameters, or algorithm version changes
- **THEN** stale cached results SHALL not be reused

### Requirement: Candidate status and budget exhaustion
The application SHALL report counts for screened, fully verified, and selected candidates and SHALL distinguish no eligible candidate, budget exhaustion, and verification failure.

#### Scenario: A valid candidate remains at cancellation
- **WHEN** optimization is cancelled after at least one fully eligible candidate completed
- **THEN** the application SHALL preserve the last completed design and SHALL not claim an incomplete optimization was complete

### Requirement: Effort candidate budgets
Fast SHALL target 10 candidates, Balanced SHALL target 50, and Thorough SHALL target 200 initially.

#### Scenario: A benchmark changes the budget
- **WHEN** implementation benchmarking adjusts provisional budgets
- **THEN** the effective budgets SHALL be documented and SHALL still apply deterministically

### Requirement: Candidate selection and metadata
Only fully verified candidates SHALL be selected, and selected metadata SHALL identify the candidate and algorithm configuration.

#### Scenario: Eligible candidate is available
- **WHEN** a valid completed candidate exists and optimization ends early
- **THEN** the application SHALL return that candidate without claiming a global optimum

#### Scenario: No eligible candidate exists
- **WHEN** the budget ends without a fully eligible candidate
- **THEN** the application SHALL report failure or incomplete status distinctly from candidate verification failure

### Requirement: Full-progression ranking eligibility
Only a candidate with a conclusive `Solvable` result at `full-progression` scope and matching candidate and configuration provenance SHALL be eligible for solvable-maze ranking.

#### Scenario: Navigation-only candidate is evaluated
- **WHEN** a candidate has only `navigation-reachability` verification
- **THEN** it SHALL NOT be labeled fully verified or enter solvable-maze ranking

#### Scenario: Full progression is unsolvable
- **WHEN** exhaustive full-progression verification establishes `Unsolvable`
- **THEN** the verification SHALL remain conclusive but the candidate SHALL NOT enter solvable-maze ranking

#### Scenario: Verification or provenance is incomplete
- **WHEN** verification is incomplete or its provenance does not match the candidate and configuration
- **THEN** the candidate SHALL NOT be treated as fully verified or ranked

### Requirement: Incremental bounded candidate evaluation
Candidate results SHALL advance through evaluation as soon as each preceding stage completes, using bounded in-flight work without a batch-wide construction barrier.

#### Scenario: Construction finishes while another candidate is building
- **WHEN** one candidate completes construction before the remaining candidates
- **THEN** its physical validation SHALL begin without waiting for all construction work to finish

#### Scenario: Worker completion order differs
- **WHEN** workers complete candidates in different orders for identical inputs
- **THEN** the evaluated candidate set and selected result SHALL remain deterministic

### Requirement: Deterministic optimization stopping
Preference optimization SHALL evaluate its configured budget and SHALL NOT stop merely because the first eligible candidate finishes; early termination is permitted only for cancellation, resource limits, or a deterministic proven-optimality condition.

#### Scenario: Generate Once terminates
- **WHEN** Generate Once is selected
- **THEN** exactly one candidate SHALL be evaluated and the result SHALL not be described as preference optimization

#### Scenario: Optimization is cancelled or resource-limited
- **WHEN** optimization stops before its configured budget without proving optimality
- **THEN** the search outcome SHALL be `incomplete`, any retained candidate SHALL be identified as the best fully verified candidate evaluated so far, and global optimality SHALL NOT be claimed

#### Scenario: Optimization completes its configured budget
- **WHEN** every candidate in the configured budget receives a conclusive evaluation
- **THEN** the search outcome SHALL distinguish completed ranking from no eligible candidate or candidate verification failure

### Requirement: Difficulty metric route evidence
Difficulty metrics SHALL consume a complete progression-state graph derived from validated physical navigation, with physical locations, permanent objective flags, distinct physical passage IDs, derived logical `corridorGroupId` values, and legal movement or objective-action transitions. Corridor groups SHALL represent maximal contiguous nonbranching chains and SHALL end at entrances, exits, objectives, doors, junctions, and other semantic anchors.

#### Scenario: Objective action is traversed
- **WHEN** a legal explicit objective action appears in a completion path
- **THEN** it SHALL change only its permanent objective flag and SHALL contribute zero physical distance

#### Scenario: Route evidence is incomplete
- **WHEN** the progression-state graph is incomplete, disconnected from a required completion, or resource-limited
- **THEN** the metric result SHALL be explicitly incomplete or unreachable and SHALL NOT substitute partial metrics

### Requirement: Exact shortest route evidence and canonical route
The shortest route SHALL minimize exact sums of canonical movement-edge values over all legal objective orders; the 1e-7 m tolerance SHALL validate evidence only and SHALL NOT add longer routes to the shortest set.

#### Scenario: Passage belongs to a shortest completion
- **WHEN** a movement transition appears in at least one exact shortest legal completion across all orders
- **THEN** its passage ID SHALL be included in `P_short`, the union across all shortest completions

#### Scenario: Canonical route passage set is distinct from shortest-route union
- **WHEN** an exact shortest completion includes a passage that is absent from the selected canonical route
- **THEN** that passage SHALL remain in `P_short` and SHALL NOT be included in `P*`

#### Scenario: Canonical route is selected
- **WHEN** exact shortest completions tie
- **THEN** selection SHALL minimize repeated-passage distance, then optional actions outside the mandatory closure, then ordinal lexicographic namespaced transition keys

#### Scenario: Objective actions have zero distance
- **WHEN** shortest paths include zero-distance objective actions
- **THEN** actions SHALL remain in path identity and state changes while contributing no movement length

#### Scenario: Shortest-transition graph is acyclic
- **WHEN** movement transitions have positive length and zero-distance objective actions only add permanent flags
- **THEN** the exact shortest-transition graph SHALL be acyclic and SHALL be processed in deterministic topological order

#### Scenario: Canonical search reaches its resource limit
- **WHEN** exact augmented-state dynamic programming cannot finish within its deterministic resource budget
- **THEN** the metric result SHALL be `incomplete` and SHALL contain no approximate canonical route or metric tuple

### Requirement: Minimum completion distance
The raw minimum completion distance SHALL be the least sum of physical movement lengths over legal completions; objective actions SHALL contribute zero meters.

#### Scenario: Required progression is completed
- **WHEN** at least one legal completion path is conclusively available
- **THEN** the raw distance SHALL equal the shortest physical movement sum

### Requirement: Decision complexity
Decision complexity SHALL sum `log2(max(1,k))` over each physical visit on the canonical route, where k is the number of distinct currently traversable passages other than the arrival passage; the entrance has no arrival passage.

#### Scenario: Route visits a junction more than once
- **WHEN** the canonical route returns to the same physical junction
- **THEN** each visit SHALL be counted independently and immediate reversal and objective actions SHALL not count as choices

### Requirement: Required backtracking
For each exact shortest route p, repeated-corridor distance SHALL be the total length of each logical corridor group multiplied by `max(0,uses_p(group)-1)`; a corridor use SHALL span a maximal traversal along that group, including any degree-two physical subdivisions. Raw B SHALL be the minimum over exact shortest routes.

#### Scenario: Tied shortest routes repeat different passages
- **WHEN** exact shortest completions have different repeated-passage distances
- **THEN** B SHALL use the minimum repeated-passage distance

### Requirement: Progression-state-aware misleading branches
Misleading opportunities SHALL be derived separately from each reachable canonical-route flag state using only passages traversable in that state; passage sets from different states SHALL NOT be combined.

#### Scenario: A gate is unavailable in the current state
- **WHEN** a passage requires an objective flag not set in the evaluated route state
- **THEN** that passage SHALL be absent from that state's branch graph

#### Scenario: An off-canonical passage connects route locations
- **WHEN** an off-canonical component attaches to multiple canonical-route locations
- **THEN** those locations SHALL remain attachment ports and the component SHALL be counted at most once

### Requirement: Misleading branch calculation
For each exact route flag state q, let A(q) be its traversable physical passage IDs and let P* be the passage IDs on the canonical route. Form U(q) by removing P* from A(q); build components per state and retain canonical locations as nonjoining attachment ports. P_short passages SHALL remain in U(q), but an L leaf SHALL be excluded when its incident passage is in P_short and a Q component SHALL be excluded when any of its passages is in P_short.

#### Scenario: Optional objective branch is evaluated
- **WHEN** an off-canonical component contains a configured optional-objective location
- **THEN** that objective location SHALL be excluded from L and the component SHALL be exempt from Q, while other eligible non-objective leaves in the component MAY count toward L

#### Scenario: Components are deduplicated
- **WHEN** the same state-specific component is reachable from multiple route states
- **THEN** it SHALL be deduplicated by ordinal-sorted passage-ID and attachment-location signatures

#### Scenario: A tied shortest alternative is not canonical
- **WHEN** a passage belongs to P_short but not P*
- **THEN** it SHALL remain in U(q) during component construction, but its component SHALL contribute nothing to Q

### Requirement: L and Q branch counts
L SHALL count noncanonical degree-one locations excluding configured objective locations and leaves incident to P_short passages. Q SHALL count a loop or multiply attached component only if it contains no configured objective location, no noncanonical leaf, and no P_short passage. Components with leaves contribute eligible leaves to L and nothing to Q. Components containing objectives contribute no Q, but their other eligible leaves MAY contribute to L. M SHALL equal L+Q.

#### Scenario: A component contains leaves and a loop or multiple attachments
- **WHEN** an off-canonical component contains at least one noncanonical leaf and also contains a loop or multiple route attachments
- **THEN** eligible leaves SHALL contribute to L and that component SHALL contribute nothing to Q

#### Scenario: A component contains an objective and other leaves
- **WHEN** an off-canonical component contains a configured objective location and one or more non-objective leaves
- **THEN** the objective location SHALL not count as a leaf, the other eligible leaves MAY count in L, and the component SHALL not count in Q

#### Scenario: An excursion would require an objective action
- **WHEN** a branch becomes traversable only by changing objective flags during its excursion
- **THEN** it SHALL be evaluated in a separate reachable route-state snapshot and SHALL NOT be joined to incompatible passage sets

### Requirement: Progression complexity
Progression complexity SHALL be `P=O+A+G+R`. O is mandatory objective-closure size; G counts distinct dependency-gated physical passage IDs traversed by the canonical route; R counts repeated logical corridor-group traversals after first use on that route.

#### Scenario: Gated passage is repeated
- **WHEN** the canonical route traverses a dependency-gated passage more than once
- **THEN** G SHALL count its passage ID once and R SHALL count traversals after the first

### Requirement: Mandatory prerequisite arc accounting
A SHALL count objective-to-objective arcs whose dependent objective is in O, declared objective-to-exit arcs, and objective-to-passage arcs whose prerequisite is in O. Exclude arcs belonging only to unrelated optional objectives or gates. Deduplicate repeated typed arcs across states or directions; duplicate dependency declarations in one configuration remain invalid.

#### Scenario: Duplicate dependency declarations occur
- **WHEN** the same typed prerequisite arc appears across multiple states or directions
- **THEN** A SHALL count the arc once, while duplicate dependency entries in one configuration SHALL remain invalid

### Requirement: Fixed difficulty normalization
Each nonnegative raw metric x SHALL use `N(x;S)=x/(x+S)` with fixed scales D=100 m, C=16 bits, B=40 m, M=16 branches, and P=16 units; raw values SHALL remain available.

#### Scenario: Metric equals its reference scale
- **WHEN** a raw metric equals its fixed scale S
- **THEN** its normalized value SHALL be 0.5 independent of the current candidate set

#### Scenario: Metric is degenerate or large
- **WHEN** a metric is zero or exceeds its reference scale
- **THEN** normalization SHALL be deterministic, monotone, unclamped, and SHALL preserve the raw value

### Requirement: Production metric evidence provenance
Before production integration, the metric adapter SHALL derive progression-state evidence from an authoritative validated-navigation artifact and bind it to matching candidate, configuration, and complete progression provenance. A caller-supplied graph or boolean alone SHALL NOT establish physical validity or full-progression verification.

#### Scenario: Unvalidated metric evidence reaches the production adapter
- **WHEN** metric evidence lacks a matching validated-navigation artifact or candidate/configuration/progression provenance
- **THEN** the adapter SHALL reject it and SHALL NOT publish metrics as production-verified results

#### Scenario: Corridor groups are supplied to production
- **WHEN** the production adapter assigns `corridorGroupId`
- **THEN** it SHALL derive and validate contiguous, nonbranching groups with semantic boundaries at entrances, exits, objectives, doors, junctions, and other anchors from authoritative physical navigation; it SHALL NOT trust arbitrary caller-supplied grouping

#### Scenario: Pure metric analysis receives corridor-group IDs
- **WHEN** the pure analyzer receives group IDs that are internally consistent for each physical passage
- **THEN** that consistency check SHALL NOT be treated as proof of group contiguity, nonbranching topology, semantic boundaries, or physical-navigation provenance; production publication SHALL require those properties to be validated by the adapter

### Requirement: Weighted score defaults and normalization
The weighted difficulty score SHALL default to 20 percent distance, 25 percent decisions, 20 percent backtracking, 25 percent misleading branches, and 10 percent progression, with normalized weights totaling 100 percent.

#### Scenario: Difficulty weights are configured
- **WHEN** weights are edited
- **THEN** the application SHALL normalize them to 100 percent or reject invalid total behavior and SHALL retain raw metric contributions

### Requirement: Candidate rendering
Candidate evaluation SHALL operate on data structures and SHALL not fully render every candidate.

#### Scenario: Selected candidate finishes evaluation
- **WHEN** only the selected candidate is ready for final presentation
- **THEN** the application SHALL perform full rendering for that candidate
