import './App.css'
import { GenerationProgress } from './components/GenerationProgress'
import { createBrowserCandidateWorker } from './core/generation/browserCandidateWorker'
import { createCandidatePipeline } from './core/generation/candidatePipeline'
import { useConfigurationStore } from './core/config/configurationStore'
import { useApplicationStore } from './core/state/applicationStore'

type ApplicationPipeline = ReturnType<typeof createCandidatePipeline>

let applicationPipeline: ApplicationPipeline | null = null

function getApplicationPipeline(): ApplicationPipeline {
  if (applicationPipeline) return applicationPipeline
  applicationPipeline = createCandidatePipeline({
    createWorker: createBrowserCandidateWorker,
    maximumWorkers: 2,
    onStart: () => useApplicationStore.getState().startGeneration(),
    onProgress: (progress) => useApplicationStore.getState().reportProgress(progress),
    onPublish: (candidate, configuration) => {
      useConfigurationStore.getState().setRenderedSnapshot(configuration)
      useApplicationStore.getState().completeGeneration(candidate)
    },
    onIncomplete: (message) => useApplicationStore.getState().incompleteGeneration(message),
    onCancel: () => useApplicationStore.getState().cancelGeneration(),
    onFailure: (message) => useApplicationStore.getState().failGeneration(message),
  })
  return applicationPipeline
}

function startGeneration(): void {
  try {
    const snapshot = useConfigurationStore.getState().snapshotPending()
    void getApplicationPipeline().generate(snapshot).catch((error: unknown) => {
      useApplicationStore.getState().failGeneration(
        error instanceof Error ? error.message : 'Candidate generation failed unexpectedly.',
      )
    })
  } catch (error) {
    useApplicationStore.getState().failGeneration(
      error instanceof Error ? error.message : 'Unable to start candidate generation.',
    )
  }
}

function cancelGeneration(): void {
  applicationPipeline?.cancel()
}

function App() {
  const {
    jobStatus,
    renderedDesignId,
    feedback,
    progress,
    reportSuccess,
    reportFailure,
  } = useApplicationStore()
  const pending = useConfigurationStore((state) => state.pending)
  const setPending = useConfigurationStore((state) => state.setPending)
  const hasRenderedDesign = renderedDesignId !== null

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Labyrinth Software</p>
          <h1>Maze Studio</h1>
        </div>
        <div className="toolbar" aria-label="Project controls">
          <button type="button" onClick={startGeneration}>
            Generate
          </button>
          <button type="button" onClick={startGeneration} disabled={!hasRenderedDesign || jobStatus === 'running'}>
            Regenerate
          </button>
          <button type="button" onClick={cancelGeneration} disabled={jobStatus !== 'running'}>
            Cancel
          </button>
          <button type="button" disabled={!hasRenderedDesign} onClick={() => reportFailure('PNG export unavailable until rendering is implemented')}>Export PNG</button>
          <button type="button" disabled={!hasRenderedDesign} onClick={() => reportFailure('SVG export unavailable until rendering is implemented')}>Export SVG</button>
          <button type="button" onClick={() => reportSuccess('Project save requested')}>Save Project</button>
          <button type="button" onClick={() => reportSuccess('Project load requested')}>Load Project</button>
          <button type="button" disabled={!hasRenderedDesign} onClick={() => reportSuccess('Share link copied')}>Copy Share Link</button>
          <button type="button" disabled={!hasRenderedDesign} onClick={() => reportSuccess('Share text copied')}>Copy Share Text</button>
        </div>
      </header>

      <aside className="configuration-sidebar" aria-label="Maze configuration">
        <h2>Configuration</h2>
        <fieldset>
          <legend>Design Area</legend>
          <label>
            Width
            <input
              type="number"
              min="1"
              value={Number.isFinite(pending.widthMeters) ? pending.widthMeters : ''}
              onChange={(event) => setPending({ widthMeters: event.currentTarget.valueAsNumber })}
              aria-label="Design width"
            />
          </label>
          <label>
            Depth
            <input
              type="number"
              min="1"
              value={Number.isFinite(pending.depthMeters) ? pending.depthMeters : ''}
              onChange={(event) => setPending({ depthMeters: event.currentTarget.valueAsNumber })}
              aria-label="Design depth"
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Topology</legend>
          <label>
            Mode
            <select
              value={pending.topology}
              onChange={(event) => setPending({
                topology: event.currentTarget.value as typeof pending.topology,
              })}
              aria-label="Topology mode"
            >
              <option value="maze">Maze</option>
              <option value="labyrinth">Labyrinth</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Geometry</legend>
          <label>
            Mode
            <select
              value={pending.geometry}
              onChange={(event) => setPending({
                geometry: event.currentTarget.value as typeof pending.geometry,
              })}
              aria-label="Geometry mode"
            >
              <option value="orthogonal">Orthogonal</option>
              <option value="circular">Circular</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
        </fieldset>
      </aside>

      <section className="viewport-panel" aria-label="Maze viewport">
        <div className="viewport-toolbar" aria-label="Viewport controls">
          <button type="button" disabled>Fit</button>
          <button type="button" disabled>Zoom in</button>
          <button type="button" disabled>Zoom out</button>
        </div>
        <div className="viewport-empty">
          <p className="job-status" role="status">Status: {feedback}</p>
          {progress && <GenerationProgress progress={progress} />}
          <svg viewBox="0 0 800 500" role="img" aria-label="Read-only maze viewport">
            <rect x="1" y="1" width="798" height="498" rx="8" fill="none" stroke="currentColor" />
            <text x="400" y="250" textAnchor="middle" fill="currentColor">
              {renderedDesignId ? `Rendered maze: ${renderedDesignId}` : 'No rendered maze'}
            </text>
          </svg>
        </div>
      </section>
    </main>
  )
}

export default App
