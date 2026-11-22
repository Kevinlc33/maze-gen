import type { ChamberConfig, DifficultyWeights, MazeConfig } from '../domain/types'

export const DEFAULT_MAZE_CONFIG: MazeConfig = {
  widthMeters: 40,
  depthMeters: 40,
  units: 'meters',
  topology: 'maze',
  geometry: 'orthogonal',
  wallThicknessMeters: 1,
  minimumPassageWidthMeters: 1,
  constructionIncrementMeters: 0.5,
  uniformCorridorWidthMeters: null,
  seed: 'maze-default',
  strategy: 'optimize-preferences',
  effort: 'balanced',
}

export const DEFAULT_DIFFICULTY_WEIGHTS: DifficultyWeights = {
  minimumCompletionDistance: 20,
  decisionComplexity: 25,
  requiredBacktracking: 20,
  misleadingBranches: 25,
  progressionComplexity: 10,
}

export const DEFAULT_CHAMBERS: ChamberConfig[] = [
  {
    id: 'general',
    type: 'general',
    enabled: true,
    areaMetersSquared: 16,
    minimumAreaMetersSquared: 16,
    maximumAreaMetersSquared: 64,
  },
  {
    id: 'subgoal',
    type: 'subgoal',
    enabled: false,
    areaMetersSquared: 24,
    minimumAreaMetersSquared: 16,
    maximumAreaMetersSquared: 64,
  },
  {
    id: 'final-goal',
    type: 'final-goal',
    enabled: true,
    areaMetersSquared: 36,
    minimumAreaMetersSquared: 16,
    maximumAreaMetersSquared: 64,
  },
]
