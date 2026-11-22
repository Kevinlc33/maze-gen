import type { ConfigurationSnapshot } from '../config/configurationStore'
import { deriveCandidateId, deriveCandidateSeed } from '../config/seed'
import type { ChamberAssignment } from '../geometry/orthogonalConstruction'
import { constructOrthogonalGeometry } from '../geometry/orthogonalConstruction'
import type { MazeGeometry } from '../geometry/models'
import { generateIntendedTopology, type IntendedTopology } from '../topology/generator'
import type { WorkerProgress } from '../workers/jobScheduler'
import { CANDIDATE_GENERATOR_ALGORITHM_VERSION } from '../algorithmVersions'

export interface CandidateBuildPayload {
  configuration: ConfigurationSnapshot
  candidateIndex: number
  rows: number
  columns: number
  totalCandidates: number
}

export interface CandidateBuildResult {
  candidateIndex: number
  seed: string
  algorithmVersion: string
  topology: IntendedTopology
  geometry: MazeGeometry | null
  issues: readonly string[]
}

export type CandidateProgressReporter = (progress: WorkerProgress) => void

export { CANDIDATE_GENERATOR_ALGORITHM_VERSION } from '../algorithmVersions'

function chamberAssignments(
  configuration: ConfigurationSnapshot,
  topology: IntendedTopology,
): ChamberAssignment[] {
  const enabled = configuration.chambers.filter((chamber) => chamber.enabled)
  const assignments: ChamberAssignment[] = []
  const usedNodes = new Set<string>()
  for (let index = 0; index < enabled.length; index += 1) {
    const chamber = enabled[index]
    const preferredIndex = chamber.type === 'final-goal'
      ? topology.nodes.length - 1
      : chamber.type === 'subgoal'
        ? Math.floor(topology.nodes.length / 2)
        : index
    let nodeIndex = preferredIndex
    while (
      nodeIndex < topology.nodes.length
      && usedNodes.has(topology.nodes[nodeIndex]?.id ?? '')
    ) {
      nodeIndex += 1
    }
    if (nodeIndex >= topology.nodes.length) {
      throw new Error(`Enabled chamber "${chamber.id}" cannot be assigned to a topology cell.`)
    }
    const node = topology.nodes[nodeIndex]
    if (!node) {
      throw new Error(`Enabled chamber "${chamber.id}" references a missing topology cell.`)
    }
    usedNodes.add(node.id)
    assignments.push({
      config: { ...chamber },
      nodeId: node.id,
    })
  }
  return assignments
}

export function buildCandidate(
  payload: CandidateBuildPayload,
  reportProgress: CandidateProgressReporter,
): CandidateBuildResult {
  const { config } = payload.configuration
  reportProgress({
    stage: 'candidate-generation',
    completedCandidates: 0,
    totalCandidates: payload.totalCandidates,
    completedWork: null,
    totalWork: null,
  })
  const topology = generateIntendedTopology({
    rows: payload.rows,
    columns: payload.columns,
    mode: config.topology,
    seed: config.seed,
    candidateIndex: payload.candidateIndex,
  })
  const seed = deriveCandidateSeed(config.seed, payload.candidateIndex)
  const candidateId = deriveCandidateId(
    payload.configuration,
    payload.candidateIndex,
    CANDIDATE_GENERATOR_ALGORITHM_VERSION,
  )
  reportProgress({
    stage: 'physical-construction',
    completedCandidates: 0,
    totalCandidates: payload.totalCandidates,
    completedWork: null,
    totalWork: null,
  })
  const construction = constructOrthogonalGeometry(topology, config, {
    chambers: chamberAssignments(payload.configuration, topology),
  })
  const geometry = construction.geometry
    ? { ...construction.geometry, levelId: candidateId }
    : null
  return {
    candidateIndex: payload.candidateIndex,
    seed,
    algorithmVersion: CANDIDATE_GENERATOR_ALGORITHM_VERSION,
    topology,
    geometry,
    issues: construction.issues.map(({ message }) => message),
  }
}
