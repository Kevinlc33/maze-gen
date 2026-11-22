import type { TopologyMode } from '../domain/types'
import { deriveCandidateSeed } from '../config/seed'

export { TOPOLOGY_GENERATOR_ALGORITHM_VERSION } from '../algorithmVersions'

export interface TopologyNode {
  id: string
  row: number
  column: number
  kind: 'corridor' | 'chamber'
  region: 'branching' | 'unicursal'
}

export interface TopologyEdge {
  id: string
  from: string
  to: string
  kind: 'corridor' | 'unicursal'
}

export interface IntendedTopology {
  mode: TopologyMode
  seed: string
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export interface TopologyRequest {
  rows: number
  columns: number
  mode: TopologyMode
  seed: string
  candidateIndex?: number
  loopChance?: number
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed)
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function nodeId(row: number, column: number): string {
  return `node-${row}-${column}`
}

function gridNeighbors(row: number, column: number, rows: number, columns: number, minimumRow = 0) {
  return [
    { row: row - 1, column },
    { row: row + 1, column },
    { row, column: column - 1 },
    { row, column: column + 1 },
  ].filter(
    (neighbor) =>
      neighbor.row >= 0
      && neighbor.row >= minimumRow
      && neighbor.row < rows
      && neighbor.column >= 0
      && neighbor.column < columns,
  )
}

function addEdge(
  edges: TopologyEdge[],
  from: string,
  to: string,
  kind: TopologyEdge['kind'],
): void {
  const [first, second] = [from, to].sort()
  if (!edges.some((edge) => edge.from === first && edge.to === second)) {
    edges.push({
      id: `edge-${first}-${second}`,
      from: first,
      to: second,
      kind,
    })
  }
}

function addSpanningTree(
  edges: TopologyEdge[],
  startRow: number,
  rows: number,
  columns: number,
  kind: TopologyEdge['kind'],
  random: () => number,
  minimumRow = 0,
): void {
  const visited = new Set<string>()
  const start = nodeId(startRow, 0)
  visited.add(start)
  const stack = [{ row: startRow, column: 0 }]

  while (stack.length > 0) {
    const current = stack[stack.length - 1]
    const unvisited = gridNeighbors(current.row, current.column, rows, columns, minimumRow)
      .filter((neighbor) => !visited.has(nodeId(neighbor.row, neighbor.column)))
    for (let index = unvisited.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1))
      ;[unvisited[index], unvisited[swapIndex]] = [unvisited[swapIndex], unvisited[index]]
    }

    if (unvisited.length === 0) {
      stack.pop()
      continue
    }

    const next = unvisited[0]
    addEdge(edges, nodeId(current.row, current.column), nodeId(next.row, next.column), kind)
    visited.add(nodeId(next.row, next.column))
    stack.push(next)
  }
}

function addOptionalLoops(
  edges: TopologyEdge[],
  rows: number,
  columns: number,
  chance: number,
  random: () => number,
): void {
  const existing = new Set(edges.map((edge) => `${edge.from}|${edge.to}`))
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (const neighbor of [
        { row, column: column + 1 },
        { row: row + 1, column },
      ]) {
        if (neighbor.row >= rows || neighbor.column >= columns) continue
        const [from, to] = [nodeId(row, column), nodeId(neighbor.row, neighbor.column)].sort()
        if (!existing.has(`${from}|${to}`) && random() < chance) {
          addEdge(edges, from, to, 'corridor')
          existing.add(`${from}|${to}`)
        }
      }
    }
  }
}

export function generateIntendedTopology(request: TopologyRequest): IntendedTopology {
  const rows = Math.max(1, Math.floor(request.rows))
  const columns = Math.max(1, Math.floor(request.columns))
  const seed = deriveCandidateSeed(request.seed, request.candidateIndex ?? 0)
  const random = seededRandom(seed)
  const nodes: TopologyNode[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      nodes.push({
        id: nodeId(row, column),
        row,
        column,
        kind: 'corridor',
        region: request.mode === 'hybrid' && row === 0 ? 'unicursal' : 'branching',
      })
    }
  }

  const edges: TopologyEdge[] = []
  if (request.mode === 'labyrinth') {
    const sequence: TopologyNode[] = []
    for (let row = 0; row < rows; row += 1) {
      const columnsInTraversal = Array.from({ length: columns }, (_, index) => index)
      if (row % 2 === 1) columnsInTraversal.reverse()
      sequence.push(
        ...columnsInTraversal.map((column) => nodes[row * columns + column]),
      )
    }
    for (let index = 0; index < sequence.length - 1; index += 1) {
      edges.push({
        id: `edge-${sequence[index].id}-${sequence[index + 1].id}`,
        from: sequence[index].id,
        to: sequence[index + 1].id,
        kind: 'unicursal',
      })
    }
  } else if (request.mode === 'hybrid' && rows > 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      addEdge(edges, nodeId(0, column), nodeId(0, column + 1), 'unicursal')
    }
    addSpanningTree(edges, 1, rows, columns, 'corridor', random, 1)
    addEdge(edges, nodeId(0, 0), nodeId(1, 0), 'corridor')
  } else {
    addSpanningTree(edges, 0, rows, columns, 'corridor', random)
    addOptionalLoops(edges, rows, columns, request.loopChance ?? 0, random)
  }

  return { mode: request.mode, seed, nodes, edges }
}
