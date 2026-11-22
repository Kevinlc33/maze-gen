import type { WallPlacementPreference } from '../domain/types'
import type { MazeGeometry, Wall } from '../geometry/models'
import {
  validatePhysicalCandidate,
  type ValidatedNavigationArtifact,
} from '../navigation/physicalNavigation'
import type { IntendedTopology, TopologyEdge } from '../topology/generator'
import {
  verifySolvability,
  type ProgressionVerificationConfig,
  type SolvabilityResult,
  type VerificationOptions,
} from './finiteStateVerifier'
import {
  analyzeProgressionRoutes,
  type RouteAnalysisResult,
} from './progressionRouteAnalysis'

interface WallToggleRequestBase {
  designatedWallId: string
  affectedConnectionId: string
  placementPreference: WallPlacementPreference
  minimumPassageWidthMeters: number
  geometry: MazeGeometry
  topologyWithWall: IntendedTopology
  topologyWithoutWall: IntendedTopology
  progression: ProgressionVerificationConfig
}

export type WallToggleRequest = WallToggleRequestBase & (
  | {
      mode: 'single-wall-addition'
      wallToAdd: Wall
    }
  | {
      mode: 'single-wall-removal'
    }
)

export interface WallToggleResult {
  valid: boolean
  reason: string | null
  progressionTiming: RouteAnalysisResult | null
  withWallResult: SolvabilityResult
  withoutWallResult: SolvabilityResult
}

function cloneWall(wall: Wall): Wall {
  return wall.kind === 'straight'
    ? {
        ...wall,
        start: { ...wall.start },
        end: { ...wall.end },
      }
    : {
        ...wall,
        center: { ...wall.center },
      }
}

function cloneGeometry(geometry: MazeGeometry): MazeGeometry {
  return {
    ...geometry,
    walls: geometry.walls.map(cloneWall),
    chambers: geometry.chambers.map((chamber) => ({
      ...chamber,
      points: chamber.points.map((point) => ({ ...point })),
    })),
    portals: geometry.portals.map((portal) => ({
      ...portal,
      position: { ...portal.position },
      connectedRegionIds: [portal.connectedRegionIds[0], portal.connectedRegionIds[1]],
      dependencies: [...portal.dependencies],
    })),
    entrance: { ...geometry.entrance, position: { ...geometry.entrance.position } },
    exit: { ...geometry.exit, position: { ...geometry.exit.position } },
  }
}

function deriveGeometrySnapshots(
  request: WallToggleRequest,
): { wallPresent: MazeGeometry; wallAbsent: MazeGeometry } | { error: string } {
  if (request.mode === 'single-wall-addition') {
    if (request.wallToAdd.id !== request.designatedWallId) {
      return { error: 'The added wall ID must match the designated wall ID.' }
    }
    if (request.geometry.walls.some((wall) => wall.id === request.designatedWallId)) {
      return { error: 'The wall-absent geometry already contains the designated wall.' }
    }
    const wallAbsent = cloneGeometry(request.geometry)
    const wallPresent = cloneGeometry(request.geometry)
    wallPresent.walls.push(cloneWall(request.wallToAdd))
    return { wallPresent, wallAbsent }
  }

  const designatedWalls = request.geometry.walls.filter(
    (wall) => wall.id === request.designatedWallId,
  )
  if (designatedWalls.length !== 1) {
    return { error: 'Wall-present geometry must contain exactly one designated wall.' }
  }
  const wallPresent = cloneGeometry(request.geometry)
  const wallAbsent = cloneGeometry(request.geometry)
  wallAbsent.walls = wallAbsent.walls.filter((wall) => wall.id !== request.designatedWallId)
  return { wallPresent, wallAbsent }
}

function canonicalEdge(from: string, to: string): string {
  return [from, to].sort().join('|')
}

function topologyGridSignature(topology: IntendedTopology): string {
  return JSON.stringify({
    mode: topology.mode,
    seed: topology.seed,
    nodes: [...topology.nodes].sort((a, b) => a.id.localeCompare(b.id)),
  })
}

function topologyEdgeMap(topology: IntendedTopology): Map<string, TopologyEdge> {
  return new Map(topology.edges.map((edge) => [canonicalEdge(edge.from, edge.to), edge]))
}

function exactlyOneTopologyEdgeOpens(
  topologyWithWall: IntendedTopology,
  topologyWithoutWall: IntendedTopology,
): TopologyEdge | null {
  if (topologyGridSignature(topologyWithWall) !== topologyGridSignature(topologyWithoutWall)) {
    return null
  }
  const withWallEdges = topologyEdgeMap(topologyWithWall)
  const withoutWallEdges = topologyEdgeMap(topologyWithoutWall)
  const removedWithWall = [...withoutWallEdges.entries()]
    .filter(([key, edge]) => {
      const withWallEdge = withWallEdges.get(key)
      return !withWallEdge || JSON.stringify(withWallEdge) !== JSON.stringify(edge)
    })
  const newlyPresentWithWall = [...withWallEdges.keys()]
    .filter((key) => !withoutWallEdges.has(key))
  if (removedWithWall.length !== 1 || newlyPresentWithWall.length !== 0) return null
  return removedWithWall[0][1]
}

function connectionSignature(
  connection: ValidatedNavigationArtifact['connections'][number],
): string {
  return JSON.stringify({
    fromTo: [connection.fromRegionId, connection.toRegionId].sort(),
    witness: connection.witness,
    portalId: connection.portalId ?? null,
  })
}

function sameNavigationConfiguration(
  left: ValidatedNavigationArtifact,
  right: ValidatedNavigationArtifact,
): boolean {
  const mappingSignature = (navigation: ValidatedNavigationArtifact) =>
    navigation.nodeMappings.map(({ nodeId, anchor }) => ({ nodeId, anchor }))
  return (
    left.candidateId === right.candidateId
    && left.minimumPassageWidthMeters === right.minimumPassageWidthMeters
    && [...left.regions].sort().join('|') === [...right.regions].sort().join('|')
    && left.entranceRegionId === right.entranceRegionId
    && left.exitRegionId === right.exitRegionId
    && JSON.stringify(mappingSignature(left)) === JSON.stringify(mappingSignature(right))
  )
}

function rejected(reason: string): WallToggleResult {
  const invalid: SolvabilityResult = {
    status: 'invalid-geometry',
    reason,
    exploredStates: 0,
  }
  return {
    valid: false,
    reason,
    progressionTiming: null,
    withWallResult: invalid,
    withoutWallResult: invalid,
  }
}

export function verifySingleWallToggle(
  request: WallToggleRequest,
  options: VerificationOptions = {},
): WallToggleResult {
  if (!request.designatedWallId.trim()) {
    return rejected('A stable designated wall ID is required.')
  }
  const snapshots = deriveGeometrySnapshots(request)
  if ('error' in snapshots) return rejected(snapshots.error)
  if (!exactlyOneTopologyEdgeOpens(request.topologyWithWall, request.topologyWithoutWall)) {
    return rejected('The wall states must differ by exactly one intended passage.')
  }

  const withWallValidation = validatePhysicalCandidate(
    request.topologyWithWall,
    snapshots.wallPresent,
    request.minimumPassageWidthMeters,
  )
  const withoutWallValidation = validatePhysicalCandidate(
    request.topologyWithoutWall,
    snapshots.wallAbsent,
    request.minimumPassageWidthMeters,
  )
  const withWallNavigation = withWallValidation.validatedNavigation
  const withoutWallNavigation = withoutWallValidation.validatedNavigation
  if (!withWallNavigation || !withoutWallNavigation) {
    const failure = withWallValidation.status !== 'valid'
      ? withWallValidation.navigation.issues[0]?.message
        ?? withWallValidation.connectivityMismatches[0]?.message
      : withoutWallValidation.navigation.issues[0]?.message
        ?? withoutWallValidation.connectivityMismatches[0]?.message
    return rejected(
      failure
        ? `A physical wall-toggle state is invalid or incomplete: ${failure}`
        : 'A physical wall-toggle state is invalid or incomplete.',
    )
  }
  if (!sameNavigationConfiguration(withWallNavigation, withoutWallNavigation)) {
    return rejected('The wall-present and wall-removed states must share all other configuration.')
  }
  const withWallConnections = new Map(
    withWallNavigation.connections.map((connection) => [connection.id, connection]),
  )
  const withoutWallConnections = new Map(
    withoutWallNavigation.connections.map((connection) => [connection.id, connection]),
  )
  const allConnectionIds = new Set([
    ...withWallConnections.keys(),
    ...withoutWallConnections.keys(),
  ])
  const changedConnectionIds = [...allConnectionIds].filter((id) => {
    const withWall = withWallConnections.get(id)
    const withoutWall = withoutWallConnections.get(id)
    return !withWall || !withoutWall || connectionSignature(withWall) !== connectionSignature(withoutWall)
  })
  const openedConnection = withoutWallConnections.get(request.affectedConnectionId)
  const blockedConnection = withWallConnections.get(request.affectedConnectionId)
  if (
    changedConnectionIds.length !== 1
    || changedConnectionIds[0] !== request.affectedConnectionId
    || !openedConnection
    || blockedConnection
  ) {
    return rejected('The designated wall must change exactly one physical connection.')
  }
  const withWallResult = verifySolvability(
    withWallNavigation,
    request.progression,
    options,
  )
  const withoutWallResult = verifySolvability(
    withoutWallNavigation,
    request.progression,
    options,
  )
  if (
    withWallResult.status === 'verification-incomplete'
    || withoutWallResult.status === 'verification-incomplete'
  ) {
    return {
      valid: false,
      reason: 'Wall toggle verification did not complete conclusively.',
      progressionTiming: null,
      withWallResult,
      withoutWallResult,
    }
  }

  const initialResult = request.mode === 'single-wall-addition'
    ? withoutWallResult
    : withWallResult
  const toggledResult = request.mode === 'single-wall-addition'
    ? withWallResult
    : withoutWallResult
  const expectedInitialStatus = request.mode === 'single-wall-addition' ? 'solvable' : 'unsolvable'
  const expectedToggledStatus = request.mode === 'single-wall-addition' ? 'unsolvable' : 'solvable'
  const toggleValid = initialResult.status === expectedInitialStatus
    && toggledResult.status === expectedToggledStatus
  if (!toggleValid) {
    return {
      valid: false,
      reason: 'The designated wall does not produce the configured solvability toggle.',
      progressionTiming: null,
      withWallResult,
      withoutWallResult,
    }
  }
  const progressionTiming = analyzeProgressionRoutes(
    withoutWallNavigation,
    request.progression,
    {
      kind: 'wall-passage',
      connectionId: request.affectedConnectionId,
    },
    {
      maximumAnalysisStates: options.maximumStates,
      isCancelled: options.isCancelled,
    },
  )
  if (progressionTiming.status !== 'complete') {
    return {
      valid: false,
      reason: `Wall-toggle progression analysis is ${progressionTiming.status}.`,
      progressionTiming,
      withWallResult,
      withoutWallResult,
    }
  }
  const preferenceMatches = request.placementPreference === 'automatic'
    || progressionTiming.classification === request.placementPreference
  const valid = progressionTiming.classification !== 'not-encountered'
    && preferenceMatches
  return {
    valid,
    reason: valid
      ? null
      : progressionTiming.classification === 'not-encountered'
        ? 'No shortest legal completion route traverses the designated wall passage.'
        : 'The designated wall does not match its requested progression preference.',
    progressionTiming,
    withWallResult,
    withoutWallResult,
  }
}
