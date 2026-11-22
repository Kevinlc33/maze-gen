import { beforeEach, describe, expect, it } from 'vitest'
import type { ConfigurationSnapshot } from '../config/configurationStore'
import {
  DEFAULT_MAZE_CONFIG,
  DEFAULT_CHAMBERS,
} from '../config/defaults'
import type { MazeGeometry } from '../geometry/models'
import { useApplicationStore } from '../state/applicationStore'
import { useConfigurationStore } from '../config/configurationStore'
import type {
  WorkerPort,
  WorkerProgress,
  WorkerRequest,
  WorkerResponse,
} from '../workers/jobScheduler'
import {
  createCandidatePipeline,
} from './candidatePipeline'
import {
  buildCandidate,
  type CandidateBuildPayload,
  type CandidateBuildResult,
} from './candidateWorker'

class FakeCandidateWorker implements WorkerPort<CandidateBuildPayload, CandidateBuildResult> {
  onmessage: ((event: { data: WorkerResponse<CandidateBuildResult> }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  readonly requests: WorkerRequest<CandidateBuildPayload>[] = []
  terminated = false

  postMessage(message: WorkerRequest<CandidateBuildPayload>): void {
    this.requests.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  reportProgress(request: WorkerRequest<CandidateBuildPayload>, progress: WorkerProgress): void {
    this.onmessage?.({
      data: {
        type: 'progress',
        jobId: request.jobId,
        revision: request.revision,
        progress,
      },
    })
  }

  complete(
    request: WorkerRequest<CandidateBuildPayload>,
    result: CandidateBuildResult,
  ): void {
    this.onmessage?.({
      data: {
        type: 'complete',
        jobId: request.jobId,
        revision: request.revision,
        result,
      },
    })
  }

  exhaust(request: WorkerRequest<CandidateBuildPayload>, message: string): void {
    this.onmessage?.({
      data: {
        type: 'resource-exhausted',
        jobId: request.jobId,
        revision: request.revision,
        message,
      },
    })
  }
}

function builtCandidate(payload: CandidateBuildPayload): CandidateBuildResult {
  return buildCandidate(payload, () => undefined)
}

function makeHarness(candidateCount = 2) {
  const workers: FakeCandidateWorker[] = []
  const published: Array<{
    candidateId: string
    geometry: MazeGeometry
    configuration: ConfigurationSnapshot
  }> = []
  const progress: WorkerProgress[] = []
  const pipeline = createCandidatePipeline({
    createWorker: () => {
      const worker = new FakeCandidateWorker()
      workers.push(worker)
      return worker
    },
    maximumWorkers: 2,
    candidateCount,
    onStart: () => useApplicationStore.getState().startGeneration(),
    onProgress: (update) => {
      progress.push(update)
      useApplicationStore.getState().reportProgress(update)
    },
    onPublish: (candidate, configuration) => {
      published.push({
        candidateId: candidate.metadata.id,
        geometry: candidate.geometry,
        configuration,
      })
      useConfigurationStore.getState().setRenderedSnapshot(configuration)
      useApplicationStore.getState().completeGeneration(candidate)
    },
    onIncomplete: (message) => useApplicationStore.getState().incompleteGeneration(message),
    onCancel: () => useApplicationStore.getState().cancelGeneration(),
    onFailure: (message) => useApplicationStore.getState().failGeneration(message),
  })
  return { pipeline, workers, published, progress }
}

function completeRequest(worker: FakeCandidateWorker, index = 0): void {
  const request = worker.requests[index]
  if (!request) throw new Error(`Worker has no request at index ${index}.`)
  worker.complete(request, builtCandidate(request.payload))
}

beforeEach(() => {
  useConfigurationStore.setState({
    pending: { ...DEFAULT_MAZE_CONFIG },
    renderedSnapshot: null,
    editRevision: 0,
    chambers: DEFAULT_CHAMBERS.map((chamber) => ({ ...chamber })),
    wallPlacementPreference: 'automatic',
  })
  useApplicationStore.setState({
    jobStatus: 'idle',
    renderedDesignId: null,
    renderedCandidate: null,
    feedback: 'Ready',
    progress: null,
  })
})

describe('production candidate pipeline', () => {
  it('publishes the submitted snapshot without overwriting newer pending edits', async () => {
    const harness = makeHarness()
    const result = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    const firstRequest = harness.workers[0].requests[0]
    const secondRequest = harness.workers[1].requests[0]

    useConfigurationStore.getState().setPending({ widthMeters: 80 })
    harness.workers[1].complete(secondRequest, builtCandidate(secondRequest.payload))
    harness.workers[0].complete(firstRequest, builtCandidate(firstRequest.payload))

    const outcome = await result

    expect(outcome, outcome.status === 'failed' ? outcome.message : '').toMatchObject({
      status: 'complete',
    })
    expect(harness.published).toHaveLength(1)
    expect(harness.published[0].configuration.config.widthMeters).toBe(40)
    expect(harness.published[0].configuration.editRevision).toBe(0)
    expect(outcome.status === 'complete' ? outcome.jobRevision : -1).toBe(0)
    expect(useConfigurationStore.getState().editRevision).toBe(1)
    expect(useConfigurationStore.getState().pending.widthMeters).toBe(80)
    expect(useConfigurationStore.getState().renderedSnapshot?.config.widthMeters).toBe(40)
    expect(useApplicationStore.getState().renderedCandidate?.geometry)
      .toEqual(harness.published[0].geometry)
  })

  it('does not publish geometry with an unintended physical shortcut', async () => {
    const harness = makeHarness(1)
    const job = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    const worker = harness.workers[0]
    const request = worker.requests[0]
    const invalidCandidate = builtCandidate(request.payload)
    if (!invalidCandidate.geometry) throw new Error('Expected the reference candidate to construct.')
    invalidCandidate.geometry.walls = []
    worker.complete(request, invalidCandidate)

    const outcome = await job

    expect(outcome).toMatchObject({ status: 'failed' })
    expect(outcome.status === 'failed' ? outcome.message : '').toContain('unintended shortcut')
    expect(harness.published).toHaveLength(0)
    expect(useApplicationStore.getState().renderedDesignId).toBeNull()
  })

  it('supersedes older jobs and publishes only the newer request', async () => {
    const harness = makeHarness()
    const oldJob = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    const oldWorkers = harness.workers.slice(0, 2)
    const oldRequests = oldWorkers.map((worker) => worker.requests[0])

    useConfigurationStore.getState().setPending({ seed: 'new-seed' })
    const newJob = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    const oldOutcome = await oldJob
    const newWorkers = harness.workers.slice(2)

    expect(oldOutcome).toMatchObject({ status: 'incomplete', reason: 'superseded' })
    expect(oldRequests.every((request) => request.revision !== newWorkers[0].requests[0].revision))
      .toBe(true)
    oldWorkers.forEach((worker, index) => {
      worker.complete(oldRequests[index], builtCandidate(oldRequests[index].payload))
    })
    expect(harness.published).toHaveLength(0)
    completeRequest(newWorkers[1])
    completeRequest(newWorkers[0])
    const newOutcome = await newJob

    expect(newOutcome).toMatchObject({ status: 'complete' })
    expect(harness.published).toHaveLength(1)
    expect(harness.published[0].configuration.config.seed).toBe('new-seed')
    expect(harness.published[0].configuration.editRevision).toBe(1)
    expect(newOutcome.status === 'complete' ? newOutcome.jobRevision : -1).toBe(1)
  })

  it('does not let an invalid newer request leave an older job publishable', async () => {
    const harness = makeHarness()
    const oldJob = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    const oldWorkers = harness.workers.slice(0, 2)
    const oldRequests = oldWorkers.map((worker) => worker.requests[0])

    useConfigurationStore.getState().setPending({ geometry: 'mixed' })
    const invalidJob = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    const invalidOutcome = await invalidJob
    const oldOutcome = await oldJob
    oldWorkers.forEach((worker, index) => {
      worker.complete(oldRequests[index], builtCandidate(oldRequests[index].payload))
    })

    expect(invalidOutcome).toMatchObject({ status: 'failed' })
    expect(oldOutcome).toMatchObject({ status: 'incomplete', reason: 'superseded' })
    expect(harness.published).toHaveLength(0)
  })

  it('cancels late work without replacing the last completed design', async () => {
    const harness = makeHarness()
    const previousSnapshot = useConfigurationStore.getState().snapshotPending()
    useConfigurationStore.getState().setRenderedSnapshot(previousSnapshot)
    useConfigurationStore.getState().setPending({ widthMeters: 80 })
    useApplicationStore.setState({
      jobStatus: 'complete',
      renderedDesignId: 'previous-design',
      feedback: 'Generation complete',
    })
    const job = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    const lateRequests = harness.workers.slice(0, 2).map((worker) => worker.requests[0])

    expect(harness.pipeline.cancel()).toBe(true)
    const outcome = await job
    lateRequests.forEach((request, index) => {
      harness.workers[index].complete(request, builtCandidate(request.payload))
    })

    expect(outcome).toMatchObject({ status: 'incomplete', reason: 'cancelled' })
    expect(harness.published).toHaveLength(0)
    expect(useApplicationStore.getState().renderedDesignId).toBe('previous-design')
    expect(useConfigurationStore.getState().renderedSnapshot?.config.widthMeters).toBe(40)
    expect(useConfigurationStore.getState().pending.widthMeters).toBe(80)
  })

  it('surfaces resource exhaustion as incomplete instead of leaving the UI running', async () => {
    const harness = makeHarness()
    const job = harness.pipeline.generate(useConfigurationStore.getState().snapshotPending())
    harness.workers.forEach((worker) => {
      worker.exhaust(worker.requests[0], 'Candidate worker resource limit reached.')
    })

    const outcome = await job

    expect(outcome).toMatchObject({
      status: 'incomplete',
      reason: 'resource-exhausted',
    })
    expect(useApplicationStore.getState().jobStatus).toBe('incomplete')
    expect(useApplicationStore.getState().feedback).toContain('resource limit')
  })

  it('reports real worker progress and selects the same candidate under permuted completion orders', async () => {
    const harness = makeHarness()
    const snapshot = useConfigurationStore.getState().snapshotPending()
    const firstRun = harness.pipeline.generate(snapshot)
    const firstRequests = harness.workers.slice(0, 2).map((worker) => worker.requests[0])
    harness.workers[0].reportProgress(firstRequests[0], {
      stage: 'physical-construction',
      completedCandidates: 0,
      totalCandidates: 2,
      completedWork: null,
      totalWork: null,
    })
    harness.workers[1].complete(firstRequests[1], builtCandidate(firstRequests[1].payload))
    harness.workers[0].complete(firstRequests[0], builtCandidate(firstRequests[0].payload))
    const firstOutcome = await firstRun

    const secondRun = harness.pipeline.generate(snapshot)
    const secondWorkers = harness.workers.slice(0, 2)
    const secondRequests = secondWorkers.map((worker) => worker.requests[1])
    secondWorkers[0].complete(secondRequests[0], builtCandidate(secondRequests[0].payload))
    secondWorkers[1].complete(secondRequests[1], builtCandidate(secondRequests[1].payload))
    const secondOutcome = await secondRun

    const constructionProgress = harness.progress.find((update) =>
      update.stage === 'physical-construction',
    )
    expect(constructionProgress).toMatchObject({
      stage: 'physical-construction',
      jobRevision: 0,
      totalCandidates: 2,
    })
    expect(firstOutcome.status).toBe('complete')
    expect(secondOutcome.status).toBe('complete')
    if (firstOutcome.status !== 'complete' || secondOutcome.status !== 'complete') return
    expect(firstOutcome.candidate.metadata.id).toBe(secondOutcome.candidate.metadata.id)
    expect(firstOutcome.candidate.geometry).toEqual(secondOutcome.candidate.geometry)
  })

  it('derives candidate identity from configuration, stable index, and generator version', () => {
    const configuration = useConfigurationStore.getState().snapshotPending()
    const payload: CandidateBuildPayload = {
      configuration,
      candidateIndex: 0,
      rows: 4,
      columns: 4,
      totalCandidates: 1,
    }
    const first = builtCandidate(payload)
    const repeated = builtCandidate(payload)
    const changedConfiguration = builtCandidate({
      ...payload,
      configuration: {
        ...configuration,
        config: { ...configuration.config, widthMeters: 60 },
      },
    })

    expect(first.geometry?.levelId).toBe(repeated.geometry?.levelId)
    expect(changedConfiguration.geometry?.levelId).not.toBe(first.geometry?.levelId)
    expect(first.algorithmVersion).toBe(changedConfiguration.algorithmVersion)
  })
})
