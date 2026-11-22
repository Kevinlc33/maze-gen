export interface DifficultyObjective {
  id: string
  locationId: string
  required: boolean
  dependencies: readonly string[]
}

export interface DifficultyState {
  id: string
  locationId: string
  completionFlags: Readonly<Record<string, boolean>>
}

export interface DifficultyMovementTransition {
  kind: 'movement'
  id: string
  fromStateId: string
  toStateId: string
  fromLocationId: string
  toLocationId: string
  passageId: string
  /**
   * Metric grouping identity; the pure analyzer checks consistency, not physical topology.
   * Production adapters must derive and validate groups from authoritative navigation.
   */
  corridorGroupId: string
  distanceMeters: number
  passageLengthMeters: number
  dependencies: readonly string[]
}

export interface DifficultyObjectiveTransition {
  kind: 'objective-action'
  id: string
  fromStateId: string
  toStateId: string
  objectiveId: string
}

export type DifficultyTransition =
  | DifficultyMovementTransition
  | DifficultyObjectiveTransition

export type DifficultyGraphCompleteness =
  | { status: 'complete' }
  | { status: 'incomplete'; reason: 'cancelled' | 'resource-limit' | 'analysis-incomplete' }

export interface DifficultyEvidence {
  completeness: DifficultyGraphCompleteness
  progressionMode: 'ordered' | 'unordered'
  states: readonly DifficultyState[]
  transitions: readonly DifficultyTransition[]
  objectives: readonly DifficultyObjective[]
  entranceLocationId: string
  exitLocationId: string
  exitDependencies: readonly string[]
  startStateId: string
  completionStateIds: readonly string[]
}

export interface DifficultyMetricValues {
  distanceMeters: number
  decisionComplexityBits: number
  requiredBacktrackingMeters: number
  misleadingBranches: number
  progressionComplexity: number
}

export interface DifficultyMetricBreakdown {
  mandatoryObjectiveClosure: number
  typedPrerequisiteArcs: number
  gatedPassages: number
  repeatedPassageTraversals: number
}

export type DifficultyMetricResult =
  | {
      status: 'complete'
      raw: DifficultyMetricValues
      normalized: DifficultyMetricValues
      progression: DifficultyMetricBreakdown
      canonicalRouteKeys: readonly string[]
      shortestPassageIds: readonly string[]
    }
  | { status: 'unreachable' }
  | {
      status: 'incomplete'
      reason: 'cancelled' | 'resource-limit' | 'analysis-incomplete'
    }
  | {
      status: 'invalid'
      reason:
        | 'invalid-graph'
        | 'invalid-progression'
        | 'invalid-transition'
        | 'invalid-distance'
        | 'invalid-completion-state'
        | 'numeric-overflow'
    }

export interface DifficultyAnalysisOptions {
  maximumSearchStates?: number
  isCancelled?: () => boolean
}

export const DIFFICULTY_REFERENCE_SCALES: Readonly<DifficultyMetricValues> = Object.freeze({
  distanceMeters: 100,
  decisionComplexityBits: 16,
  requiredBacktrackingMeters: 40,
  misleadingBranches: 16,
  progressionComplexity: 16,
})

const EMPTY_RESULT = {
  status: 'invalid',
  reason: 'invalid-graph',
} as const

interface IndexedMovement extends DifficultyMovementTransition {
  fromIndex: number
  toIndex: number
  exactDistance: bigint
  exactPassageLength: bigint
  key: string
}

interface IndexedAction extends DifficultyObjectiveTransition {
  fromIndex: number
  toIndex: number
  key: string
}

type IndexedTransition = IndexedMovement | IndexedAction

interface Budget {
  maximum: number
  used: number
  isCancelled?: () => boolean
}

class AnalysisStopped extends Error {
  readonly reason: 'cancelled' | 'resource-limit'

  constructor(reason: 'cancelled' | 'resource-limit') {
    super(reason)
    this.reason = reason
  }
}

function consume(budget: Budget): void {
  if (budget.isCancelled?.()) throw new AnalysisStopped('cancelled')
  budget.used += 1
  if (budget.used > budget.maximum) throw new AnalysisStopped('resource-limit')
}

function compareText(a: string, b: string): number {
  let aIndex = 0
  let bIndex = 0
  while (aIndex < a.length && bIndex < b.length) {
    const aCodePoint = a.codePointAt(aIndex)!
    const bCodePoint = b.codePointAt(bIndex)!
    if (aCodePoint !== bCodePoint) return aCodePoint - bCodePoint
    aIndex += aCodePoint > 0xffff ? 2 : 1
    bIndex += bCodePoint > 0xffff ? 2 : 1
  }
  return aIndex < a.length ? 1 : bIndex < b.length ? -1 : 0
}

function flagsKey(flags: Readonly<Record<string, boolean>>, ids: readonly string[]): string {
  return ids.map((id) => flags[id] ? '1' : '0').join('')
}

function parseDecimal(value: number): { coefficient: bigint; scale: number } | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined
  const text = value.toString().toLowerCase()
  const [mantissa, exponentText] = text.split('e')
  const exponent = exponentText ? Number(exponentText) : 0
  const [whole, fraction = ''] = mantissa.split('.')
  const digits = `${whole}${fraction}`
  let coefficient: bigint
  try {
    coefficient = BigInt(digits)
  } catch {
    return undefined
  }
  const scale = fraction.length - exponent
  if (scale >= 0) return { coefficient, scale }
  return { coefficient: coefficient * 10n ** BigInt(-scale), scale: 0 }
}

function toScaledInteger(value: number, scale: number): bigint | undefined {
  const parsed = parseDecimal(value)
  if (!parsed || parsed.scale > scale) return undefined
  return parsed.coefficient * 10n ** BigInt(scale - parsed.scale)
}

function toFiniteNumber(value: bigint, scale: number): number | undefined {
  const converted = Number(`${value.toString()}e-${scale}`)
  return Number.isFinite(converted) ? converted : undefined
}

class MinHeap {
  private readonly items: Array<{ index: number; distance: bigint }> = []

  get size(): number {
    return this.items.length
  }

  push(item: { index: number; distance: bigint }): void {
    this.items.push(item)
    let child = this.items.length - 1
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2)
      if (this.compare(this.items[parent], this.items[child]) <= 0) break
      ;[this.items[parent], this.items[child]] = [this.items[child], this.items[parent]]
      child = parent
    }
  }

  pop(): { index: number; distance: bigint } | undefined {
    if (this.items.length === 0) return undefined
    const first = this.items[0]
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      let parent = 0
      while (true) {
        const left = parent * 2 + 1
        const right = left + 1
        let smallest = parent
        if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) {
          smallest = left
        }
        if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) {
          smallest = right
        }
        if (smallest === parent) break
        ;[this.items[parent], this.items[smallest]] = [this.items[smallest], this.items[parent]]
        parent = smallest
      }
    }
    return first
  }

  private compare(
    a: { index: number; distance: bigint },
    b: { index: number; distance: bigint },
  ): number {
    return a.distance < b.distance ? -1 : a.distance > b.distance ? 1 : a.index - b.index
  }
}

function shortestDistances(
  starts: readonly number[],
  adjacency: readonly (readonly IndexedTransition[])[],
  reverse: boolean,
  budget: Budget,
): Map<number, bigint> {
  const distances = new Map<number, bigint>()
  const heap = new MinHeap()
  for (const index of starts) {
    distances.set(index, 0n)
    heap.push({ index, distance: 0n })
  }
  while (heap.size > 0) {
    consume(budget)
    const current = heap.pop()!
    if (distances.get(current.index) !== current.distance) continue
    for (const transition of adjacency[current.index]) {
      consume(budget)
      const target = reverse ? transition.fromIndex : transition.toIndex
      const next = current.distance + (
        transition.kind === 'movement' ? transition.exactDistance : 0n
      )
      const previous = distances.get(target)
      if (previous === undefined || next < previous) {
        distances.set(target, next)
        heap.push({ index: target, distance: next })
      }
    }
  }
  return distances
}

function comparePathKeys(a: readonly string[], b: readonly string[]): number {
  const length = Math.min(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const order = compareText(a[index], b[index])
    if (order !== 0) return order
  }
  return a.length - b.length
}

function validateProgression(evidence: DifficultyEvidence): boolean {
  if (
    !['ordered', 'unordered'].includes(evidence.progressionMode)
  ) return false
  const objectiveIds = evidence.objectives.map(({ id }) => id)
  if (
    evidence.objectives.some(({ id, locationId, required, dependencies }) =>
      !id || !locationId || typeof required !== 'boolean' || !Array.isArray(dependencies),
    )
    || objectiveIds.some((id) => id.length === 0)
    || new Set(objectiveIds).size !== objectiveIds.length
  ) return false
  const known = new Set(objectiveIds)
  for (const objective of evidence.objectives) {
    if (
      objective.dependencies.some((id) => !known.has(id) || id === objective.id)
      || new Set(objective.dependencies).size !== objective.dependencies.length
    ) return false
  }
  for (const dependency of evidence.exitDependencies) {
    if (!known.has(dependency)) return false
  }
  const dependents = new Map(objectiveIds.map((id) => [id, [] as string[]]))
  const dependencyCounts = new Map<string, number>()
  for (const objective of evidence.objectives) {
    dependencyCounts.set(objective.id, objective.dependencies.length)
    for (const dependency of objective.dependencies) dependents.get(dependency)!.push(objective.id)
  }
  const ready = objectiveIds.filter((id) => dependencyCounts.get(id) === 0).sort(compareText)
  let visitedCount = 0
  while (ready.length > 0) {
    const id = ready.shift()!
    visitedCount += 1
    for (const dependent of dependents.get(id)!) {
      const count = dependencyCounts.get(dependent)! - 1
      dependencyCounts.set(dependent, count)
      if (count === 0) {
        ready.push(dependent)
        ready.sort(compareText)
      }
    }
  }
  return visitedCount === objectiveIds.length
}

function availableObjectives(
  state: DifficultyState,
  evidence: DifficultyEvidence,
): DifficultyObjective[] {
  const nextRequired = evidence.progressionMode === 'ordered'
    ? evidence.objectives.find(({ id, required }) => required && !state.completionFlags[id])
    : undefined
  return evidence.objectives.filter((objective) =>
    objective.locationId === state.locationId
    && !state.completionFlags[objective.id]
    && objective.dependencies.every((id) => state.completionFlags[id])
    && (!objective.required || !nextRequired || objective.id === nextRequired.id),
  )
}

function validateEvidence(
  evidence: DifficultyEvidence,
  maximumSearchStates: number,
): DifficultyMetricResult | undefined {
  if (evidence.completeness.status === 'incomplete') {
    return { status: 'incomplete', reason: evidence.completeness.reason }
  }
  if (
    !Number.isSafeInteger(maximumSearchStates)
    || maximumSearchStates < 1
    || evidence.states.length === 0
    || !evidence.entranceLocationId
    || !evidence.exitLocationId
  ) return EMPTY_RESULT
  if (!validateProgression(evidence)) {
    return { status: 'invalid', reason: 'invalid-progression' }
  }

  const objectiveIds = evidence.objectives.map(({ id }) => id).sort(compareText)
  const objectiveById = new Map(evidence.objectives.map((objective) => [objective.id, objective]))
  const statesById = new Map<string, DifficultyState>()
  for (const state of evidence.states) {
    if (
      !state.id
      || !state.locationId
      || statesById.has(state.id)
      || Object.keys(state.completionFlags).sort(compareText).join('\u0000')
        !== objectiveIds.join('\u0000')
      || objectiveIds.some((id) => typeof state.completionFlags[id] !== 'boolean')
    ) return EMPTY_RESULT
    statesById.set(state.id, state)
  }
  const start = statesById.get(evidence.startStateId)
  if (!start || start.locationId !== evidence.entranceLocationId) return EMPTY_RESULT
  if (objectiveIds.some((id) => start.completionFlags[id])) {
    return { status: 'invalid', reason: 'invalid-progression' }
  }

  const completionIds = new Set(evidence.completionStateIds)
  if (completionIds.size !== evidence.completionStateIds.length) {
    return { status: 'invalid', reason: 'invalid-completion-state' }
  }
  const requiredIds = evidence.objectives.filter(({ required }) => required).map(({ id }) => id)
  for (const id of completionIds) {
    const state = statesById.get(id)
    if (
      !state
      || state.locationId !== evidence.exitLocationId
      || requiredIds.some((objectiveId) => !state.completionFlags[objectiveId])
      || evidence.exitDependencies.some((objectiveId) => !state.completionFlags[objectiveId])
    ) return { status: 'invalid', reason: 'invalid-completion-state' }
  }

  for (const transition of evidence.transitions) {
    if (!transition.id || !statesById.has(transition.fromStateId) || !statesById.has(transition.toStateId)) {
      return { status: 'invalid', reason: 'invalid-transition' }
    }
    const from = statesById.get(transition.fromStateId)!
    const to = statesById.get(transition.toStateId)!
    if (transition.kind === 'movement') {
      if (
        !transition.passageId
        || !transition.corridorGroupId
        || transition.fromLocationId !== from.locationId
        || transition.toLocationId !== to.locationId
        || from.locationId === to.locationId
        || !Number.isFinite(transition.distanceMeters)
        || transition.distanceMeters <= 0
        || !Number.isFinite(transition.passageLengthMeters)
        || transition.passageLengthMeters <= 0
        || transition.dependencies.some((id) =>
          !objectiveById.has(id) || !from.completionFlags[id],
        )
        || objectiveIds.some((id) => from.completionFlags[id] !== to.completionFlags[id])
      ) return { status: 'invalid', reason: 'invalid-transition' }
      continue
    }
    if (
      !objectiveById.has(transition.objectiveId)
      || from.locationId !== to.locationId
      || availableObjectives(from, evidence).every(({ id }) => id !== transition.objectiveId)
    ) return { status: 'invalid', reason: 'invalid-transition' }
    for (const id of objectiveIds) {
      if (to.completionFlags[id] !== (from.completionFlags[id] || id === transition.objectiveId)) {
        return { status: 'invalid', reason: 'invalid-transition' }
      }
    }
  }
  return undefined
}

function mandatoryClosure(evidence: DifficultyEvidence): Set<string> {
  const closure = new Set<string>()
  const objectiveById = new Map(evidence.objectives.map((objective) => [objective.id, objective]))
  const pending: string[] = []
  for (const objective of evidence.objectives) {
    if (objective.required) pending.push(objective.id)
  }
  pending.push(...evidence.exitDependencies)
  while (pending.length > 0) {
    const id = pending.pop()!
    if (closure.has(id)) continue
    closure.add(id)
    pending.push(...objectiveById.get(id)!.dependencies)
  }
  return closure
}

function countTypedPrerequisiteArcs(evidence: DifficultyEvidence): number {
  const arcs = new Set<string>()
  const mandatory = mandatoryClosure(evidence)
  for (const objective of evidence.objectives) {
    if (!mandatory.has(objective.id)) continue
    for (const dependency of objective.dependencies) {
      arcs.add(JSON.stringify([dependency, 'objective', objective.id]))
    }
  }
  for (const transition of evidence.transitions) {
    if (transition.kind !== 'movement') continue
    for (const dependency of transition.dependencies) {
      if (!mandatory.has(dependency)) continue
      arcs.add(JSON.stringify([dependency, 'passage', transition.passageId]))
    }
  }
  for (const dependency of evidence.exitDependencies) {
    arcs.add(JSON.stringify([dependency, 'exit', evidence.exitLocationId]))
  }
  return arcs.size
}

function passageTraversalRuns(
  movements: readonly IndexedMovement[],
): IndexedMovement[][] {
  const runs: IndexedMovement[][] = []
  for (const movement of movements) {
    const previous = runs[runs.length - 1]
    const priorLocations = previous?.flatMap(({ fromLocationId, toLocationId }) => [
      fromLocationId,
      toLocationId,
    ]) ?? []
    const continues = previous?.[previous.length - 1].corridorGroupId === movement.corridorGroupId
      && previous[previous.length - 1].toLocationId === movement.fromLocationId
      && !priorLocations.includes(movement.toLocationId)
    if (continues) {
      previous.push(movement)
    } else {
      runs.push([movement])
    }
  }
  return runs
}

interface BranchSegment {
  passageId: string
  from: string
  to: string
}

interface BranchComponent {
  passageIds: Set<string>
  segments: BranchSegment[]
  internalLocations: Set<string>
  attachments: Set<string>
}

interface CanonicalLabel {
  stateIndex: number
  usedCorridors: bigint
  activeCorridorId?: string
  previousMovementFrom?: string
  repeatedDistance: bigint
  optionalActions: number
  pathKeys: readonly string[]
  predecessor?: CanonicalLabel
  transition?: IndexedTransition
}

function compareCanonicalLabels(a: CanonicalLabel, b: CanonicalLabel): number {
  if (a.repeatedDistance !== b.repeatedDistance) {
    return a.repeatedDistance < b.repeatedDistance ? -1 : 1
  }
  if (a.optionalActions !== b.optionalActions) return a.optionalActions - b.optionalActions
  return comparePathKeys(a.pathKeys, b.pathKeys)
}

function canonicalLabelKey(label: CanonicalLabel): string {
  return JSON.stringify([
    label.usedCorridors.toString(),
    label.activeCorridorId ?? null,
    label.previousMovementFrom ?? null,
  ])
}

function canonicalPath(label: CanonicalLabel): IndexedTransition[] {
  const path: IndexedTransition[] = []
  let current: CanonicalLabel | undefined = label
  while (current?.transition) {
    path.push(current.transition)
    current = current.predecessor
  }
  path.reverse()
  return path
}

function stateSpecificBranches(
  state: DifficultyState,
  evidence: DifficultyEvidence,
  allStates: ReadonlyMap<string, DifficultyState>,
  outgoing: readonly (readonly IndexedTransition[])[],
  stateIndex: ReadonlyMap<string, number>,
  canonicalLocations: ReadonlySet<string>,
  canonicalPassageIds: ReadonlySet<string>,
  budget: Budget,
): BranchComponent[] {
  const ids = evidence.objectives.map(({ id }) => id).sort(compareText)
  const key = flagsKey(state.completionFlags, ids)
  const locations = new Set<string>()
  const segments = new Map<string, BranchSegment>()
  for (const candidate of allStates.values()) {
    consume(budget)
    if (flagsKey(candidate.completionFlags, ids) !== key) continue
    locations.add(candidate.locationId)
    for (const transition of outgoing[stateIndex.get(candidate.id)!]) {
      consume(budget)
      if (
        transition.kind !== 'movement'
        || canonicalPassageIds.has(transition.passageId)
        || flagsKey(allStates.get(transition.toStateId)!.completionFlags, ids) !== key
      ) continue
      const [from, to] = [transition.fromLocationId, transition.toLocationId].sort(compareText)
      const segmentKey = JSON.stringify([transition.passageId, from, to])
      segments.set(segmentKey, { passageId: transition.passageId, from, to })
    }
  }

  const internalLocations = [...locations]
    .filter((locationId) => !canonicalLocations.has(locationId))
    .sort(compareText)
  const parent = new Map(internalLocations.map((locationId) => [locationId, locationId]))
  const find = (locationId: string): string => {
    const root = parent.get(locationId)!
    if (root === locationId) return locationId
    const resolved = find(root)
    parent.set(locationId, resolved)
    return resolved
  }
  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) {
      if (compareText(rootA, rootB) < 0) parent.set(rootB, rootA)
      else parent.set(rootA, rootB)
    }
  }
  for (const segment of segments.values()) {
    if (parent.has(segment.from) && parent.has(segment.to)) union(segment.from, segment.to)
  }

  const components = new Map<string, BranchComponent>()
  const routeRoute: BranchComponent[] = []
  for (const locationId of internalLocations) {
    const root = find(locationId)
    if (!components.has(root)) {
      components.set(root, {
        passageIds: new Set(),
        segments: [],
        internalLocations: new Set(),
        attachments: new Set(),
      })
    }
    components.get(root)!.internalLocations.add(locationId)
  }
  for (const segment of segments.values()) {
    const fromIsInternal = parent.has(segment.from)
    const toIsInternal = parent.has(segment.to)
    if (!fromIsInternal && !toIsInternal) {
      routeRoute.push({
        passageIds: new Set([segment.passageId]),
        segments: [segment],
        internalLocations: new Set(),
        attachments: new Set([segment.from, segment.to]),
      })
      continue
    }
    const root = find(fromIsInternal ? segment.from : segment.to)
    const component = components.get(root)!
    component.passageIds.add(segment.passageId)
    component.segments.push(segment)
    if (!fromIsInternal) component.attachments.add(segment.from)
    if (!toIsInternal) component.attachments.add(segment.to)
  }
  return [...components.values(), ...routeRoute]
    .filter(({ attachments }) => attachments.size > 0)
}

function misleadingBranchCount(
  canonicalStates: readonly DifficultyState[],
  canonicalLocations: ReadonlySet<string>,
  evidence: DifficultyEvidence,
  allStates: ReadonlyMap<string, DifficultyState>,
  outgoing: readonly (readonly IndexedTransition[])[],
  stateIndex: ReadonlyMap<string, number>,
  canonicalPassageIds: ReadonlySet<string>,
  shortestPassageIds: ReadonlySet<string>,
  budget: Budget,
): number {
  const objectiveLocations = new Set(evidence.objectives.map(({ locationId }) => locationId))
  const signatures = new Map<string, number>()
  const analyzedFlagStates = new Set<string>()
  const objectiveIds = evidence.objectives.map(({ id }) => id).sort(compareText)
  for (const state of canonicalStates) {
    const snapshotKey = flagsKey(state.completionFlags, objectiveIds)
    if (analyzedFlagStates.has(snapshotKey)) continue
    analyzedFlagStates.add(snapshotKey)
    consume(budget)
    const components = stateSpecificBranches(
      state,
      evidence,
      allStates,
      outgoing,
      stateIndex,
      canonicalLocations,
      canonicalPassageIds,
      budget,
    )
    for (const component of components) {
      consume(budget)
      const passageIds = [...component.passageIds].sort(compareText)
      const attachmentIds = [...component.attachments].sort(compareText)
      const signature = JSON.stringify([passageIds, attachmentIds])
      if (signatures.has(signature)) continue
      const degree = new Map<string, number>()
      for (const segment of component.segments) {
        if (component.internalLocations.has(segment.from)) {
          degree.set(segment.from, (degree.get(segment.from) ?? 0) + 1)
        }
        if (component.internalLocations.has(segment.to)) {
          degree.set(segment.to, (degree.get(segment.to) ?? 0) + 1)
        }
      }
      const leafLocations = [...degree]
        .filter(([, value]) => value === 1)
        .map(([locationId]) => locationId)
      const eligibleLeaves = leafLocations
        .filter((locationId) => (
          !objectiveLocations.has(locationId)
          && !component.segments.some((segment) => (
            (segment.from === locationId || segment.to === locationId)
            && shortestPassageIds.has(segment.passageId)
          ))
        )).length
      const vertices = new Set([...component.internalLocations, ...component.attachments])
      const cycleRank = component.segments.length - vertices.size + 1
      const containsObjective = [...component.internalLocations]
        .some((locationId) => objectiveLocations.has(locationId))
      const hasNoncanonicalLeaf = leafLocations.length > 0
      const containsShortestPassage = [...component.passageIds]
        .some((passageId) => shortestPassageIds.has(passageId))
      const qualifiesAsLoopOrMultiAttachment = !containsObjective
        && !hasNoncanonicalLeaf
        && !containsShortestPassage
        && (component.attachments.size > 1 || cycleRank > 0)
      signatures.set(signature, eligibleLeaves + (qualifiesAsLoopOrMultiAttachment ? 1 : 0))
    }
  }
  return [...signatures.values()].reduce((sum, count) => sum + count, 0)
}

function normalized(value: number, scale: number): number {
  if (value === 0) return 0
  const denominator = value + scale
  return Number.isFinite(denominator)
    ? value / denominator
    : 1 / (1 + scale / value)
}

export function analyzeDifficultyMetrics(
  evidence: DifficultyEvidence,
  options: DifficultyAnalysisOptions = {},
): DifficultyMetricResult {
  const maximum = options.maximumSearchStates ?? 100_000
  const validation = validateEvidence(evidence, maximum)
  if (validation) return validation

  const decimalValues = evidence.transitions.flatMap((transition) =>
    transition.kind === 'movement'
      ? [transition.distanceMeters, transition.passageLengthMeters]
      : [],
  )
  const parsed = decimalValues.map(parseDecimal)
  if (parsed.some((value) => value === undefined)) {
    return { status: 'invalid', reason: 'invalid-distance' }
  }
  const scale = parsed.reduce((largest, value) => Math.max(largest, value!.scale), 0)
  const states = [...evidence.states].sort((a, b) => compareText(a.id, b.id))
  const stateIndex = new Map(states.map((state, index) => [state.id, index]))
  const allStates = new Map(states.map((state) => [state.id, state]))
  const transitionIds = new Set<string>()
  const passageLengths = new Map<string, bigint>()
  const passageGroups = new Map<string, string>()
  const passageEndpoints = new Map<string, string>()
  const corridorLengths = new Map<string, bigint>()
  const transitions: IndexedTransition[] = []
  for (const transition of evidence.transitions) {
    const key = `${transition.kind}:${transition.id}`
    if (transitionIds.has(key)) return { status: 'invalid', reason: 'invalid-transition' }
    transitionIds.add(key)
    if (transition.kind === 'movement') {
      const exactDistance = toScaledInteger(transition.distanceMeters, scale)
      const exactPassageLength = toScaledInteger(transition.passageLengthMeters, scale)
      if (exactDistance === undefined || exactPassageLength === undefined) {
        return { status: 'invalid', reason: 'invalid-distance' }
      }
      const previousLength = passageLengths.get(transition.passageId)
      if (previousLength !== undefined && previousLength !== exactPassageLength) {
        return { status: 'invalid', reason: 'invalid-distance' }
      }
      const previousGroup = passageGroups.get(transition.passageId)
      const previousEndpoints = passageEndpoints.get(transition.passageId)
      const endpoints = JSON.stringify(
        [transition.fromLocationId, transition.toLocationId].sort(compareText),
      )
      if (
        (previousGroup !== undefined && previousGroup !== transition.corridorGroupId)
        || (previousEndpoints !== undefined && previousEndpoints !== endpoints)
      ) return { status: 'invalid', reason: 'invalid-transition' }
      if (previousLength === undefined) {
        corridorLengths.set(
          transition.corridorGroupId,
          (corridorLengths.get(transition.corridorGroupId) ?? 0n) + exactPassageLength,
        )
      }
      passageLengths.set(transition.passageId, exactPassageLength)
      passageGroups.set(transition.passageId, transition.corridorGroupId)
      passageEndpoints.set(transition.passageId, endpoints)
      transitions.push({
        ...transition,
        fromIndex: stateIndex.get(transition.fromStateId)!,
        toIndex: stateIndex.get(transition.toStateId)!,
        exactDistance,
        exactPassageLength,
        key,
      })
    } else {
      transitions.push({
        ...transition,
        fromIndex: stateIndex.get(transition.fromStateId)!,
        toIndex: stateIndex.get(transition.toStateId)!,
        key,
      })
    }
  }
  transitions.sort((a, b) => compareText(a.key, b.key))
  const outgoing: IndexedTransition[][] = states.map(() => [])
  const incoming: IndexedTransition[][] = states.map(() => [])
  for (const transition of transitions) {
    outgoing[transition.fromIndex].push(transition)
    incoming[transition.toIndex].push(transition)
  }

  const budget: Budget = {
    maximum,
    used: 0,
    isCancelled: options.isCancelled,
  }
  try {
    const startIndex = stateIndex.get(evidence.startStateId)!
    const completionIndices = evidence.completionStateIds.map((id) => stateIndex.get(id)!)
    const fromStart = shortestDistances([startIndex], outgoing, false, budget)
    const toCompletion = shortestDistances(completionIndices, incoming, true, budget)
    const shortestDistance = completionIndices
      .map((index) => fromStart.get(index))
      .filter((distance): distance is bigint => distance !== undefined)
      .reduce<bigint | undefined>(
        (smallest, distance) => smallest === undefined || distance < smallest ? distance : smallest,
        undefined,
      )
    if (shortestDistance === undefined) return { status: 'unreachable' }

    const shortestTransitions = transitions.filter((transition) => {
      consume(budget)
      const distanceFrom = fromStart.get(transition.fromIndex)
      const distanceTo = toCompletion.get(transition.toIndex)
      if (distanceFrom === undefined || distanceTo === undefined) return false
      const weight = transition.kind === 'movement' ? transition.exactDistance : 0n
      return distanceFrom + weight + distanceTo === shortestDistance
    })
    const shortestOutgoing: IndexedTransition[][] = states.map(() => [])
    for (const transition of shortestTransitions) {
      shortestOutgoing[transition.fromIndex].push(transition)
    }
    const goalIndices = new Set(completionIndices.filter((index) =>
      fromStart.get(index) === shortestDistance,
    ))

    const mandatory = mandatoryClosure(evidence)
    const indegrees = states.map(() => 0)
    for (const transition of shortestTransitions) indegrees[transition.toIndex] += 1
    const ready = new MinHeap()
    for (let index = 0; index < indegrees.length; index += 1) {
      if (indegrees[index] === 0) ready.push({ index, distance: BigInt(index) })
    }
    const topologicalOrder: number[] = []
    while (ready.size > 0) {
      consume(budget)
      const { index } = ready.pop()!
      topologicalOrder.push(index)
      for (const transition of shortestOutgoing[index]) {
        consume(budget)
        indegrees[transition.toIndex] -= 1
        if (indegrees[transition.toIndex] === 0) {
          ready.push({ index: transition.toIndex, distance: BigInt(transition.toIndex) })
        }
      }
    }
    if (topologicalOrder.length !== states.length) {
      return { status: 'invalid', reason: 'invalid-transition' }
    }

    const corridorIds = [...corridorLengths.keys()].sort(compareText)
    const corridorIndices = new Map(corridorIds.map((id, index) => [id, index]))
    const labelsByState: Map<string, CanonicalLabel>[] = states.map(() => new Map())
    const initialLabel: CanonicalLabel = {
      stateIndex: startIndex,
      usedCorridors: 0n,
      repeatedDistance: 0n,
      optionalActions: 0,
      pathKeys: [],
    }
    labelsByState[startIndex].set(canonicalLabelKey(initialLabel), initialLabel)

    for (const index of topologicalOrder) {
      const labels = [...labelsByState[index].values()].sort(compareCanonicalLabels)
      for (const label of labels) {
        consume(budget)
        for (const transition of shortestOutgoing[index]) {
          consume(budget)
          let usedCorridors = label.usedCorridors
          let activeCorridorId: string | undefined
          let previousMovementFrom: string | undefined
          let repeatedDistance = label.repeatedDistance
          let optionalActions = label.optionalActions
          if (transition.kind === 'movement') {
            activeCorridorId = transition.corridorGroupId
            previousMovementFrom = transition.fromLocationId
            const continuesTraversal = label.activeCorridorId === transition.corridorGroupId
              && label.previousMovementFrom !== undefined
              && transition.toLocationId !== label.previousMovementFrom
            if (!continuesTraversal) {
              const corridorIndex = corridorIndices.get(transition.corridorGroupId)
              if (corridorIndex === undefined) {
                return { status: 'invalid', reason: 'invalid-transition' }
              }
              const bit = 1n << BigInt(corridorIndex)
              if ((usedCorridors & bit) !== 0n) {
                repeatedDistance += corridorLengths.get(transition.corridorGroupId)!
              } else {
                usedCorridors |= bit
              }
            }
          } else {
            activeCorridorId = undefined
            previousMovementFrom = undefined
            if (
              transition.kind === 'objective-action'
              && !mandatory.has(transition.objectiveId)
            ) optionalActions += 1
          }
          const candidate: CanonicalLabel = {
            stateIndex: transition.toIndex,
            usedCorridors,
            activeCorridorId,
            previousMovementFrom,
            repeatedDistance,
            optionalActions,
            pathKeys: [...label.pathKeys, transition.key],
            predecessor: label,
            transition,
          }
          const key = canonicalLabelKey(candidate)
          const existing = labelsByState[transition.toIndex].get(key)
          if (!existing || compareCanonicalLabels(candidate, existing) < 0) {
            labelsByState[transition.toIndex].set(key, candidate)
          }
        }
      }
    }

    let canonicalLabel: CanonicalLabel | undefined
    for (const index of goalIndices) {
      for (const candidate of labelsByState[index].values()) {
        if (!canonicalLabel || compareCanonicalLabels(candidate, canonicalLabel) < 0) {
          canonicalLabel = candidate
        }
      }
    }
    if (!canonicalLabel) {
      return { status: 'incomplete', reason: 'analysis-incomplete' }
    }
    const canonical = canonicalPath(canonicalLabel)
    const canonicalKeys = canonicalLabel.pathKeys
    const canonicalRepeatedDistance = canonicalLabel.repeatedDistance

    const canonicalStates: DifficultyState[] = [states[startIndex]]
    for (const transition of canonical) canonicalStates.push(states[transition.toIndex])
    const canonicalLocations = new Set(canonicalStates.map(({ locationId }) => locationId))
    const shortestPassageIds = new Set(
      shortestTransitions.flatMap((transition) =>
        transition.kind === 'movement' ? [transition.passageId] : [],
      ),
    )
    const routeMovements = canonical.filter(
      (transition): transition is IndexedMovement => transition.kind === 'movement',
    )
    const routeRuns = passageTraversalRuns(routeMovements)
    const canonicalPassageIds = new Set(routeMovements.map(({ passageId }) => passageId))
    const gatedPassages = new Set(routeMovements.flatMap((movement) =>
      movement.dependencies.length > 0 ? [movement.passageId] : [],
    )).size
    const repeatedPassageTraversals = Math.max(0, routeRuns.length - new Set(
      routeRuns.map((run) => run[0].corridorGroupId),
    ).size)
    const typedPrerequisiteArcs = countTypedPrerequisiteArcs(evidence)
    const mandatoryObjectiveClosure = mandatory.size
    const progressionComplexity = mandatoryObjectiveClosure
      + typedPrerequisiteArcs
      + gatedPassages
      + repeatedPassageTraversals
    const decisionComplexityBits = (() => {
      let total = 0
      let arrivalPassage: string | undefined
      let state = states[startIndex]
      let pathIndex = 0
      while (true) {
        while (
          pathIndex < canonical.length
          && canonical[pathIndex].kind === 'objective-action'
          && canonical[pathIndex].fromIndex === stateIndex.get(state.id)
        ) {
          state = states[canonical[pathIndex].toIndex]
          pathIndex += 1
        }
        const outgoingPassages = new Set(
          outgoing[stateIndex.get(state.id)!].flatMap((transition) =>
            transition.kind === 'movement' ? [transition.passageId] : [],
          ),
        )
        if (arrivalPassage) outgoingPassages.delete(arrivalPassage)
        total += Math.log2(Math.max(1, outgoingPassages.size))
        if (pathIndex >= canonical.length) break
        const movement = canonical[pathIndex]
        if (movement.kind !== 'movement') return Number.NaN
        arrivalPassage = movement.passageId
        state = states[movement.toIndex]
        pathIndex += 1
      }
      return total
    })()
    const misleadingBranches = misleadingBranchCount(
      canonicalStates,
      canonicalLocations,
      evidence,
      allStates,
      outgoing,
      stateIndex,
      canonicalPassageIds,
      shortestPassageIds,
      budget,
    )
    const distanceMeters = toFiniteNumber(shortestDistance, scale)
    const requiredBacktrackingMeters = toFiniteNumber(canonicalRepeatedDistance, scale)
    if (
      distanceMeters === undefined
      || requiredBacktrackingMeters === undefined
      || !Number.isFinite(decisionComplexityBits)
    ) {
      return { status: 'invalid', reason: 'numeric-overflow' }
    }
    const raw: DifficultyMetricValues = {
      distanceMeters,
      decisionComplexityBits,
      requiredBacktrackingMeters,
      misleadingBranches,
      progressionComplexity,
    }
    const normalizedValues: DifficultyMetricValues = {
      distanceMeters: normalized(
        raw.distanceMeters,
        DIFFICULTY_REFERENCE_SCALES.distanceMeters,
      ),
      decisionComplexityBits: normalized(
        raw.decisionComplexityBits,
        DIFFICULTY_REFERENCE_SCALES.decisionComplexityBits,
      ),
      requiredBacktrackingMeters: normalized(
        raw.requiredBacktrackingMeters,
        DIFFICULTY_REFERENCE_SCALES.requiredBacktrackingMeters,
      ),
      misleadingBranches: normalized(
        raw.misleadingBranches,
        DIFFICULTY_REFERENCE_SCALES.misleadingBranches,
      ),
      progressionComplexity: normalized(
        raw.progressionComplexity,
        DIFFICULTY_REFERENCE_SCALES.progressionComplexity,
      ),
    }
    return {
      status: 'complete',
      raw,
      normalized: normalizedValues,
      progression: {
        mandatoryObjectiveClosure,
        typedPrerequisiteArcs,
        gatedPassages,
        repeatedPassageTraversals,
      },
      canonicalRouteKeys: canonicalKeys,
      shortestPassageIds: [...shortestPassageIds].sort(compareText),
    }
  } catch (error) {
    if (error instanceof AnalysisStopped) {
      return { status: 'incomplete', reason: error.reason }
    }
    throw error
  }
}
