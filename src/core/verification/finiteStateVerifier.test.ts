import { describe, expect, it } from 'vitest'
import { validatePhysicalCandidate } from '../navigation/physicalNavigation'
import type { MazeGeometry } from '../geometry/models'
import type { IntendedTopology } from '../topology/generator'
import {
  verifySolvability,
  type ProgressionVerificationConfig,
} from './finiteStateVerifier'

function createReferenceCase(disconnectedExit = false) {
  const topology: IntendedTopology = {
    mode: 'maze',
    seed: 'verified-search-fixture',
    nodes: [0, 1, 2].map((column) => ({
      id: `node-0-${column}`,
      row: 0,
      column,
      kind: 'corridor',
      region: 'branching',
    })),
    edges: [
      {
        id: 'to-goal',
        from: 'node-0-0',
        to: 'node-0-1',
        kind: 'corridor' as const,
      },
      ...(!disconnectedExit
        ? [{
            id: 'to-exit',
            from: 'node-0-1',
            to: 'node-0-2',
            kind: 'corridor' as const,
          }]
        : []),
    ],
  }
  const geometry: MazeGeometry = {
    schemaVersion: '1',
    levelId: 'verified-search-fixture',
    boundsWidthMeters: 30,
    boundsDepthMeters: 10,
    walls: disconnectedExit
      ? [{
          id: 'closed-exit-boundary',
          kind: 'straight',
          start: { x: 20, y: 0.5 },
          end: { x: 20, y: 9.5 },
          thicknessMeters: 1,
        }]
      : [],
    chambers: [],
    portals: disconnectedExit
      ? []
      : [{
          id: 'exit-door',
          kind: 'portal',
          type: 'subgoal-dependent',
          position: { x: 20, y: 5 },
          widthMeters: 1,
          connectedRegionIds: ['node-0-1', 'node-0-2'],
          dependencies: ['goal'],
        }],
    entrance: {
      id: 'entrance',
      kind: 'entrance',
      position: { x: 5, y: 5 },
      connectedRegionId: 'node-0-0',
    },
    exit: {
      id: 'exit',
      kind: 'exit',
      position: { x: 25, y: 5 },
      connectedRegionId: 'node-0-2',
    },
  }
  const validation = validatePhysicalCandidate(topology, geometry, 1)
  if (!validation.validatedNavigation) {
    throw new Error('The independent physical-verification fixture must validate.')
  }
  const progression: ProgressionVerificationConfig = {
    progressionMode: 'unordered',
    objectives: [{
      id: 'goal',
      required: true,
      dependencies: [],
      regionId: 'node-0-1',
    }],
    exitDependencies: ['goal'],
  }
  return {
    navigation: validation.validatedNavigation,
    progression,
    topology,
    geometry,
  }
}

describe('finite-state solvability verification', () => {
  it('finds a valid sequence through a physically validated objective-dependent door', () => {
    const { navigation, progression } = createReferenceCase()

    expect(verifySolvability(navigation, progression)).toMatchObject({
      status: 'solvable',
      regionPath: ['node-0-0', 'node-0-1', 'node-0-2'],
      completedObjectiveIds: ['goal'],
    })
  })

  it('proves a physically reconstructed disconnected exit unsolvable', () => {
    const { navigation, progression } = createReferenceCase(true)

    expect(verifySolvability(navigation, progression)).toMatchObject({
      status: 'unsolvable',
      exploredStates: 3,
    })
  })

  it('rejects invalid geometry and forged navigation before searching progression states', () => {
    const { topology, geometry, progression } = createReferenceCase()
    const invalidCandidate = validatePhysicalCandidate(topology, {
      ...geometry,
      exit: {
        ...geometry.exit,
        position: { x: 1000, y: geometry.exit.position.y },
      },
    }, 1)
    const forgedNavigation = {
      geometryValid: true,
      minimumPassageWidthMeters: 1,
      regions: ['entrance', 'exit'],
      connections: [{ id: 'forged-edge', fromRegionId: 'entrance', toRegionId: 'exit' }],
      entranceRegionId: 'entrance',
      exitRegionId: 'exit',
    }
    expect(invalidCandidate.status).toBe('invalid')
    expect(invalidCandidate.validatedNavigation).toBeNull()
    expect(Reflect.apply(
      verifySolvability,
      undefined,
      [invalidCandidate.validatedNavigation, progression],
    )).toMatchObject({ status: 'invalid-geometry', exploredStates: 0 })
    expect(Reflect.apply(verifySolvability, undefined, [forgedNavigation, progression]))
      .toMatchObject({ status: 'invalid-geometry', exploredStates: 0 })
    expect(Reflect.apply(verifySolvability, undefined, [null, progression]))
      .toMatchObject({ status: 'invalid-geometry', exploredStates: 0 })
  })

  it('rejects progression objectives assigned outside validated physical regions', () => {
    const { navigation } = createReferenceCase()
    const progression: ProgressionVerificationConfig = {
      progressionMode: 'unordered',
      objectives: [{
        id: 'goal',
        required: false,
        dependencies: [],
        regionId: 'not-on-route',
      }],
      exitDependencies: ['goal'],
    }

    expect(verifySolvability(navigation, progression)).toMatchObject({
      status: 'invalid-geometry',
      reason: 'Objective goal references an unknown navigation region.',
    })
  })

  it('rejects copied or mutated navigation artifacts at the production boundary', () => {
    const { navigation } = createReferenceCase()
    const progression: ProgressionVerificationConfig = {
      progressionMode: 'unordered',
      objectives: [],
      exitDependencies: [],
    }

    expect(Reflect.apply(
      verifySolvability,
      undefined,
      [{ ...navigation, exitRegionId: '' }, progression],
    )).toMatchObject({
      status: 'invalid-geometry',
      reason: 'Physical navigation was not validated from candidate geometry.',
    })
  })

  it('distinguishes cancellation and state-limit exhaustion from unsolvability', () => {
    const { navigation, progression } = createReferenceCase()
    expect(verifySolvability(navigation, progression, { isCancelled: () => true })).toMatchObject({
      status: 'verification-incomplete',
      reason: 'cancelled',
    })
    expect(verifySolvability(navigation, progression, { maximumStates: 1 })).toMatchObject({
      status: 'verification-incomplete',
      reason: 'resource-limit',
    })
  })
})
