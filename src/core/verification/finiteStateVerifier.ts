import type { ProgressionMode } from '../domain/types'
import type { DoorPortal } from '../geometry/models'
import { GEOMETRY_EPSILON_METERS } from '../geometry/precision'
import { evaluateDoorAccess } from './doorAccess'
import {
  ProgressionController,
  type ProgressionObjective,
  type ProgressionState,
} from './progressionState'
import {
  isValidatedNavigationArtifact,
  type ValidatedNavigationArtifact,
} from '../navigation/physicalNavigation'

export interface ObjectivePlacement extends ProgressionObjective {
  regionId: string
}

export interface VerificationConnection {
  id: string
  fromRegionId: string
  toRegionId: string
  portal?: DoorPortal
}

interface VerificationGraph {
  minimumPassageWidthMeters: number
  progressionMode: ProgressionMode
  regions: readonly string[]
  connections: readonly VerificationConnection[]
  objectives: readonly ObjectivePlacement[]
  entranceRegionId: string | null
  exitRegionId: string | null
  exitDependencies: readonly string[]
}

export interface ProgressionVerificationConfig {
  progressionMode: ProgressionMode
  objectives: readonly ObjectivePlacement[]
  exitDependencies: readonly string[]
}

export interface VerificationOptions {
  maximumStates?: number
  isCancelled?: () => boolean
}

export type SolvabilityResult =
  | {
    status: 'solvable'
    regionPath: string[]
    completedObjectiveIds: string[]
    exploredStates: number
  }
  | { status: 'unsolvable'; exploredStates: number }
  | { status: 'invalid-geometry'; reason: string; exploredStates: 0 }
  | {
    status: 'verification-incomplete'
    reason: 'cancelled' | 'resource-limit'
    exploredStates: number
  }

export const DEFAULT_MAX_VERIFICATION_STATES = 250_000
export { FINITE_STATE_VERIFIER_ALGORITHM_VERSION } from '../algorithmVersions'

interface SearchNode {
  key: string
  regionId: string
  state: ProgressionState
  previousKey: string | null
}

function invalidGeometry(reason: string): SolvabilityResult {
  return { status: 'invalid-geometry', reason, exploredStates: 0 }
}

function validateGraph(graph: VerificationGraph): string | null {
  if (
    !Number.isFinite(graph.minimumPassageWidthMeters)
    || graph.minimumPassageWidthMeters <= 0
  ) {
    return 'Minimum passage width must be a positive finite value.'
  }
  const regionIds = new Set(graph.regions)
  if (regionIds.size !== graph.regions.length || regionIds.size === 0) {
    return 'Navigation regions must have unique identifiers.'
  }
  if (
    !graph.entranceRegionId
    || !graph.exitRegionId
    || !regionIds.has(graph.entranceRegionId)
    || !regionIds.has(graph.exitRegionId)
  ) {
    return 'Entrance and exit must each reference a validated navigation region.'
  }

  const objectiveIds = new Set(graph.objectives.map(({ id }) => id))
  if (objectiveIds.size !== graph.objectives.length) {
    return 'Progression objective IDs must be unique.'
  }
  for (const objective of graph.objectives) {
    if (!regionIds.has(objective.regionId)) {
      return `Objective ${objective.id} references an unknown navigation region.`
    }
    if (objective.dependencies.some((id) => !objectiveIds.has(id) || id === objective.id)) {
      return `Objective ${objective.id} has an invalid dependency.`
    }
  }
  if (graph.exitDependencies.some((id) => !objectiveIds.has(id))) {
    return 'Exit dependencies must reference configured objectives.'
  }

  const connectionIds = new Set<string>()
  for (const connection of graph.connections) {
    if (
      connectionIds.has(connection.id)
      || !regionIds.has(connection.fromRegionId)
      || !regionIds.has(connection.toRegionId)
      || connection.fromRegionId === connection.toRegionId
    ) {
      return `Connection ${connection.id} has invalid or duplicate region references.`
    }
    connectionIds.add(connection.id)
    if (connection.portal) {
      const portalRegions = [...connection.portal.connectedRegionIds].sort()
      const connectionRegions = [connection.fromRegionId, connection.toRegionId].sort()
      if (
        portalRegions[0] !== connectionRegions[0]
        || portalRegions[1] !== connectionRegions[1]
      ) {
        return `Portal ${connection.portal.id} does not match its navigation connection.`
      }
      if (
        !Number.isFinite(connection.portal.widthMeters)
        || connection.portal.widthMeters + GEOMETRY_EPSILON_METERS
          < graph.minimumPassageWidthMeters
      ) {
        return `Portal ${connection.portal.id} does not meet minimum physical clearance.`
      }
      if (
        connection.portal.type === 'subgoal-dependent'
        && connection.portal.dependencies.some((id) => !objectiveIds.has(id))
      ) {
        return `Portal ${connection.portal.id} has an invalid objective dependency.`
      }
    }
  }
  return null
}

function completionKey(objectives: readonly ObjectivePlacement[], state: ProgressionState): string {
  return objectives.map(({ id }) => state.completionFlags[id] ? '1' : '0').join('')
}

function collectObjectives(
  controller: ProgressionController,
  objectivesById: ReadonlyMap<string, ObjectivePlacement>,
  state: ProgressionState,
  regionId: string,
): ProgressionState {
  let current = state
  let available = controller.availableObjectiveIds(current)
  let objectiveId = available.find((id) => objectivesById.get(id)?.regionId === regionId)
  while (objectiveId) {
    current = controller.completeObjective(current, objectiveId)
    available = controller.availableObjectiveIds(current)
    objectiveId = available.find((id) => objectivesById.get(id)?.regionId === regionId)
  }
  return current
}

function regionPath(nodes: ReadonlyMap<string, SearchNode>, key: string): string[] {
  const path: string[] = []
  let current: SearchNode | undefined = nodes.get(key)
  while (current) {
    path.push(current.regionId)
    current = current.previousKey ? nodes.get(current.previousKey) : undefined
  }
  return path.reverse()
}

export function verifySolvability(
  navigation: ValidatedNavigationArtifact,
  progression: ProgressionVerificationConfig,
  options: VerificationOptions = {},
): SolvabilityResult {
  if (!isValidatedNavigationArtifact(navigation)) {
    return invalidGeometry('Physical navigation was not validated from candidate geometry.')
  }
  const portalsById = new Map(navigation.portals.map((portal) => [portal.id, portal]))
  const connections: VerificationConnection[] = []
  for (const connection of navigation.connections) {
    if (connection.portalId && !portalsById.has(connection.portalId)) {
      return invalidGeometry(`Physical connection ${connection.id} has no validated portal.`)
    }
    const portal = connection.portalId ? portalsById.get(connection.portalId) : undefined
    connections.push({
      id: connection.id,
      fromRegionId: connection.fromRegionId,
      toRegionId: connection.toRegionId,
      ...(portal
        ? {
            portal: {
              id: portal.id,
              kind: portal.kind,
              type: portal.type,
              position: { x: portal.position.x, y: portal.position.y },
              widthMeters: portal.widthMeters,
              connectedRegionIds: [portal.connectedRegionIds[0], portal.connectedRegionIds[1]],
              dependencies: [...portal.dependencies],
            },
          }
        : {}),
    })
  }
  const graph: VerificationGraph = {
    minimumPassageWidthMeters: navigation.minimumPassageWidthMeters,
    progressionMode: progression.progressionMode,
    regions: navigation.regions,
    connections,
    objectives: progression.objectives,
    entranceRegionId: navigation.entranceRegionId,
    exitRegionId: navigation.exitRegionId,
    exitDependencies: progression.exitDependencies,
  }
  return verifyValidatedGraph(graph, options)
}

function verifyValidatedGraph(
  graph: VerificationGraph,
  options: VerificationOptions = {},
): SolvabilityResult {
  const invalidReason = validateGraph(graph)
  if (invalidReason) return invalidGeometry(invalidReason)

  const maximumStates = options.maximumStates ?? DEFAULT_MAX_VERIFICATION_STATES
  if (!Number.isSafeInteger(maximumStates) || maximumStates < 1) {
    throw new RangeError('Maximum verification state count must be a positive integer.')
  }

  const controller = new ProgressionController(graph.progressionMode, graph.objectives)
  const objectivesById = new Map(graph.objectives.map((objective) => [objective.id, objective]))
  const adjacency = new Map<string, VerificationConnection[]>()
  for (const regionId of graph.regions) adjacency.set(regionId, [])
  for (const connection of graph.connections) {
    adjacency.get(connection.fromRegionId)?.push(connection)
    adjacency.get(connection.toRegionId)?.push(connection)
  }

  const initialState = collectObjectives(
    controller,
    objectivesById,
    controller.createInitialState(),
    graph.entranceRegionId!,
  )
  const initialKey = `${graph.entranceRegionId}|${completionKey(graph.objectives, initialState)}`
  const initialNode: SearchNode = {
    key: initialKey,
    regionId: graph.entranceRegionId!,
    state: initialState,
    previousKey: null,
  }
  const nodes = new Map([[initialKey, initialNode]])
  const queue = [initialNode]
  let queueIndex = 0
  let exploredStates = 0

  while (queueIndex < queue.length) {
    if (options.isCancelled?.()) {
      return { status: 'verification-incomplete', reason: 'cancelled', exploredStates }
    }
    const node = queue[queueIndex]
    queueIndex += 1
    exploredStates += 1
    const completedObjectiveIds = Object.keys(node.state.completionFlags)
      .filter((id) => node.state.completionFlags[id])
    if (
      node.regionId === graph.exitRegionId
      && controller.requiredObjectivesComplete(node.state)
      && graph.exitDependencies.every((id) => node.state.completionFlags[id])
    ) {
      return {
        status: 'solvable',
        regionPath: regionPath(nodes, node.key),
        completedObjectiveIds,
        exploredStates,
      }
    }

    for (const connection of adjacency.get(node.regionId) ?? []) {
      const neighborRegionId = connection.fromRegionId === node.regionId
        ? connection.toRegionId
        : connection.fromRegionId
      const completedSet = new Set(completedObjectiveIds)
      if (
        connection.portal
        && !evaluateDoorAccess(
          connection.portal,
          completedSet,
          graph.minimumPassageWidthMeters,
        ).traversable
      ) {
        continue
      }
      const nextState = collectObjectives(
        controller,
        objectivesById,
        node.state,
        neighborRegionId,
      )
      const key = `${neighborRegionId}|${completionKey(graph.objectives, nextState)}`
      if (nodes.has(key)) continue
      if (nodes.size >= maximumStates) {
        return { status: 'verification-incomplete', reason: 'resource-limit', exploredStates }
      }
      const nextNode: SearchNode = {
        key,
        regionId: neighborRegionId,
        state: nextState,
        previousKey: node.key,
      }
      nodes.set(key, nextNode)
      queue.push(nextNode)
    }
  }

  return { status: 'unsolvable', exploredStates }
}
