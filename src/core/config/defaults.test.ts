import { describe, expect, it } from 'vitest'
import { DEFAULT_CHAMBERS, DEFAULT_DIFFICULTY_WEIGHTS, DEFAULT_MAZE_CONFIG } from './defaults'
import { deriveCandidateSeed } from './seed'
import { validateChambers, validateMazeConfig } from './validation'
import { useConfigurationStore } from './configurationStore'

describe('V1 configuration defaults', () => {
  it('uses the resolved PRD defaults', () => {
    expect(DEFAULT_MAZE_CONFIG.wallThicknessMeters).toBe(1)
    expect(DEFAULT_MAZE_CONFIG.minimumPassageWidthMeters).toBe(1)
    expect(DEFAULT_MAZE_CONFIG.uniformCorridorWidthMeters).toBeNull()
    expect(DEFAULT_MAZE_CONFIG.strategy).toBe('optimize-preferences')
    expect(DEFAULT_MAZE_CONFIG.effort).toBe('balanced')
  })

  it('validates area, passage, and uniform corridor constraints', () => {
    expect(validateMazeConfig(DEFAULT_MAZE_CONFIG)).toEqual([])
    expect(validateMazeConfig({
      ...DEFAULT_MAZE_CONFIG,
      uniformCorridorWidthMeters: 0.5,
    }).map((issue) => issue.field)).toContain('uniform-corridor')
  })

  it('uses 16, 24, and 36 square meter chamber defaults', () => {
    expect(DEFAULT_CHAMBERS.map((chamber) => chamber.areaMetersSquared)).toEqual([16, 24, 36])
    expect(validateChambers(DEFAULT_CHAMBERS)).toEqual([])
  })

  it('normalizes default difficulty weights to 100 percent', () => {
    const total = Object.values(DEFAULT_DIFFICULTY_WEIGHTS).reduce((sum, value) => sum + value, 0)
    expect(total).toBe(100)
  })

  it('derives deterministic candidate seeds', () => {
    expect(deriveCandidateSeed('seed', 10)).toBe('seed:candidate:a')
    expect(deriveCandidateSeed('seed', 10)).toBe(deriveCandidateSeed('seed', 10))
  })

  it('does not copy pending edits into rendered state', () => {
    useConfigurationStore.setState({
      pending: { ...DEFAULT_MAZE_CONFIG },
      rendered: null,
      renderedSnapshot: null,
    })
    useConfigurationStore.getState().setPending({ widthMeters: 80 })
    expect(useConfigurationStore.getState().rendered).toBeNull()
    expect(useConfigurationStore.getState().renderedSnapshot).toBeNull()
  })
})
