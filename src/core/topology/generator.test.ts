import { describe, expect, it } from 'vitest'
import { generateIntendedTopology, type IntendedTopology } from './generator'

function isConnected(topology: IntendedTopology): boolean {
  const adjacent = new Map(topology.nodes.map((node) => [node.id, new Set<string>()]))
  for (const edge of topology.edges) {
    adjacent.get(edge.from)?.add(edge.to)
    adjacent.get(edge.to)?.add(edge.from)
  }
  const visited = new Set<string>()
  const pending = [topology.nodes[0]?.id]
  while (pending.length > 0) {
    const nodeId = pending.pop()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)
    for (const neighbor of adjacent.get(nodeId) ?? []) pending.push(neighbor)
  }
  return visited.size === topology.nodes.length
}

function nodePosition(topology: IntendedTopology, id: string) {
  return topology.nodes.find((node) => node.id === id)
}

describe('intended orthogonal topology', () => {
  it('reproduces identical topology for identical parameters', () => {
    const request = { rows: 6, columns: 8, mode: 'maze' as const, seed: 'repeatable', candidateIndex: 3 }
    expect(generateIntendedTopology(request)).toEqual(generateIntendedTopology(request))
  })

  it('creates a continuous orthogonally adjacent unicursal sequence', () => {
    const topology = generateIntendedTopology({
      rows: 4,
      columns: 4,
      mode: 'labyrinth',
      seed: 'lab',
    })
    expect(topology.edges).toHaveLength(topology.nodes.length - 1)
    expect(isConnected(topology)).toBe(true)
    for (const edge of topology.edges) {
      const from = nodePosition(topology, edge.from)
      const to = nodePosition(topology, edge.to)
      expect(from).toBeDefined()
      expect(to).toBeDefined()
      expect(Math.abs(from!.row - to!.row) + Math.abs(from!.column - to!.column)).toBe(1)
    }
    const degrees = new Map<string, number>()
    for (const edge of topology.edges) {
      degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1)
      degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1)
    }
    expect([...degrees.values()].every((degree) => degree <= 2)).toBe(true)
  })

  it('generates connected maze and hybrid graphs', () => {
    for (const mode of ['maze', 'hybrid'] as const) {
      const topology = generateIntendedTopology({
        rows: 5,
        columns: 5,
        mode,
        seed: 'connected',
      })
      expect(isConnected(topology)).toBe(true)
      expect(topology.nodes).toHaveLength(25)
    }
  })

  it('creates both unicursal and branching regions in hybrid mode', () => {
    const topology = generateIntendedTopology({
      rows: 5,
      columns: 5,
      mode: 'hybrid',
      seed: 'hybrid',
    })
    expect(topology.mode).toBe('hybrid')
    expect(topology.nodes.filter((node) => node.region === 'unicursal')).toHaveLength(5)
    expect(topology.edges.some((edge) => edge.kind === 'unicursal')).toBe(true)
    expect(topology.nodes.some((node) => node.region === 'branching')).toBe(true)
  })

  it('adds only configured optional loops', () => {
    const tree = generateIntendedTopology({
      rows: 8,
      columns: 8,
      mode: 'maze',
      seed: 'loops',
      loopChance: 0,
    })
    const loopy = generateIntendedTopology({
      rows: 8,
      columns: 8,
      mode: 'maze',
      seed: 'loops',
      loopChance: 1,
    })
    expect(tree.edges).toHaveLength(tree.nodes.length - 1)
    expect(loopy.edges.length).toBeGreaterThan(tree.edges.length)
  })
})
