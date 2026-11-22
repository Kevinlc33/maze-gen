import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  analyzeDifficultyMetrics,
  DIFFICULTY_REFERENCE_SCALES,
  type DifficultyEvidence,
  type DifficultyMetricResult,
  type DifficultyObjective,
} from './difficultyMetrics'

interface ReferencePassage {
  id: string
  corridorGroupId?: string
  from: string
  to: string
  lengthMeters: number
  dependencies?: readonly string[]
}

interface ReferenceMaze {
  locations: readonly string[]
  passages: readonly ReferencePassage[]
  objectives?: readonly DifficultyObjective[]
  progressionMode?: 'ordered' | 'unordered'
  entrance?: string
  exit?: string
  exitDependencies?: readonly string[]
}

function referenceEvidence(maze: ReferenceMaze): DifficultyEvidence {
  const objectives = maze.objectives ?? []
  const objectiveIds = objectives.map(({ id }) => id).sort()
  const entranceLocationId = maze.entrance ?? 'S'
  const exitLocationId = maze.exit ?? 'X'
  const startFlags = Object.fromEntries(objectiveIds.map((id) => [id, false]))
  const startStateId = JSON.stringify([entranceLocationId, objectiveIds.map(() => 0)])
  const states = new Map<string, DifficultyEvidence['states'][number]>()
  const transitions: DifficultyEvidence['transitions'][number][] = []
  const completionStateIds: string[] = []
  const pending: string[] = []
  const stateKey = (locationId: string, flags: Readonly<Record<string, boolean>>) =>
    JSON.stringify([locationId, objectiveIds.map((id) => flags[id] ? 1 : 0)])
  const addState = (locationId: string, flags: Readonly<Record<string, boolean>>) => {
    const id = stateKey(locationId, flags)
    if (!states.has(id)) {
      states.set(id, { id, locationId, completionFlags: { ...flags } })
      pending.push(id)
    }
    return id
  }
  addState(entranceLocationId, startFlags)
  let cursor = 0
  while (cursor < pending.length) {
    const fromStateId = pending[cursor]
    cursor += 1
    const state = states.get(fromStateId)!
    const completed = (id: string) => state.completionFlags[id]
    const nextRequired = maze.progressionMode === 'ordered'
      ? objectives.find(({ id, required }) => required && !completed(id))
      : undefined
    if (
      state.locationId === exitLocationId
      && objectives.every(({ id, required }) => !required || completed(id))
      && (maze.exitDependencies ?? []).every(completed)
    ) completionStateIds.push(state.id)

    for (const passage of maze.passages) {
      if ((passage.dependencies ?? []).some((id) => !completed(id))) continue
      const toLocationId = passage.from === state.locationId
        ? passage.to
        : passage.to === state.locationId
          ? passage.from
          : undefined
      if (!toLocationId) continue
      const toStateId = addState(toLocationId, state.completionFlags)
      const transitionId = `${fromStateId}|${passage.id}|${toLocationId}`
      transitions.push({
        kind: 'movement',
        id: transitionId,
        fromStateId,
        toStateId,
        fromLocationId: state.locationId,
        toLocationId,
        passageId: passage.id,
        corridorGroupId: passage.corridorGroupId ?? passage.id,
        distanceMeters: passage.lengthMeters,
        passageLengthMeters: passage.lengthMeters,
        dependencies: passage.dependencies ?? [],
      })
    }

    for (const objective of objectives) {
      if (
        objective.locationId !== state.locationId
        || completed(objective.id)
        || objective.dependencies.some((id) => !completed(id))
        || (objective.required && nextRequired && objective.id !== nextRequired.id)
      ) continue
      const toStateId = addState(state.locationId, {
        ...state.completionFlags,
        [objective.id]: true,
      })
      transitions.push({
        kind: 'objective-action',
        id: `${fromStateId}|action|${objective.id}`,
        fromStateId,
        toStateId,
        objectiveId: objective.id,
      })
    }
  }
  return {
    completeness: { status: 'complete' },
    progressionMode: maze.progressionMode ?? 'unordered',
    states: [...states.values()],
    transitions,
    objectives,
    entranceLocationId,
    exitLocationId,
    exitDependencies: maze.exitDependencies ?? [],
    startStateId,
    completionStateIds,
  }
}

function resultFor(maze: ReferenceMaze): Extract<DifficultyMetricResult, { status: 'complete' }> {
  const result = analyzeDifficultyMetrics(referenceEvidence(maze))
  expect(result.status).toBe('complete')
  if (result.status !== 'complete') throw new Error(`Expected complete metrics, got ${result.status}`)
  return result
}

const requiredSpur: ReferenceMaze = {
  locations: ['S', 'J', 'O', 'X'],
  passages: [
    { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
    { id: 'j-o', from: 'J', to: 'O', lengthMeters: 3 },
    { id: 'j-x', from: 'J', to: 'X', lengthMeters: 5 },
  ],
  objectives: [{ id: 'o', locationId: 'O', required: true, dependencies: [] }],
}

describe('difficulty metrics', () => {
  it('matches hand-calculated required-spur, misleading-leaf, and optional-objective references', () => {
    const spur = resultFor(requiredSpur)
    expect(spur.raw).toEqual({
      distanceMeters: 13,
      decisionComplexityBits: 2,
      requiredBacktrackingMeters: 3,
      misleadingBranches: 0,
      progressionComplexity: 2,
    })
    expect(spur.progression).toEqual({
      mandatoryObjectiveClosure: 1,
      typedPrerequisiteArcs: 0,
      gatedPassages: 0,
      repeatedPassageTraversals: 1,
    })
    expect(spur.normalized.distanceMeters).toBeCloseTo(13 / 113)
    expect(spur.normalized.decisionComplexityBits).toBeCloseTo(1 / 9)
    expect(spur.normalized.requiredBacktrackingMeters).toBeCloseTo(3 / 43)
    expect(spur.normalized.progressionComplexity).toBeCloseTo(1 / 9)

    const leaves = resultFor({
      locations: ['S', 'J', 'X', 'A', 'B'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        { id: 'j-x', from: 'J', to: 'X', lengthMeters: 4 },
        { id: 'j-a', from: 'J', to: 'A', lengthMeters: 3 },
        { id: 'j-b', from: 'J', to: 'B', lengthMeters: 5 },
      ],
    })
    expect(leaves.raw).toEqual({
      distanceMeters: 6,
      decisionComplexityBits: Math.log2(3),
      requiredBacktrackingMeters: 0,
      misleadingBranches: 2,
      progressionComplexity: 0,
    })
    expect(leaves.normalized).toEqual({
      distanceMeters: 3 / 53,
      decisionComplexityBits: Math.log2(3) / (16 + Math.log2(3)),
      requiredBacktrackingMeters: 0,
      misleadingBranches: 1 / 9,
      progressionComplexity: 0,
    })

    const optional = resultFor({
      locations: ['S', 'J', 'X', 'O'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        { id: 'j-x', from: 'J', to: 'X', lengthMeters: 4 },
        { id: 'j-o', from: 'J', to: 'O', lengthMeters: 3 },
      ],
      objectives: [{ id: 'optional', locationId: 'O', required: false, dependencies: [] }],
    })
    expect(optional.raw).toEqual({
      distanceMeters: 6,
      decisionComplexityBits: 1,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 0,
      progressionComplexity: 0,
    })
    expect(optional.normalized).toEqual({
      distanceMeters: 3 / 53,
      decisionComplexityBits: 1 / 17,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 0,
      progressionComplexity: 0,
    })
  })

  it('counts a multi-attachment loop once and chooses the least-backtracking exact shortest route', () => {
    const loop = resultFor({
      locations: ['S', 'A', 'X', 'B', 'C'],
      passages: [
        { id: 's-a', from: 'S', to: 'A', lengthMeters: 2 },
        { id: 'a-x', from: 'A', to: 'X', lengthMeters: 2 },
        { id: 'a-b', from: 'A', to: 'B', lengthMeters: 1 },
        { id: 'b-c', from: 'B', to: 'C', lengthMeters: 2 },
        { id: 'c-x', from: 'C', to: 'X', lengthMeters: 1 },
      ],
    })
    expect(loop.raw).toEqual({
      distanceMeters: 4,
      decisionComplexityBits: 1,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 1,
      progressionComplexity: 0,
    })
    expect(loop.normalized).toEqual({
      distanceMeters: 1 / 26,
      decisionComplexityBits: 1 / 17,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 1 / 17,
      progressionComplexity: 0,
    })

    const tied = resultFor({
      locations: ['S', 'J', 'O', 'X'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        { id: 'j-o', from: 'J', to: 'O', lengthMeters: 3 },
        { id: 'o-x', from: 'O', to: 'X', lengthMeters: 8 },
        { id: 'j-x', from: 'J', to: 'X', lengthMeters: 5 },
      ],
      objectives: [{ id: 'o', locationId: 'O', required: true, dependencies: [] }],
    })
    expect(tied.raw).toEqual({
      distanceMeters: 13,
      decisionComplexityBits: 1,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 0,
      progressionComplexity: 1,
    })
    expect(tied.normalized).toEqual({
      distanceMeters: 13 / 113,
      decisionComplexityBits: 1 / 17,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 0,
      progressionComplexity: 1 / 17,
    })
    expect(tied.shortestPassageIds).toEqual(['j-o', 'j-x', 'o-x', 's-j'])
    expect(tied.canonicalRouteKeys.some((key) => key.includes('j-x'))).toBe(false)
  })

  it('counts objective, gate, and exit prerequisites as typed arcs', () => {
    const gatedReturn = resultFor({
      locations: ['S', 'A', 'B', 'X'],
      passages: [
        { id: 's-a', from: 'S', to: 'A', lengthMeters: 2 },
        { id: 'a-b', from: 'A', to: 'B', lengthMeters: 3, dependencies: ['a'] },
      ],
      objectives: [
        { id: 'a', locationId: 'A', required: true, dependencies: [] },
        { id: 'b', locationId: 'B', required: true, dependencies: ['a'] },
      ],
      exit: 'A',
      exitDependencies: ['b'],
    })
    expect(gatedReturn.progression).toEqual({
      mandatoryObjectiveClosure: 2,
      typedPrerequisiteArcs: 3,
      gatedPassages: 1,
      repeatedPassageTraversals: 1,
    })
    expect(gatedReturn.raw).toEqual({
      distanceMeters: 8,
      decisionComplexityBits: 0,
      requiredBacktrackingMeters: 3,
      misleadingBranches: 0,
      progressionComplexity: 7,
    })
    expect(gatedReturn.normalized).toEqual({
      distanceMeters: 2 / 27,
      decisionComplexityBits: 0,
      requiredBacktrackingMeters: 3 / 43,
      misleadingBranches: 0,
      progressionComplexity: 7 / 23,
    })
  })

  it('requires an explicit zero-distance objective action and handles off-canonical gates', () => {
    const explicit = referenceEvidence({
      locations: ['S', 'J', 'X'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        { id: 'j-x', from: 'J', to: 'X', lengthMeters: 3 },
      ],
      objectives: [{ id: 'a', locationId: 'J', required: true, dependencies: [] }],
    })
    const withoutAction = {
      ...explicit,
      transitions: explicit.transitions.filter((transition) =>
        transition.kind !== 'objective-action',
      ),
    }
    expect(analyzeDifficultyMetrics(withoutAction)).toEqual({ status: 'unreachable' })
    expect(analyzeDifficultyMetrics({
      ...explicit,
      completionStateIds: [],
    })).toEqual({ status: 'unreachable' })
    const withAction = analyzeDifficultyMetrics(explicit)
    expect(withAction.status).toBe('complete')
    if (withAction.status === 'complete') {
      expect(withAction.raw).toEqual({
        distanceMeters: 5,
        decisionComplexityBits: 0,
        requiredBacktrackingMeters: 0,
        misleadingBranches: 0,
        progressionComplexity: 1,
      })
      expect(withAction.normalized).toEqual({
        distanceMeters: 1 / 21,
        decisionComplexityBits: 0,
        requiredBacktrackingMeters: 0,
        misleadingBranches: 0,
        progressionComplexity: 1 / 17,
      })
    }

    const offCanonical = resultFor({
      locations: ['S', 'A', 'X'],
      passages: [
        { id: 's-a', from: 'S', to: 'A', lengthMeters: 2 },
        { id: 'a-x', from: 'A', to: 'X', lengthMeters: 2 },
        { id: 'loop-a-x', from: 'A', to: 'X', lengthMeters: 6 },
      ],
    })
    expect(offCanonical.raw).toEqual({
      distanceMeters: 4,
      decisionComplexityBits: 1,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 1,
      progressionComplexity: 0,
    })
    expect(offCanonical.normalized).toEqual({
      distanceMeters: 1 / 26,
      decisionComplexityBits: 1 / 17,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 1 / 17,
      progressionComplexity: 0,
    })

    const gated = resultFor({
      locations: ['S', 'J', 'X'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        { id: 'direct', from: 'J', to: 'X', lengthMeters: 2 },
        { id: 'gate-a', from: 'J', to: 'X', lengthMeters: 6, dependencies: ['a'] },
      ],
      objectives: [{ id: 'a', locationId: 'J', required: true, dependencies: [] }],
    })
    expect(gated.raw).toEqual({
      distanceMeters: 4,
      decisionComplexityBits: 1,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 1,
      progressionComplexity: 2,
    })
    expect(gated.progression.gatedPassages).toBe(0)
    expect(gated.progression).toEqual({
      mandatoryObjectiveClosure: 1,
      typedPrerequisiteArcs: 1,
      gatedPassages: 0,
      repeatedPassageTraversals: 0,
    })
    expect(gated.normalized.progressionComplexity).toBe(1 / 9)
    expect(gated.normalized).toEqual({
      distanceMeters: 1 / 26,
      decisionComplexityBits: 1 / 17,
      requiredBacktrackingMeters: 0,
      misleadingBranches: 1 / 17,
      progressionComplexity: 1 / 9,
    })
  })

  it('matches the larger hand-calculated trunk and distinguishes near-shortest routes exactly', () => {
    const locations = Array.from({ length: 51 }, (_, index) => `T${index}`)
    const passages: ReferencePassage[] = Array.from({ length: 50 }, (_, index) => ({
      id: `trunk-${index}`,
      from: `T${index}`,
      to: `T${index + 1}`,
      lengthMeters: 2.4,
    }))
    const objectives: DifficultyObjective[] = []
    for (let index = 1; index <= 47; index += 2) {
      const id = `o${index}`
      const spur = `O${index}`
      locations.push(spur)
      passages.push({
        id: `objective-spur-${index}`,
        from: `T${index}`,
        to: spur,
        lengthMeters: 10 / 3,
      })
      objectives.push({ id, locationId: spur, required: true, dependencies: [] })
    }
    for (let index = 2; index <= 48; index += 2) {
      const leaf = `L${index}`
      locations.push(leaf)
      passages.push({
        id: `leaf-${index}`,
        from: `T${index}`,
        to: leaf,
        lengthMeters: 1,
      })
    }
    const trunk = resultFor({
      locations,
      passages,
      objectives,
      progressionMode: 'ordered',
      entrance: 'T0',
      exit: 'T50',
    })
    expect(trunk.raw.distanceMeters).toBe(280)
    expect(trunk.raw.decisionComplexityBits).toBe(72)
    expect(trunk.raw.requiredBacktrackingMeters).toBe(80)
    expect(trunk.raw.misleadingBranches).toBe(24)
    expect(trunk.progression).toEqual({
      mandatoryObjectiveClosure: 24,
      typedPrerequisiteArcs: 0,
      gatedPassages: 0,
      repeatedPassageTraversals: 24,
    })
    expect(trunk.raw.progressionComplexity).toBe(48)
    expect(trunk.normalized).toEqual({
      distanceMeters: expect.closeTo(14 / 19),
      decisionComplexityBits: expect.closeTo(9 / 11),
      requiredBacktrackingMeters: expect.closeTo(2 / 3),
      misleadingBranches: expect.closeTo(3 / 5),
      progressionComplexity: expect.closeTo(3 / 4),
    })

    const nearTie = referenceEvidence({
      locations: ['S', 'X', 'A'],
      passages: [
        { id: 'short', from: 'S', to: 'X', lengthMeters: 1 },
        { id: 'slightly-longer', from: 'S', to: 'A', lengthMeters: 0.5 },
        { id: 'longer-to-exit', from: 'A', to: 'X', lengthMeters: 0.50000005 },
      ],
    })
    const exact = analyzeDifficultyMetrics(nearTie)
    expect(exact.status).toBe('complete')
    if (exact.status === 'complete') expect(exact.shortestPassageIds).toEqual(['short'])
  })

  it('is invariant to graph ordering and unanchored degree-two subdivision', () => {
    const base = referenceEvidence(requiredSpur)
    const ordered = analyzeDifficultyMetrics(base)
    const reordered = analyzeDifficultyMetrics({
      ...base,
      states: [...base.states].reverse(),
      transitions: [...base.transitions].reverse(),
      objectives: [...base.objectives].reverse(),
      completionStateIds: [...base.completionStateIds].reverse(),
    })
    expect(reordered).toEqual(ordered)

    const subdivided = referenceEvidence({
      locations: ['S', 'J', 'O', 'X', 'M'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        {
          id: 'j-o-first',
          corridorGroupId: 'j-o',
          from: 'J',
          to: 'M',
          lengthMeters: 1.5,
        },
        {
          id: 'j-o-second',
          corridorGroupId: 'j-o',
          from: 'M',
          to: 'O',
          lengthMeters: 1.5,
        },
        { id: 'j-x', from: 'J', to: 'X', lengthMeters: 5 },
      ],
      objectives: [{ id: 'o', locationId: 'O', required: true, dependencies: [] }],
    })
    const splitResult = analyzeDifficultyMetrics(subdivided)
    expect(splitResult.status).toBe('complete')
    if (splitResult.status === 'complete') {
      expect(splitResult.raw).toEqual(ordered && ordered.status === 'complete'
        ? ordered.raw
        : undefined)
      expect(splitResult.normalized).toEqual(ordered && ordered.status === 'complete'
        ? ordered.normalized
        : undefined)
    }
  })

  it('returns no approximate tuple for cancellation, resource limits, or unreachable completion', () => {
    const evidence = referenceEvidence(requiredSpur)
    expect(analyzeDifficultyMetrics(evidence, { isCancelled: () => true }))
      .toEqual({ status: 'incomplete', reason: 'cancelled' })
    expect(analyzeDifficultyMetrics(evidence, { maximumSearchStates: 1 }))
      .toEqual({ status: 'incomplete', reason: 'resource-limit' })
    expect(analyzeDifficultyMetrics({
      ...evidence,
      completionStateIds: [
        ...referenceEvidence({
          locations: ['S', 'X'],
          passages: [{ id: 's-x', from: 'S', to: 'X', lengthMeters: 1 }],
        }).completionStateIds,
      ],
    })).toEqual({ status: 'invalid', reason: 'invalid-completion-state' })
    expect(analyzeDifficultyMetrics({
      ...evidence,
      transitions: evidence.transitions.filter((transition) =>
        transition.kind !== 'movement' || transition.passageId !== 'j-x',
      ),
    })).toEqual({ status: 'unreachable' })
  })

  it('uses fixed reference scales', () => {
    expect(DIFFICULTY_REFERENCE_SCALES).toEqual({
      distanceMeters: 100,
      decisionComplexityBits: 16,
      requiredBacktrackingMeters: 40,
      misleadingBranches: 16,
      progressionComplexity: 16,
    })
  })

  it('uses P* rather than P_short and applies exclusive L/Q and objective-location rules', () => {
      const tiedAlternative = resultFor({
        locations: ['S', 'A', 'B', 'X'],
        passages: [
          { id: 'a-in', from: 'S', to: 'A', lengthMeters: 1 },
          { id: 'a-out', from: 'A', to: 'X', lengthMeters: 1 },
          { id: 'b-in', from: 'S', to: 'B', lengthMeters: 1 },
          { id: 'b-out', from: 'B', to: 'X', lengthMeters: 1 },
        ],
      })
      expect(tiedAlternative.shortestPassageIds).toEqual(['a-in', 'a-out', 'b-in', 'b-out'])
      expect(tiedAlternative.canonicalRouteKeys.some((key) => key.includes('a-in'))).toBe(true)
      expect(tiedAlternative.canonicalRouteKeys.some((key) => key.includes('b-in'))).toBe(false)
      expect(tiedAlternative.raw.misleadingBranches).toBe(0)

      const shortestLeaf = resultFor({
        locations: ['S', 'J', 'X', 'B', 'C'],
        passages: [
          { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
          { id: 'a-direct', from: 'J', to: 'X', lengthMeters: 2 },
          { id: 'z-spur-in', from: 'J', to: 'B', lengthMeters: 1 },
          { id: 'z-spur-out', from: 'B', to: 'X', lengthMeters: 1, dependencies: ['a'] },
          { id: 'z-leaf', from: 'B', to: 'C', lengthMeters: 1, dependencies: ['a'] },
        ],
        objectives: [{ id: 'a', locationId: 'J', required: true, dependencies: [] }],
      })
      expect(shortestLeaf.shortestPassageIds).toEqual([
        'a-direct',
        's-j',
        'z-spur-in',
        'z-spur-out',
      ])
      expect(shortestLeaf.canonicalRouteKeys.some((key) => key.includes('a-direct'))).toBe(true)
      expect(shortestLeaf.raw.misleadingBranches).toBe(1)

      const leafAndLoop = resultFor({
        locations: ['S', 'J', 'X', 'A', 'B', 'L1', 'L2'],
        passages: [
          { id: 's-j', from: 'S', to: 'J', lengthMeters: 1 },
          { id: 'j-x', from: 'J', to: 'X', lengthMeters: 1 },
          { id: 'j-a', from: 'J', to: 'A', lengthMeters: 1 },
          { id: 'a-b', from: 'A', to: 'B', lengthMeters: 1 },
          { id: 'b-j', from: 'B', to: 'J', lengthMeters: 1 },
          { id: 'b-x', from: 'B', to: 'X', lengthMeters: 1 },
          { id: 'a-l1', from: 'A', to: 'L1', lengthMeters: 1 },
          { id: 'a-l2', from: 'A', to: 'L2', lengthMeters: 1 },
        ],
        objectives: [{ id: 'optional-leaf', locationId: 'L1', required: false, dependencies: [] }],
      })
      expect(leafAndLoop.raw.misleadingBranches).toBe(1)

      const objectiveInComponent = resultFor({
        locations: ['S', 'J', 'X', 'A', 'B', 'L'],
        passages: [
          { id: 's-j', from: 'S', to: 'J', lengthMeters: 1 },
          { id: 'j-x', from: 'J', to: 'X', lengthMeters: 1 },
          { id: 'j-a', from: 'J', to: 'A', lengthMeters: 1 },
          { id: 'a-b', from: 'A', to: 'B', lengthMeters: 1 },
          { id: 'b-j', from: 'B', to: 'J', lengthMeters: 1 },
          { id: 'a-l', from: 'A', to: 'L', lengthMeters: 1 },
        ],
        objectives: [{ id: 'optional-a', locationId: 'A', required: false, dependencies: [] }],
      })
      expect(objectiveInComponent.raw.misleadingBranches).toBe(1)
    })

  it('counts only typed prerequisites connected to mandatory completion', () => {
      const optionalDependencies = resultFor({
        locations: ['S', 'X', 'A', 'B'],
        passages: [
          { id: 's-x', from: 'S', to: 'X', lengthMeters: 2 },
          { id: 's-a', from: 'S', to: 'A', lengthMeters: 1 },
          { id: 'a-b', from: 'A', to: 'B', lengthMeters: 1 },
        ],
        objectives: [
          { id: 'optional-y', locationId: 'A', required: false, dependencies: [] },
          { id: 'optional-z', locationId: 'B', required: false, dependencies: ['optional-y'] },
        ],
      })
      expect(optionalDependencies.progression).toEqual({
        mandatoryObjectiveClosure: 0,
        typedPrerequisiteArcs: 0,
        gatedPassages: 0,
        repeatedPassageTraversals: 0,
      })
      expect(optionalDependencies.raw.progressionComplexity).toBe(0)

      const duplicateDependency = referenceEvidence({
        locations: ['S', 'J', 'O', 'X'],
        passages: [
          { id: 's-j', from: 'S', to: 'J', lengthMeters: 1 },
          { id: 'j-o', from: 'J', to: 'O', lengthMeters: 1 },
          { id: 'j-x', from: 'J', to: 'X', lengthMeters: 3 },
        ],
        objectives: [
          { id: 'prerequisite', locationId: 'J', required: true, dependencies: [] },
          { id: 'target', locationId: 'O', required: true, dependencies: ['prerequisite'] },
        ],
      })
      expect(analyzeDifficultyMetrics(duplicateDependency).status).toBe('complete')
      const invalidDuplicate = {
        ...duplicateDependency,
        objectives: duplicateDependency.objectives.map((objective) =>
          objective.id === 'target'
            ? { ...objective, dependencies: ['prerequisite', 'prerequisite'] }
            : objective,
        ),
      }
      expect(analyzeDifficultyMetrics(invalidDuplicate))
        .toEqual({ status: 'invalid', reason: 'invalid-progression' })
  })

  it('rejects non-monotone objective transitions', () => {
    const evidence = referenceEvidence(requiredSpur)
    const action = evidence.transitions.find((transition) =>
      transition.kind === 'objective-action',
    )!
    const from = evidence.states.find(({ id }) => id === action.fromStateId)!
    const to = evidence.states.find(({ id }) => id === action.toStateId)!
    expect(Object.keys(from.completionFlags).every((id) =>
      !from.completionFlags[id] || to.completionFlags[id],
    )).toBe(true)
    const regressedStateId = `${to.id}-regressed`
    expect(analyzeDifficultyMetrics({
      ...evidence,
      states: [
        ...evidence.states,
        { ...to, id: regressedStateId, completionFlags: { ...to.completionFlags, o: false } },
      ],
      transitions: evidence.transitions.map((transition) =>
        transition === action
          ? { ...action, toStateId: regressedStateId }
          : transition,
      ),
    })).toEqual({ status: 'invalid', reason: 'invalid-transition' })
  })

  it('preserves deterministic metrics over generated graph input permutations', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { maxLength: 80 }), (keys) => {
        const evidence = referenceEvidence(requiredSpur)
        const rotate = <T>(items: readonly T[], offset: number): T[] => {
          if (items.length === 0) return []
          const index = offset % items.length
          return [...items.slice(index), ...items.slice(0, index)]
        }
        const baseline = analyzeDifficultyMetrics(evidence)
        const permuted = analyzeDifficultyMetrics({
          ...evidence,
          states: rotate(evidence.states, keys[0] ?? 0),
          transitions: rotate(evidence.transitions, keys[1] ?? 0),
          objectives: rotate(evidence.objectives, keys[2] ?? 0),
          completionStateIds: rotate(evidence.completionStateIds, keys[3] ?? 0),
        })
        expect(permuted).toEqual(baseline)
      }),
    )
  })

  it('preserves metrics across generated unanchored degree-two subdivisions', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 40 }), (spurLength) => {
        const base = referenceEvidence({
          ...requiredSpur,
          passages: requiredSpur.passages.map((passage) =>
            passage.id === 'j-o' ? { ...passage, lengthMeters: spurLength } : passage,
          ),
        })
        const split = referenceEvidence({
          locations: ['S', 'J', 'M', 'O', 'X'],
          passages: [
            { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
            {
              id: 'j-o-first',
              corridorGroupId: 'j-o',
              from: 'J',
              to: 'M',
              lengthMeters: spurLength / 2,
            },
            {
              id: 'j-o-second',
              corridorGroupId: 'j-o',
              from: 'M',
              to: 'O',
              lengthMeters: spurLength / 2,
            },
            { id: 'j-x', from: 'J', to: 'X', lengthMeters: 5 },
          ],
          objectives: [{ id: 'o', locationId: 'O', required: true, dependencies: [] }],
        })
        const originalResult = analyzeDifficultyMetrics(base)
            const splitResult = analyzeDifficultyMetrics(split)
        expect(splitResult.status).toBe(originalResult.status)
        if (splitResult.status === 'complete' && originalResult.status === 'complete') {
          expect(splitResult.raw).toEqual(originalResult.raw)
          expect(splitResult.normalized).toEqual(originalResult.normalized)
          expect(splitResult.progression).toEqual(originalResult.progression)
          expect(splitResult.canonicalRouteKeys.some((key) => key.includes('j-o-first'))).toBe(true)
          expect(splitResult.canonicalRouteKeys.some((key) => key.includes('j-o-second'))).toBe(true)
        }
      }),
    )
  })

  it('uses exact DAG dynamic programming across factorially many objective orders', () => {
    const objectives: DifficultyObjective[] = Array.from({ length: 9 }, (_, index) => ({
      id: `o${index}`,
      locationId: 'J',
      required: true,
      dependencies: [],
    }))
    const evidence = referenceEvidence({
      locations: ['S', 'J', 'X'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        { id: 'j-x', from: 'J', to: 'X', lengthMeters: 3 },
      ],
      objectives,
    })
    const result = analyzeDifficultyMetrics(evidence, { maximumSearchStates: 100_000 })
    expect(result.status).toBe('complete')
    if (result.status === 'complete') {
      expect(result.raw.distanceMeters).toBe(5)
      expect(result.canonicalRouteKeys.filter((key) => key.includes('|action|'))).toHaveLength(9)
    }
  })

  it('rejects inconsistent corridor identity for a physical passage', () => {
    const evidence = referenceEvidence(requiredSpur)
    const transition = evidence.transitions.find((item) =>
      item.kind === 'movement' && item.passageId === 'j-o',
    )!
    expect(analyzeDifficultyMetrics({
      ...evidence,
      transitions: evidence.transitions.map((item) =>
        item === transition && item.kind === 'movement'
          ? { ...item, corridorGroupId: 'inconsistent-group' }
          : item,
      ),
    })).toEqual({ status: 'invalid', reason: 'invalid-transition' })
  })

  it('preserves objective flags over generated dependency-ordered action sequences', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (count) => {
        const objectives: DifficultyObjective[] = Array.from({ length: count }, (_, index) => ({
          id: `o${index}`,
          locationId: 'J',
          required: true,
          dependencies: index === 0 ? [] : [`o${index - 1}`],
        }))
        const evidence = referenceEvidence({
          locations: ['S', 'J', 'X'],
          passages: [
            { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
            { id: 'j-x', from: 'J', to: 'X', lengthMeters: 3 },
          ],
          objectives,
          progressionMode: 'ordered',
        })
        for (const transition of evidence.transitions) {
          if (transition.kind !== 'objective-action') continue
          const from = evidence.states.find(({ id }) => id === transition.fromStateId)!
          const to = evidence.states.find(({ id }) => id === transition.toStateId)!
          expect(Object.keys(from.completionFlags).every((id) =>
            !from.completionFlags[id] || to.completionFlags[id],
          )).toBe(true)
        }
        const result = analyzeDifficultyMetrics(evidence)
        expect(result.status).toBe('complete')
        if (result.status === 'complete') {
          expect(result.progression.mandatoryObjectiveClosure).toBe(count)
          expect(result.progression.typedPrerequisiteArcs).toBe(count - 1)
        }
      }),
    )
  })

  it('unions every generated exact shortest tie and applies canonical lexical tie-breaking', () => {
    const withOptionalAction = resultFor({
      locations: ['S', 'J', 'X'],
      passages: [
        { id: 's-j', from: 'S', to: 'J', lengthMeters: 2 },
        { id: 'j-x', from: 'J', to: 'X', lengthMeters: 3 },
      ],
      objectives: [
        { id: 'required', locationId: 'J', required: true, dependencies: [] },
        { id: 'optional', locationId: 'J', required: false, dependencies: [] },
      ],
    })
    expect(withOptionalAction.canonicalRouteKeys.some((key) => key.includes('action|optional')))
      .toBe(false)
    expect(withOptionalAction.raw.progressionComplexity).toBe(1)
  })

  it('uses code-point lexical ordering for canonical transition keys', () => {
    const bmp = String.fromCodePoint(0xe000)
    const astral = String.fromCodePoint(0x10000)
    const result = resultFor({
      locations: ['S', bmp, astral, 'X'],
      passages: [
        { id: `${bmp}-in`, from: 'S', to: bmp, lengthMeters: 1 },
        { id: `${bmp}-out`, from: bmp, to: 'X', lengthMeters: 1 },
        { id: `${astral}-in`, from: 'S', to: astral, lengthMeters: 1 },
        { id: `${astral}-out`, from: astral, to: 'X', lengthMeters: 1 },
      ],
    })
    expect(result.raw.distanceMeters).toBe(2)
    expect(result.canonicalRouteKeys.some((key) => key.includes(`${bmp}-in`))).toBe(true)
    expect(result.canonicalRouteKeys.some((key) => key.includes(`${astral}-in`))).toBe(false)
  })

  it('keeps degenerate and incomplete outcomes explicit over generated inputs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (length) => {
        const valid = referenceEvidence({
          locations: ['S', 'X'],
          passages: [{ id: 's-x', from: 'S', to: 'X', lengthMeters: length }],
        })
        const limited = analyzeDifficultyMetrics(valid, { maximumSearchStates: 1 })
        expect(limited.status).toBe('incomplete')
        if (limited.status === 'incomplete') expect('raw' in limited).toBe(false)

        const disconnected = referenceEvidence(requiredSpur)
        const unreachable = analyzeDifficultyMetrics({
          ...disconnected,
          transitions: disconnected.transitions.filter((transition) =>
            transition.kind !== 'movement' || transition.passageId !== 'j-x',
          ),
        })
        expect(unreachable).toEqual({ status: 'unreachable' })

        const invalid = analyzeDifficultyMetrics(referenceEvidence({
          locations: ['S', 'X'],
          passages: [{ id: 'zero', from: 'S', to: 'X', lengthMeters: 0 }],
        }))
        expect(invalid).toEqual({ status: 'invalid', reason: 'invalid-transition' })
      }),
    )
  })
})
