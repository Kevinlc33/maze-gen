import type { CandidateMetadata, MazeConfig } from '../domain/types'
import type { ConfigurationSnapshot } from '../config/configurationStore'
import { deriveCandidateId, deriveCandidateSeed } from '../config/seed'
import { validateChambers, validateMazeConfig } from '../config/validation'
import type { MazeGeometry } from '../geometry/models'
import {
  validatePhysicalCandidate,
  type ValidatedNavigationArtifact,
} from '../navigation/physicalNavigation'
import type { IntendedTopology } from '../topology/generator'
import {
  verifySolvability,
  type SolvabilityResult,
} from '../verification/finiteStateVerifier'
import {
  StaleWorkerJobError,
  WorkerExecutionError,
  WorkerJobScheduler,
  type WorkerPort,
  type WorkerProgress,
} from '../workers/jobScheduler'
import {
  type CandidateBuildPayload,
  type CandidateBuildResult,
} from './candidateWorker'
import { CANDIDATE_GENERATOR_ALGORITHM_VERSION } from '../algorithmVersions'

const TOPOLOGY_ROWS = 4
const TOPOLOGY_COLUMNS = 4
const EMPTY_PROGRESSION = {
  progressionMode: 'unordered' as const,
  objectives: [],
  exitDependencies: [],
}

export interface VerifiedCandidate {
  metadata: CandidateMetadata
  geometry: MazeGeometry
  topology: IntendedTopology
  navigation: ValidatedNavigationArtifact
  verification: Extract<SolvabilityResult, { status: 'solvable' }>
}

export type CandidatePipelineOutcome =
  | {
    status: 'complete'
    candidate: VerifiedCandidate
    configuration: ConfigurationSnapshot
    jobRevision: number
  }
  | {
    status: 'incomplete'
    reason: 'cancelled' | 'superseded' | 'resource-exhausted'
    message?: string
    jobRevision: number
  }
  | {
    status: 'failed'
    message: string
    jobRevision: number
  }

export interface CandidatePipelineOptions {
  createWorker: () => WorkerPort<CandidateBuildPayload, CandidateBuildResult>
  maximumWorkers: number
  candidateCount?: number
  onStart?: () => void
  onProgress?: (progress: CandidatePipelineProgress) => void
  onPublish: (candidate: VerifiedCandidate, configuration: ConfigurationSnapshot) => void
  onIncomplete: (message: string) => void
  onCancel?: () => void
  onFailure?: (message: string) => void
}

export interface CandidatePipelineProgress extends WorkerProgress {
  jobRevision: number
}

interface ActiveRun {
  revision: number
  terminalReason: 'cancelled' | 'superseded' | 'failed' | null
}

type IncompleteReason = Extract<
  CandidatePipelineOutcome,
  { status: 'incomplete' }
>['reason']

function candidateCountFor(config: MazeConfig): number {
  if (config.strategy === 'generate-once') return 1
  if (config.effort === 'fast') return 3
  if (config.effort === 'thorough') return 16
  return 8
}

function snapshotConfiguration(snapshot: ConfigurationSnapshot): ConfigurationSnapshot {
  return Object.freeze({
    config: Object.freeze({ ...snapshot.config }),
    chambers: Object.freeze(snapshot.chambers.map((chamber) => Object.freeze({ ...chamber }))),
    wallPlacementPreference: snapshot.wallPlacementPreference,
    editRevision: snapshot.editRevision,
  })
}

function invalidConfigurationMessage(snapshot: ConfigurationSnapshot): string | null {
  const issues = [
    ...validateMazeConfig(snapshot.config),
    ...validateChambers(snapshot.chambers.map((chamber) => ({ ...chamber }))),
  ]
  if (
    snapshot.config.topology !== 'maze'
    && snapshot.config.topology !== 'labyrinth'
    && snapshot.config.topology !== 'hybrid'
  ) {
    issues.push({ field: 'topology', message: 'A supported topology mode is required.' })
  }
  if (snapshot.config.units !== 'meters' && snapshot.config.units !== 'feet') {
    issues.push({ field: 'units', message: 'A supported unit system is required.' })
  }
  if (
    snapshot.config.strategy !== 'generate-once'
    && snapshot.config.strategy !== 'optimize-preferences'
  ) {
    issues.push({ field: 'strategy', message: 'A supported generation strategy is required.' })
  }
  if (
    snapshot.config.effort !== 'fast'
    && snapshot.config.effort !== 'balanced'
    && snapshot.config.effort !== 'thorough'
  ) {
    issues.push({ field: 'effort', message: 'A supported optimization effort is required.' })
  }
  if (snapshot.config.geometry !== 'orthogonal') {
    issues.push({
      field: 'geometry',
      message: `The ${snapshot.config.geometry} geometry generator is not implemented.`,
    })
  }
  if (
    snapshot.wallPlacementPreference !== 'automatic'
    && snapshot.wallPlacementPreference !== 'early'
    && snapshot.wallPlacementPreference !== 'middle'
    && snapshot.wallPlacementPreference !== 'late'
  ) {
    issues.push({
      field: 'wall-placement-preference',
      message: 'A supported wall placement preference is required.',
    })
  }
  if (!Number.isSafeInteger(snapshot.editRevision) || snapshot.editRevision < 0) {
    issues.push({
      field: 'configuration-revision',
      message: 'Configuration edit revision must be a non-negative safe integer.',
    })
  }
  const chamberIds = new Set<string>()
  for (const chamber of snapshot.chambers) {
    if (!chamber.id.trim() || chamberIds.has(chamber.id)) {
      issues.push({
        field: 'chambers',
        message: 'Enabled and disabled chamber identifiers must be non-empty and unique.',
      })
      break
    }
    chamberIds.add(chamber.id)
  }
  return issues.length > 0
    ? issues.map(({ message }) => message).join(' ')
    : null
}

function incompleteOutcome(
  reason: IncompleteReason,
  jobRevision: number,
  message?: string,
): CandidatePipelineOutcome {
  return {
    status: 'incomplete',
    reason,
    ...(message ? { message } : {}),
    jobRevision,
  }
}

function cloneGeometry(geometry: MazeGeometry): MazeGeometry {
  return {
    ...geometry,
    entrance: { ...geometry.entrance, position: { ...geometry.entrance.position } },
    exit: { ...geometry.exit, position: { ...geometry.exit.position } },
    walls: geometry.walls.map((wall) =>
      wall.kind === 'straight'
        ? { ...wall, start: { ...wall.start }, end: { ...wall.end } }
        : { ...wall, center: { ...wall.center } },
    ),
    chambers: geometry.chambers.map((chamber) => ({
      ...chamber,
      points: chamber.points.map((point) => ({ ...point })),
    })),
    portals: geometry.portals.map((portal) => ({
      ...portal,
      position: { ...portal.position },
      connectedRegionIds: [...portal.connectedRegionIds],
      dependencies: [...portal.dependencies],
    })),
  }
}

export function createCandidatePipeline(options: CandidatePipelineOptions) {
  const scheduler = new WorkerJobScheduler(
    options.createWorker,
    options.maximumWorkers,
  )
  const configuredCandidateCount = options.candidateCount
  if (
    configuredCandidateCount !== undefined
    && (!Number.isSafeInteger(configuredCandidateCount) || configuredCandidateCount < 1)
  ) {
    throw new RangeError('Candidate count must be a positive safe integer.')
  }
  let activeRun: ActiveRun | null = null
  let hasSubmitted = false
  let disposed = false

  const resourceExhausted = (run: ActiveRun, message: string): CandidatePipelineOutcome => {
    options.onIncomplete(message)
    return incompleteOutcome('resource-exhausted', run.revision, message)
  }

  const report = (progress: WorkerProgress, jobRevision: number) => {
    options.onProgress?.({ ...progress, jobRevision })
  }

  async function execute(
    configuration: ConfigurationSnapshot,
    run: ActiveRun,
    totalCandidates: number,
  ): Promise<CandidatePipelineOutcome> {
    try {
      report({
        stage: 'candidate-generation',
        completedCandidates: 0,
        totalCandidates,
        completedWork: null,
        totalWork: null,
      }, run.revision)
      const completedBuilds = { count: 0 }
      const requests = Array.from({ length: totalCandidates }, (_, candidateIndex) => ({
        configuration,
        candidateIndex,
        rows: TOPOLOGY_ROWS,
        columns: TOPOLOGY_COLUMNS,
        totalCandidates,
      }))
      const built = await Promise.all(requests.map((payload) =>
        scheduler.submit(payload, (progress) => {
          report({
            ...progress,
            completedCandidates: completedBuilds.count,
            totalCandidates,
          }, run.revision)
        }).then((outcome) => {
          completedBuilds.count += 1
          report({
            stage: 'topology-screening',
            completedCandidates: completedBuilds.count,
            totalCandidates,
            completedWork: null,
            totalWork: null,
          }, run.revision)
          return outcome
        }),
      ))

      if (run.terminalReason === 'cancelled' || run.terminalReason === 'superseded') {
        return incompleteOutcome(run.terminalReason, run.revision)
      }

      const rejectionReasons: string[] = []
      for (let index = 0; index < built.length; index += 1) {
        const outcome = built[index]
        if (outcome.status === 'incomplete') {
          return resourceExhausted(
            run,
            outcome.message ?? 'Candidate construction exhausted its available resources.',
          )
        }
        const result = outcome.result
        report({
          stage: 'geometry-validation',
          completedCandidates: index,
          totalCandidates,
          completedWork: null,
          totalWork: null,
        }, run.revision)
        if (
          result.candidateIndex !== index
          || result.seed !== deriveCandidateSeed(configuration.config.seed, index)
          || result.algorithmVersion !== CANDIDATE_GENERATOR_ALGORITHM_VERSION
          || result.topology.seed !== result.seed
          || !result.geometry
          || result.geometry.levelId !== deriveCandidateId(
            configuration,
            index,
            CANDIDATE_GENERATOR_ALGORITHM_VERSION,
          )
        ) {
          rejectionReasons.push(result.issues[0] ?? `Candidate ${index} returned inconsistent identity or geometry data.`)
          continue
        }

        const geometry = cloneGeometry(result.geometry)
        const physical = validatePhysicalCandidate(
          result.topology,
          geometry,
          configuration.config.minimumPassageWidthMeters,
        )
        if (physical.status === 'incomplete') {
          return resourceExhausted(
            run,
            'Physical navigation reconstruction exhausted its resource limit.',
          )
        }
        if (physical.status !== 'valid' || !physical.validatedNavigation) {
          rejectionReasons.push(
            physical.connectivityMismatches[0]?.message
            ?? physical.navigation.issues[0]?.message
            ?? `Candidate ${index} failed physical navigation validation.`,
          )
          continue
        }

        report({
          stage: 'solvability-verification',
          completedCandidates: index,
          totalCandidates,
          completedWork: null,
          totalWork: null,
        }, run.revision)
        const verification = verifySolvability(
          physical.validatedNavigation,
          EMPTY_PROGRESSION,
        )
        if (verification.status === 'verification-incomplete') {
          return resourceExhausted(run, 'Formal solvability verification did not complete.')
        }
        if (verification.status !== 'solvable') {
          rejectionReasons.push(
            verification.status === 'unsolvable'
              ? `Candidate ${index} was exhaustively verified as unsolvable.`
              : `Candidate ${index} could not be formally verified.`,
          )
          continue
        }

        const candidate: VerifiedCandidate = {
          metadata: {
            id: geometry.levelId,
            algorithmVersion: result.algorithmVersion,
            seed: result.seed,
            verificationStatus: 'solvable',
            fullyVerified: true,
          },
          geometry,
          topology: result.topology,
          navigation: physical.validatedNavigation,
          verification,
        }
        report({
          stage: 'final-rendering',
          completedCandidates: index + 1,
          totalCandidates,
          completedWork: 1,
          totalWork: 1,
        }, run.revision)
        options.onPublish(candidate, configuration)
        return {
          status: 'complete',
          candidate,
          configuration,
          jobRevision: run.revision,
        }
      }

      const reason = rejectionReasons.find((entry) => entry.length > 0)
      const message = reason
        ? `No candidate passed physical navigation validation and formal solvability verification. ${reason}`
        : 'No candidate passed physical navigation validation and formal solvability verification.'
      options.onFailure?.(message)
      return { status: 'failed', message, jobRevision: run.revision }
    } catch (error) {
      if (run.terminalReason === 'cancelled' || run.terminalReason === 'superseded') {
        return incompleteOutcome(run.terminalReason, run.revision)
      }
      run.terminalReason = 'failed'
      if (!disposed) scheduler.advanceRevision()
      const message = error instanceof Error ? error.message : 'Candidate generation failed.'
      options.onFailure?.(message)
      if (!(error instanceof WorkerExecutionError) && !(error instanceof StaleWorkerJobError)) {
        throw error
      }
      return { status: 'failed', message, jobRevision: run.revision }
    } finally {
      if (activeRun === run) activeRun = null
    }
  }

  return {
    generate(submittedConfiguration: ConfigurationSnapshot): Promise<CandidatePipelineOutcome> {
      if (disposed) throw new Error('Candidate pipeline has been disposed.')
      if (activeRun) {
        activeRun.terminalReason = 'superseded'
        scheduler.advanceRevision()
        activeRun = null
      } else if (hasSubmitted) {
        scheduler.advanceRevision()
      }
      hasSubmitted = true
      const configuration = snapshotConfiguration(submittedConfiguration)
      const validationMessage = invalidConfigurationMessage(configuration)
      if (validationMessage) {
        options.onFailure?.(validationMessage)
        return Promise.resolve({
          status: 'failed',
          message: validationMessage,
          jobRevision: scheduler.currentRevision,
        })
      }

      const run: ActiveRun = {
        revision: scheduler.currentRevision,
        terminalReason: null,
      }
      activeRun = run
      const totalCandidates = configuredCandidateCount ?? candidateCountFor(configuration.config)
      options.onStart?.()
      return execute(configuration, run, totalCandidates)
    },
    cancel(): boolean {
      if (!activeRun || disposed) return false
      activeRun.terminalReason = 'cancelled'
      activeRun = null
      scheduler.advanceRevision()
      options.onCancel?.()
      return true
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      if (activeRun) activeRun.terminalReason = 'cancelled'
      activeRun = null
      scheduler.dispose()
    },
  }
}
