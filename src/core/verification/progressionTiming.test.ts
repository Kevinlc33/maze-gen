import { describe, expect, it } from 'vitest'
import { progressionBandAt } from './progressionTiming'

describe('progression timing bands', () => {
  it('uses the specified inclusive one-third and two-thirds boundaries', () => {
    expect(progressionBandAt(1 / 3)).toBe('early')
    expect(progressionBandAt(2 / 3)).toBe('middle')
    expect(progressionBandAt(1)).toBe('late')
  })

  it('rejects invalid normalized positions', () => {
    expect(() => progressionBandAt(-0.1)).toThrow('between 0 and 1')
    expect(() => progressionBandAt(1.1)).toThrow('between 0 and 1')
    expect(() => progressionBandAt(Number.NaN)).toThrow('between 0 and 1')
  })
})
