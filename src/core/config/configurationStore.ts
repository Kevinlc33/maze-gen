import { create } from 'zustand'
import type { ChamberConfig, MazeConfig, WallPlacementPreference } from '../domain/types'
import { DEFAULT_CHAMBERS, DEFAULT_MAZE_CONFIG } from './defaults'

export interface ConfigurationSnapshot {
  readonly config: Readonly<MazeConfig>
  readonly chambers: readonly Readonly<ChamberConfig>[]
  readonly wallPlacementPreference: WallPlacementPreference
  readonly editRevision: number
}

interface ConfigurationState {
  pending: MazeConfig
  rendered: MazeConfig | null
  renderedSnapshot: ConfigurationSnapshot | null
  editRevision: number
  chambers: ChamberConfig[]
  wallPlacementPreference: WallPlacementPreference
  setPending: (patch: Partial<MazeConfig>) => void
  setWallPlacementPreference: (preference: WallPlacementPreference) => void
  snapshotPending: () => ConfigurationSnapshot
  setRenderedSnapshot: (snapshot: ConfigurationSnapshot) => void
}

export const useConfigurationStore = create<ConfigurationState>((set, get) => ({
  pending: { ...DEFAULT_MAZE_CONFIG },
  rendered: null,
  renderedSnapshot: null,
  editRevision: 0,
  chambers: DEFAULT_CHAMBERS.map((chamber) => ({ ...chamber })),
  wallPlacementPreference: 'automatic',
  setPending: (patch) => set((state) => ({
    pending: { ...state.pending, ...patch },
    editRevision: state.editRevision + 1,
  })),
  setWallPlacementPreference: (preference) => set((state) => ({
    wallPlacementPreference: preference,
    editRevision: state.editRevision + 1,
  })),
  snapshotPending: () => {
    const state = get()
    return Object.freeze({
      config: Object.freeze({ ...state.pending }),
      chambers: Object.freeze(state.chambers.map((chamber) => Object.freeze({ ...chamber }))),
      wallPlacementPreference: state.wallPlacementPreference,
      editRevision: state.editRevision,
    })
  },
  setRenderedSnapshot: (snapshot) => set({
    rendered: { ...snapshot.config },
    renderedSnapshot: snapshot,
  }),
}))
