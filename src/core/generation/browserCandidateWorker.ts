import type { WorkerPort, WorkerRequest, WorkerResponse } from '../workers/jobScheduler'
import type { CandidateBuildPayload, CandidateBuildResult } from './candidateWorker'

export function createBrowserCandidateWorker(): WorkerPort<
  CandidateBuildPayload,
  CandidateBuildResult
> {
  const worker = new Worker(new URL('./candidateWorkerEntry.ts', import.meta.url), {
    type: 'module',
  })
  const port: WorkerPort<CandidateBuildPayload, CandidateBuildResult> = {
    onmessage: null,
    onerror: null,
    postMessage: (request: WorkerRequest<CandidateBuildPayload>) => worker.postMessage(request),
    terminate: () => worker.terminate(),
  }
  worker.addEventListener('message', (event: MessageEvent<WorkerResponse<CandidateBuildResult>>) => {
    port.onmessage?.({ data: event.data })
  })
  worker.addEventListener('error', (event: ErrorEvent) => {
    port.onerror?.({ message: event.message })
  })
  return port
}
