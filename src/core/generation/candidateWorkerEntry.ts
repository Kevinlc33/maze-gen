import type { WorkerRequest, WorkerResponse } from '../workers/jobScheduler'
import { buildCandidate, type CandidateBuildPayload, type CandidateBuildResult } from './candidateWorker'

const workerScope = self as unknown as {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<WorkerRequest<CandidateBuildPayload>>) => void,
  ) => void
  postMessage: (response: WorkerResponse<CandidateBuildResult>) => void
}

workerScope.addEventListener(
  'message',
  (event: MessageEvent<WorkerRequest<CandidateBuildPayload>>) => {
    const request = event.data
    if (request.type !== 'run') return
    const send = (response: WorkerResponse<CandidateBuildResult>) => {
      workerScope.postMessage(response)
    }
    try {
      const result = buildCandidate(request.payload, (progress) => {
        send({
          type: 'progress',
          jobId: request.jobId,
          revision: request.revision,
          progress,
        })
      })
      send({
        type: 'complete',
        jobId: request.jobId,
        revision: request.revision,
        result,
      })
    } catch (error) {
      send({
        type: 'failed',
        jobId: request.jobId,
        revision: request.revision,
        message: error instanceof Error ? error.message : 'Candidate construction failed.',
      })
    }
  },
)
