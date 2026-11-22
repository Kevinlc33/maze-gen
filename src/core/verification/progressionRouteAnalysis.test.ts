import { describe, expect, it } from 'vitest'
import type { MazeGeometry } from '../geometry/models'
import { validatePhysicalCandidate } from '../navigation/physicalNavigation'
import type { IntendedTopology } from '../topology/generator'
import {
  analyzeProgressionRoutes,
  analyzeShortestRouteEvidence,
} from './progressionRouteAnalysis'

const targetId = 'designated-wall-passage'

function squareReference() {
  const topology: IntendedTopology = {
    mode: 'maze',
    seed: 'progression-route-reference',
    nodes: [
      { id: 'node-0-0', row: 0, column: 0, kind: 'corridor', region: 'branching' },
      { id: 'node-0-1', row: 0, column: 1, kind: 'corridor', region: 'branching' },
      { id: 'node-1-0', row: 1, column: 0, kind: 'corridor', region: 'branching' },
      { id: 'node-1-1', row: 1, column: 1, kind: 'corridor', region: 'branching' },
    ],
    edges: [
      ['node-0-0', 'node-0-1'],
      ['node-0-0', 'node-1-0'],
      ['node-0-1', 'node-1-1'],
      ['node-1-0', 'node-1-1'],
    ].map(([from, to]) => ({
      id: `edge-${from}-${to}`,
      from,
      to,
      kind: 'corridor' as const,
    })),
  }
  const geometry: MazeGeometry = {
    schemaVersion: '1',
    levelId: 'progression-route-reference',
    boundsWidthMeters: 20,
    boundsDepthMeters: 20,
    walls: [],
    chambers: [],
    portals: [],
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
  const validation = validatePhysicalCandidate(topology, geometry, 1)
  if (!validation.validatedNavigation) {
    throw new Error('The independent square progression fixture must validate.')
  }
  return { topology, geometry, navigation: validation.validatedNavigation }
}

describe('verified shortest-route evidence', () => {
  it('uses physical lengths and preserves alternative legal objective orders', () => {
    const graph = {
      startStateId: 'start',
      completionStates: [
        { stateId: 'order-ab-done', objectiveOrder: ['a', 'b'] },
        { stateId: 'order-ba-done', objectiveOrder: ['b', 'a'] },
      ],
      transitions: [
        {
          fromStateId: 'start',
          toStateId: 'a-near',
          distanceMeters: 2,
          encounters: [{ targetId, offsetMeters: 1 }],
        },
        { fromStateId: 'a-near', toStateId: 'order-ab-done', distanceMeters: 8 },
        {
          fromStateId: 'start',
          toStateId: 'b-late',
          distanceMeters: 8,
          encounters: [{ targetId, offsetMeters: 7 }],
        },
        { fromStateId: 'b-late', toStateId: 'order-ba-done', distanceMeters: 2 },
      ],
    }

    const result = analyzeShortestRouteEvidence(graph, targetId)

    expect(result).toMatchObject({
      status: 'complete',
      classification: 'variable',
      legalOrderResults: [
        {
          objectiveOrder: ['a', 'b'],
          shortestDistanceMeters: 10,
          earliestEncounterPosition: 0.1,
          latestEncounterPosition: 0.1,
          encounterOnEveryShortestRoute: true,
        },
        {
          objectiveOrder: ['b', 'a'],
          shortestDistanceMeters: 10,
          earliestEncounterPosition: 0.7,
          latestEncounterPosition: 0.7,
          encounterOnEveryShortestRoute: true,
        },
      ],
    })
  })

  it('retains encounter extrema across all tied shortest routes', () => {
    const graph = {
      startStateId: 'start',
      completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
      transitions: [
        {
          fromStateId: 'start',
          toStateId: 'early',
          distanceMeters: 2,
          encounters: [{ targetId, offsetMeters: 2 }],
        },
        { fromStateId: 'early', toStateId: 'done', distanceMeters: 8 },
        {
          fromStateId: 'start',
          toStateId: 'late',
          distanceMeters: 8,
          encounters: [{ targetId, offsetMeters: 8 }],
        },
        { fromStateId: 'late', toStateId: 'done', distanceMeters: 2 },
      ],
    }

    const result = analyzeShortestRouteEvidence(graph, targetId)
    const reversedResult = analyzeShortestRouteEvidence({
      ...graph,
      transitions: [...graph.transitions].reverse(),
    }, targetId)

    expect(result).toEqual(reversedResult)
    expect(result).toMatchObject({
      status: 'complete',
      classification: 'variable',
      legalOrderResults: [{
        shortestDistanceMeters: 10,
        earliestEncounterPosition: 0.2,
        latestEncounterPosition: 0.8,
        encounterOnEveryShortestRoute: true,
      }],
    })
  })

  it('returns Variable when tied shortest routes include both passage and bypass paths', () => {
    const graph = {
      startStateId: 'start',
      completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
      transitions: [
        {
          fromStateId: 'start',
          toStateId: 'through',
          distanceMeters: 5,
          encounters: [{ targetId, offsetMeters: 3 }],
        },
        { fromStateId: 'through', toStateId: 'done', distanceMeters: 5 },
        { fromStateId: 'start', toStateId: 'bypass', distanceMeters: 5 },
        { fromStateId: 'bypass', toStateId: 'done', distanceMeters: 5 },
      ],
    }

    expect(analyzeShortestRouteEvidence(graph, targetId)).toMatchObject({
      status: 'complete',
      classification: 'variable',
      legalOrderResults: [{
        encounterOnSomeShortestRoute: true,
        encounterOnEveryShortestRoute: false,
      }],
    })
  })

  it('returns Not Encountered when every shortest completion route bypasses the passage', () => {
    const graph = {
      startStateId: 'start',
      completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
      transitions: [
        { fromStateId: 'start', toStateId: 'detour', distanceMeters: 4 },
        { fromStateId: 'detour', toStateId: 'done', distanceMeters: 6 },
      ],
    }

    expect(analyzeShortestRouteEvidence(graph, targetId)).toMatchObject({
      status: 'complete',
      classification: 'not-encountered',
      legalOrderResults: [{
        encounterOnSomeShortestRoute: false,
        encounterOnEveryShortestRoute: false,
      }],
    })
  })

  it('handles zero-cost transitions and cycles without losing encounter alternatives', () => {
    const graph = {
      startStateId: 'start',
      completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
      transitions: [
        { fromStateId: 'start', toStateId: 'cycle-a', distanceMeters: 0 },
        { fromStateId: 'cycle-a', toStateId: 'cycle-b', distanceMeters: 0 },
        { fromStateId: 'cycle-b', toStateId: 'cycle-a', distanceMeters: 0 },
        {
          fromStateId: 'cycle-a',
          toStateId: 'encounter',
          distanceMeters: 0,
          encounters: [{ targetId, offsetMeters: 0 }],
        },
        { fromStateId: 'encounter', toStateId: 'done', distanceMeters: 4 },
        { fromStateId: 'cycle-b', toStateId: 'bypass', distanceMeters: 0 },
        { fromStateId: 'bypass', toStateId: 'done', distanceMeters: 4 },
      ],
    }

    expect(analyzeShortestRouteEvidence(graph, targetId)).toMatchObject({
      status: 'complete',
      classification: 'variable',
      legalOrderResults: [{
        shortestDistanceMeters: 4,
        encounterOnSomeShortestRoute: true,
        encounterOnEveryShortestRoute: false,
      }],
    })
  })

  it('rejects zero-length completion routes without normalizing an encounter position', () => {
    const graph = {
      startStateId: 'done',
      completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
      transitions: [],
    }

    expect(analyzeShortestRouteEvidence(graph, targetId)).toMatchObject({
      status: 'invalid',
      reason: 'zero-length-route',
    })
  })

  it.each([
    { distanceMeters: 3, offsetMeters: 1, classification: 'early' },
    { distanceMeters: 6, offsetMeters: 4, classification: 'middle' },
  ] as const)(
    'uses the exact progression band boundary at $offsetMeters/$distanceMeters',
    ({ distanceMeters, offsetMeters, classification }) => {
      const graph = {
        startStateId: 'start',
        completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
        transitions: [{
          fromStateId: 'start',
          toStateId: 'done',
          distanceMeters,
          encounters: [{ targetId, offsetMeters }],
        }],
      }

      expect(analyzeShortestRouteEvidence(graph, targetId)).toMatchObject({
        status: 'complete',
        classification,
      })
    },
  )

  it('returns Incomplete without a partial classification when analysis is exhausted', () => {
    const graph = {
      startStateId: 'start',
      completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
      transitions: [
        { fromStateId: 'start', toStateId: 'a', distanceMeters: 1 },
        { fromStateId: 'a', toStateId: 'b', distanceMeters: 1 },
        { fromStateId: 'b', toStateId: 'done', distanceMeters: 1 },
      ],
    }

    const result = analyzeShortestRouteEvidence(graph, targetId, { maximumAnalysisStates: 2 })

    expect(result).toMatchObject({ status: 'incomplete', reason: 'resource-limit' })
    expect(result).not.toHaveProperty('classification')
  })

  it('returns Incomplete when route analysis is cancelled', () => {
    const graph = {
      startStateId: 'start',
      completionStates: [{ stateId: 'done', objectiveOrder: ['goal'] }],
      transitions: [{ fromStateId: 'start', toStateId: 'done', distanceMeters: 1 }],
    }

    expect(analyzeShortestRouteEvidence(graph, targetId, { isCancelled: () => true }))
      .toMatchObject({ status: 'incomplete', reason: 'cancelled' })
  })

  it('derives wall encounters from physical passage traversal, not neighboring regions', () => {
    const { navigation } = squareReference()
    const progression = {
      progressionMode: 'unordered' as const,
      objectives: [],
      exitDependencies: [],
    }

    expect(navigation.routeMetricStatus).toBe('complete')
    expect(analyzeProgressionRoutes(
      navigation,
      progression,
      {
        kind: 'wall-passage',
        connectionId: 'edge-node-0-0-node-0-1-passage-1',
      },
    )).toMatchObject({
      status: 'complete',
      classification: 'variable',
      legalOrderResults: [{
        encounterOnSomeShortestRoute: true,
        encounterOnEveryShortestRoute: false,
      }],
    })
  })

  it('derives both legal objective orders from validated progression states', () => {
    const { navigation } = squareReference()
    const progression = {
      progressionMode: 'unordered' as const,
      objectives: [
        { id: 'a', required: true, dependencies: [], regionId: 'node-0-1' },
        { id: 'b', required: true, dependencies: [], regionId: 'node-1-0' },
      ],
      exitDependencies: [],
    }
    const result = analyzeProgressionRoutes(
      navigation,
      progression,
      { kind: 'required-objectives', objectiveIds: ['a', 'b'] },
    )

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.legalOrderResults.map(({ objectiveOrder }) => objectiveOrder.join('')))
      .toEqual(['ab', 'ba'])
  })

  it('respects validated door dependencies when deriving shortest completion routes', () => {
    const topology: IntendedTopology = {
      mode: 'maze',
      seed: 'progression-door-route-reference',
      nodes: [0, 1, 2].map((column) => ({
        id: `node-0-${column}`,
        row: 0,
        column,
        kind: 'corridor' as const,
        region: 'branching' as const,
      })),
      edges: [
        ['node-0-0', 'node-0-1'],
        ['node-0-1', 'node-0-2'],
      ].map(([from, to]) => ({
        id: `edge-${from}-${to}`,
        from,
        to,
        kind: 'corridor' as const,
      })),
    }
    const geometry: MazeGeometry = {
      schemaVersion: '1',
      levelId: 'progression-door-route-reference',
      boundsWidthMeters: 30,
      boundsDepthMeters: 10,
      walls: [],
      chambers: [],
      portals: [{
        id: 'goal-door',
        kind: 'portal',
        type: 'subgoal-dependent',
        position: { x: 20, y: 5 },
        widthMeters: 1,
        connectedRegionIds: ['node-0-1', 'node-0-2'],
        dependencies: ['goal'],
      }],
      entrance: {
        id: 'entrance',
        kind: 'entrance',
        position: { x: 5, y: 5 },
        connectedRegionId: 'node-0-0',
      },
      exit: {
        id: 'exit',
        kind: 'exit',
        position: { x: 25, y: 5 },
        connectedRegionId: 'node-0-2',
      },
    }
    const navigation = validatePhysicalCandidate(topology, geometry, 1).validatedNavigation
    if (!navigation) throw new Error('The physical door route reference must validate.')

    expect(analyzeProgressionRoutes(
      navigation,
      {
        progressionMode: 'unordered',
        objectives: [{
          id: 'goal',
          required: true,
          dependencies: [],
          regionId: 'node-0-1',
        }],
        exitDependencies: ['goal'],
      },
      {
        kind: 'wall-passage',
        connectionId: 'edge-node-0-1-node-0-2-passage-1',
      },
    )).toMatchObject({
      status: 'complete',
      classification: 'late',
      legalOrderResults: [{ objectiveOrder: ['goal'] }],
    })
  })

  it('measures a clearance-valid detour around physical wall thickness', () => {
    const topology: IntendedTopology = {
      mode: 'maze',
      seed: 'physical-route-detour-reference',
      nodes: [0, 1].map((column) => ({
        id: `node-0-${column}`,
        row: 0,
        column,
        kind: 'corridor' as const,
        region: 'branching' as const,
      })),
      edges: [{
        id: 'edge-node-0-0-node-0-1',
        from: 'node-0-0',
        to: 'node-0-1',
        kind: 'corridor',
      }],
    }
    const geometry: MazeGeometry = {
      schemaVersion: '1',
      levelId: 'physical-route-detour-reference',
      boundsWidthMeters: 20,
      boundsDepthMeters: 10,
      walls: [{
        id: 'interior-detour',
        kind: 'straight',
        start: { x: 3, y: 2 },
        end: { x: 3, y: 8 },
        thicknessMeters: 1,
      }],
      chambers: [],
      portals: [],
      entrance: {
        id: 'entrance',
        kind: 'entrance',
        position: { x: 1, y: 5 },
        connectedRegionId: 'node-0-0',
      },
      exit: {
        id: 'exit',
        kind: 'exit',
        position: { x: 19, y: 5 },
        connectedRegionId: 'node-0-1',
      },
    }
    const navigation = validatePhysicalCandidate(topology, geometry, 1).validatedNavigation
    if (!navigation) throw new Error('The physical detour reference must validate.')
    const result = analyzeProgressionRoutes(
      navigation,
      { progressionMode: 'unordered', objectives: [], exitDependencies: [] },
      { kind: 'wall-passage', connectionId: 'edge-node-0-0-node-0-1-passage-1' },
    )

    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.legalOrderResults[0].shortestDistanceMeters).toBeGreaterThan(18)
  })

  it('rejects a caller-supplied graph instead of treating it as validated physical evidence', () => {
    const result = Reflect.apply(
      analyzeProgressionRoutes,
      undefined,
      [
        { startStateId: 'fake' },
        {
          progressionMode: 'unordered',
          objectives: [],
          exitDependencies: [],
        },
        { kind: 'wall-passage', connectionId: 'fake-passage' },
      ],
    )

    expect(result).toMatchObject({ status: 'invalid', reason: 'unvalidated-navigation' })
  })
})
