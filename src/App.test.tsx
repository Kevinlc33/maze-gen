import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_CHAMBERS, DEFAULT_MAZE_CONFIG } from './core/config/defaults'
import { useConfigurationStore } from './core/config/configurationStore'
import { buildCandidate, type CandidateBuildPayload, type CandidateBuildResult } from './core/generation/candidateWorker'
import { useApplicationStore } from './core/state/applicationStore'
import type { WorkerRequest, WorkerResponse } from './core/workers/jobScheduler'

class TestCandidateWorker {
  static instances: TestCandidateWorker[] = []
  static holdResponses = false
  private readonly messageListeners: Array<
    (event: MessageEvent<WorkerResponse<CandidateBuildResult>>) => void
  > = []
  readonly requests: WorkerRequest<CandidateBuildPayload>[] = []
  private readonly pendingResponses: WorkerResponse<CandidateBuildResult>[] = []
  private terminated = false

  constructor() {
    TestCandidateWorker.instances.push(this)
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<WorkerResponse<CandidateBuildResult>>) => void,
  ): void {
    if (type === 'message') this.messageListeners.push(listener)
  }

  postMessage(request: WorkerRequest<CandidateBuildPayload>): void {
    this.requests.push(request)
    const result = buildCandidate(request.payload, (progress) => {
      this.dispatch({
        type: 'progress',
        jobId: request.jobId,
        revision: request.revision,
        progress,
      })
    })
    const response: WorkerResponse<CandidateBuildResult> = {
      type: 'complete',
      jobId: request.jobId,
      revision: request.revision,
      result,
    }
    if (TestCandidateWorker.holdResponses) {
      this.pendingResponses.push(response)
    } else {
      queueMicrotask(() => this.dispatch(response))
    }
  }

  terminate(): void {
    this.terminated = true
  }

  completePending(): void {
    this.pendingResponses.splice(0).forEach((response) => this.dispatch(response))
  }

  get isTerminated(): boolean {
    return this.terminated
  }

  private dispatch(response: WorkerResponse<CandidateBuildResult>): void {
    if (this.terminated) return
    const event = new MessageEvent('message', { data: response })
    this.messageListeners.forEach((listener) => listener(event))
  }
}

describe('Maze application shell', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', TestCandidateWorker)
    TestCandidateWorker.instances.forEach((worker) => {
      worker.requests.length = 0
    })
    TestCandidateWorker.holdResponses = false
    useConfigurationStore.setState({
      pending: { ...DEFAULT_MAZE_CONFIG },
      rendered: null,
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

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders configuration and a read-only viewport', () => {
    render(<App />)

    expect(screen.getByLabelText('Maze configuration')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Read-only maze viewport' })).toBeInTheDocument()
  })

  it('tracks generation, cancellation, and rendered export availability', () => {
    render(<App />)

    const generate = screen.getByRole('button', { name: 'Generate' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toBeDisabled()

    fireEvent.click(generate)
    expect(screen.getByRole('status')).toHaveTextContent('Generation in progress')
    expect(cancel).not.toBeDisabled()

    fireEvent.click(cancel)
    expect(screen.getByRole('status')).toHaveTextContent('Generation cancelled')
  })

  it('lets a newer Generate submission supersede the active UI job', async () => {
    TestCandidateWorker.holdResponses = true
    render(<App />)

    const generate = screen.getByRole('button', { name: 'Generate' })
    const requestCounts = new Map(
      TestCandidateWorker.instances.map((worker) => [worker, worker.requests.length]),
    )
    fireEvent.click(generate)
    expect(generate).toBeEnabled()
    const originalWorkers = TestCandidateWorker.instances.filter((worker) =>
      worker.requests.length > (requestCounts.get(worker) ?? 0),
    )

    fireEvent.change(screen.getByLabelText('Design width'), { target: { value: '60' } })
    fireEvent.click(generate)

    expect(originalWorkers.every((worker) => worker.isTerminated)).toBe(true)
    TestCandidateWorker.holdResponses = false
    TestCandidateWorker.instances.forEach((worker) => worker.completePending())

    await waitFor(() => {
      expect(useApplicationStore.getState().jobStatus).toBe('complete')
    })
    expect(useConfigurationStore.getState().renderedSnapshot?.config.widthMeters).toBe(60)
  })

  it('submits a sidebar snapshot and keeps later edits pending after publication', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Design width'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    fireEvent.change(screen.getByLabelText('Design width'), { target: { value: '80' } })

    await waitFor(() => {
      expect(useApplicationStore.getState().jobStatus).toBe('complete')
    })

    const submittedWidths = TestCandidateWorker.instances.flatMap((worker) =>
      worker.requests.map((request) => request.payload.configuration.config.widthMeters),
    )
    expect(submittedWidths.length).toBeGreaterThan(0)
    expect(submittedWidths.every((width) => width === 60)).toBe(true)
    expect(useConfigurationStore.getState().pending.widthMeters).toBe(80)
    expect(useConfigurationStore.getState().renderedSnapshot?.config.widthMeters).toBe(60)
  })

  it('exposes save/load and copy controls with rendered-design restrictions', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Save Project' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Load Project' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Copy Share Link' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copy Share Text' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save Project' }))
    expect(screen.getByRole('status')).toHaveTextContent('Project save requested')
  })

  it('distinguishes determinate and indeterminate generation progress', () => {
    useApplicationStore.getState().reportProgress({
      stage: 'topology-screening',
      completedCandidates: 3,
      totalCandidates: null,
      completedWork: null,
      totalWork: null,
    })
    const { rerender } = render(<App />)

    expect(screen.getByRole('heading', { name: 'Screening topology' })).toBeInTheDocument()
    expect(screen.getByText('Candidates: 3 completed')).toBeInTheDocument()
    expect(screen.getByText('Progress is indeterminate')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')

    useApplicationStore.getState().reportProgress({
      stage: 'final-rendering',
      completedCandidates: 5,
      totalCandidates: 5,
      completedWork: 1,
      totalWork: 4,
    })
    rerender(<App />)

    expect(screen.getByRole('heading', { name: 'Rendering selected design' })).toBeInTheDocument()
    expect(screen.getByText('Candidates: 5 of 5')).toBeInTheDocument()
    expect(screen.getByText('25% complete')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '25')
  })

  it('keeps the previous rendered design until its replacement completes', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    await waitFor(() => {
      expect(useApplicationStore.getState().jobStatus).toBe('complete')
    })

    const previousCandidate = useApplicationStore.getState().renderedCandidate
    const previousDesignId = previousCandidate?.metadata.id
    expect(previousDesignId).toBeTruthy()
    expect(screen.getByText(`Rendered maze: ${previousDesignId}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export SVG' })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Design width'), { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText(`Rendered maze: ${previousDesignId}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export SVG' })).toBeEnabled()
    expect(useApplicationStore.getState().renderedCandidate).toBe(previousCandidate)
  })
})
