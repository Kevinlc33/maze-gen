import { describe, expect, it } from 'vitest'
import { DEFAULT_MAZE_CONFIG } from '../config/defaults'
import { generateIntendedTopology, type IntendedTopology } from '../topology/generator'
import { constructOrthogonalGeometry } from '../geometry/orthogonalConstruction'
import type { MazeGeometry, Wall } from '../geometry/models'
import { verifySolvability } from '../verification/finiteStateVerifier'
import {
  compareIntendedTopologyToPhysicalGeometry,
  reconstructPhysicalNavigation,
  validatePhysicalCandidate,
} from './physicalNavigation'

function referenceGeometry(wallList: Wall[]): MazeGeometry {
  return {
    schemaVersion: '1',
    levelId: 'reference',
    boundsWidthMeters: 10,
    boundsDepthMeters: 10,
    walls: wallList,
    chambers: [],
    portals: [],
    entrance: {
      id: 'entrance',
      kind: 'entrance',
      position: { x: 1, y: 5 },
      connectedRegionId: 'untrusted-intended-id',
    },
    exit: {
      id: 'exit',
      kind: 'exit',
      position: { x: 9, y: 5 },
      connectedRegionId: 'untrusted-intended-id',
    },
  }
}

function referenceTwoCellTopology(withConnection: boolean): IntendedTopology {
  return {
    mode: 'maze',
    seed: 'independent-physical-reference',
    nodes: [0, 1].map((column) => ({
      id: `node-0-${column}`,
      row: 0,
      column,
      kind: 'corridor',
      region: 'branching',
    })),
    edges: withConnection
      ? [{
          id: 'reference-edge',
          from: 'node-0-0',
          to: 'node-0-1',
          kind: 'corridor',
        }]
      : [],
  }
}

describe('physical navigation reconstruction', () => {
  it('rejects a wall-end shortcut in the independently specified 20 by 10 m fixture', () => {
    const topology = referenceTwoCellTopology(false)
    const geometry = referenceGeometry([{
      id: 'short-divider',
      kind: 'straight',
      start: { x: 10, y: 2 },
      end: { x: 10, y: 8 },
      thicknessMeters: 1,
    }])
    geometry.boundsWidthMeters = 20
    geometry.entrance.position = { x: 5, y: 5 }
    geometry.entrance.connectedRegionId = 'node-0-0'
    geometry.exit.position = { x: 15, y: 5 }
    geometry.exit.connectedRegionId = 'node-0-1'

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.navigation.issues).toEqual([])
    expect(validation.navigation.regions).toHaveLength(1)
    expect(validation.navigation.entranceRegionId).toBe(validation.navigation.exitRegionId)
    expect(validation.eligibleForVerification).toBe(false)
    const crossingEvidence = validation.boundaryEvidence.find((boundary) =>
      boundary.from === 'node-0-0' && boundary.to === 'node-0-1',
    )
    expect(crossingEvidence?.physicallyTraversable).toBe(true)
    expect(crossingEvidence?.passageWitnesses[0].position.y).toBeCloseTo(0.5)
    expect(crossingEvidence?.passageWitnesses[1].position.y).toBeCloseTo(9.5)
    expect(validation.navigation.connections).toHaveLength(2)
    expect(validation.connectivityMismatches).toEqual([
      expect.objectContaining({
        expectedTraversable: false,
        physicallyTraversable: true,
      }),
    ])
  })

  it('accepts a passage exactly at the configured physical clearance', () => {
    const topology = referenceTwoCellTopology(true)
    const geometry = referenceGeometry([
      {
        id: 'divider-lower',
        kind: 'straight',
        start: { x: 10, y: 0.5 },
        end: { x: 10, y: 4 },
        thicknessMeters: 1,
      },
      {
        id: 'divider-upper',
        kind: 'straight',
        start: { x: 10, y: 6 },
        end: { x: 10, y: 9.5 },
        thicknessMeters: 1,
      },
    ])
    geometry.boundsWidthMeters = 20
    geometry.entrance.position = { x: 5, y: 5 }
    geometry.entrance.connectedRegionId = 'node-0-0'
    geometry.exit.position = { x: 15, y: 5 }
    geometry.exit.connectedRegionId = 'node-0-1'

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.status).toBe('valid')
    expect(validation.validatedNavigation).not.toBeNull()
  })

  it('records a physical barrier witness for an intended non-edge', () => {
    const topology = referenceTwoCellTopology(false)
    const geometry = referenceGeometry([{
      id: 'full-divider',
      kind: 'straight',
      start: { x: 10, y: 0.5 },
      end: { x: 10, y: 9.5 },
      thicknessMeters: 1,
    }])
    geometry.boundsWidthMeters = 20
    geometry.entrance.position = { x: 5, y: 5 }
    geometry.entrance.connectedRegionId = 'node-0-0'
    geometry.exit.position = { x: 15, y: 5 }
    geometry.exit.connectedRegionId = 'node-0-1'

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.status).toBe('valid')
    expect(validation.nodeMappings.map((mapping) => mapping.physicalComponentId))
      .toEqual(['physical-region-1', 'physical-region-2'])
    expect(validation.boundaryEvidence[0]).toMatchObject({
      expectedTraversable: false,
      physicallyTraversable: false,
    })
    expect(validation.boundaryEvidence[0].barrierWitness).not.toBeNull()
    expect(validation.navigation.connections).toEqual([])
  })

  it('rejects a disconnected physical free-space pocket outside the intended topology', () => {
    const topology = referenceTwoCellTopology(true)
    const geometry = referenceGeometry([
      {
        id: 'pocket-north',
        kind: 'straight',
        start: { x: 1, y: 1 },
        end: { x: 4, y: 1 },
        thicknessMeters: 1,
      },
      {
        id: 'pocket-south',
        kind: 'straight',
        start: { x: 1, y: 4 },
        end: { x: 4, y: 4 },
        thicknessMeters: 1,
      },
      {
        id: 'pocket-west',
        kind: 'straight',
        start: { x: 1, y: 1 },
        end: { x: 1, y: 4 },
        thicknessMeters: 1,
      },
      {
        id: 'pocket-east',
        kind: 'straight',
        start: { x: 4, y: 1 },
        end: { x: 4, y: 4 },
        thicknessMeters: 1,
      },
    ])
    geometry.boundsWidthMeters = 20
    geometry.entrance.position = { x: 7, y: 7 }
    geometry.entrance.connectedRegionId = 'node-0-0'
    geometry.exit.position = { x: 15, y: 5 }
    geometry.exit.connectedRegionId = 'node-0-1'

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.navigation.regions).toHaveLength(2)
    expect(validation.status).toBe('invalid')
    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.navigation.issues).toContainEqual(expect.objectContaining({
      message: 'A physical free-space region has no intended topology mapping.',
    }))
  })

  it('keeps reference connectivity stable when free space is subdivided without a cut', () => {
    const topology = referenceTwoCellTopology(true)
    const openGeometry = referenceGeometry([])
    const subdividedGeometry = referenceGeometry([{
      id: 'local-subdivision',
      kind: 'straight',
      start: { x: 5, y: 2 },
      end: { x: 5, y: 3 },
      thicknessMeters: 1,
    }])
    for (const geometry of [openGeometry, subdividedGeometry]) {
      geometry.boundsWidthMeters = 20
      geometry.entrance.position = { x: 5, y: 6 }
      geometry.exit.position = { x: 15, y: 6 }
    }

    const openNavigation = reconstructPhysicalNavigation(openGeometry, 1)
    const subdividedNavigation = reconstructPhysicalNavigation(subdividedGeometry, 1)
    const openValidation = validatePhysicalCandidate(topology, openGeometry, 1)
    const subdividedValidation = validatePhysicalCandidate(topology, subdividedGeometry, 1)

    expect(openNavigation.regions).toHaveLength(1)
    expect(subdividedNavigation.regions).toHaveLength(1)
    expect(openNavigation.entranceRegionId).toBe(openNavigation.exitRegionId)
    expect(subdividedNavigation.entranceRegionId).toBe(subdividedNavigation.exitRegionId)
    expect(subdividedNavigation.decompositionCellCount)
      .toBeGreaterThan(openNavigation.decompositionCellCount)
    expect(compareIntendedTopologyToPhysicalGeometry(topology, openGeometry, 1)).toEqual([])
    expect(compareIntendedTopologyToPhysicalGeometry(topology, subdividedGeometry, 1)).toEqual([])
    expect(subdividedValidation.boundaryEvidence).toEqual(openValidation.boundaryEvidence)
    expect(subdividedValidation.nodeMappings).toEqual(openValidation.nodeMappings)
  })

  it('rejects a portal with valid-looking region IDs that do not meet at its opening', () => {
    const topology = referenceTwoCellTopology(true)
    const geometry = referenceGeometry([{
      id: 'continuous-divider',
      kind: 'straight',
      start: { x: 10, y: 0.5 },
      end: { x: 10, y: 9.5 },
      thicknessMeters: 1,
    }])
    geometry.boundsWidthMeters = 20
    geometry.entrance.position = { x: 5, y: 5 }
    geometry.entrance.connectedRegionId = 'node-0-0'
    geometry.exit.position = { x: 15, y: 5 }
    geometry.exit.connectedRegionId = 'node-0-1'
    geometry.portals = [{
      id: 'misplaced-portal',
      kind: 'portal',
      type: 'ordinary',
      position: { x: 2, y: 5 },
      widthMeters: 1,
      connectedRegionIds: ['node-0-0', 'node-0-1'],
      dependencies: [],
    }]

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.navigation.regions).toHaveLength(2)
    expect(validation.navigation.portalValidations[0]).toMatchObject({
      valid: false,
      portalId: 'misplaced-portal',
    })
    expect(validation.navigation.issues.some((issue) =>
      issue.code === 'invalid-portal' && issue.entityId === 'misplaced-portal',
    )).toBe(true)
    expect(validation.boundaryEvidence[0].barrierWitness).not.toBeNull()
  })

  it('records portal evidence only for a physically open adjacent-region crossing', () => {
    const topology = referenceTwoCellTopology(true)
    const geometry = referenceGeometry([])
    geometry.boundsWidthMeters = 20
    geometry.entrance.position = { x: 5, y: 5 }
    geometry.entrance.connectedRegionId = 'node-0-0'
    geometry.exit.position = { x: 15, y: 5 }
    geometry.exit.connectedRegionId = 'node-0-1'
    geometry.portals = [{
      id: 'valid-crossing-portal',
      kind: 'portal',
      type: 'ordinary',
      position: { x: 10, y: 5 },
      widthMeters: 1,
      connectedRegionIds: ['node-0-0', 'node-0-1'],
      dependencies: [],
    }]

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.eligibleForVerification).toBe(true)
    expect(validation.navigation.portalValidations[0]).toMatchObject({
      valid: true,
      portalId: 'valid-crossing-portal',
    })
    expect(validation.navigation.connections).toContainEqual(expect.objectContaining({
      portalId: 'valid-crossing-portal',
      fromRegionId: 'node-0-0',
      toRegionId: 'node-0-1',
    }))
  })

  it('does not allow a caller-built graph to enter production verification', () => {
    const callerBuiltGraph = {
      geometryValid: true,
      minimumPassageWidthMeters: 1,
      progressionMode: 'unordered',
      regions: ['entrance', 'exit'],
      connections: [{ id: 'caller-edge', fromRegionId: 'entrance', toRegionId: 'exit' }],
      objectives: [],
      entranceRegionId: 'entrance',
      exitRegionId: 'exit',
      exitDependencies: [],
    }
    const progression = {
      progressionMode: 'unordered' as const,
      objectives: [],
      exitDependencies: [],
    }

    expect(Reflect.apply(verifySolvability, undefined, [callerBuiltGraph, progression])).toMatchObject({
      status: 'invalid-geometry',
      exploredStates: 0,
    })
  })

  it('independently reconstructs connected traversability from generated wall footprints', () => {
    const topology = generateIntendedTopology({
      rows: 4,
      columns: 4,
      mode: 'maze',
      seed: 'physical-reference',
    })
    const construction = constructOrthogonalGeometry(topology, {
      ...DEFAULT_MAZE_CONFIG,
      widthMeters: 40,
      depthMeters: 40,
    })
    expect(construction.geometry).not.toBeNull()
    const navigation = reconstructPhysicalNavigation(construction.geometry!, 1)

    expect(navigation.issues).toEqual([])
    expect(navigation.regions).toHaveLength(1)
    expect(navigation.entranceRegionId).toBe(navigation.exitRegionId)
    expect(compareIntendedTopologyToPhysicalGeometry(
      topology,
      construction.geometry!,
      1,
    )).toEqual([])
  })

  it('detects an unintended physical shortcut absent from intended topology', () => {
    const topology = generateIntendedTopology({
      rows: 2,
      columns: 2,
      mode: 'maze',
      seed: 'shortcut-reference',
    })
    const construction = constructOrthogonalGeometry(topology, {
      ...DEFAULT_MAZE_CONFIG,
      widthMeters: 20,
      depthMeters: 20,
    })
    expect(construction.geometry).not.toBeNull()
    const intendedEdges = new Set(topology.edges.map((edge) => [edge.from, edge.to].sort().join('|')))
    let removedWallId: string | null = null
    for (const [from, to, wallId] of [
      ['node-0-0', 'node-0-1', 'wall-v-0-0'],
      ['node-1-0', 'node-1-1', 'wall-v-1-0'],
      ['node-0-0', 'node-1-0', 'wall-h-0-0'],
      ['node-0-1', 'node-1-1', 'wall-h-0-1'],
    ]) {
      if (!intendedEdges.has([from, to].sort().join('|'))) {
        removedWallId = wallId
        break
      }
    }
    expect(removedWallId).not.toBeNull()
    construction.geometry!.walls = construction.geometry!.walls.filter(
      (wall) => wall.id !== removedWallId,
    )

    const mismatches = compareIntendedTopologyToPhysicalGeometry(
      topology,
      construction.geometry!,
      1,
    )
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0].physicallyTraversable).toBe(true)
    expect(mismatches[0].expectedTraversable).toBe(false)
  })

  it('prevents a narrow physical opening from reaching progression verification', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 2,
      mode: 'maze',
      seed: 'narrow-opening',
    })
    const construction = constructOrthogonalGeometry(topology, {
      ...DEFAULT_MAZE_CONFIG,
      widthMeters: 20,
      depthMeters: 10,
    })
    expect(construction.geometry).not.toBeNull()
    const first = construction.geometry!.walls.find((wall) => wall.id === 'wall-v-0-0-a')
    const second = construction.geometry!.walls.find((wall) => wall.id === 'wall-v-0-0-b')
    expect(first?.kind).toBe('straight')
    expect(second?.kind).toBe('straight')
    if (first?.kind !== 'straight' || second?.kind !== 'straight') return
    first.end.y = 4.5
    second.start.y = 5.5

    const validation = validatePhysicalCandidate(topology, construction.geometry!, 1)
    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.connectivityMismatches[0].expectedTraversable).toBe(true)
    expect(validation.connectivityMismatches[0].physicallyTraversable).toBe(false)
  })

  it('rejects nearly touching wall ends that leave only a microscopic gap', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 2,
      mode: 'maze',
      seed: 'microscopic-gap',
    })
    const construction = constructOrthogonalGeometry(topology, {
      ...DEFAULT_MAZE_CONFIG,
      widthMeters: 20,
      depthMeters: 10,
    })
    expect(construction.geometry).not.toBeNull()
    const first = construction.geometry!.walls.find((wall) => wall.id === 'wall-v-0-0-a')
    const second = construction.geometry!.walls.find((wall) => wall.id === 'wall-v-0-0-b')
    expect(first?.kind).toBe('straight')
    expect(second?.kind).toBe('straight')
    if (first?.kind !== 'straight' || second?.kind !== 'straight') return
    first.end.y = 5 - 1e-8
    second.start.y = 5 + 1e-8

    const validation = validatePhysicalCandidate(topology, construction.geometry!, 1)

    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.connectivityMismatches.some((mismatch) =>
      mismatch.expectedTraversable && !mismatch.physicallyTraversable,
    )).toBe(true)
  })

  it('rejects coincident and diagonal walls before verification', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 1,
      mode: 'maze',
      seed: 'wall-errors',
    })
    const geometry = referenceGeometry([
      {
        id: 'straight',
        kind: 'straight',
        start: { x: 5, y: 1 },
        end: { x: 5, y: 9 },
        thicknessMeters: 1,
      },
      {
        id: 'duplicate',
        kind: 'straight',
        start: { x: 5, y: 1 },
        end: { x: 5, y: 9 },
        thicknessMeters: 1,
      },
      {
        id: 'diagonal',
        kind: 'straight',
        start: { x: 1, y: 1 },
        end: { x: 2, y: 2 },
        thicknessMeters: 1,
      },
    ])
    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.navigation.issues.filter((issue) => issue.code === 'invalid-wall').length)
      .toBeGreaterThanOrEqual(2)
  })

  it('rejects out-of-bounds endpoints and portals instead of mapping them to edge cells', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 1,
      mode: 'maze',
      seed: 'out-of-bounds-endpoint',
    })
    const geometry = referenceGeometry([])
    geometry.exit.position.x = 1000
    geometry.portals = [{
      id: 'out-of-bounds-portal',
      kind: 'portal',
      type: 'ordinary',
      position: { x: 1000, y: 5 },
      widthMeters: 1,
      connectedRegionIds: ['physical-region-1', 'physical-region-2'],
      dependencies: [],
    }]

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.navigation.issues.some((issue) =>
      issue.code === 'invalid-endpoint' && issue.entityId === 'exit',
    )).toBe(true)
    expect(validation.navigation.issues.some((issue) =>
      issue.code === 'invalid-portal' && issue.entityId === 'out-of-bounds-portal',
    )).toBe(true)
  })

  it('rejects portal region declarations that do not match physical regions', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 1,
      mode: 'maze',
      seed: 'portal-region-mismatch',
    })
    const geometry = referenceGeometry([{
      id: 'divider',
      kind: 'straight',
      start: { x: 5, y: 0.5 },
      end: { x: 5, y: 9.5 },
      thicknessMeters: 1,
    }])
    geometry.portals = [{
      id: 'wrong-region-pair',
      kind: 'portal',
      type: 'ordinary',
      position: { x: 2, y: 5 },
      widthMeters: 1,
      connectedRegionIds: ['physical-region-99', 'physical-region-2'],
      dependencies: [],
    }]

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.navigation.issues.some((issue) =>
      issue.code === 'invalid-portal' && issue.entityId === 'wrong-region-pair',
    )).toBe(true)
  })

  it('rejects non-finite physical wall dimensions before decomposition', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 1,
      mode: 'maze',
      seed: 'non-finite-wall',
    })
    const geometry = referenceGeometry([{
      id: 'nan-thickness',
      kind: 'straight',
      start: { x: 5, y: 1 },
      end: { x: 5, y: 9 },
      thicknessMeters: Number.NaN,
    }])

    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.navigation.issues.some((issue) =>
      issue.code === 'invalid-wall' && issue.entityId === 'nan-thickness',
    )).toBe(true)
  })

  it('rejects tangent circular walls until curved physical validation is available', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 1,
      mode: 'maze',
      seed: 'curved-adversarial',
    })
    const geometry = referenceGeometry([
      {
        id: 'arc-a',
        kind: 'circular',
        center: { x: 3, y: 5 },
        radiusMeters: 1,
        startAngleRadians: 0,
        endAngleRadians: Math.PI,
        thicknessMeters: 0.5,
      },
      {
        id: 'arc-b',
        kind: 'circular',
        center: { x: 5, y: 5 },
        radiusMeters: 1,
        startAngleRadians: Math.PI,
        endAngleRadians: 2 * Math.PI,
        thicknessMeters: 0.5,
      },
      {
        id: 'arc-pinch',
        kind: 'circular',
        center: { x: 7.5, y: 5 },
        radiusMeters: 0.8,
        startAngleRadians: 0,
        endAngleRadians: Math.PI,
        thicknessMeters: 0.5,
      },
    ])
    const validation = validatePhysicalCandidate(topology, geometry, 1)

    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.navigation.issues.some((issue) => issue.code === 'invalid-wall')).toBe(true)
  })

  it('finds two regions separated by a continuous physical wall independent of intended IDs', () => {
    const geometry = referenceGeometry([{
      id: 'divider',
      kind: 'straight',
      start: { x: 5, y: 0.5 },
      end: { x: 5, y: 9.5 },
      thicknessMeters: 1,
    }])
    const navigation = reconstructPhysicalNavigation(geometry, 1)

    expect(navigation.regions).toHaveLength(2)
    expect(navigation.entranceRegionId).not.toBe(navigation.exitRegionId)
    expect(navigation.issues).toEqual([])
  })

  it('rejects undersized portals and portals inside wall obstacles', () => {
    const geometry = referenceGeometry([{
      id: 'wall',
      kind: 'straight',
      start: { x: 5, y: 0.5 },
      end: { x: 5, y: 9.5 },
      thicknessMeters: 1,
    }])
    geometry.portals = [
      {
        id: 'small',
        kind: 'portal',
        type: 'ordinary',
        position: { x: 2, y: 2 },
        widthMeters: 0.5,
        connectedRegionIds: ['a', 'b'],
        dependencies: [],
      },
      {
        id: 'blocked',
        kind: 'portal',
        type: 'ordinary',
        position: { x: 5, y: 5 },
        widthMeters: 1,
        connectedRegionIds: ['a', 'b'],
        dependencies: [],
      },
    ]
    const navigation = reconstructPhysicalNavigation(geometry, 1)

    expect(navigation.portalValidations.map((portal) => portal.valid)).toEqual([false, false])
    expect(navigation.issues.filter((issue) => issue.code === 'invalid-portal')).toHaveLength(2)
  })

  it('reports an explicit technical resource limit', () => {
    const geometry = referenceGeometry([])
    const navigation = reconstructPhysicalNavigation(geometry, 1, 0)

    expect(navigation.issues[0].code).toBe('resource-limit')
    expect(navigation.regions).toEqual([])

    const validation = validatePhysicalCandidate(
      referenceTwoCellTopology(true),
      geometry,
      1,
      0,
    )
    expect(validation.status).toBe('incomplete')
    expect(validation.eligibleForVerification).toBe(false)
    expect(validation.connectivityMismatches).toEqual([])
  })
})
