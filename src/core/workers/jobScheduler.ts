export type WorkerRequest<TPayload> = {
  type: 'run'
  jobId: string
  revision: number
  payload: TPayload
}

export type WorkerResponse<TResult> =
  | { type: 'complete'; jobId: string; revision: number; result: TResult }
  | { type: 'failed'; jobId: string; revision: number; message: string }
  | { type: 'resource-exhausted'; jobId: string; revision: number; message: string }
  | { type: 'progress'; jobId: string; revision: number; progress: WorkerProgress }

export type GenerationStage =
  | 'candidate-generation'
  | 'topology-screening'
  | 'physical-construction'
  | 'geometry-validation'
  | 'solvability-verification'
  | 'difficulty-optimization'
  | 'final-rendering'

export interface WorkerProgress {
  stage: GenerationStage
  completedCandidates: number
  totalCandidates: number | null
  completedWork: number | null
  totalWork: number | null
  jobRevision?: number
}

export type WorkerProgressListener = (progress: WorkerProgress) => void

export interface WorkerPort<TPayload, TResult> {
  onmessage: ((event: { data: WorkerResponse<TResult> }) => void) | null
  onerror: ((event: { message: string }) => void) | null
  postMessage(message: WorkerRequest<TPayload>): void
  terminate(): void
}

export type WorkerJobOutcome<TResult> =
  | { status: 'complete'; jobId: string; revision: number; result: TResult }
  | {
    status: 'incomplete'
    jobId: string
    revision: number
    reason: 'cancelled' | 'resource-exhausted'
    message?: string
  }

export class StaleWorkerJobError extends Error {
  constructor(jobId: string) {
    super(`Worker job ${jobId} was superseded by a newer revision.`)
    this.name = 'StaleWorkerJobError'
  }
}

export class WorkerExecutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerExecutionError'
  }
}

interface Job<TPayload, TResult> {
  id: string
  revision: number
  payload: TPayload
  onProgress: WorkerProgressListener | undefined
  resolve: (result: WorkerJobOutcome<TResult>) => void
  reject: (error: Error) => void
}

interface WorkerSlot<TPayload, TResult> {
  worker: WorkerPort<TPayload, TResult> | null
  job: Job<TPayload, TResult> | null
}

export class WorkerJobScheduler<TPayload, TResult> {
  private readonly slots: WorkerSlot<TPayload, TResult>[] = []
  private readonly queue: Job<TPayload, TResult>[] = []
  private readonly jobs = new Map<string, Job<TPayload, TResult>>()
  private revision = 0
  private sequence = 0
  private disposed = false
  private readonly createWorker: () => WorkerPort<TPayload, TResult>

  constructor(
    createWorker: () => WorkerPort<TPayload, TResult>,
    maximumWorkers: number,
  ) {
    if (!Number.isInteger(maximumWorkers) || maximumWorkers < 1) {
      throw new RangeError('Maximum worker count must be a positive integer.')
    }
    this.createWorker = createWorker

    for (let index = 0; index < maximumWorkers; index += 1) {
      const slot: WorkerSlot<TPayload, TResult> = { worker: null, job: null }
      this.slots.push(slot)
      this.replaceWorker(slot)
    }
  }

  get currentRevision(): number {
    return this.revision
  }

  submit(
    payload: TPayload,
    onProgress?: WorkerProgressListener,
  ): Promise<WorkerJobOutcome<TResult>> {
    if (this.disposed) {
      return Promise.reject(new Error('Worker job scheduler has been disposed.'))
    }

    const revision = this.revision
    const jobId = `job-${revision}-${++this.sequence}`
    return new Promise((resolve, reject) => {
      const job: Job<TPayload, TResult> = {
        id: jobId,
        revision,
        payload,
        onProgress,
        resolve,
        reject,
      }
      this.jobs.set(jobId, job)
      this.queue.push(job)
      this.pump()
    })
  }

  advanceRevision(): number {
    if (this.disposed) {
      throw new Error('Worker job scheduler has been disposed.')
    }
    this.revision += 1
    for (const job of this.jobs.values()) {
      if (job.revision < this.revision) this.cancelJob(job, true, false)
    }
    this.pump()
    return this.revision
  }

  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false
    this.cancelJob(job, false)
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const job of this.jobs.values()) {
      job.resolve({
        status: 'incomplete',
        jobId: job.id,
        revision: job.revision,
        reason: 'cancelled',
      })
    }
    this.jobs.clear()
    this.queue.length = 0
    for (const slot of this.slots) {
      slot.job = null
      slot.worker?.terminate()
      slot.worker = null
    }
  }

  private cancelJob(job: Job<TPayload, TResult>, stale: boolean, schedule = true): void {
    this.jobs.delete(job.id)
    const queuedIndex = this.queue.indexOf(job)
    if (queuedIndex >= 0) this.queue.splice(queuedIndex, 1)

    const activeSlot = this.slots.find((slot) => slot.job === job)
    if (activeSlot) {
      activeSlot.worker?.terminate()
      activeSlot.worker = null
      activeSlot.job = null
    }

    if (stale) {
      job.reject(new StaleWorkerJobError(job.id))
    } else {
      job.resolve({
        status: 'incomplete',
        jobId: job.id,
        revision: job.revision,
        reason: 'cancelled',
      })
    }
    if (schedule) this.pump()
  }

  private replaceWorker(slot: WorkerSlot<TPayload, TResult>): void {
    const worker = this.createWorker()
    slot.worker = worker
    worker.onmessage = ({ data }) => {
      if (slot.worker !== worker) return
      const job = slot.job
      if (!job || data.jobId !== job.id || data.revision !== job.revision) return
      if (data.type === 'progress') {
        if (!this.isValidProgress(data.progress)) {
          slot.job = null
          this.jobs.delete(job.id)
          job.reject(new WorkerExecutionError('Worker reported invalid progress data.'))
          this.pump()
          return
        }
        try {
          job.onProgress?.(data.progress)
        } catch (error) {
          slot.job = null
          this.jobs.delete(job.id)
          job.reject(new WorkerExecutionError(
            error instanceof Error ? error.message : 'Progress listener failed.',
          ))
          this.pump()
        }
        return
      }
      slot.job = null
      this.jobs.delete(job.id)
      if (job.revision !== this.revision) {
        job.reject(new StaleWorkerJobError(job.id))
      } else if (data.type === 'failed') {
        job.reject(new WorkerExecutionError(data.message))
      } else if (data.type === 'resource-exhausted') {
        job.resolve({
          status: 'incomplete',
          jobId: job.id,
          revision: job.revision,
          reason: 'resource-exhausted',
          message: data.message,
        })
      } else {
        job.resolve({
          status: 'complete',
          jobId: job.id,
          revision: job.revision,
          result: data.result,
        })
      }
      this.pump()
    }
    worker.onerror = ({ message }) => {
      if (slot.worker !== worker) return
      const job = slot.job
      slot.job = null
      worker.terminate()
      slot.worker = null
      if (job) {
        this.jobs.delete(job.id)
        job.reject(new WorkerExecutionError(message || 'Worker execution failed.'))
      }
      this.pump()
    }
  }

  private isValidProgress(progress: WorkerProgress): boolean {
    const validCount = (value: number) => Number.isSafeInteger(value) && value >= 0
    if (!validCount(progress.completedCandidates)) return false
    if (
      progress.totalCandidates !== null
      && (!Number.isSafeInteger(progress.totalCandidates)
        || progress.totalCandidates <= 0
        || progress.completedCandidates > progress.totalCandidates)
    ) {
      return false
    }
    if (progress.completedWork === null && progress.totalWork === null) return true
    return (
      progress.completedWork !== null
      && progress.totalWork !== null
      && validCount(progress.completedWork)
      && Number.isSafeInteger(progress.totalWork)
      && progress.totalWork > 0
      && progress.completedWork <= progress.totalWork
    )
  }

  private pump(): void {
    if (this.disposed) return
    for (const slot of this.slots) {
      if (slot.job || this.queue.length === 0) continue
      if (!slot.worker) {
        try {
          this.replaceWorker(slot)
        } catch (error) {
          const failure = new WorkerExecutionError(
            error instanceof Error ? error.message : 'Unable to create a worker.',
          )
          for (const job of this.queue.splice(0)) {
            this.jobs.delete(job.id)
            job.reject(failure)
          }
          return
        }
      }

      const job = this.queue.shift()
      if (!job || !slot.worker) continue
      slot.job = job
      try {
        slot.worker.postMessage({
          type: 'run',
          jobId: job.id,
          revision: job.revision,
          payload: job.payload,
        })
      } catch (error) {
        slot.job = null
        this.jobs.delete(job.id)
        job.reject(new WorkerExecutionError(
          error instanceof Error ? error.message : 'Unable to send work to a worker.',
        ))
        this.pump()
      }
    }
  }
}
