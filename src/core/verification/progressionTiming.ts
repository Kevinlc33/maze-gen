export type ProgressionBand = 'early' | 'middle' | 'late'

export function progressionBandAt(position: number): ProgressionBand {
  if (!Number.isFinite(position) || position < 0 || position > 1) {
    throw new RangeError('Progression position must be between 0 and 1.')
  }
  if (position <= 1 / 3) return 'early'
  if (position <= 2 / 3) return 'middle'
  return 'late'
}
