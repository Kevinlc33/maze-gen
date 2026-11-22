import type { DoorType, Point2D } from '../domain/types'
import type { DoorPortal, MazeGeometry, StraightWall } from '../geometry/models'
import { GEOMETRY_EPSILON_METERS } from '../geometry/precision'
import { validateEndpoints } from '../geometry/endpoints'
import type { IntendedTopology } from '../topology/generator'

const EPSILON = GEOMETRY_EPSILON_METERS
export { PHYSICAL_NAVIGATION_ALGORITHM_VERSION } from '../algorithmVersions'
const validatedNavigationBrand: unique symbol = Symbol('validated-navigation')
const validatedNavigationArtifacts = new WeakSet<object>()

export interface NavigationRegion {
  id: string
  cellCount: number
}

export interface PortalValidation {
  portalId: string
  valid: boolean
  regionId: string | null
  message: string | null
}

export interface NavigationIssue {
  code: 'invalid-geometry' | 'invalid-wall' | 'invalid-portal' | 'invalid-endpoint' | 'resource-limit'
  message: string
  entityId?: string
}

export interface PhysicalNavigation {
  regions: NavigationRegion[]
  connections: PhysicalNavigationConnection[]
  nodeMappings: TopologyNodeMapping[]
  boundaryEvidence: TopologyBoundaryEvidence[]
  entranceRegionId: string | null
  exitRegionId: string | null
  entranceTopologyRegionId: string | null
  exitTopologyRegionId: string | null
  portalValidations: PortalValidation[]
  issues: NavigationIssue[]
  decompositionCellCount: number
}

export interface PhysicalPassageWitness {
  axis: 'horizontal' | 'vertical'
  coordinate: number
  start: number
  end: number
  position: Point2D
}

export type ValidatedPassageWitness =
  Readonly<Omit<PhysicalPassageWitness, 'position'>>
  & { readonly position: Readonly<Point2D> }

export type ValidatedTopologyNodeMapping =
  Readonly<Omit<TopologyNodeMapping, 'anchor'>>
  & { readonly anchor: Readonly<Point2D> }

export interface PhysicalNavigationConnection {
  id: string
  fromRegionId: string
  toRegionId: string
  witness: PhysicalPassageWitness
  portalId?: string
}

export interface TopologyNodeMapping {
  nodeId: string
  anchor: Point2D
  physicalComponentId: string | null
}

export interface TopologyBoundaryEvidence {
  edgeId: string
  from: string
  to: string
  expectedTraversable: boolean
  physicallyTraversable: boolean
  passageWitnesses: PhysicalPassageWitness[]
  barrierWitness: PhysicalPassageWitness | null
}

export interface ValidatedTopologyBoundaryEvidence
  extends Readonly<Omit<TopologyBoundaryEvidence, 'passageWitnesses' | 'barrierWitness'>> {
  readonly passageWitnesses: readonly ValidatedPassageWitness[]
  readonly barrierWitness: ValidatedPassageWitness | null
}

export interface ConnectivityMismatch {
  edgeId: string
  from: string
  to: string
  expectedTraversable: boolean
  physicallyTraversable: boolean
  message: string
}

export interface PhysicalCandidateValidation {
  status: 'valid' | 'invalid' | 'incomplete'
  eligibleForVerification: boolean
  navigation: PhysicalNavigation
  validatedNavigation: ValidatedNavigationArtifact | null
  nodeMappings: TopologyNodeMapping[]
  boundaryEvidence: TopologyBoundaryEvidence[]
  connectivityMismatches: ConnectivityMismatch[]
}

export interface ValidatedNavigationArtifact {
  readonly [validatedNavigationBrand]: true
  readonly candidateId: string
  readonly minimumPassageWidthMeters: number
  readonly regions: readonly string[]
  readonly connections: readonly {
    id: string
    fromRegionId: string
    toRegionId: string
    witness: ValidatedPassageWitness
    portalId?: string
  }[]
  readonly portals: readonly {
    readonly id: string
    readonly kind: 'portal'
    readonly type: DoorType
    readonly position: Readonly<Point2D>
    readonly widthMeters: number
    readonly connectedRegionIds: readonly [string, string]
    readonly dependencies: readonly string[]
  }[]
  readonly entranceRegionId: string
  readonly exitRegionId: string
  readonly nodeMappings: readonly ValidatedTopologyNodeMapping[]
  readonly boundaryEvidence: readonly ValidatedTopologyBoundaryEvidence[]
  readonly routeMetricStatus: 'complete' | 'incomplete'
  readonly routeLocations: readonly {
    readonly id: string
    readonly regionId: string
    readonly position: Readonly<Point2D>
    readonly kind: 'entrance' | 'exit' | 'passage-side'
    readonly connectionId?: string
  }[]
  readonly routeTravel: readonly {
    readonly fromLocationId: string
    readonly toLocationId: string
    readonly distanceMeters: number
  }[]
  readonly routePassages: readonly {
    readonly connectionId: string
    readonly fromLocationId: string
    readonly toLocationId: string
    readonly distanceMeters: number
    readonly encounterOffsetMeters: number
    readonly portalId?: string
  }[]
}

interface Rectangle {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface GridCell {
  xIndex: number
  yIndex: number
  center: Point2D
  regionId: string | null
  visited: boolean
}

function wallFootprint(wall: StraightWall): Rectangle {
  const half = wall.thicknessMeters / 2
  return {
    minX: Math.min(wall.start.x, wall.end.x) - half,
    minY: Math.min(wall.start.y, wall.end.y) - half,
    maxX: Math.max(wall.start.x, wall.end.x) + half,
    maxY: Math.max(wall.start.y, wall.end.y) + half,
  }
}

function inflated(rectangle: Rectangle, amount: number): Rectangle {
  return {
    minX: rectangle.minX - amount,
    minY: rectangle.minY - amount,
    maxX: rectangle.maxX + amount,
    maxY: rectangle.maxY + amount,
  }
}

function uniqueSorted(values: number[]): number[] {
  const sorted = values.sort((a, b) => a - b)
  return sorted.filter((value, index) => index === 0 || value - sorted[index - 1] > EPSILON)
}

function contains(rectangle: Rectangle, point: Point2D): boolean {
  return (
    point.x > rectangle.minX
    && point.x < rectangle.maxX
    && point.y > rectangle.minY
    && point.y < rectangle.maxY
  )
}

function coordinateIndex(values: number[], value: number): number {
  if (
    values.length < 2
    || !Number.isFinite(value)
    || value < values[0]
    || value > values[values.length - 1]
  ) {
    return -1
  }
  if (value >= values[values.length - 1] - EPSILON) return values.length - 2
  for (let index = 0; index < values.length - 1; index += 1) {
    if (value >= values[index] && value < values[index + 1]) {
      return index
    }
  }
  return -1
}

function componentAt(
  point: Point2D,
  xCoordinates: number[],
  yCoordinates: number[],
  cells: GridCell[][],
): string | null {
  const xIndex = coordinateIndex(xCoordinates, point.x)
  const yIndex = coordinateIndex(yCoordinates, point.y)
  if (xIndex < 0 || yIndex < 0) return null
  return cells[yIndex]?.[xIndex]?.regionId ?? null
}

function passageJoinsMappedComponents(
  witness: PhysicalPassageWitness,
  fromComponentId: string | null,
  toComponentId: string | null,
  xCoordinates: number[],
  yCoordinates: number[],
  cells: GridCell[][],
  offset: number,
): boolean {
  if (!fromComponentId || !toComponentId) return false
  const before = witness.axis === 'vertical'
    ? { x: witness.coordinate - offset, y: witness.position.y }
    : { x: witness.position.x, y: witness.coordinate - offset }
  const after = witness.axis === 'vertical'
    ? { x: witness.coordinate + offset, y: witness.position.y }
    : { x: witness.position.x, y: witness.coordinate + offset }
  return (
    componentAt(before, xCoordinates, yCoordinates, cells) === fromComponentId
    && componentAt(after, xCoordinates, yCoordinates, cells) === toComponentId
  )
}

function topologyNodeAtPoint(
  point: Point2D,
  topology: IntendedTopology,
  geometry: MazeGeometry,
): string | null {
  const rows = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.row), -1) + 1
  const columns = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.column), -1) + 1
  if (
    rows < 1
    || columns < 1
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || point.x < 0
    || point.y < 0
    || point.x > geometry.boundsWidthMeters
    || point.y > geometry.boundsDepthMeters
  ) {
    return null
  }
  const column = point.x >= geometry.boundsWidthMeters - EPSILON
    ? columns - 1
    : Math.floor(point.x / (geometry.boundsWidthMeters / columns))
  const row = point.y >= geometry.boundsDepthMeters - EPSILON
    ? rows - 1
    : Math.floor(point.y / (geometry.boundsDepthMeters / rows))
  const nodeId = `node-${row}-${column}`
  return topology.nodes.some((node) => node.id === nodeId) ? nodeId : null
}

function portalValidation(
  portal: DoorPortal,
  minimumPassageWidthMeters: number,
  boundsWidthMeters: number,
  boundsDepthMeters: number,
  regionIds: ReadonlySet<string>,
  xCoordinates: number[],
  yCoordinates: number[],
  cells: GridCell[][],
): PortalValidation {
  const connectedRegionIds = portal.connectedRegionIds
  if (
    !Number.isFinite(portal.position.x)
    || !Number.isFinite(portal.position.y)
    || portal.position.x < 0
    || portal.position.y < 0
    || portal.position.x > boundsWidthMeters
    || portal.position.y > boundsDepthMeters
  ) {
    return {
      portalId: portal.id,
      valid: false,
      regionId: null,
      message: 'Portal position lies outside the configured design area.',
    }
  }
  if (
    !Number.isFinite(portal.widthMeters)
    || portal.widthMeters <= 0
    || !Array.isArray(connectedRegionIds)
    || connectedRegionIds.length !== 2
    || connectedRegionIds[0] === connectedRegionIds[1]
    || connectedRegionIds.some((id) => !regionIds.has(id))
  ) {
    return {
      portalId: portal.id,
      valid: false,
      regionId: null,
      message: 'Portal must have finite clearance and reference two distinct physical regions.',
    }
  }
  const regionId = componentAt(portal.position, xCoordinates, yCoordinates, cells)
  if (portal.widthMeters + EPSILON < minimumPassageWidthMeters) {
    return {
      portalId: portal.id,
      valid: false,
      regionId,
      message: `Portal clearance must be at least ${minimumPassageWidthMeters} meters.`,
    }
  }
  if (!regionId) {
    return {
      portalId: portal.id,
      valid: false,
      regionId: null,
      message: 'Portal position is not in physically traversable space.',
    }
  }
  return { portalId: portal.id, valid: true, regionId, message: null }
}

function canonicalEdge(from: string, to: string): string {
  return [from, to].sort().join('|')
}

function topologyStructureIssue(topology: IntendedTopology): string | null {
  const rows = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.row), -1) + 1
  const columns = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.column), -1) + 1
  const nodeIds = new Set(topology.nodes.map((node) => node.id))
  if (
    !Number.isInteger(rows)
    || !Number.isInteger(columns)
    || rows < 1
    || columns < 1
    || topology.nodes.length !== rows * columns
    || nodeIds.size !== topology.nodes.length
  ) {
    return 'Intended topology must contain a complete grid with unique node identifiers.'
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!nodeIds.has(`node-${row}-${column}`)) {
        return 'Intended topology must contain each canonical grid node.'
      }
    }
  }
  const seenEdges = new Set<string>()
  for (const edge of topology.edges) {
    const from = topology.nodes.find((node) => node.id === edge.from)
    const to = topology.nodes.find((node) => node.id === edge.to)
    const key = canonicalEdge(edge.from, edge.to)
    if (
      !from
      || !to
      || Math.abs(from.row - to.row) + Math.abs(from.column - to.column) !== 1
      || seenEdges.has(key)
    ) {
      return 'Intended topology connections must be unique and join adjacent grid nodes.'
    }
    seenEdges.add(key)
  }
  return null
}

function physicalObstacles(
  geometry: MazeGeometry,
  minimumPassageWidthMeters: number,
): Rectangle[] {
  const clearanceRadius = Math.max(0, minimumPassageWidthMeters / 2 - EPSILON)
  return geometry.walls.flatMap((wall) => {
    if (
      wall.kind !== 'straight'
      || !Number.isFinite(wall.start.x)
      || !Number.isFinite(wall.start.y)
      || !Number.isFinite(wall.end.x)
      || !Number.isFinite(wall.end.y)
      || !Number.isFinite(wall.thicknessMeters)
      || wall.thicknessMeters <= 0
    ) {
      return []
    }
    return [inflated(wallFootprint(wall), clearanceRadius)]
  })
}

function boundaryWitnesses(
  axis: 'horizontal' | 'vertical',
  coordinate: number,
  start: number,
  end: number,
  obstacles: Rectangle[],
): { passages: PhysicalPassageWitness[]; barrier: PhysicalPassageWitness | null } {
  const blockedIntervals = obstacles
    .filter((obstacle) => axis === 'vertical'
      ? obstacle.minX <= coordinate + EPSILON && obstacle.maxX >= coordinate - EPSILON
      : obstacle.minY <= coordinate + EPSILON && obstacle.maxY >= coordinate - EPSILON)
    .map((obstacle) => axis === 'vertical'
      ? [Math.max(start, obstacle.minY), Math.min(end, obstacle.maxY)] as const
      : [Math.max(start, obstacle.minX), Math.min(end, obstacle.maxX)] as const)
    .filter(([intervalStart, intervalEnd]) => intervalEnd > intervalStart + EPSILON)
    .sort((left, right) => left[0] - right[0])

  const merged: Array<[number, number]> = []
  for (const [intervalStart, intervalEnd] of blockedIntervals) {
    const previous = merged[merged.length - 1]
    if (!previous || intervalStart > previous[1] + EPSILON) {
      merged.push([intervalStart, intervalEnd])
    } else {
      previous[1] = Math.max(previous[1], intervalEnd)
    }
  }

  const passages: PhysicalPassageWitness[] = []
  const addPassage = (intervalStart: number, intervalEnd: number) => {
    if (intervalEnd - intervalStart <= EPSILON) return
    const along = (intervalStart + intervalEnd) / 2
    passages.push({
      axis,
      coordinate,
      start: intervalStart,
      end: intervalEnd,
      position: axis === 'vertical'
        ? { x: coordinate, y: along }
        : { x: along, y: coordinate },
    })
  }

  let cursor = start
  for (const [intervalStart, intervalEnd] of merged) {
    addPassage(cursor, intervalStart)
    cursor = Math.max(cursor, intervalEnd)
  }
  addPassage(cursor, end)

  const fullyBlocked = merged.length > 0
    && merged[0][0] <= start + EPSILON
    && merged[merged.length - 1][1] >= end - EPSILON
    && merged.every((interval, index) =>
      index === 0 || interval[0] <= merged[index - 1][1] + EPSILON,
    )
  const barrier = passages.length === 0 && fullyBlocked
    ? {
        axis,
        coordinate,
        start,
        end,
        position: axis === 'vertical'
          ? { x: coordinate, y: (start + end) / 2 }
          : { x: (start + end) / 2, y: coordinate },
      }
    : null
  return { passages, barrier }
}

function buildTopologyBoundaryEvidence(
  topology: IntendedTopology,
  geometry: MazeGeometry,
  minimumPassageWidthMeters: number,
): TopologyBoundaryEvidence[] {
  if (topologyStructureIssue(topology)) return []
  const rows = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.row), -1) + 1
  const columns = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.column), -1) + 1
  if (rows < 1 || columns < 1 || topology.nodes.length !== rows * columns) return []

  const intendedEdges = new Set(topology.edges.map((edge) => canonicalEdge(edge.from, edge.to)))
  const nodeIds = new Set(topology.nodes.map((node) => node.id))
  const obstacles = physicalObstacles(geometry, minimumPassageWidthMeters)
  const cellWidth = geometry.boundsWidthMeters / columns
  const cellDepth = geometry.boundsDepthMeters / rows
  const evidence: TopologyBoundaryEvidence[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const from = `node-${row}-${column}`
      if (!nodeIds.has(from)) continue
      const neighbors = [
        {
          row,
          column: column + 1,
          axis: 'vertical' as const,
          coordinate: (column + 1) * cellWidth,
          start: row * cellDepth,
          end: (row + 1) * cellDepth,
        },
        {
          row: row + 1,
          column,
          axis: 'horizontal' as const,
          coordinate: (row + 1) * cellDepth,
          start: column * cellWidth,
          end: (column + 1) * cellWidth,
        },
      ]
      for (const neighbor of neighbors) {
        if (neighbor.row >= rows || neighbor.column >= columns) continue
        const to = `node-${neighbor.row}-${neighbor.column}`
        if (!nodeIds.has(to)) continue
        const edgeId = `edge-${from}-${to}`
        const boundary = boundaryWitnesses(
          neighbor.axis,
          neighbor.coordinate,
          neighbor.start,
          neighbor.end,
          obstacles,
        )
        evidence.push({
          edgeId,
          from,
          to,
          expectedTraversable: intendedEdges.has(canonicalEdge(from, to)),
          physicallyTraversable: boundary.passages.length > 0,
          passageWitnesses: boundary.passages,
          barrierWitness: boundary.barrier,
        })
      }
    }
  }
  return evidence
}

function mismatchesFromEvidence(
  boundaryEvidence: TopologyBoundaryEvidence[],
): ConnectivityMismatch[] {
  return boundaryEvidence
    .filter((boundary) =>
      boundary.expectedTraversable !== boundary.physicallyTraversable,
    )
    .map((boundary) => ({
      edgeId: boundary.edgeId,
      from: boundary.from,
      to: boundary.to,
      expectedTraversable: boundary.expectedTraversable,
      physicallyTraversable: boundary.physicallyTraversable,
      message: boundary.expectedTraversable
        ? 'Intended connection is physically blocked or too narrow.'
        : 'Physical geometry contains an unintended shortcut.',
    }))
}

function topologyPortalValidation(
  portal: DoorPortal,
  minimumPassageWidthMeters: number,
  boundsWidthMeters: number,
  boundsDepthMeters: number,
  topology: IntendedTopology,
  boundaryEvidence: TopologyBoundaryEvidence[],
  xCoordinates: number[],
  yCoordinates: number[],
  cells: GridCell[][],
): PortalValidation {
  const [firstRegionId, secondRegionId] = portal.connectedRegionIds
  const regionId = componentAt(portal.position, xCoordinates, yCoordinates, cells)
  if (
    !Number.isFinite(portal.position.x)
    || !Number.isFinite(portal.position.y)
    || portal.position.x < 0
    || portal.position.y < 0
    || portal.position.x > boundsWidthMeters
    || portal.position.y > boundsDepthMeters
    || !Number.isFinite(portal.widthMeters)
    || portal.widthMeters + EPSILON < minimumPassageWidthMeters
    || !firstRegionId
    || !secondRegionId
    || firstRegionId === secondRegionId
    || !topology.nodes.some((node) => node.id === firstRegionId)
    || !topology.nodes.some((node) => node.id === secondRegionId)
  ) {
    return {
      portalId: portal.id,
      valid: false,
      regionId,
      message: 'Portal must have valid bounds, clearance, and two distinct intended regions.',
    }
  }

  const matchingBoundary = boundaryEvidence.find((boundary) =>
    canonicalEdge(boundary.from, boundary.to) === canonicalEdge(firstRegionId, secondRegionId),
  )
  const passage = matchingBoundary?.passageWitnesses.find((witness) => {
    if (witness.axis === 'vertical') {
      return (
        Math.abs(portal.position.x - witness.coordinate) <= EPSILON
        && portal.position.y - portal.widthMeters / 2 >= witness.start - EPSILON
        && portal.position.y + portal.widthMeters / 2 <= witness.end + EPSILON
      )
    }
    return (
      Math.abs(portal.position.y - witness.coordinate) <= EPSILON
      && portal.position.x - portal.widthMeters / 2 >= witness.start - EPSILON
      && portal.position.x + portal.widthMeters / 2 <= witness.end + EPSILON
    )
  })
  if (!regionId || !passage) {
    return {
      portalId: portal.id,
      valid: false,
      regionId,
      message: 'Portal opening does not physically join its declared adjacent regions.',
    }
  }
  return { portalId: portal.id, valid: true, regionId, message: null }
}

export function compareIntendedTopologyToPhysicalGeometry(
  topology: IntendedTopology,
  geometry: MazeGeometry,
  minimumPassageWidthMeters: number,
): ConnectivityMismatch[] {
  const topologyIssue = topologyStructureIssue(topology)
  if (topologyIssue) {
    return [{
      edgeId: 'topology-grid',
      from: '',
      to: '',
      expectedTraversable: false,
      physicallyTraversable: false,
      message: topologyIssue,
    }]
  }
  const rows = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.row), -1) + 1
  const columns = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.column), -1) + 1
  if (rows < 1 || columns < 1 || topology.nodes.length !== rows * columns) {
    return [{
      edgeId: 'topology-grid',
      from: '',
      to: '',
      expectedTraversable: false,
      physicallyTraversable: false,
      message: 'Intended topology is not a complete rectangular grid.',
    }]
  }

  return mismatchesFromEvidence(
    buildTopologyBoundaryEvidence(topology, geometry, minimumPassageWidthMeters),
  )
}

export function reconstructPhysicalNavigation(
  geometry: MazeGeometry,
  minimumPassageWidthMeters: number,
  maximumDecompositionCells = 250_000,
  topology?: IntendedTopology,
): PhysicalNavigation {
  const issues: NavigationIssue[] = []
  if (
    !Number.isFinite(geometry.boundsWidthMeters)
    || !Number.isFinite(geometry.boundsDepthMeters)
    || geometry.boundsWidthMeters <= 0
    || geometry.boundsDepthMeters <= 0
    || !Number.isFinite(minimumPassageWidthMeters)
    || minimumPassageWidthMeters <= 0
  ) {
    return {
      regions: [],
      connections: [],
      nodeMappings: [],
      boundaryEvidence: [],
      entranceRegionId: null,
      exitRegionId: null,
      entranceTopologyRegionId: null,
      exitTopologyRegionId: null,
      portalValidations: [],
      issues: [{
        code: 'invalid-geometry',
        message: 'Design bounds and minimum passage width must be positive finite values.',
      }],
      decompositionCellCount: 0,
    }
  }
  const clearanceRadius = Math.max(0, minimumPassageWidthMeters / 2 - EPSILON)
  const obstacles: Rectangle[] = []
  const seenFootprints = new Set<string>()
  const endpointIssues = validateEndpoints(geometry)
  const endpointIssueFields = new Set(endpointIssues.map((issue) => issue.field))
  for (const issue of endpointIssues) {
    issues.push({
      code: 'invalid-endpoint',
      message: issue.message,
      entityId: issue.field,
    })
  }

  for (const wall of geometry.walls) {
    if (wall.kind !== 'straight') {
      issues.push({
        code: 'invalid-wall',
        message: 'Physical navigation currently requires orthogonal straight wall footprints.',
        entityId: wall.id,
      })
      continue
    }
    if (
      !Number.isFinite(wall.start.x)
      || !Number.isFinite(wall.start.y)
      || !Number.isFinite(wall.end.x)
      || !Number.isFinite(wall.end.y)
      || !Number.isFinite(wall.thicknessMeters)
    ) {
      issues.push({
        code: 'invalid-wall',
        message: 'Wall coordinates and thickness must be finite.',
        entityId: wall.id,
      })
      continue
    }
    if (
      wall.thicknessMeters <= 0
      || (Math.abs(wall.start.x - wall.end.x) > EPSILON
        && Math.abs(wall.start.y - wall.end.y) > EPSILON)
    ) {
      issues.push({
        code: 'invalid-wall',
        message: 'Wall must have positive thickness and be axis-aligned.',
        entityId: wall.id,
      })
      continue
    }
    const footprint = wallFootprint(wall)
    if (
      footprint.minX < -EPSILON
      || footprint.minY < -EPSILON
      || footprint.maxX > geometry.boundsWidthMeters + EPSILON
      || footprint.maxY > geometry.boundsDepthMeters + EPSILON
    ) {
      issues.push({
        code: 'invalid-wall',
        message: 'Wall footprint extends outside the configured design area.',
        entityId: wall.id,
      })
      continue
    }
    const footprintKey = [
      footprint.minX,
      footprint.minY,
      footprint.maxX,
      footprint.maxY,
    ].map((value) => value.toFixed(7)).join('|')
    if (seenFootprints.has(footprintKey)) {
      issues.push({
        code: 'invalid-wall',
        message: 'Duplicate wall footprints overlap exactly.',
        entityId: wall.id,
      })
      continue
    }
    seenFootprints.add(footprintKey)
    obstacles.push(inflated(footprint, clearanceRadius))
  }

  for (const chamber of geometry.chambers) {
    if (
      !Number.isFinite(chamber.areaMetersSquared)
      || chamber.points.some((point) =>
        !Number.isFinite(point.x)
        || !Number.isFinite(point.y)
        || point.x < 0
        || point.y < 0
        || point.x > geometry.boundsWidthMeters
        || point.y > geometry.boundsDepthMeters,
      )
    ) {
      issues.push({
        code: 'invalid-geometry',
        message: 'Chamber area and points must be finite and inside the configured design area.',
        entityId: chamber.id,
      })
    }
  }

  const clampX = (value: number) => Math.max(0, Math.min(geometry.boundsWidthMeters, value))
  const clampY = (value: number) => Math.max(0, Math.min(geometry.boundsDepthMeters, value))
  const xCoordinates = uniqueSorted([
    0,
    geometry.boundsWidthMeters,
    ...obstacles.flatMap((obstacle) => [clampX(obstacle.minX), clampX(obstacle.maxX)]),
  ])
  const yCoordinates = uniqueSorted([
    0,
    geometry.boundsDepthMeters,
    ...obstacles.flatMap((obstacle) => [clampY(obstacle.minY), clampY(obstacle.maxY)]),
  ])
  const columns = xCoordinates.length - 1
  const rows = yCoordinates.length - 1
  const decompositionCellCount = Math.max(0, columns) * Math.max(0, rows)

  if (decompositionCellCount > maximumDecompositionCells) {
    issues.push({
      code: 'resource-limit',
      message: `Physical navigation decomposition exceeds the ${maximumDecompositionCells} cell technical limit.`,
    })
    return {
      regions: [],
      connections: [],
      nodeMappings: [],
      boundaryEvidence: [],
      entranceRegionId: null,
      exitRegionId: null,
      entranceTopologyRegionId: null,
      exitTopologyRegionId: null,
      portalValidations: [],
      issues,
      decompositionCellCount,
    }
  }

  const cells: GridCell[][] = []
  for (let yIndex = 0; yIndex < rows; yIndex += 1) {
    const row: GridCell[] = []
    for (let xIndex = 0; xIndex < columns; xIndex += 1) {
      const center = {
        x: (xCoordinates[xIndex] + xCoordinates[xIndex + 1]) / 2,
        y: (yCoordinates[yIndex] + yCoordinates[yIndex + 1]) / 2,
      }
      const blocked = obstacles.some((obstacle) => contains(obstacle, center))
      row.push({
        xIndex,
        yIndex,
        center,
        regionId: blocked ? null : '',
        visited: false,
      })
    }
    cells.push(row)
  }

  const regions: NavigationRegion[] = []
  for (let yIndex = 0; yIndex < rows; yIndex += 1) {
    for (let xIndex = 0; xIndex < columns; xIndex += 1) {
      const first = cells[yIndex][xIndex]
      if (first.regionId === null || first.visited) continue
      const regionId = `physical-region-${regions.length + 1}`
      const pending = [first]
      first.visited = true
      let cellCount = 0
      while (pending.length > 0) {
        const cell = pending.pop()
        if (!cell) continue
        cell.regionId = regionId
        cellCount += 1
        for (const [nextX, nextY] of [
          [cell.xIndex - 1, cell.yIndex],
          [cell.xIndex + 1, cell.yIndex],
          [cell.xIndex, cell.yIndex - 1],
          [cell.xIndex, cell.yIndex + 1],
        ]) {
          const neighbor = cells[nextY]?.[nextX]
          if (neighbor && neighbor.regionId !== null && !neighbor.visited) {
            neighbor.visited = true
            pending.push(neighbor)
          }
        }

      }
      regions.push({ id: regionId, cellCount })
    }
  }

  const entranceRegionId = componentAt(
    geometry.entrance.position,
    xCoordinates,
    yCoordinates,
    cells,
  )
  const exitRegionId = componentAt(
    geometry.exit.position,
    xCoordinates,
    yCoordinates,
    cells,
  )
  if (!entranceRegionId && !endpointIssueFields.has('entrance')) {
    issues.push({
      code: 'invalid-endpoint',
      message: 'Entrance is not connected to physical free space.',
      entityId: geometry.entrance.id,
    })
  }
  if (!exitRegionId && !endpointIssueFields.has('exit')) {
    issues.push({
      code: 'invalid-endpoint',
      message: 'Exit is not connected to physical free space.',
      entityId: geometry.exit.id,
    })
  }

  const topologyRows = topology
    ? topology.nodes.reduce((maximum, node) => Math.max(maximum, node.row), -1) + 1
    : 0
  const topologyColumns = topology
    ? topology.nodes.reduce((maximum, node) => Math.max(maximum, node.column), -1) + 1
    : 0
  const topologyIssue = topology ? topologyStructureIssue(topology) : null
  if (topologyIssue) {
    issues.push({
      code: 'invalid-geometry',
      message: topologyIssue,
      entityId: 'topology-grid',
    })
  }
  const nodeMappings = topology?.nodes.map((node) => {
    const anchor = {
      x: (node.column + 0.5) * geometry.boundsWidthMeters / topologyColumns,
      y: (node.row + 0.5) * geometry.boundsDepthMeters / topologyRows,
    }
    return {
      nodeId: node.id,
      anchor,
      physicalComponentId: componentAt(anchor, xCoordinates, yCoordinates, cells),
    }
  }) ?? []
  for (const mapping of nodeMappings) {
    if (!mapping.physicalComponentId) {
      issues.push({
        code: 'invalid-geometry',
        message: 'An intended topology node has no traversable physical anchor.',
        entityId: mapping.nodeId,
      })
    }
  }
  if (topology) {
    const mappedPhysicalComponents = new Set(
      nodeMappings.flatMap((mapping) =>
        mapping.physicalComponentId ? [mapping.physicalComponentId] : [],
      ),
    )
    for (const region of regions) {
      if (!mappedPhysicalComponents.has(region.id)) {
        issues.push({
          code: 'invalid-geometry',
          message: 'A physical free-space region has no intended topology mapping.',
          entityId: region.id,
        })
      }
    }
  }
  const entranceTopologyRegionId = topology
    ? topologyNodeAtPoint(geometry.entrance.position, topology, geometry)
    : null
  const exitTopologyRegionId = topology
    ? topologyNodeAtPoint(geometry.exit.position, topology, geometry)
    : null
  const nodeMappingById = new Map(nodeMappings.map((mapping) => [mapping.nodeId, mapping]))
  if (
    topology
    && (
      !entranceTopologyRegionId
      || geometry.entrance.connectedRegionId !== entranceTopologyRegionId
      || nodeMappingById.get(entranceTopologyRegionId)?.physicalComponentId !== entranceRegionId
    )
  ) {
    issues.push({
      code: 'invalid-endpoint',
      message: 'Entrance does not map to its declared traversable topology region.',
      entityId: geometry.entrance.id,
    })
  }
  if (
    topology
    && (
      !exitTopologyRegionId
      || geometry.exit.connectedRegionId !== exitTopologyRegionId
      || nodeMappingById.get(exitTopologyRegionId)?.physicalComponentId !== exitRegionId
    )
  ) {
    issues.push({
      code: 'invalid-endpoint',
      message: 'Exit does not map to its declared traversable topology region.',
      entityId: geometry.exit.id,
    })
  }
  const rawBoundaryEvidence = topology
    ? buildTopologyBoundaryEvidence(topology, geometry, minimumPassageWidthMeters)
    : []
  const nodeMappingsById = new Map(nodeMappings.map((mapping) => [mapping.nodeId, mapping]))
  const crossingOffset = Math.min(
    1e-4,
    Math.max(2 * EPSILON, Math.min(
      geometry.boundsWidthMeters / Math.max(topologyColumns, 1),
      geometry.boundsDepthMeters / Math.max(topologyRows, 1),
    ) / 4),
  )
  const boundaryEvidence = rawBoundaryEvidence.map((boundary) => {
    const from = nodeMappingsById.get(boundary.from)
    const to = nodeMappingsById.get(boundary.to)
    const passageWitnesses = boundary.passageWitnesses.filter((witness) =>
      passageJoinsMappedComponents(
        witness,
        from?.physicalComponentId ?? null,
        to?.physicalComponentId ?? null,
        xCoordinates,
        yCoordinates,
        cells,
        crossingOffset,
      ),
    )
    if (passageWitnesses.length === 0 && !boundary.barrierWitness) {
      issues.push({
        code: 'invalid-geometry',
        message: 'A topology boundary has neither a verified passage nor a continuous barrier witness.',
        entityId: boundary.edgeId,
      })
    }
    return {
      ...boundary,
      physicallyTraversable: passageWitnesses.length > 0,
      passageWitnesses,
    }
  })
  const connections = boundaryEvidence.flatMap((boundary) =>
    boundary.passageWitnesses.map((witness, index) => {
      const portal = geometry.portals.find((candidate) =>
        canonicalEdge(...candidate.connectedRegionIds) === canonicalEdge(boundary.from, boundary.to)
        && (witness.axis === 'vertical'
          ? Math.abs(candidate.position.x - witness.coordinate) <= EPSILON
            && candidate.position.y - candidate.widthMeters / 2 >= witness.start - EPSILON
            && candidate.position.y + candidate.widthMeters / 2 <= witness.end + EPSILON
          : Math.abs(candidate.position.y - witness.coordinate) <= EPSILON
            && candidate.position.x - candidate.widthMeters / 2 >= witness.start - EPSILON
            && candidate.position.x + candidate.widthMeters / 2 <= witness.end + EPSILON),
      )
      return {
        id: `${boundary.edgeId}-passage-${index + 1}`,
        fromRegionId: boundary.from,
        toRegionId: boundary.to,
        witness,
        ...(portal ? { portalId: portal.id } : {}),
      }
    }),
  )
  const regionIds = new Set(regions.map((region) => region.id))
  const portalValidations = geometry.portals.map((portal) =>
    topology
      ? topologyPortalValidation(
          portal,
          minimumPassageWidthMeters,
          geometry.boundsWidthMeters,
          geometry.boundsDepthMeters,
          topology,
          boundaryEvidence,
          xCoordinates,
          yCoordinates,
          cells,
        )
      : portalValidation(
          portal,
          minimumPassageWidthMeters,
          geometry.boundsWidthMeters,
          geometry.boundsDepthMeters,
          regionIds,
          xCoordinates,
          yCoordinates,
          cells,
        ),
  )
  for (const validation of portalValidations) {
    if (!validation.valid) {
      issues.push({
        code: 'invalid-portal',
        message: validation.message ?? 'Portal is physically invalid.',
        entityId: validation.portalId,
      })
    }
  }

  return {
    regions,
    connections,
    nodeMappings,
    boundaryEvidence,
    entranceRegionId,
    exitRegionId,
    entranceTopologyRegionId,
    exitTopologyRegionId,
    portalValidations,
    issues,
    decompositionCellCount,
  }
}

export function validatePhysicalCandidate(
  topology: IntendedTopology,
  geometry: MazeGeometry,
  minimumPassageWidthMeters: number,
  maximumDecompositionCells = 250_000,
): PhysicalCandidateValidation {
  const navigation = reconstructPhysicalNavigation(
    geometry,
    minimumPassageWidthMeters,
    maximumDecompositionCells,
    topology,
  )
  const exhausted = navigation.issues.some((issue) => issue.code === 'resource-limit')
  if (exhausted) {
    return {
      status: 'incomplete',
      eligibleForVerification: false,
      navigation,
      validatedNavigation: null,
      nodeMappings: navigation.nodeMappings,
      boundaryEvidence: navigation.boundaryEvidence,
      connectivityMismatches: [],
    }
  }
  const connectivityMismatches = navigation.boundaryEvidence.length > 0
    ? mismatchesFromEvidence(navigation.boundaryEvidence)
    : compareIntendedTopologyToPhysicalGeometry(
        topology,
        geometry,
        minimumPassageWidthMeters,
      )
  const status = navigation.issues.length === 0 && connectivityMismatches.length === 0
    ? 'valid'
    : 'invalid'
  const validatedNavigation = status === 'valid'
    ? mintValidatedNavigationArtifact(
        topology,
        geometry,
        minimumPassageWidthMeters,
        navigation,
      )
    : null
  return {
    status,
    eligibleForVerification: status === 'valid',
    navigation,
    validatedNavigation,
    nodeMappings: navigation.nodeMappings,
    boundaryEvidence: navigation.boundaryEvidence,
    connectivityMismatches,
  }
}

interface RouteLocation {
  id: string
  regionId: string
  position: Point2D
  kind: 'entrance' | 'exit' | 'passage-side'
  connectionId?: string
}

interface RouteTravel {
  fromLocationId: string
  toLocationId: string
  distanceMeters: number
}

interface RoutePassage {
  connectionId: string
  fromLocationId: string
  toLocationId: string
  distanceMeters: number
  encounterOffsetMeters: number
  portalId?: string
}

interface RouteMetricData {
  status: 'complete' | 'incomplete'
  locations: RouteLocation[]
  travel: RouteTravel[]
  passages: RoutePassage[]
}

const MAX_ROUTE_VISIBILITY_POINTS_PER_REGION = 600
const MAX_ROUTE_VISIBILITY_WORK = 2_000_000

function intervalWithinOpenRange(
  start: number,
  delta: number,
  minimum: number,
  maximum: number,
): [number, number] | null {
  const lower = minimum + EPSILON
  const upper = maximum - EPSILON
  if (upper <= lower) return null
  if (Math.abs(delta) <= EPSILON) {
    return start > lower && start < upper ? [0, 1] : null
  }
  const first = (lower - start) / delta
  const second = (upper - start) / delta
  return [Math.min(first, second), Math.max(first, second)]
}

function segmentCrossesObstacleInterior(
  start: Point2D,
  end: Point2D,
  obstacle: Rectangle,
): boolean {
  const xInterval = intervalWithinOpenRange(
    start.x,
    end.x - start.x,
    obstacle.minX,
    obstacle.maxX,
  )
  if (!xInterval) return false
  const yInterval = intervalWithinOpenRange(
    start.y,
    end.y - start.y,
    obstacle.minY,
    obstacle.maxY,
  )
  if (!yInterval) return false
  const entry = Math.max(0, xInterval[0], yInterval[0])
  const exit = Math.min(1, xInterval[1], yInterval[1])
  return exit > entry + Number.EPSILON
}

function shortestVisibilityDistances(
  bounds: Rectangle,
  obstacles: readonly Rectangle[],
  locations: readonly RouteLocation[],
  work: { count: number },
): number[][] | null {
  work.count += obstacles.length
  if (work.count > MAX_ROUTE_VISIBILITY_WORK) return null
  const clippedObstacles = obstacles.flatMap((obstacle) => {
    const clipped = {
      minX: Math.max(bounds.minX, obstacle.minX),
      minY: Math.max(bounds.minY, obstacle.minY),
      maxX: Math.min(bounds.maxX, obstacle.maxX),
      maxY: Math.min(bounds.maxY, obstacle.maxY),
    }
    return clipped.maxX > clipped.minX + EPSILON
      && clipped.maxY > clipped.minY + EPSILON
      ? [clipped]
      : []
  })
  const xCoordinates = uniqueSorted([
    bounds.minX,
    bounds.maxX,
    ...clippedObstacles.flatMap(({ minX, maxX }) => [minX, maxX]),
  ])
  const yCoordinates = uniqueSorted([
    bounds.minY,
    bounds.maxY,
    ...clippedObstacles.flatMap(({ minY, maxY }) => [minY, maxY]),
  ])
  const coordinatePointCount = xCoordinates.length * yCoordinates.length
  work.count += coordinatePointCount * Math.max(clippedObstacles.length, 1)
  if (work.count > MAX_ROUTE_VISIBILITY_WORK) return null
  const points: Point2D[] = locations.map(({ position }) => ({ ...position }))
  for (const x of xCoordinates) {
    for (const y of yCoordinates) {
      const point = { x, y }
      if (!clippedObstacles.some((obstacle) => contains(obstacle, point))) {
        points.push(point)
      }
    }
  }
  if (points.length > MAX_ROUTE_VISIBILITY_POINTS_PER_REGION) return null
  const pairCount = points.length * (points.length - 1) / 2
  const estimatedWork = (pairCount + points.length + locations.length)
      * Math.max(clippedObstacles.length, 1)
    + 2 * locations.length * points.length * points.length
  if (work.count + estimatedWork > MAX_ROUTE_VISIBILITY_WORK) return null
  work.count += estimatedWork
  for (const location of locations) {
    if (clippedObstacles.some((obstacle) => contains(obstacle, location.position))) {
      return null
    }
  }

  const adjacency = points.map(() => [] as Array<{ index: number; distance: number }>)
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      if (clippedObstacles.some((obstacle) =>
        segmentCrossesObstacleInterior(points[first], points[second], obstacle),
      )) {
        continue
      }
      const distance = Math.hypot(
        points[first].x - points[second].x,
        points[first].y - points[second].y,
      )
      adjacency[first].push({ index: second, distance })
      adjacency[second].push({ index: first, distance })
    }
  }

  const results: number[][] = []
  for (let source = 0; source < locations.length; source += 1) {
    const distances = points.map(() => Number.POSITIVE_INFINITY)
    const visited = points.map(() => false)
    distances[source] = 0
    for (let step = 0; step < points.length; step += 1) {
      let next = -1
      for (let index = 0; index < points.length; index += 1) {
        if (!visited[index] && (next < 0 || distances[index] < distances[next])) next = index
      }
      if (next < 0 || !Number.isFinite(distances[next])) break
      visited[next] = true
      for (const edge of adjacency[next]) {
        const candidateDistance = distances[next] + edge.distance
        if (candidateDistance < distances[edge.index]) {
          distances[edge.index] = candidateDistance
        }
      }
    }
    results.push(distances.slice(0, locations.length))
  }
  return results
}

function buildRouteMetricData(
  topology: IntendedTopology,
  geometry: MazeGeometry,
  minimumPassageWidthMeters: number,
  navigation: PhysicalNavigation,
): RouteMetricData {
  const locations: RouteLocation[] = []
  const passages: RoutePassage[] = []
  const nodeById = new Map(topology.nodes.map((node) => [node.id, node]))
  const rows = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.row), -1) + 1
  const columns = topology.nodes.reduce((maximum, node) => Math.max(maximum, node.column), -1) + 1
  const cellWidth = geometry.boundsWidthMeters / columns
  const cellDepth = geometry.boundsDepthMeters / rows
  let status: RouteMetricData['status'] = 'complete'
  const crossingOffset = Math.min(
    1e-4,
    Math.max(2 * EPSILON, Math.min(cellWidth, cellDepth) / 4),
  )

  if (!navigation.entranceTopologyRegionId || !navigation.exitTopologyRegionId) {
    status = 'incomplete'
  } else {
    locations.push({
      id: 'route-entrance',
      regionId: navigation.entranceTopologyRegionId,
      position: { ...geometry.entrance.position },
      kind: 'entrance',
    })
    locations.push({
      id: 'route-exit',
      regionId: navigation.exitTopologyRegionId,
      position: { ...geometry.exit.position },
      kind: 'exit',
    })
  }

  for (const connection of navigation.connections) {
    const fromNode = nodeById.get(connection.fromRegionId)
    const toNode = nodeById.get(connection.toRegionId)
    if (!fromNode || !toNode) {
      status = 'incomplete'
      continue
    }
    const fromLocationId = `route-passage:${connection.id}:from`
    const toLocationId = `route-passage:${connection.id}:to`
    const fromPosition = connection.witness.axis === 'vertical'
      ? { x: connection.witness.coordinate - crossingOffset, y: connection.witness.position.y }
      : { x: connection.witness.position.x, y: connection.witness.coordinate - crossingOffset }
    const toPosition = connection.witness.axis === 'vertical'
      ? { x: connection.witness.coordinate + crossingOffset, y: connection.witness.position.y }
      : { x: connection.witness.position.x, y: connection.witness.coordinate + crossingOffset }
    locations.push({
      id: fromLocationId,
      regionId: connection.fromRegionId,
      position: fromPosition,
      kind: 'passage-side',
      connectionId: connection.id,
    })
    locations.push({
      id: toLocationId,
      regionId: connection.toRegionId,
      position: toPosition,
      kind: 'passage-side',
      connectionId: connection.id,
    })
    const distanceMeters = Math.hypot(
      toPosition.x - fromPosition.x,
      toPosition.y - fromPosition.y,
    )
    passages.push({
      connectionId: connection.id,
      fromLocationId,
      toLocationId,
      distanceMeters,
      encounterOffsetMeters: crossingOffset,
      ...(connection.portalId ? { portalId: connection.portalId } : {}),
    })
    if (
      (connection.witness.axis === 'vertical'
        && (fromNode.row !== toNode.row || toNode.column - fromNode.column !== 1))
      || (connection.witness.axis === 'horizontal'
        && (fromNode.column !== toNode.column || toNode.row - fromNode.row !== 1))
    ) {
      status = 'incomplete'
    }
  }

  const obstacles = physicalObstacles(geometry, minimumPassageWidthMeters)
  const locationsByRegion = new Map<string, RouteLocation[]>()
  for (const location of locations) {
    const regionLocations = locationsByRegion.get(location.regionId) ?? []
    regionLocations.push(location)
    locationsByRegion.set(location.regionId, regionLocations)
  }
  const travel: RouteTravel[] = []
  const work = { count: 0 }
  for (const [regionId, regionLocations] of locationsByRegion) {
    const node = nodeById.get(regionId)
    if (!node) {
      status = 'incomplete'
      continue
    }
    const bounds = {
      minX: node.column * cellWidth,
      maxX: (node.column + 1) * cellWidth,
      minY: node.row * cellDepth,
      maxY: (node.row + 1) * cellDepth,
    }
    const distances = shortestVisibilityDistances(bounds, obstacles, regionLocations, work)
    if (!distances) {
      status = 'incomplete'
      continue
    }
    for (let fromIndex = 0; fromIndex < regionLocations.length; fromIndex += 1) {
      for (let toIndex = 0; toIndex < regionLocations.length; toIndex += 1) {
        if (fromIndex === toIndex) continue
        const distanceMeters = distances[fromIndex][toIndex]
        if (!Number.isFinite(distanceMeters)) {
          status = 'incomplete'
          continue
        }
        travel.push({
          fromLocationId: regionLocations[fromIndex].id,
          toLocationId: regionLocations[toIndex].id,
          distanceMeters,
        })
      }
    }
  }
  return { status, locations, travel, passages }
}

function mintValidatedNavigationArtifact(
  topology: IntendedTopology,
  geometry: MazeGeometry,
  minimumPassageWidthMeters: number,
  navigation: PhysicalNavigation,
): ValidatedNavigationArtifact {
  const portals = Object.freeze(geometry.portals.map((portal) => Object.freeze({
    id: portal.id,
    kind: 'portal' as const,
    type: portal.type,
    position: Object.freeze({ ...portal.position }),
    widthMeters: portal.widthMeters,
    connectedRegionIds: Object.freeze([
      portal.connectedRegionIds[0],
      portal.connectedRegionIds[1],
    ]) as readonly [string, string],
    dependencies: Object.freeze([...portal.dependencies]),
  })))
  const connections = Object.freeze(navigation.connections.map((connection) =>
    Object.freeze({
      id: connection.id,
      fromRegionId: connection.fromRegionId,
      toRegionId: connection.toRegionId,
      witness: Object.freeze({
        ...connection.witness,
        position: Object.freeze({ ...connection.witness.position }),
      }),
      ...(connection.portalId ? { portalId: connection.portalId } : {}),
    }),
  ))
  const nodeMappings = Object.freeze(navigation.nodeMappings.map((mapping) =>
    Object.freeze({
      nodeId: mapping.nodeId,
      anchor: Object.freeze({ ...mapping.anchor }),
      physicalComponentId: mapping.physicalComponentId,
    }),
  ))
  const boundaryEvidence = Object.freeze(navigation.boundaryEvidence.map((boundary) =>
    Object.freeze({
      ...boundary,
      passageWitnesses: Object.freeze(boundary.passageWitnesses.map((witness) =>
        Object.freeze({ ...witness, position: Object.freeze({ ...witness.position }) }),
      )),
      barrierWitness: boundary.barrierWitness
        ? Object.freeze({
            ...boundary.barrierWitness,
            position: Object.freeze({ ...boundary.barrierWitness.position }),
          })
        : null,
    }),
  ))
  const routeMetrics = buildRouteMetricData(
    topology,
    geometry,
    minimumPassageWidthMeters,
    navigation,
  )
  const artifact: ValidatedNavigationArtifact = Object.freeze({
    [validatedNavigationBrand]: true as const,
    candidateId: geometry.levelId,
    minimumPassageWidthMeters,
    regions: Object.freeze(topology.nodes.map((node) => node.id)),
    connections,
    portals,
    entranceRegionId: navigation.entranceTopologyRegionId!,
    exitRegionId: navigation.exitTopologyRegionId!,
    nodeMappings,
    boundaryEvidence,
    routeMetricStatus: routeMetrics.status,
    routeLocations: Object.freeze(routeMetrics.locations.map((location) =>
      Object.freeze({
        ...location,
        position: Object.freeze({ ...location.position }),
      }),
    )),
    routeTravel: Object.freeze(routeMetrics.travel.map((route) => Object.freeze(route))),
    routePassages: Object.freeze(routeMetrics.passages.map((passage) => Object.freeze(passage))),
  })
  validatedNavigationArtifacts.add(artifact)
  return artifact
}

export function isValidatedNavigationArtifact(
  value: unknown,
): value is ValidatedNavigationArtifact {
  return (
    typeof value === 'object'
    && value !== null
    && validatedNavigationArtifacts.has(value)
  )
}
