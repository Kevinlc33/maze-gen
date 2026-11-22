import type { Objective, ProgressionMode } from '../domain/types'

export type ProgressionObjective = Pick<Objective, 'id' | 'required' | 'dependencies'>

export interface ProgressionDefinition {
  mode: ProgressionMode
  objectives: readonly ProgressionObjective[]
}

export interface ProgressionState {
  readonly completionFlags: Readonly<Record<string, boolean>>
}

export class ProgressionController {
  private readonly objectives: readonly ProgressionObjective[]
  private readonly objectiveById: ReadonlyMap<string, ProgressionObjective>
  private readonly mode: ProgressionMode

  constructor(mode: ProgressionMode, objectives: readonly ProgressionObjective[]) {
    this.mode = mode
    const copiedObjectives = objectives.map((objective) => ({
      ...objective,
      dependencies: [...objective.dependencies],
    }))
    const ids = new Set(copiedObjectives.map((objective) => objective.id))
    if (ids.size !== copiedObjectives.length) {
      throw new Error('Progression objective IDs must be unique.')
    }
    for (const objective of copiedObjectives) {
      for (const dependency of objective.dependencies) {
        if (!ids.has(dependency) || dependency === objective.id) {
          throw new Error(`Objective ${objective.id} has an invalid dependency: ${dependency}.`)
        }
      }
    }
    this.objectives = copiedObjectives
    this.objectiveById = new Map(copiedObjectives.map((objective) => [objective.id, objective]))
  }

  createInitialState(): ProgressionState {
    return {
      completionFlags: Object.freeze(
        Object.fromEntries(this.objectives.map(({ id }) => [id, false])),
      ),
    }
  }

  availableObjectiveIds(state: ProgressionState): string[] {
    const nextRequired = this.mode === 'ordered'
      ? this.objectives.find((objective) =>
        objective.required && !state.completionFlags[objective.id],
      )
      : undefined

    return this.objectives
      .filter((objective) => {
        if (state.completionFlags[objective.id]) return false
        if (!objective.dependencies.every((id) => state.completionFlags[id])) return false
        return !objective.required || !nextRequired || objective.id === nextRequired.id
      })
      .map(({ id }) => id)
  }

  completeObjective(state: ProgressionState, objectiveId: string): ProgressionState {
    if (!this.objectiveById.has(objectiveId)) {
      throw new Error(`Unknown progression objective: ${objectiveId}.`)
    }
    if (!this.availableObjectiveIds(state).includes(objectiveId)) {
      throw new Error(`Progression objective ${objectiveId} is not currently available.`)
    }
    return {
      completionFlags: Object.freeze({
        ...state.completionFlags,
        [objectiveId]: true,
      }),
    }
  }

  requiredObjectivesComplete(state: ProgressionState): boolean {
    return this.objectives.every(
      (objective) => !objective.required || state.completionFlags[objective.id],
    )
  }
}
