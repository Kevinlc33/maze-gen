export type UnitSystem = 'meters' | 'feet'

export type TopologyMode = 'maze' | 'labyrinth' | 'hybrid'

export type GeometryMode = 'orthogonal' | 'circular' | 'mixed'

export type GenerationStrategy = 'generate-once' | 'optimize-preferences'

export type OptimizationEffort = 'fast' | 'balanced' | 'thorough'

export type VerificationStatus =
  | 'solvable'
  | 'unsolvable'
  | 'invalid-geometry'
  | 'verification-incomplete'

export type ProgressionMode = 'ordered' | 'unordered'

export type DoorType =
  | 'ordinary'
  | 'secret'
  | 'permanently-inaccessible'
  | 'subgoal-dependent'

export type SolvabilityMode =
  | 'standard-solvable'
  | 'single-wall-addition'
  | 'single-wall-removal'

export type WallPlacementPreference =
  | 'automatic'
  | 'early'
  | 'middle'
  | 'late'

export type ChamberType = 'general' | 'subgoal' | 'final-goal'

export interface DifficultyWeights {
  minimumCompletionDistance: number
  decisionComplexity: number
  requiredBacktracking: number
  misleadingBranches: number
  progressionComplexity: number
}

export interface ChamberConfig extends StableEntity {
  type: ChamberType
  enabled: boolean
  areaMetersSquared: number
  minimumAreaMetersSquared: number
  maximumAreaMetersSquared: number
}

export interface Objective extends StableEntity {
  required: boolean
  dependencies: string[]
  completionState: 'incomplete' | 'complete'
}

export interface Door extends StableEntity {
  type: DoorType
  dependencies: string[]
  clearanceMeters: number
  openingValid: boolean
}

export interface CandidateMetadata extends StableEntity {
  algorithmVersion: string
  seed: string
  verificationStatus: VerificationStatus
  fullyVerified: boolean
}

export interface MazeConfig {
  widthMeters: number
  depthMeters: number
  units: UnitSystem
  topology: TopologyMode
  geometry: GeometryMode
  wallThicknessMeters: number
  minimumPassageWidthMeters: number
  constructionIncrementMeters: number | null
  uniformCorridorWidthMeters: number | null
  seed: string
  strategy: GenerationStrategy
  effort: OptimizationEffort
}

export interface StableEntity {
  id: string
}

export interface Point2D {
  x: number
  y: number
}

export interface MazeLevel extends StableEntity {
  name: string
  bounds: {
    widthMeters: number
    depthMeters: number
  }
}
