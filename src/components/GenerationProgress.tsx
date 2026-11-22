import type { GenerationStage, WorkerProgress } from '../core/workers/jobScheduler'

const STAGE_LABELS: Record<GenerationStage, string> = {
  'candidate-generation': 'Generating candidates',
  'topology-screening': 'Screening topology',
  'physical-construction': 'Constructing physical geometry',
  'geometry-validation': 'Validating geometry',
  'solvability-verification': 'Verifying solvability',
  'difficulty-optimization': 'Optimizing difficulty',
  'final-rendering': 'Rendering selected design',
}

interface GenerationProgressProps {
  progress: WorkerProgress
}

export function GenerationProgress({ progress }: GenerationProgressProps) {
  const label = STAGE_LABELS[progress.stage]
  const percent = progress.totalWork === null || progress.completedWork === null
    ? null
    : Math.round((progress.completedWork / progress.totalWork) * 100)
  const candidateCount = progress.totalCandidates === null
    ? `${progress.completedCandidates} completed`
    : `${progress.completedCandidates} of ${progress.totalCandidates}`

  return (
    <section aria-label="Generation progress">
      <h2>{label}</h2>
      <p>Candidates: {candidateCount}</p>
      <progress
        aria-label={`${label} progress`}
        max={100}
        value={percent ?? undefined}
      />
      <p>{percent === null ? 'Progress is indeterminate' : `${percent}% complete`}</p>
    </section>
  )
}
