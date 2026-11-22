import { describe, expect, it } from 'vitest'
import type { MazeGeometry } from './models'
import { validateEndpoints } from './endpoints'

describe('maze geometry serialization', () => {
  it('round trips stable wall, chamber, portal, entrance, and exit data', () => {
    const geometry: MazeGeometry = {
      schemaVersion: '1',
      levelId: 'level-1',
      boundsWidthMeters: 40,
      boundsDepthMeters: 40,
      walls: [
        {
          id: 'wall-1',
          kind: 'straight',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          thicknessMeters: 1,
        },
      ],
      chambers: [
        {
          id: 'chamber-1',
          kind: 'rectangle',
          areaMetersSquared: 16,
          points: [
            { x: 1, y: 1 },
            { x: 5, y: 1 },
            { x: 5, y: 5 },
            { x: 1, y: 5 },
          ],
        },
      ],
      portals: [
        {
          id: 'door-1',
          kind: 'portal',
          type: 'ordinary',
          position: { x: 5, y: 2 },
          widthMeters: 1,
          connectedRegionIds: ['region-1', 'region-2'],
          dependencies: [],
        },
      ],
      entrance: {
        id: 'entrance',
        kind: 'entrance',
        position: { x: 0, y: 20 },
        connectedRegionId: 'region-1',
      },
      exit: {
        id: 'exit',
        kind: 'exit',
        position: { x: 40, y: 20 },
        connectedRegionId: 'region-2',
      },
    }

    const restored = JSON.parse(JSON.stringify(geometry)) as MazeGeometry

    expect(restored).toEqual(geometry)
    expect(restored.walls[0].id).toBe('wall-1')
    expect(restored.entrance.kind).toBe('entrance')
    expect(restored.exit.kind).toBe('exit')
  })

  it('rejects inaccessible or out-of-bounds endpoints', () => {
    const geometry: MazeGeometry = {
      schemaVersion: '1',
      levelId: 'level-1',
      boundsWidthMeters: 40,
      boundsDepthMeters: 40,
      walls: [],
      chambers: [],
      portals: [],
      entrance: {
        id: 'entrance',
        kind: 'entrance',
        position: { x: -1, y: 20 },
        connectedRegionId: '',
      },
      exit: {
        id: 'exit',
        kind: 'exit',
        position: { x: 41, y: 20 },
        connectedRegionId: '',
      },
    }

    expect(validateEndpoints(geometry).map((issue) => issue.field)).toEqual(['entrance', 'exit'])
  })
})
