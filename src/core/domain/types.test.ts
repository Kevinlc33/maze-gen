import { describe, expect, it } from 'vitest'
import type {
  ChamberConfig,
  DifficultyWeights,
  Door,
  MazeConfig,
  Objective,
} from './types'

describe('MazeConfig domain type', () => {
  it('accepts a complete metric configuration', () => {
    const config: MazeConfig = {
      widthMeters: 160,
      depthMeters: 80,
      units: 'meters',
      topology: 'maze',
      geometry: 'orthogonal',
      wallThicknessMeters: 1,
      minimumPassageWidthMeters: 1,
      constructionIncrementMeters: 0.5,
      uniformCorridorWidthMeters: null,
      seed: 'test-seed',
      strategy: 'optimize-preferences',
      effort: 'balanced',
    }

    expect(config.widthMeters).toBe(160)
    expect(config.wallThicknessMeters).toBe(1)
  })

  it('covers V1 chamber, objective, door, and weight types', () => {
    const chamber: ChamberConfig = {
      id: 'chamber-general',
      type: 'general',
      enabled: true,
      areaMetersSquared: 16,
      minimumAreaMetersSquared: 16,
      maximumAreaMetersSquared: 64,
    }
    const objective: Objective = {
      id: 'objective-1',
      required: true,
      dependencies: [],
      completionState: 'incomplete',
    }
    const door: Door = {
      id: 'door-1',
      type: 'subgoal-dependent',
      dependencies: [objective.id],
      clearanceMeters: 1,
      openingValid: true,
    }
    const weights: DifficultyWeights = {
      minimumCompletionDistance: 20,
      decisionComplexity: 25,
      requiredBacktracking: 20,
      misleadingBranches: 25,
      progressionComplexity: 10,
    }

    expect(chamber.areaMetersSquared).toBe(16)
    expect(objective.required).toBe(true)
    expect(door.dependencies).toContain(objective.id)
    expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBe(100)
  })
})
