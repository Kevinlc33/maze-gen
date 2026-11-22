import { create } from 'zustand'
import type { VerifiedCandidate } from '../generation/candidatePipeline'
import type { WorkerProgress } from '../workers/jobScheduler'

export type JobStatus = 'idle' | 'running' | 'cancelled' | 'complete' | 'incomplete' | 'failed'

interface ApplicationState {
  jobStatus: JobStatus
  renderedDesignId: string | null
  renderedCandidate: VerifiedCandidate | null
  feedback: string
  progress: WorkerProgress | null
  startGeneration: () => void
  cancelGeneration: () => void
  completeGeneration: (candidate: VerifiedCandidate) => void
  incompleteGeneration: (message: string) => void
  failGeneration: (message: string) => void
  reportProgress: (progress: WorkerProgress) => void
  reportSuccess: (message: string) => void
  reportFailure: (message: string) => void
}

export const useApplicationStore = create<ApplicationState>((set) => ({
  jobStatus: 'idle',
  renderedDesignId: null,
  renderedCandidate: null,
  feedback: 'Ready',
  progress: null,
  startGeneration: () => set({
    jobStatus: 'running',
    feedback: 'Generation in progress',
    progress: null,
  }),
  cancelGeneration: () => set({
    jobStatus: 'cancelled',
    feedback: 'Generation cancelled',
    progress: null,
  }),
  completeGeneration: (candidate) => set({
    jobStatus: 'complete',
    renderedDesignId: candidate.metadata.id,
    renderedCandidate: candidate,
    feedback: 'Generation complete',
  }),
  incompleteGeneration: (message) => set({
    jobStatus: 'incomplete',
    feedback: `Generation incomplete: ${message}`,
    progress: null,
  }),
  failGeneration: (message) => set({
    jobStatus: 'failed',
    feedback: message,
  }),
  reportProgress: (progress) => set({ progress }),
  reportSuccess: (message) => set({
    feedback: message,
  }),
  reportFailure: (message) => set({
    feedback: message,
  }),
}))
