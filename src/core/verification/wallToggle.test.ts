import { describe, expect, it } from 'vitest'
import type { IntendedTopology } from '../topology/generator'
import type { MazeGeometry, StraightWall } from '../geometry/models'
import { validatePhysicalCandidate } from '../navigation/physicalNavigation'
import type { WallToggleRequest } from './wallToggle'
import { verifySingleWallToggle } from './wallToggle'

const designatedWall: StraightWall = {
  id: 'designated-divider',
  kind: 'straight',
  start: { x: 5, y: 0.5 },
  end: { x: 5, y: 9.5 },
  thicknessMeters: 1,
}

function referenceGeometry(walls: StraightWall[] = []): MazeGeometry {
  return {
    schemaVersion: '1',
    levelId: 'physical-wall-toggle-reference',
    boundsWidthMeters: 10,
    boundsDepthMeters: 10,
    walls: walls.map((wall) => ({
      ...wall,
      start: { ...wall.start },
      end: { ...wall.end },
    })),
    chambers: [],
    portals: [],
    entrance: {
      id: 'entrance',
      kind: 'entrance',
      position: { x: 2, y: 5 },
      connectedRegionId: 'node-0-0',
    },
    exit: {
      id: 'exit',
      kind: 'exit',
      position: { x: 8, y: 5 },
      connectedRegionId: 'node-0-1',
    },
  }
}

function referenceTopology(withConnection: boolean): IntendedTopology {
  return {
    mode: 'maze',
    seed: 'physical-wall-toggle-reference',
    nodes: [0, 1].map((column) => ({
      id: `node-0-${column}`,
      row: 0,
      column,
      kind: 'corridor',
      region: 'branching',
    })),
    edges: withConnection
      ? [{
          id: 'edge-node-0-0-node-0-1',
          from: 'node-0-0',
          to: 'node-0-1',
          kind: 'corridor',
        }]
      : [],
  }
}

function toggleRequest(mode: 'single-wall-addition' | 'single-wall-removal'): WallToggleRequest {
  const common = {
    designatedWallId: designatedWall.id,
    affectedConnectionId: 'edge-node-0-0-node-0-1-passage-1',
    placementPreference: 'automatic' as const,
    minimumPassageWidthMeters: 1,
    geometry: mode === 'single-wall-addition'
      ? referenceGeometry()
      : referenceGeometry([designatedWall]),
    topologyWithWall: referenceTopology(false),
    topologyWithoutWall: referenceTopology(true),
    progression: {
      progressionMode: 'unordered' as const,
      objectives: [],
      exitDependencies: [],
    },
  }
  return mode === 'single-wall-addition'
    ? { ...common, mode, wallToAdd: designatedWall }
    : { ...common, mode }
}

describe('physical wall-toggle verification', () => {
  it.each(['single-wall-addition', 'single-wall-removal'] as const)(
    'reconstructs and verifies both physical states for %s',
    (mode) => {
      const request = toggleRequest(mode)
      const originalGeometry = structuredClone(request.geometry)
      const wallPresentGeometry = mode === 'single-wall-addition'
        ? { ...request.geometry, walls: [...request.geometry.walls, designatedWall] }
        : request.geometry
      const wallAbsentGeometry = mode === 'single-wall-removal'
        ? {
            ...request.geometry,
            walls: request.geometry.walls.filter((wall) => wall.id !== designatedWall.id),
          }
        : request.geometry

      expect(wallPresentGeometry.walls.filter((wall) => wall.id === designatedWall.id))
        .toHaveLength(1)
      expect(wallAbsentGeometry.walls.some((wall) => wall.id === designatedWall.id)).toBe(false)
      expect(validatePhysicalCandidate(
        request.topologyWithWall,
        wallPresentGeometry,
        request.minimumPassageWidthMeters,
      ).status).toBe('valid')
      expect(validatePhysicalCandidate(
        request.topologyWithoutWall,
        wallAbsentGeometry,
        request.minimumPassageWidthMeters,
      ).status).toBe('valid')

      const result = verifySingleWallToggle(request)

      expect(request.geometry).toEqual(originalGeometry)
      expect(result.valid).toBe(true)
      expect(result.reason).toBeNull()
      expect(result.withWallResult.status).toBe('unsolvable')
      expect(result.withoutWallResult.status).toBe('solvable')
      expect(result.progressionTiming).toMatchObject({
        status: 'complete',
        classification: 'middle',
      })
    },
  )

  it('rejects a wall operation whose ID does not match the designated wall', () => {
    const request = toggleRequest('single-wall-addition')
    if (request.mode !== 'single-wall-addition') throw new Error('Expected wall addition request.')
    request.wallToAdd = { ...designatedWall, id: 'different-wall' }

    const result = verifySingleWallToggle(request)

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('wall ID must match')
  })

  it('uses verified physical route timing instead of caller-supplied progress positions', () => {
    const request = toggleRequest('single-wall-addition')
    request.placementPreference = 'early'

    const result = verifySingleWallToggle(request)

    expect(result.valid).toBe(false)
    expect(result.progressionTiming).toMatchObject({
      status: 'complete',
      classification: 'middle',
    })
    expect(result.reason).toContain('requested progression preference')
  })

  it('rejects topology states that claim multiple passages changed by one wall', () => {
    const request = toggleRequest('single-wall-addition')
    if (request.mode !== 'single-wall-addition') throw new Error('Expected wall addition request.')
    const horizontalWall: StraightWall = {
      id: 'one-wall-two-passages',
      kind: 'straight',
      start: { x: 0.5, y: 10 },
      end: { x: 19.5, y: 10 },
      thicknessMeters: 1,
    }
    const nodes = [
      { id: 'node-0-0', row: 0, column: 0, kind: 'corridor' as const, region: 'branching' as const },
      { id: 'node-0-1', row: 0, column: 1, kind: 'corridor' as const, region: 'branching' as const },
      { id: 'node-1-0', row: 1, column: 0, kind: 'corridor' as const, region: 'branching' as const },
      { id: 'node-1-1', row: 1, column: 1, kind: 'corridor' as const, region: 'branching' as const },
    ]
    const topAndBottomEdges = [
      {
        id: 'edge-node-0-0-node-0-1',
        from: 'node-0-0',
        to: 'node-0-1',
        kind: 'corridor' as const,
      },
      {
        id: 'edge-node-1-0-node-1-1',
        from: 'node-1-0',
        to: 'node-1-1',
        kind: 'corridor' as const,
      },
    ]
    const crossRowEdges = [
      {
        id: 'edge-node-0-0-node-1-0',
        from: 'node-0-0',
        to: 'node-1-0',
        kind: 'corridor' as const,
      },
      {
        id: 'edge-node-0-1-node-1-1',
        from: 'node-0-1',
        to: 'node-1-1',
        kind: 'corridor' as const,
      },
    ]
    request.designatedWallId = horizontalWall.id
    request.affectedConnectionId = 'edge-node-0-0-node-1-0-passage-1'
    request.wallToAdd = horizontalWall
    request.geometry = {
      ...referenceGeometry(),
      boundsWidthMeters: 20,
      boundsDepthMeters: 20,
      entrance: {
        id: 'entrance',
        kind: 'entrance',
        position: { x: 5, y: 5 },
        connectedRegionId: 'node-0-0',
      },
      exit: {
        id: 'exit',
        kind: 'exit',
        position: { x: 15, y: 15 },
        connectedRegionId: 'node-1-1',
      },
    }
    request.topologyWithoutWall = {
      ...request.topologyWithoutWall,
      nodes,
      edges: [...topAndBottomEdges, ...crossRowEdges],
    }
    request.topologyWithWall = {
      ...request.topologyWithWall,
      nodes,
      edges: topAndBottomEdges,
    }

    const result = verifySingleWallToggle(request)

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('exactly one intended passage')
  })
})
