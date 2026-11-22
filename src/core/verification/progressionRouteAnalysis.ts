import { GEOMETRY_EPSILON_METERS } from '../geometry/precision'
import { evaluateDoorAccess } from './doorAccess'
import {
  DEFAULT_MAX_VERIFICATION_STATES,
  verifySolvability,
  type ProgressionVerificationConfig,
} from './finiteStateVerifier'
import {
  isValidatedNavigationArtifact,
  type ValidatedNavigationArtifact,
} from '../navigation/physicalNavigation'
import { ProgressionController } from './progressionState'
import { progressionBandAt, type ProgressionBand } from './progressionTiming'

export interface RouteGraphEncounter {
  targetId: string
  offsetMeters: number
}

export interface RouteGraphTransition {
  fromStateId: string
  toStateId: string
  distanceMeters: number
  encounters?: readonly RouteGraphEncounter[]
}

export interface RouteCompletionState {
  stateId: string
  objectiveOrder: readonly string[]
}

export interface ShortestRouteEvidenceGraph {
  startStateId: string
  completionStates: readonly RouteCompletionState[]
  transitions: readonly RouteGraphTransition[]
}

export interface RouteAnalysisOptions {
  maximumAnalysisStates?: number
  isCancelled?: () => boolean
}

export type RouteAnalysisClassification =
  | ProgressionBand
  | 'variable'
  | 'not-encountered'

export interface RouteOrderAnalysis {
  objectiveOrder: readonly string[]
  shortestDistanceMeters: number
  earliestEncounterPosition: number | null
  latestEncounterPosition: number | null
  encounterOnSomeShortestRoute: boolean
  encounterOnEveryShortestRoute: boolean
  classification: RouteAnalysisClassification
}

export type RouteAnalysisResult =
  | {
      status: 'complete'
      classification: RouteAnalysisClassification
      legalOrderResults: readonly RouteOrderAnalysis[]
    }
  | {
      status: 'incomplete'
      reason: 'cancelled' | 'resource-limit' | 'route-metrics-incomplete' | 'analysis-incomplete'
    }
  | { status: 'invalid'; reason: string }

interface Budget {
  maximum: number
  used: number
  options: RouteAnalysisOptions
  stopReason?: 'cancelled' | 'resource-limit'
}

interface HeapEntry {
  stateId: string
  distance: number
}

class MinHeap {
  private readonly values: HeapEntry[] = []

  get size(): number {
    return this.values.length
  }

  push(value: HeapEntry): void {
    this.values.push(value)
    let index = this.values.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.values[parent].distance <= value.distance) break
      this.values[index] = this.values[parent]
      index = parent
    }
    this.values[index] = value
  }

  pop(): HeapEntry | undefined {
    const first = this.values[0]
    const last = this.values.pop()
    if (!first || !last || this.values.length === 0) return first
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.values.length) break
      const child = right < this.values.length
        && this.values[right].distance < this.values[left].distance
        ? right
        : left
      if (this.values[child].distance >= last.distance) break
      this.values[index] = this.values[child]
      index = child
    }
    this.values[index] = last
    return first
  }
}

function incompleteReason(budget: Budget): 'cancelled' | 'resource-limit' | null {
  if (budget.options.isCancelled?.()) {
    budget.stopReason = 'cancelled'
    return 'cancelled'
  }
  if (budget.used >= budget.maximum) {
    budget.stopReason = 'resource-limit'
    return 'resource-limit'
  }
  budget.used += 1
  return null
}

function dijkstra(
  starts: readonly string[],
  adjacency: ReadonlyMap<string, readonly RouteGraphTransition[]>,
  budget: Budget,
): Map<string, number> | null {
  const distances = new Map<string, number>()
  const pending = new MinHeap()
  for (const stateId of starts) {
    distances.set(stateId, 0)
    pending.push({ stateId, distance: 0 })
  }
  while (pending.size > 0) {
    const reason = incompleteReason(budget)
    if (reason) return null
    const current = pending.pop()
    if (!current || current.distance !== distances.get(current.stateId)) continue
    for (const transition of adjacency.get(current.stateId) ?? []) {
      const distance = current.distance + transition.distanceMeters
      if (distance < (distances.get(transition.toStateId) ?? Infinity)) {
        distances.set(transition.toStateId, distance)
        pending.push({ stateId: transition.toStateId, distance })
      }
    }
  }
  return distances
}

function buildAdjacency(
  stateIds: readonly string[],
  transitions: readonly RouteGraphTransition[],
  reverse = false,
): Map<string, RouteGraphTransition[]> {
  const adjacency = new Map(stateIds.map((stateId) => [stateId, [] as RouteGraphTransition[]]))
  for (const transition of transitions) {
    const fromStateId = reverse ? transition.toStateId : transition.fromStateId
    const toStateId = reverse ? transition.fromStateId : transition.toStateId
    adjacency.get(fromStateId)?.push({
      ...transition,
      fromStateId,
      toStateId,
      ...(reverse && transition.encounters
        ? {
            encounters: transition.encounters.map((encounter) => ({
              ...encounter,
              offsetMeters: transition.distanceMeters - encounter.offsetMeters,
            })),
          }
        : {}),
    })
  }
  return adjacency
}

function canonicalOrder(order: readonly string[]): string {
  return JSON.stringify(order)
}

function closeDistance(left: number, right: number): boolean {
  return Math.abs(left - right) <= GEOMETRY_EPSILON_METERS
}

function shortestRouteTransitions(
  transitions: readonly RouteGraphTransition[],
  fromDistances: ReadonlyMap<string, number>,
  toDistances: ReadonlyMap<string, number>,
  shortestDistance: number,
): RouteGraphTransition[] {
  return transitions.filter((transition) => {
    const fromDistance = fromDistances.get(transition.fromStateId)
    const toDistance = toDistances.get(transition.toStateId)
    return fromDistance !== undefined
      && toDistance !== undefined
      && closeDistance(
        fromDistance + transition.distanceMeters + toDistance,
        shortestDistance,
      )
  })
}

function condenseZeroCostReachability(
  stateIds: readonly string[],
  transitions: readonly RouteGraphTransition[],
  startStateId: string,
  budget: Budget,
): {
  reachable: Set<string>
  minimumDistanceByState: Map<string, number>
  terminalReachable: (terminalStateIds: readonly string[]) => boolean
} | null {
  const zeroForward = new Map(stateIds.map((stateId) => [stateId, [] as string[]]))
  const zeroReverse = new Map(stateIds.map((stateId) => [stateId, [] as string[]]))
  for (const transition of transitions) {
    if (transition.distanceMeters !== 0) continue
    zeroForward.get(transition.fromStateId)?.push(transition.toStateId)
    zeroReverse.get(transition.toStateId)?.push(transition.fromStateId)
  }

  const visited = new Set<string>()
  const order: string[] = []
  for (const root of stateIds) {
    if (visited.has(root)) continue
    const stack: Array<{ stateId: string; nextIndex: number }> = [{ stateId: root, nextIndex: 0 }]
    visited.add(root)
    while (stack.length > 0) {
      const reason = incompleteReason(budget)
      if (reason) return null
      const current = stack[stack.length - 1]
      const neighbors = zeroForward.get(current.stateId) ?? []
      if (current.nextIndex < neighbors.length) {
        const neighbor = neighbors[current.nextIndex]
        current.nextIndex += 1
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          stack.push({ stateId: neighbor, nextIndex: 0 })
        }
      } else {
        order.push(current.stateId)
        stack.pop()
      }
    }
  }

  const componentByState = new Map<string, number>()
  let componentCount = 0
  for (const root of order.reverse()) {
    if (componentByState.has(root)) continue
    const pending = [root]
    componentByState.set(root, componentCount)
    while (pending.length > 0) {
      const reason = incompleteReason(budget)
      if (reason) return null
      const current = pending.pop()!
      for (const neighbor of zeroReverse.get(current) ?? []) {
        if (componentByState.has(neighbor)) continue
        componentByState.set(neighbor, componentCount)
        pending.push(neighbor)
      }
    }
    componentCount += 1
  }

  const componentAdjacency = Array.from(
    { length: componentCount },
    () => [] as Array<{ component: number; distance: number }>,
  )
  const componentIndegree = Array.from({ length: componentCount }, () => 0)
  for (const transition of transitions) {
    const fromComponent = componentByState.get(transition.fromStateId)
    const toComponent = componentByState.get(transition.toStateId)
    if (fromComponent === undefined || toComponent === undefined) continue
    if (fromComponent === toComponent) {
      if (transition.distanceMeters > 0) return null
      continue
    }
    componentAdjacency[fromComponent].push({
      component: toComponent,
      distance: transition.distanceMeters,
    })
    componentIndegree[toComponent] += 1
  }
  const startComponent = componentByState.get(startStateId)
  if (startComponent === undefined) return null
  const minimumDistance = Array.from({ length: componentCount }, () => Infinity)
  minimumDistance[startComponent] = 0
  const pending = componentIndegree
    .map((degree, component) => degree === 0 ? component : -1)
    .filter((component) => component >= 0)
  let processedComponents = 0
  while (pending.length > 0) {
    const reason = incompleteReason(budget)
    if (reason) return null
    const component = pending.pop()!
    processedComponents += 1
    for (const edge of componentAdjacency[component]) {
      if (Number.isFinite(minimumDistance[component])) {
        minimumDistance[edge.component] = Math.min(
          minimumDistance[edge.component],
          minimumDistance[component] + edge.distance,
        )
      }
      componentIndegree[edge.component] -= 1
      if (componentIndegree[edge.component] === 0) pending.push(edge.component)
    }
  }
  if (processedComponents !== componentCount) return null
  const minimumDistanceByState = new Map(
    [...componentByState.entries()].map(([stateId, component]) =>
      [stateId, minimumDistance[component]] as const,
    ),
  )
  const reachable = new Set(
    [...minimumDistanceByState.entries()]
      .filter(([, distance]) => Number.isFinite(distance))
      .map(([stateId]) => stateId),
  )
  return {
    reachable,
    minimumDistanceByState,
    terminalReachable: (terminalStateIds) =>
      terminalStateIds.some((stateId) => reachable.has(stateId)),
  }
}

function classifyOrder(
  objectiveOrder: readonly string[],
  shortestDistance: number,
  shortestTransitions: readonly RouteGraphTransition[],
  fromStart: ReadonlyMap<string, number>,
  stateIds: readonly string[],
  startStateId: string,
  terminalStateIds: readonly string[],
  targetId: string,
  budget: Budget,
): RouteOrderAnalysis | null {
  const noEncounterTransitions = shortestTransitions.filter((transition) =>
    !transition.encounters?.some((encounter) => encounter.targetId === targetId),
  )
  const condensed = condenseZeroCostReachability(
    stateIds,
    noEncounterTransitions,
    startStateId,
    budget,
  )
  if (!condensed) return null
  const encounterOnEveryShortestRoute = !condensed.terminalReachable(terminalStateIds)

  const encounterPositions: number[] = []
  for (const transition of shortestTransitions) {
    const events = transition.encounters?.filter((encounter) => encounter.targetId === targetId)
    if (!events?.length || !condensed.reachable.has(transition.fromStateId)) continue
    const noEncounterDistance = condensed.minimumDistanceByState.get(transition.fromStateId)
    if (
      noEncounterDistance === undefined
      || !closeDistance(noEncounterDistance, fromStart.get(transition.fromStateId) ?? Infinity)
    ) {
      continue
    }
    const firstEvent = events.reduce((first, event) =>
      event.offsetMeters < first.offsetMeters ? event : first,
    )
    const position = (noEncounterDistance + firstEvent.offsetMeters) / shortestDistance
    encounterPositions.push(Math.max(0, Math.min(1, position)))
  }
  const encounterOnSomeShortestRoute = encounterPositions.length > 0
  const classification: RouteAnalysisClassification = !encounterOnSomeShortestRoute
    ? 'not-encountered'
    : !encounterOnEveryShortestRoute
      ? 'variable'
      : (() => {
          const bands = new Set(encounterPositions.map(progressionBandAt))
          return bands.size === 1 ? [...bands][0] : 'variable'
        })()
  return {
    objectiveOrder: [...objectiveOrder],
    shortestDistanceMeters: shortestDistance,
    earliestEncounterPosition: encounterOnSomeShortestRoute
      ? encounterPositions.reduce((minimum, position) => Math.min(minimum, position), Infinity)
      : null,
    latestEncounterPosition: encounterOnSomeShortestRoute
      ? encounterPositions.reduce((maximum, position) => Math.max(maximum, position), -Infinity)
      : null,
    encounterOnSomeShortestRoute,
    encounterOnEveryShortestRoute,
    classification,
  }
}

export function analyzeShortestRouteEvidence(
  graph: ShortestRouteEvidenceGraph,
  targetId: string,
  options: RouteAnalysisOptions = {},
): RouteAnalysisResult {
  const maximum = options.maximumAnalysisStates ?? DEFAULT_MAX_VERIFICATION_STATES
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new RangeError('Maximum route-analysis state count must be a positive integer.')
  }
  const stateIds = new Set([graph.startStateId])
  for (const transition of graph.transitions) {
    stateIds.add(transition.fromStateId)
    stateIds.add(transition.toStateId)
    if (
      !Number.isFinite(transition.distanceMeters)
      || transition.distanceMeters < 0
      || transition.encounters?.some((encounter) =>
        !Number.isFinite(encounter.offsetMeters)
        || encounter.offsetMeters < 0
        || encounter.offsetMeters > transition.distanceMeters + GEOMETRY_EPSILON_METERS,
      )
    ) {
      return { status: 'invalid', reason: 'invalid-route-transition' }
    }
  }
  for (const completion of graph.completionStates) stateIds.add(completion.stateId)
  const orderedStateIds = [...stateIds]
  if (!stateIds.has(graph.startStateId)) {
    return { status: 'invalid', reason: 'missing-start-state' }
  }
  if (
    orderedStateIds.length > maximum
    || graph.transitions.length > maximum
    || graph.completionStates.length === 0
  ) {
    return orderedStateIds.length > maximum
      || graph.transitions.length > maximum
      ? { status: 'incomplete', reason: 'resource-limit' }
      : { status: 'invalid', reason: 'no-completion-route' }
  }
  const completionGroups = new Map<string, RouteCompletionState[]>()
  for (const completion of graph.completionStates) {
    const key = canonicalOrder(completion.objectiveOrder)
    const group = completionGroups.get(key) ?? []
    group.push(completion)
    completionGroups.set(key, group)
  }
  if (orderedStateIds.length * completionGroups.size > maximum) {
    return { status: 'incomplete', reason: 'resource-limit' }
  }
  const budget: Budget = { maximum, used: 0, options }
  const allAdjacency = buildAdjacency(orderedStateIds, graph.transitions)
  const fromStart = dijkstra([graph.startStateId], allAdjacency, budget)
  if (!fromStart) {
    return {
      status: 'incomplete',
      reason: options.isCancelled?.() ? 'cancelled' : 'resource-limit',
    }
  }
  const results: RouteOrderAnalysis[] = []
  for (const [, completions] of [...completionGroups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const terminalStateIds = completions
      .map(({ stateId }) => stateId)
      .filter((stateId) => fromStart.has(stateId))
    if (terminalStateIds.length === 0) continue
    const reverseAdjacency = buildAdjacency(orderedStateIds, graph.transitions, true)
    const toCompletion = dijkstra(terminalStateIds, reverseAdjacency, budget)
    if (!toCompletion) {
      return {
        status: 'incomplete',
        reason: options.isCancelled?.() ? 'cancelled' : 'resource-limit',
      }
    }
    const shortestDistance = terminalStateIds.reduce((minimum, stateId) =>
      Math.min(minimum, fromStart.get(stateId) ?? Infinity),
    Infinity)
    if (!Number.isFinite(shortestDistance)) continue
    if (shortestDistance <= GEOMETRY_EPSILON_METERS) {
      return { status: 'invalid', reason: 'zero-length-route' }
    }
    const shortestTransitions = shortestRouteTransitions(
      graph.transitions,
      fromStart,
      toCompletion,
      shortestDistance,
    )
    const representativeOrder = completions[0].objectiveOrder
    const result = classifyOrder(
      representativeOrder,
      shortestDistance,
      shortestTransitions,
      fromStart,
      orderedStateIds,
      graph.startStateId,
      terminalStateIds,
      targetId,
      budget,
    )
    if (!result) {
      return {
        status: 'incomplete',
        reason: budget.stopReason ?? 'analysis-incomplete',
      }
    }
    results.push(result)
  }
  if (results.length === 0) return { status: 'invalid', reason: 'no-completion-route' }
  const classifications = new Set(results.map(({ classification }) => classification))
  const classification: RouteAnalysisClassification = classifications.size === 1
    ? results[0].classification
    : 'variable'
  return { status: 'complete', classification, legalOrderResults: results }
}

export type ProgressionRouteTarget =
  | { kind: 'wall-passage'; connectionId: string }
  | { kind: 'required-objectives'; objectiveIds: readonly string[] }

interface SearchRouteState {
  locationId: string
  completionFlags: Readonly<Record<string, boolean>>
  objectiveOrder: readonly string[]
}

function routeStateKey(
  state: SearchRouteState,
  objectiveIds: readonly string[],
): string {
  return JSON.stringify([
    state.locationId,
    objectiveIds.map((id) => state.completionFlags[id] ? 1 : 0),
    state.objectiveOrder,
  ])
}

function portalForDoorCheck(
  portal: ValidatedNavigationArtifact['portals'][number],
): {
  id: string
  kind: 'portal'
  type: typeof portal.type
  position: { x: number; y: number }
  widthMeters: number
  connectedRegionIds: [string, string]
  dependencies: string[]
} {
  return {
    id: portal.id,
    kind: 'portal',
    type: portal.type,
    position: { x: portal.position.x, y: portal.position.y },
    widthMeters: portal.widthMeters,
    connectedRegionIds: [portal.connectedRegionIds[0], portal.connectedRegionIds[1]],
    dependencies: [...portal.dependencies],
  }
}

export function analyzeProgressionRoutes(
  navigation: ValidatedNavigationArtifact,
  progression: ProgressionVerificationConfig,
  target: ProgressionRouteTarget,
  options: RouteAnalysisOptions = {},
): RouteAnalysisResult {
  if (!isValidatedNavigationArtifact(navigation)) {
    return { status: 'invalid', reason: 'unvalidated-navigation' }
  }
  if (navigation.routeMetricStatus !== 'complete') {
    return { status: 'incomplete', reason: 'route-metrics-incomplete' }
  }
  if (target.kind === 'wall-passage'
    && !navigation.routePassages.some(({ connectionId }) => connectionId === target.connectionId)
  ) {
    return { status: 'invalid', reason: 'unvalidated-wall-passage' }
  }
  if (
    target.kind === 'required-objectives'
    && (
      target.objectiveIds.length === 0
      || target.objectiveIds.some((id) =>
        !progression.objectives.some((objective) => objective.id === id && objective.required),
      )
    )
  ) {
    return { status: 'invalid', reason: 'invalid-progression-target' }
  }
  const maximum = options.maximumAnalysisStates ?? DEFAULT_MAX_VERIFICATION_STATES
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new RangeError('Maximum route-analysis state count must be a positive integer.')
  }
  const solvability = verifySolvability(navigation, progression, {
    maximumStates: maximum,
    isCancelled: options.isCancelled,
  })
  if (solvability.status === 'verification-incomplete') {
    return {
      status: 'incomplete',
      reason: solvability.reason === 'cancelled' ? 'cancelled' : 'resource-limit',
    }
  }
  if (solvability.status !== 'solvable') {
    return { status: 'invalid', reason: 'no-verified-completion-route' }
  }

  const controller = new ProgressionController(progression.progressionMode, progression.objectives)
  const orderedObjectiveIds = progression.objectives.map(({ id }) => id)
  const locations = new Map(navigation.routeLocations.map((location) => [location.id, location]))
  const travelByFrom = new Map<string, typeof navigation.routeTravel[number][]>()
  for (const travel of navigation.routeTravel) {
    const entries = travelByFrom.get(travel.fromLocationId) ?? []
    entries.push(travel)
    travelByFrom.set(travel.fromLocationId, entries)
  }
  const passagesByFrom = new Map<string, Array<{
    toLocationId: string
    connectionId: string
    portalId?: string
    distanceMeters: number
    encounterOffsetMeters: number
  }>>()
  for (const passage of navigation.routePassages) {
    const forward = passagesByFrom.get(passage.fromLocationId) ?? []
    forward.push(passage)
    passagesByFrom.set(passage.fromLocationId, forward)
    const reverse = passagesByFrom.get(passage.toLocationId) ?? []
    reverse.push({
      toLocationId: passage.fromLocationId,
      connectionId: passage.connectionId,
      ...(passage.portalId ? { portalId: passage.portalId } : {}),
      distanceMeters: passage.distanceMeters,
      encounterOffsetMeters: passage.distanceMeters - passage.encounterOffsetMeters,
    })
    passagesByFrom.set(passage.toLocationId, reverse)
  }

  const initialState: SearchRouteState = {
    locationId: 'route-entrance',
    completionFlags: controller.createInitialState().completionFlags,
    objectiveOrder: [],
  }
  if (!locations.has(initialState.locationId) || !locations.has('route-exit')) {
    return { status: 'invalid', reason: 'missing-physical-route-endpoint' }
  }
  const states = new Map<string, SearchRouteState>()
  const queue: string[] = []
  const transitions: RouteGraphTransition[] = []
  const completionStates: RouteCompletionState[] = []
  let generatedTransitionCount = 0
  const initialKey = routeStateKey(initialState, orderedObjectiveIds)
  states.set(initialKey, initialState)
  queue.push(initialKey)
  let queueIndex = 0
  const targetId = 'progression-route-target'

  const addState = (
    sourceKey: string,
    nextState: SearchRouteState,
    distanceMeters: number,
    encountered = false,
  ) => {
    if (generatedTransitionCount >= maximum) return false
    const nextKey = routeStateKey(nextState, orderedObjectiveIds)
    generatedTransitionCount += 1
    transitions.push({
      fromStateId: sourceKey,
      toStateId: nextKey,
      distanceMeters,
      ...(encountered
        ? { encounters: [{ targetId, offsetMeters: 0 }] }
        : {}),
    })
    if (states.has(nextKey)) return true
    if (states.size >= maximum) return false
    states.set(nextKey, nextState)
    queue.push(nextKey)
    return true
  }

  while (queueIndex < queue.length) {
    if (options.isCancelled?.()) return { status: 'incomplete', reason: 'cancelled' }
    if (states.size > maximum) return { status: 'incomplete', reason: 'resource-limit' }
    const stateKey = queue[queueIndex]
    queueIndex += 1
    const state = states.get(stateKey)!
    const location = locations.get(state.locationId)!
    const availableObjectives = controller.availableObjectiveIds({
      completionFlags: state.completionFlags,
    }).filter((id) =>
      progression.objectives.find((objective) => objective.id === id)?.regionId
        === location.regionId,
    )
    if (availableObjectives.length > 0) {
      for (const objectiveId of availableObjectives) {
        const nextProgressionState = controller.completeObjective(
          { completionFlags: state.completionFlags },
          objectiveId,
        )
        const objective = progression.objectives.find(({ id }) => id === objectiveId)!
        const nextState: SearchRouteState = {
          ...state,
          completionFlags: nextProgressionState.completionFlags,
          objectiveOrder: objective.required
            ? [...state.objectiveOrder, objectiveId]
            : state.objectiveOrder,
        }
        const targetEncounter = target.kind === 'required-objectives'
          && target.objectiveIds.includes(objectiveId)
        if (!addState(stateKey, nextState, 0, targetEncounter)) {
          return { status: 'incomplete', reason: 'resource-limit' }
        }
      }
      continue
    }

    const completed = new Set(
      Object.entries(state.completionFlags)
        .filter(([, isComplete]) => isComplete)
        .map(([id]) => id),
    )
    if (
      state.locationId === 'route-exit'
      && controller.requiredObjectivesComplete({ completionFlags: state.completionFlags })
      && progression.exitDependencies.every((id) => state.completionFlags[id])
    ) {
      completionStates.push({
        stateId: stateKey,
        objectiveOrder: state.objectiveOrder,
      })
      continue
    }

    for (const travel of travelByFrom.get(state.locationId) ?? []) {
      if (travel.toLocationId === state.locationId) continue
      const nextState = { ...state, locationId: travel.toLocationId }
      if (!addState(stateKey, nextState, travel.distanceMeters)) {
        return { status: 'incomplete', reason: 'resource-limit' }
      }
    }
    for (const passage of passagesByFrom.get(state.locationId) ?? []) {
      const portal = passage.portalId
        ? navigation.portals.find(({ id }) => id === passage.portalId)
        : undefined
      if (
        portal
        && !evaluateDoorAccess(
          portalForDoorCheck(portal),
          completed,
          navigation.minimumPassageWidthMeters,
        ).traversable
      ) {
        continue
      }
      const nextState = { ...state, locationId: passage.toLocationId }
      const targetEncounter = target.kind === 'wall-passage'
        && passage.connectionId === target.connectionId
      const nextKey = routeStateKey(nextState, orderedObjectiveIds)
      const transition: RouteGraphTransition = {
        fromStateId: stateKey,
        toStateId: nextKey,
        distanceMeters: passage.distanceMeters,
        ...(targetEncounter
          ? {
              encounters: [{
                targetId,
                offsetMeters: passage.encounterOffsetMeters,
              }],
            }
          : {}),
      }
      if (generatedTransitionCount >= maximum) {
        return { status: 'incomplete', reason: 'resource-limit' }
      }
      generatedTransitionCount += 1
      transitions.push(transition)
      if (!states.has(nextKey)) {
        if (states.size >= maximum) {
          return { status: 'incomplete', reason: 'resource-limit' }
        }
        states.set(nextKey, nextState)
        queue.push(nextKey)
      }
    }
  }

  return analyzeShortestRouteEvidence({
    startStateId: initialKey,
    completionStates,
    transitions,
  }, targetId, options)
}
