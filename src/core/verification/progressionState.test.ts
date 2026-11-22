import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ProgressionController, type ProgressionObjective } from './progressionState'

describe('objective progression state', () => {
  it('gates ordered required objectives while allowing optional objectives to be skipped', () => {
    const progression = new ProgressionController('ordered', [
      { id: 'required-1', required: true, dependencies: [] },
      { id: 'optional', required: false, dependencies: [] },
      { id: 'required-2', required: true, dependencies: [] },
    ])
    const initial = progression.createInitialState()

    expect(progression.availableObjectiveIds(initial)).toEqual(['required-1', 'optional'])
    const afterFirst = progression.completeObjective(initial, 'required-1')
    expect(progression.availableObjectiveIds(afterFirst)).toEqual(['optional', 'required-2'])
    expect(progression.requiredObjectivesComplete(afterFirst)).toBe(false)
    const completed = progression.completeObjective(afterFirst, 'required-2')
    expect(progression.requiredObjectivesComplete(completed)).toBe(true)
    expect(completed.completionFlags.optional).toBe(false)
  })

  it('allows every dependency-ready objective in unordered progression', () => {
    const progression = new ProgressionController('unordered', [
      { id: 'first', required: true, dependencies: [] },
      { id: 'second', required: true, dependencies: ['first'] },
      { id: 'optional', required: false, dependencies: [] },
    ])

    expect(progression.availableObjectiveIds(progression.createInitialState()))
      .toEqual(['first', 'optional'])
  })

  it('keeps every completed flag set over arbitrary valid completion sequences', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 1, maxLength: 100 }),
        (indices) => {
          const objectives: ProgressionObjective[] = Array.from({ length: 8 }, (_, index) => ({
            id: `optional-${index}`,
            required: false,
            dependencies: [],
          }))
          const progression = new ProgressionController('unordered', objectives)
          let state = progression.createInitialState()

          for (const index of indices) {
            const id = `optional-${index}`
            if (!state.completionFlags[id]) {
              const nextState = progression.completeObjective(state, id)
              for (const [completedId, wasComplete] of Object.entries(state.completionFlags)) {
                if (wasComplete) expect(nextState.completionFlags[completedId]).toBe(true)
              }
              state = nextState
            }
          }
        },
      ),
    )
  })

  it('rejects duplicate IDs and invalid dependencies', () => {
    expect(() => new ProgressionController('unordered', [
      { id: 'duplicate', required: true, dependencies: [] },
      { id: 'duplicate', required: false, dependencies: [] },
    ])).toThrow('IDs must be unique')
    expect(() => new ProgressionController('unordered', [
      { id: 'goal', required: true, dependencies: ['missing'] },
    ])).toThrow('invalid dependency')
  })
})
