import { describe, expect, it } from 'vitest'
import type { DoorPortal } from '../geometry/models'
import { evaluateDoorAccess } from './doorAccess'

function portal(
  type: DoorPortal['type'],
  dependencies: string[] = [],
  widthMeters = 1,
): DoorPortal {
  return {
    id: `door-${type}`,
    kind: 'portal',
    type,
    position: { x: 5, y: 5 },
    widthMeters,
    connectedRegionIds: ['region-a', 'region-b'],
    dependencies,
  }
}

describe('physical and logical door access', () => {
  it.each(['ordinary', 'secret'] as const)(
    '%s doors are traversable when their physical opening is clear',
    (type) => {
      expect(evaluateDoorAccess(portal(type), new Set(), 1)).toEqual({
        traversable: true,
        reason: 'available',
      })
    },
  )

  it('keeps permanently inaccessible doors closed in every progression state', () => {
    expect(evaluateDoorAccess(
      portal('permanently-inaccessible'),
      new Set(['subgoal-1']),
      1,
    )).toEqual({ traversable: false, reason: 'permanently-inaccessible' })
  })

  it('opens dependent doors only after every required objective is complete', () => {
    const door = portal('subgoal-dependent', ['subgoal-1', 'subgoal-2'])
    expect(evaluateDoorAccess(door, new Set(['subgoal-1']), 1)).toEqual({
      traversable: false,
      reason: 'unsatisfied-dependencies',
    })
    expect(evaluateDoorAccess(door, new Set(['subgoal-1', 'subgoal-2']), 1)).toEqual({
      traversable: true,
      reason: 'available',
    })
  })

  it('rejects undersized door portals before logical access is considered', () => {
    expect(evaluateDoorAccess(
      portal('subgoal-dependent', ['subgoal-1'], 0.9),
      new Set(['subgoal-1']),
      1,
    )).toEqual({ traversable: false, reason: 'insufficient-clearance' })
  })
})
