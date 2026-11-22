import type { ChamberConfig, MazeConfig } from '../domain/types'
import type { ChamberRegion, MazeGeometry, StraightWall } from './models'
import type { IntendedTopology, TopologyEdge } from '../topology/generator'
import { validateEndpoints } from './endpoints'

export { ORTHOGONAL_CONSTRUCTION_ALGORITHM_VERSION } from '../algorithmVersions'

export interface ChamberAssignment {
  nodeId: string
  config: ChamberConfig
}

export interface OrthogonalConstructionOptions {
  includePerimeterWalls?: boolean
  chambers?: ChamberAssignment[]
}

export interface ConstructionIssue {
  code:
    | 'invalid-grid'
    | 'insufficient-cell-size'
    | 'invalid-chamber'
    | 'invalid-topology'
    | 'off-construction-increment'
  message: string
  entityId?: string
}

export interface OrthogonalConstructionResult {
  geometry: MazeGeometry | null
  issues: ConstructionIssue[]
  cellWidthMeters: number
  cellDepthMeters: number
  passageClearWidthMeters: number
}

function canonicalEdge(from: string, to: string): string {
  return [from, to].sort().join('|')
}

function edgeSet(edges: TopologyEdge[]): Set<string> {
  return new Set(edges.map((edge) => canonicalEdge(edge.from, edge.to)))
}

function createWall(
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  thicknessMeters: number,
): StraightWall {
  return { id, kind: 'straight', start, end, thicknessMeters }
}

function addWallWithOpening(
  walls: StraightWall[],
  id: string,
  axis: 'horizontal' | 'vertical',
  fixed: number,
  start: number,
  end: number,
  openingCenter: number | null,
  clearWidthMeters: number,
  thicknessMeters: number,
): void {
  if (openingCenter === null) {
    walls.push(createWall(
      id,
      axis === 'horizontal' ? { x: start, y: fixed } : { x: fixed, y: start },
      axis === 'horizontal' ? { x: end, y: fixed } : { x: fixed, y: end },
      thicknessMeters,
    ))
    return
  }

  const grossOpeningWidth = clearWidthMeters + thicknessMeters
  const openingStart = openingCenter - grossOpeningWidth / 2
  const openingEnd = openingCenter + grossOpeningWidth / 2
  const epsilon = 1e-7

  if (openingStart > start + epsilon) {
    walls.push(createWall(
      `${id}-a`,
      axis === 'horizontal' ? { x: start, y: fixed } : { x: fixed, y: start },
      axis === 'horizontal' ? { x: openingStart, y: fixed } : { x: fixed, y: openingStart },
      thicknessMeters,
    ))
  }
  if (openingEnd < end - epsilon) {
    walls.push(createWall(
      `${id}-b`,
      axis === 'horizontal' ? { x: openingEnd, y: fixed } : { x: fixed, y: openingEnd },
      axis === 'horizontal' ? { x: end, y: fixed } : { x: fixed, y: end },
      thicknessMeters,
    ))
  }
}

function chamberForAssignment(
  assignment: ChamberAssignment,
  node: IntendedTopology['nodes'][number],
  cellWidth: number,
  cellDepth: number,
  wallThickness: number,
): ChamberRegion | null {
  if (!assignment.config.enabled) return null
  const sideMeters = Math.sqrt(assignment.config.areaMetersSquared)
  const usableWidth = cellWidth - wallThickness
  const usableDepth = cellDepth - wallThickness
  if (
    assignment.config.areaMetersSquared < assignment.config.minimumAreaMetersSquared
    || assignment.config.areaMetersSquared > assignment.config.maximumAreaMetersSquared
    || sideMeters > usableWidth
    || sideMeters > usableDepth
  ) {
    return null
  }

  const centerX = (node.column + 0.5) * cellWidth
  const centerY = (node.row + 0.5) * cellDepth
  const half = sideMeters / 2
  return {
    id: assignment.config.id,
    kind: 'rectangle',
    areaMetersSquared: sideMeters * sideMeters,
    points: [
      { x: centerX - half, y: centerY - half },
      { x: centerX + half, y: centerY - half },
      { x: centerX + half, y: centerY + half },
      { x: centerX - half, y: centerY + half },
    ],
  }
}

function isOnConstructionIncrement(value: number, incrementMeters: number): boolean {
  const increments = value / incrementMeters
  return Number.isFinite(increments)
    && Math.abs(increments - Math.round(increments)) <= 1e-7 * Math.max(1, Math.abs(increments))
}

export function constructOrthogonalGeometry(
  topology: IntendedTopology,
  config: MazeConfig,
  options: OrthogonalConstructionOptions = {},
): OrthogonalConstructionResult {
  const issues: ConstructionIssue[] = []
  const rows = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.row), -1) + 1
  const columns = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.column), -1) + 1
  const cellWidthMeters = config.widthMeters / columns
  const cellDepthMeters = config.depthMeters / rows
  const passageClearWidthMeters =
    config.uniformCorridorWidthMeters ?? config.minimumPassageWidthMeters

  if (rows < 1 || columns < 1 || topology.nodes.length !== rows * columns) {
    issues.push({
      code: 'invalid-grid',
      message: 'Topology must contain a complete rectangular grid of cells.',
    })
  }

  const requiredOpeningSpan = passageClearWidthMeters + config.wallThicknessMeters
  if (cellWidthMeters + 1e-7 < requiredOpeningSpan || cellDepthMeters + 1e-7 < requiredOpeningSpan) {
    issues.push({
      code: 'insufficient-cell-size',
      message: 'Cell dimensions cannot provide the requested clear passage width and wall thickness.',
    })
  }

  const nodeById = new Map(topology.nodes.map((node) => [node.id, node]))
  if (nodeById.size !== topology.nodes.length) {
    issues.push({
      code: 'invalid-topology',
      message: 'Topology node identifiers must be unique.',
    })
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!nodeById.has(`node-${row}-${column}`)) {
        issues.push({
          code: 'invalid-topology',
          message: 'Topology must contain each cell in its rectangular grid.',
          entityId: `node-${row}-${column}`,
        })
      }
    }
  }
  const edges = edgeSet(topology.edges)
  for (const edge of topology.edges) {
    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    if (
      !from
      || !to
      || Math.abs(from.row - to.row) + Math.abs(from.column - to.column) !== 1
    ) {
      issues.push({
        code: 'invalid-topology',
        message: 'Every passage must connect adjacent cells in the orthogonal grid.',
        entityId: edge.id,
      })
    }
  }

  const walls: StraightWall[] = []
  const halfThickness = config.wallThicknessMeters / 2
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const currentId = `node-${row}-${column}`
      const centerX = (column + 1) * cellWidthMeters
      const centerY = (row + 1) * cellDepthMeters
      if (column + 1 < columns) {
        const rightId = `node-${row}-${column + 1}`
        const open = edges.has(canonicalEdge(currentId, rightId))
        addWallWithOpening(
          walls,
          `wall-v-${row}-${column}`,
          'vertical',
          centerX,
          row === 0 ? halfThickness : row * cellDepthMeters,
          row + 1 === rows ? config.depthMeters - halfThickness : centerY,
          open ? centerY - cellDepthMeters / 2 : null,
          passageClearWidthMeters,
          config.wallThicknessMeters,
        )
      }
      if (row + 1 < rows) {
        const belowId = `node-${row + 1}-${column}`
        const open = edges.has(canonicalEdge(currentId, belowId))
        addWallWithOpening(
          walls,
          `wall-h-${row}-${column}`,
          'horizontal',
          centerY,
          column === 0 ? halfThickness : column * cellWidthMeters,
          column + 1 === columns ? config.widthMeters - halfThickness : centerX,
          open ? centerX - cellWidthMeters / 2 : null,
          passageClearWidthMeters,
          config.wallThicknessMeters,
        )
      }
    }
  }

  if (options.includePerimeterWalls && rows > 0 && columns > 0) {
    const entranceY = cellDepthMeters / 2
    const exitY = config.depthMeters - cellDepthMeters / 2
    addWallWithOpening(
      walls,
      'perimeter-west',
      'vertical',
      halfThickness,
      halfThickness,
      config.depthMeters - halfThickness,
      entranceY,
      config.minimumPassageWidthMeters,
      config.wallThicknessMeters,
    )
    addWallWithOpening(
      walls,
      'perimeter-east',
      'vertical',
      config.widthMeters - halfThickness,
      halfThickness,
      config.depthMeters - halfThickness,
      exitY,
      config.minimumPassageWidthMeters,
      config.wallThicknessMeters,
    )
    walls.push(createWall(
      'perimeter-north',
      { x: halfThickness, y: halfThickness },
      { x: config.widthMeters - halfThickness, y: halfThickness },
      config.wallThicknessMeters,
    ))
    walls.push(createWall(
      'perimeter-south',
      { x: halfThickness, y: config.depthMeters - halfThickness },
      { x: config.widthMeters - halfThickness, y: config.depthMeters - halfThickness },
      config.wallThicknessMeters,
    ))
  }

  const chambers: ChamberRegion[] = []
  for (const assignment of options.chambers ?? []) {
    if (!assignment.config.enabled) continue
    const node = nodeById.get(assignment.nodeId)
    const chamber = node
      ? chamberForAssignment(
          assignment,
          node,
          cellWidthMeters,
          cellDepthMeters,
          config.wallThicknessMeters,
        )
      : null
    if (!chamber) {
      issues.push({
        code: 'invalid-chamber',
        message: 'Chamber is disabled, outside its allowed area, or does not fit within its cell.',
        entityId: assignment.config.id,
      })
    } else {
      chambers.push(chamber)
    }
  }

  if (issues.length > 0) {
    return {
      geometry: null,
      issues,
      cellWidthMeters,
      cellDepthMeters,
      passageClearWidthMeters,
    }
  }

  const geometry: MazeGeometry = {
    schemaVersion: '1',
    levelId: 'level-1',
    boundsWidthMeters: config.widthMeters,
    boundsDepthMeters: config.depthMeters,
    walls,
    chambers,
    portals: [],
    entrance: {
      id: 'entrance',
      kind: 'entrance',
      position: { x: 0, y: cellDepthMeters / 2 },
      connectedRegionId: 'node-0-0',
    },
    exit: {
      id: 'exit',
      kind: 'exit',
      position: {
        x: config.widthMeters,
        y: config.depthMeters - cellDepthMeters / 2,
      },
      connectedRegionId: `node-${rows - 1}-${columns - 1}`,
    },
  }

  const endpointIssues = validateEndpoints(geometry)
  if (endpointIssues.length > 0) {
    return {
      geometry: null,
      issues: endpointIssues.map((issue) => ({
        code: 'invalid-topology',
        message: issue.message,
        entityId: issue.field,
      })),
      cellWidthMeters,
      cellDepthMeters,
      passageClearWidthMeters,
    }
  }

  const incrementMeters = config.constructionIncrementMeters
  if (incrementMeters !== null) {
    const dimensions = [
      config.widthMeters,
      config.depthMeters,
      config.wallThicknessMeters,
      passageClearWidthMeters,
      cellWidthMeters,
      cellDepthMeters,
    ]
    const wallMeasurements = geometry.walls.flatMap((wall) =>
      wall.kind === 'straight'
        ? [
            wall.start.x,
            wall.start.y,
            wall.end.x,
            wall.end.y,
            wall.thicknessMeters,
          ]
        : [
            wall.center.x,
            wall.center.y,
            wall.radiusMeters,
            wall.thicknessMeters,
          ],
    )
    const chamberCoordinates = geometry.chambers.flatMap((chamber) =>
      chamber.points.flatMap((point) => [point.x, point.y]),
    )
    const endpointCoordinates = [
      geometry.entrance.position.x,
      geometry.entrance.position.y,
      geometry.exit.position.x,
      geometry.exit.position.y,
    ]
    if (
      !Number.isFinite(incrementMeters)
      || incrementMeters <= 0
      || [
        ...dimensions,
        ...wallMeasurements,
        ...chamberCoordinates,
        ...endpointCoordinates,
      ]
        .some((value) => !isOnConstructionIncrement(value, incrementMeters))
    ) {
      return {
        geometry: null,
        issues: [{
          code: 'off-construction-increment',
          message: `Generated dimensions or placements cannot honor the configured ${incrementMeters} m construction increment without changing clearances or bounds.`,
        }],
        cellWidthMeters,
        cellDepthMeters,
        passageClearWidthMeters,
      }
    }
  }

  return {
    geometry,
    issues: [],
    cellWidthMeters,
    cellDepthMeters,
    passageClearWidthMeters,
  }
}
