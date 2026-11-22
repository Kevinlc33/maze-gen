import { describe, expect, it } from 'vitest'
import { DEFAULT_CHAMBERS, DEFAULT_MAZE_CONFIG } from '../config/defaults'
import { generateIntendedTopology, type IntendedTopology } from '../topology/generator'
import { constructOrthogonalGeometry } from './orthogonalConstruction'
import type { StraightWall } from './models'

describe('orthogonal geometry construction', () => {
  const config = {
    ...DEFAULT_MAZE_CONFIG,
    widthMeters: 40,
    depthMeters: 40,
    wallThicknessMeters: 1,
    minimumPassageWidthMeters: 1,
  }

  it('builds bounded wall footprints and respects minimum passage clear width', () => {
    const topology = generateIntendedTopology({
      rows: 4,
      columns: 4,
      mode: 'maze',
      seed: 'construction',
    })
    const result = constructOrthogonalGeometry(topology, config)

    expect(result.issues).toEqual([])
    expect(result.geometry).not.toBeNull()
    expect(result.cellWidthMeters).toBe(10)
    expect(result.cellDepthMeters).toBe(10)
    expect(result.passageClearWidthMeters).toBe(1)

    const walls = result.geometry!.walls.filter((wall): wall is StraightWall => wall.kind === 'straight')
    for (const wall of walls) {
      expect(wall.start.x - wall.thicknessMeters / 2).toBeGreaterThanOrEqual(-1e-7)
      expect(wall.start.y - wall.thicknessMeters / 2).toBeGreaterThanOrEqual(-1e-7)
      expect(wall.end.x + wall.thicknessMeters / 2).toBeLessThanOrEqual(40 + 1e-7)
      expect(wall.end.y + wall.thicknessMeters / 2).toBeLessThanOrEqual(40 + 1e-7)
    }
    const constructionMeasurements = [
      result.cellWidthMeters,
      result.cellDepthMeters,
      ...walls.flatMap((wall) => [
        wall.start.x,
        wall.start.y,
        wall.end.x,
        wall.end.y,
        wall.thicknessMeters,
      ]),
    ]
    expect(constructionMeasurements.every((value) =>
      Math.abs(value / 0.5 - Math.round(value / 0.5)) <= 1e-7,
    )).toBe(true)
  })

  it('sets clear opening width using wall thickness and uniform corridor configuration', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 2,
      mode: 'maze',
      seed: 'opening',
    })
    const result = constructOrthogonalGeometry(topology, {
      ...config,
      widthMeters: 20,
      depthMeters: 10,
      minimumPassageWidthMeters: 1,
      uniformCorridorWidthMeters: 2,
    })
    const internalWall = result.geometry?.walls.filter((wall): wall is StraightWall =>
      wall.kind === 'straight'
      &&
      Math.abs(wall.start.x - 10) < 1e-7 && Math.abs(wall.end.x - 10) < 1e-7,
    ) ?? []

    expect(result.issues).toEqual([])
    expect(result.passageClearWidthMeters).toBe(2)
    expect(internalWall).toHaveLength(2)
    const lowerSegmentEnd = Math.min(...internalWall.map((wall) => Math.max(wall.start.y, wall.end.y)))
    const upperSegmentStart = Math.max(...internalWall.map((wall) => Math.min(wall.start.y, wall.end.y)))
    expect(upperSegmentStart - lowerSegmentEnd - config.wallThicknessMeters).toBeCloseTo(2)
  })

  it('respects a configured construction increment for every generated wall placement', () => {
    const topology = generateIntendedTopology({
      rows: 1,
      columns: 3,
      mode: 'maze',
      seed: 'increment-placement',
    })
    const incrementMeters = 0.5
    const result = constructOrthogonalGeometry(topology, {
      ...config,
      widthMeters: 10,
      depthMeters: 20,
      constructionIncrementMeters: incrementMeters,
    })

    expect(result.geometry).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'off-construction-increment',
      message: expect.stringContaining('0.5 m'),
    }))
  })

  it('preserves canonical geometry when no construction increment is configured', () => {
    const topology: IntendedTopology = {
      mode: 'maze',
      seed: 'canonical-unset-increment',
      nodes: [0, 1, 2].map((column) => ({
        id: `node-0-${column}`,
        row: 0,
        column,
        kind: 'corridor',
        region: 'branching',
      })),
      edges: [],
    }
    const result = constructOrthogonalGeometry(topology, {
      ...config,
      widthMeters: 10,
      depthMeters: 10,
      constructionIncrementMeters: null,
    })

    expect(result.geometry).toEqual({
      schemaVersion: '1',
      levelId: 'level-1',
      boundsWidthMeters: 10,
      boundsDepthMeters: 10,
      walls: [
        {
          id: 'wall-v-0-0',
          kind: 'straight',
          start: { x: 10 / 3, y: 0.5 },
          end: { x: 10 / 3, y: 9.5 },
          thicknessMeters: 1,
        },
        {
          id: 'wall-v-0-1',
          kind: 'straight',
          start: { x: 20 / 3, y: 0.5 },
          end: { x: 20 / 3, y: 9.5 },
          thicknessMeters: 1,
        },
      ],
      chambers: [],
      portals: [],
      entrance: {
        id: 'entrance',
        kind: 'entrance',
        position: { x: 0, y: 5 },
        connectedRegionId: 'node-0-0',
      },
      exit: {
        id: 'exit',
        kind: 'exit',
        position: { x: 10, y: 5 },
        connectedRegionId: 'node-0-2',
      },
    })
  })

  it('keeps generated placements on the configured increment across grid sizes and seeds', () => {
    for (const [rows, columns] of [[1, 2], [2, 4], [4, 4], [5, 5]]) {
      const topology = generateIntendedTopology({
        rows,
        columns,
        mode: 'maze',
        seed: `increment-property-${rows}-${columns}`,
      })
      const result = constructOrthogonalGeometry(topology, {
        ...config,
        constructionIncrementMeters: 0.5,
      })

      expect(result.issues).toEqual([])
      expect(result.geometry).not.toBeNull()
      const measurements = [
        result.cellWidthMeters,
        result.cellDepthMeters,
        result.geometry!.entrance.position.x,
        result.geometry!.entrance.position.y,
        result.geometry!.exit.position.x,
        result.geometry!.exit.position.y,
        ...result.geometry!.walls.flatMap((wall) =>
          wall.kind === 'straight'
            ? [
                wall.start.x,
                wall.start.y,
                wall.end.x,
                wall.end.y,
                wall.thicknessMeters,
              ]
            : [],
        ),
      ]
      expect(measurements.every((value) =>
        Math.abs(value / 0.5 - Math.round(value / 0.5)) <= 1e-7,
      )).toBe(true)
    }
  })

  it('adds explicit perimeter walls only when requested', () => {
    const topology = generateIntendedTopology({
      rows: 3,
      columns: 3,
      mode: 'maze',
      seed: 'perimeter',
    })
    const perimeterConfig = { ...config, constructionIncrementMeters: null }
    const openBoundary = constructOrthogonalGeometry(topology, perimeterConfig)
    const bounded = constructOrthogonalGeometry(topology, perimeterConfig, { includePerimeterWalls: true })

    expect(openBoundary.geometry?.walls.some((wall) => wall.id.startsWith('perimeter-'))).toBe(false)
    expect(bounded.geometry?.walls.some((wall) => wall.id.startsWith('perimeter-'))).toBe(true)
    expect(bounded.issues).toEqual([])
  })

  it('constructs configured chamber floor area or reports when it cannot fit', () => {
    const topology = generateIntendedTopology({
      rows: 4,
      columns: 4,
      mode: 'maze',
      seed: 'chamber',
    })
    const assignment = { nodeId: 'node-1-1', config: DEFAULT_CHAMBERS[0] }
    const result = constructOrthogonalGeometry(topology, config, { chambers: [assignment] })
    const tooSmall = constructOrthogonalGeometry(topology, {
      ...config,
      widthMeters: 4,
      depthMeters: 4,
    }, { chambers: [assignment] })

    expect(result.geometry?.chambers[0].areaMetersSquared).toBe(16)
    expect(result.issues).toEqual([])
    expect(tooSmall.geometry).toBeNull()
    expect(tooSmall.issues[0].code).toBe('insufficient-cell-size')
  })

  it('does not construct disabled chambers', () => {
    const topology = generateIntendedTopology({
      rows: 4,
      columns: 4,
      mode: 'maze',
      seed: 'disabled-chamber',
    })
    const result = constructOrthogonalGeometry(topology, config, {
      chambers: [{
        nodeId: 'node-1-1',
        config: { ...DEFAULT_CHAMBERS[0], enabled: false },
      }],
    })

    expect(result.issues).toEqual([])
    expect(result.geometry?.chambers).toEqual([])
  })
})
