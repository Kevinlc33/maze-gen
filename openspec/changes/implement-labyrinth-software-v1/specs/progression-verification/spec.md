# Spec Delta

## Purpose

Defines formal objective progression and finite-state solvability for one entrance, one final exit, and explicit logical dependencies.

## ADDED Requirements

### Requirement: Required and optional objectives
The application SHALL support required and optional subgoals with stable identifiers and permanent completion flags.

#### Scenario: Optional objective is omitted
- **WHEN** the completion search reaches the exit without visiting an optional subgoal
- **THEN** the sequence SHALL remain eligible

#### Scenario: Required objective is omitted
- **WHEN** no legal sequence visits every required subgoal
- **THEN** the design SHALL be classified using exhaustive verification rather than as geometry failure

### Requirement: Ordered and unordered progression
The application SHALL support unordered and explicitly ordered objective progression.

#### Scenario: Unordered progression
- **WHEN** unordered progression is configured
- **THEN** every legally permitted subgoal order SHALL be considered

#### Scenario: Ordered progression
- **WHEN** ordered progression is configured
- **THEN** the generator SHALL assign and verify a valid completion sequence or report failure

### Requirement: Door and exit dependencies
The verification engine SHALL include subgoal-dependent doors, gated regions, and exit requirements in state-space search.

#### Scenario: Dependency is unsatisfied
- **WHEN** a required subgoal has not been completed
- **THEN** traversal through a dependent door SHALL be unavailable

### Requirement: Verification status
The application SHALL distinguish Solvable, Unsolvable, Invalid Geometry, and Verification Incomplete outcomes.

#### Scenario: Solvable result
- **WHEN** a legal completion sequence is found
- **THEN** the result SHALL include that sequence

#### Scenario: Exhaustive unsolvable result
- **WHEN** finite-state search exhausts the reachable progression states without completion
- **THEN** the result SHALL be Unsolvable only if the validated geometry is complete

#### Scenario: Verification resources are exhausted
- **WHEN** cancellation or technical resource limits stop verification before an exhaustive result
- **THEN** the result SHALL be Verification Incomplete and SHALL not claim unsolvability

### Requirement: Single-wall solvability toggles
The application SHALL support an exact designated wall addition or removal toggle when configured.

#### Scenario: Single-wall addition
- **WHEN** addition toggle mode is selected
- **THEN** the initial state SHALL be solvable and the designated-wall state SHALL be formally verified unsolvable

#### Scenario: Single-wall removal
- **WHEN** removal toggle mode is selected
- **THEN** the initial state SHALL be unsolvable and removal of the designated wall SHALL restore verified solvability

### Requirement: Progression classification
The application SHALL classify required progression as Early, Middle, Late, or Variable using three equal normalized bands.

#### Scenario: Encounter timing spans bands
- **WHEN** alternative legal subgoal orders produce legal encounter positions in multiple bands
- **THEN** the candidate SHALL be classified as Variable

#### Scenario: Placement preference is not met
- **WHEN** a configured Early, Middle, or Late preference excludes the candidate classification
- **THEN** the application SHALL report the mismatch or reject the candidate according to mandatory configuration

### Requirement: Entrance and final exit verification
Every verified completion sequence SHALL begin at the one entrance and SHALL finish by satisfying exit dependencies at the one final exit.

#### Scenario: Exit dependency is unsatisfied
- **WHEN** the player state reaches the exit before required objectives or dependencies are satisfied
- **THEN** the sequence SHALL not complete

### Requirement: Subgoal dependency state
Subgoals SHALL carry stable IDs, required or optional classification, permanent completion state, and optional dependencies.

#### Scenario: Impossible dependency is detected
- **WHEN** a subgoal or door dependency cannot become reachable from the entrance
- **THEN** the verification result SHALL classify the candidate or dependency configuration as unsolvable or invalid instead of proceeding silently

### Requirement: Completion state never reverts
Once a subgoal completion flag is set, later traversal SHALL keep that flag set.

#### Scenario: The player revisits earlier regions
- **WHEN** a completed subgoal's region or route is revisited
- **THEN** the completion state SHALL remain permanent

### Requirement: Standard solvability mode
The application SHALL support standard generation of a verified solvable maze.

#### Scenario: Standard mode selects a candidate
- **WHEN** standard solvable mode is configured
- **THEN** the selected candidate SHALL include a verified legal completion sequence

### Requirement: Designated-wall toggle validity
A designated toggle wall SHALL be physically valid, completely block a traversable passage in the relevant state, and satisfy construction and progression placement rules.

#### Scenario: Addition toggle is valid
- **WHEN** a wall is designated for wall-addition mode
- **THEN** both the initially solvable state and the wall-added unsolvable state SHALL be formally verified

#### Scenario: Removal toggle is valid
- **WHEN** a wall is designated for wall-removal mode
- **THEN** the wall-present unsolvable state and wall-removed solvable state SHALL be formally verified

### Requirement: Door accessibility types
Doors SHALL distinguish ordinary, secret, permanently inaccessible, and subgoal-dependent accessibility.

#### Scenario: Permanently inaccessible door is generated
- **WHEN** a barrier door is represented
- **THEN** it SHALL remain unavailable in every progression state

#### Scenario: Secret door is traversable
- **WHEN** a secret door is physically and logically traversable
- **THEN** concealment SHALL affect presentation only

### Requirement: Door generation
Door configuration SHALL be parameter-driven and SHALL select only physically clear locations with consistent logical dependencies.

#### Scenario: Door is generated
- **WHEN** an ordinary, secret, inaccessible, or dependent door is selected
- **THEN** its portal geometry, state, connected regions, and dependencies SHALL persist and participate in verification

### Requirement: Explicit objective completion actions
Objective flags SHALL change only through an explicit completion action available at the objective's mapped navigable location when its dependency and ordering rules permit it. The V1 action SHALL add no physical distance or modeled puzzle-solving effort.

#### Scenario: Player enters an objective location
- **WHEN** the player enters or passes through a region containing an incomplete objective
- **THEN** the objective SHALL remain incomplete until its explicit action is taken

#### Scenario: Player completes an available objective action
- **WHEN** the player is at an objective's mapped location and all dependencies and ordering rules permit completion
- **THEN** the action SHALL set its permanent completion flag without adding physical travel distance

#### Scenario: Objective action is dependency-gated
- **WHEN** the player is at an objective location but a required predecessor is incomplete
- **THEN** the objective completion action SHALL not be available

### Requirement: Verification scope and provenance
Every verification result SHALL identify its scope and bind the claim to the candidate, algorithm version, configuration, and authoritative progression input used.

#### Scenario: Navigation-only verification
- **WHEN** verification proves only entrance-to-exit reachability over validated physical navigation
- **THEN** its scope SHALL be `navigation-reachability` and SHALL NOT claim full progression verification

#### Scenario: Full-progression verification
- **WHEN** verification evaluates a complete, explicitly supplied progression configuration
- **THEN** its scope SHALL be `full-progression` and its provenance SHALL identify all configured objectives, ordering rules, door dependencies, and exit requirements

#### Scenario: Progression input is absent
- **WHEN** a caller supplies no authoritative progression configuration or only an implicit empty fallback
- **THEN** verification SHALL NOT claim `full-progression`

#### Scenario: Exhaustive unsolvability is established
- **WHEN** full-progression search exhausts all legal states without a completion sequence
- **THEN** the result SHALL be conclusive `Unsolvable` verification while remaining ineligible as a verified-solvable candidate

#### Scenario: Verification is incomplete
- **WHEN** cancellation or resource limits prevent a conclusive result
- **THEN** provenance SHALL identify the incomplete outcome and SHALL NOT claim `fullyVerified`
