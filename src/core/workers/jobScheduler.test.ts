import { describe, expect, it } from 'vitest'
import {
  StaleWorkerJobError,
  WorkerJobScheduler,
  type WorkerPort,
  type WorkerProgress,
  type WorkerRequest,
  type WorkerResponse,
} from './jobScheduler'

class FakeWorker implements WorkerPort<string, string> {
  onmessage: ((event: { data: WorkerResponse<string> }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  readonly requests: WorkerRequest<string>[] = []
  terminated = false

  postMessage(message: WorkerRequest<string>): void {
    this.requests.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  complete(request: WorkerRequest<string>, result: string): void {
    this.onmessage?.({
      data: {
        type: 'complete',
        jobId: request.jobId,
        revision: request.revision,
        result,
      },
    })
  }

  reportProgress(request: WorkerRequest<string>, progress: WorkerProgress): void {
    this.onmessage?.({
      data: {
        type: 'progress',
        jobId: request.jobId,
        revision: request.revision,
        progress,
      },
    })
  }

  exhaustResources(request: WorkerRequest<string>, message: string): void {
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

describe('worker job scheduler', () => {
  it('uses stable job identities and keeps execution within the worker limit', async () => {
    const workers: FakeWorker[] = []
    const scheduler = new WorkerJobScheduler<string, string>(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    }, 1)

    const first = scheduler.submit('first')
    const second = scheduler.submit('second')
    expect(workers[0].requests).toHaveLength(1)
    expect(workers[0].requests[0].jobId).toBe('job-0-1')

    workers[0].complete(workers[0].requests[0], 'first-result')
    await expect(first).resolves.toMatchObject({ result: 'first-result', revision: 0 })
    expect(workers[0].requests).toHaveLength(2)
    expect(workers[0].requests[1].jobId).toBe('job-0-2')

    workers[0].complete(workers[0].requests[1], 'second-result')
    await expect(second).resolves.toMatchObject({ result: 'second-result', revision: 0 })
    scheduler.dispose()
  })

  it('forwards candidate and final-render progress for the active revision', async () => {
    const workers: FakeWorker[] = []
    const scheduler = new WorkerJobScheduler<string, string>(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    }, 1)
    const updates: WorkerProgress[] = []
    const result = scheduler.submit('with progress', (progress) => updates.push(progress))
    const request = workers[0].requests[0]
    const progress: WorkerProgress = {
      stage: 'final-rendering',
      completedCandidates: 3,
      totalCandidates: 3,
      completedWork: 1,
      totalWork: 2,
    }

    workers[0].reportProgress(request, progress)
    expect(updates).toEqual([progress])
    workers[0].complete(request, 'rendered')
    await expect(result).resolves.toMatchObject({ result: 'rendered' })
    scheduler.dispose()
  })

  it('returns an incomplete outcome for cancelled verification and ignores late completion', async () => {
    const workers: FakeWorker[] = []
    const scheduler = new WorkerJobScheduler<string, string>(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    }, 1)
    const result = scheduler.submit('cancel me')
    const request = workers[0].requests[0]

    expect(scheduler.cancel(request.jobId)).toBe(true)
    await expect(result).resolves.toMatchObject({
      status: 'incomplete',
      reason: 'cancelled',
    })
    expect(workers[0].terminated).toBe(true)
    workers[0].complete(request, 'solvable')
    const next = scheduler.submit('next')
    expect(workers[1].requests[0].payload).toBe('next')
    workers[1].complete(workers[1].requests[0], 'solvable')
    await expect(next).resolves.toMatchObject({ status: 'complete', result: 'solvable' })
    scheduler.dispose()
  })

  it('reports resource exhaustion as incomplete rather than execution failure', async () => {
    const workers: FakeWorker[] = []
    const scheduler = new WorkerJobScheduler<string, string>(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    }, 1)
    const result = scheduler.submit('resource-bound verification')
    workers[0].exhaustResources(workers[0].requests[0], 'Verification state limit reached.')

    await expect(result).resolves.toMatchObject({
      status: 'incomplete',
      reason: 'resource-exhausted',
      message: 'Verification state limit reached.',
    })
    scheduler.dispose()
  })

  it('advances revisions and rejects stale completion without publishing it', async () => {
    const workers: FakeWorker[] = []
    const scheduler = new WorkerJobScheduler<string, string>(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    }, 1)
    const stale = scheduler.submit('old revision')
    const oldRequest = workers[0].requests[0]
    const rejection = expect(stale).rejects.toBeInstanceOf(StaleWorkerJobError)

    expect(scheduler.advanceRevision()).toBe(1)
    await rejection
    workers[0].complete(oldRequest, 'stale result')

    const current = scheduler.submit('current revision')
    expect(workers[1].requests[0]).toMatchObject({
      jobId: 'job-1-2',
      revision: 1,
    })
    workers[1].complete(workers[1].requests[0], 'current result')
    await expect(current).resolves.toMatchObject({ result: 'current result', revision: 1 })
    scheduler.dispose()
  })
})
