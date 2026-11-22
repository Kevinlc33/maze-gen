import { describe, expect, it } from 'vitest'
import { DEFAULT_MAZE_CONFIG } from './defaults'
import { validateChambers, validateMazeConfig } from './validation'

describe('configuration validation', () => {
  it('rejects non-finite numeric configuration values', () => {
    const cases = [
      { config: { ...DEFAULT_MAZE_CONFIG, widthMeters: Number.NaN }, field: 'design-area' },
      { config: { ...DEFAULT_MAZE_CONFIG, depthMeters: Number.POSITIVE_INFINITY }, field: 'design-area' },
      { config: { ...DEFAULT_MAZE_CONFIG, wallThicknessMeters: Number.NaN }, field: 'wall-thickness' },
      { config: { ...DEFAULT_MAZE_CONFIG, minimumPassageWidthMeters: Number.NEGATIVE_INFINITY }, field: 'minimum-passage' },
      { config: { ...DEFAULT_MAZE_CONFIG, constructionIncrementMeters: Number.NaN }, field: 'construction-increment' },
      { config: { ...DEFAULT_MAZE_CONFIG, uniformCorridorWidthMeters: Number.NaN }, field: 'uniform-corridor' },
    ]

    for (const { config, field } of cases) {
      expect(validateMazeConfig(config).some((issue) => issue.field === field)).toBe(true)
    }
  })

  it('rejects non-finite chamber area constraints', () => {
    const issues = validateChambers([{
      id: 'nan-area',
      type: 'general',
      enabled: true,
      areaMetersSquared: Number.NaN,
      minimumAreaMetersSquared: 16,
      maximumAreaMetersSquared: 64,
    }])

    expect(issues).toHaveLength(1)
    expect(issues[0].field).toBe('chamber-nan-area')
  })
})
