import type { DoorPortal } from '../geometry/models'
import { GEOMETRY_EPSILON_METERS } from '../geometry/precision'

export type DoorAccessReason =
  | 'available'
  | 'permanently-inaccessible'
  | 'unsatisfied-dependencies'
  | 'insufficient-clearance'

export interface DoorAccessResult {
  traversable: boolean
  reason: DoorAccessReason
}

export function evaluateDoorAccess(
  portal: DoorPortal,
  completedObjectiveIds: ReadonlySet<string>,
  minimumPassageWidthMeters: number,
): DoorAccessResult {
  if (!Number.isFinite(minimumPassageWidthMeters) || minimumPassageWidthMeters <= 0) {
    throw new RangeError('Minimum passage width must be a positive finite value.')
  }
  if (
    !Number.isFinite(portal.widthMeters)
    || portal.widthMeters + GEOMETRY_EPSILON_METERS < minimumPassageWidthMeters
  ) {
    return { traversable: false, reason: 'insufficient-clearance' }
  }
  if (portal.type === 'permanently-inaccessible') {
    return { traversable: false, reason: 'permanently-inaccessible' }
  }
  if (
    portal.type === 'subgoal-dependent'
    && !portal.dependencies.every((id) => completedObjectiveIds.has(id))
  ) {
    return { traversable: false, reason: 'unsatisfied-dependencies' }
  }
  return { traversable: true, reason: 'available' }
}
