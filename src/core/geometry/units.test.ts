import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { feetToMeters, metersToFeet, METERS_PER_FOOT, quantizeMeters } from './units'

describe('metric unit conversion', () => {
  it('round trips feet and meters', () => {
    expect(feetToMeters(1)).toBe(METERS_PER_FOOT)
    expect(metersToFeet(METERS_PER_FOOT)).toBeCloseTo(1)
  })

  it('quantizes values to a construction increment', () => {
    expect(quantizeMeters(1.24, 0.5)).toBe(1)
    expect(quantizeMeters(1.26, 0.5)).toBe(1.5)
  })

  it('preserves positive dimensions through unit conversion', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 1000, noNaN: true }), (meters) => {
        expect(metersToFeet(feetToMeters(meters))).toBeCloseTo(meters)
      }),
    )
  })
})
