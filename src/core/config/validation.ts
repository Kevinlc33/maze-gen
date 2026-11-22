import type { ChamberConfig, MazeConfig } from '../domain/types'

export interface ValidationIssue {
  field: string
  message: string
}

export function validateMazeConfig(config: MazeConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (
    !Number.isFinite(config.widthMeters)
    || !Number.isFinite(config.depthMeters)
    || config.widthMeters <= 0
    || config.depthMeters <= 0
  ) {
    issues.push({ field: 'design-area', message: 'Width and depth must be greater than zero.' })
  }
  if (
    Number.isFinite(config.widthMeters)
    && Number.isFinite(config.depthMeters)
    && (config.widthMeters > 160 || config.depthMeters > 80)
  ) {
    issues.push({ field: 'design-area', message: 'Maximum design area is 160 m by 80 m.' })
  }
  if (!Number.isFinite(config.wallThicknessMeters) || config.wallThicknessMeters <= 0) {
    issues.push({
      field: 'wall-thickness',
      message: 'Wall thickness must be a positive finite value.',
    })
  }
  if (
    !Number.isFinite(config.minimumPassageWidthMeters)
    || config.minimumPassageWidthMeters <= 0
  ) {
    issues.push({
      field: 'minimum-passage',
      message: 'Minimum passage width must be a positive finite value.',
    })
  }
  if (
    config.uniformCorridorWidthMeters !== null
    && (
      !Number.isFinite(config.uniformCorridorWidthMeters)
      || config.uniformCorridorWidthMeters < config.minimumPassageWidthMeters
    )
  ) {
    issues.push({
      field: 'uniform-corridor',
      message: 'Uniform corridor width must be finite and cannot be less than minimum passage width.',
    })
  }
  if (
    config.constructionIncrementMeters !== null
    && (
      !Number.isFinite(config.constructionIncrementMeters)
      || config.constructionIncrementMeters <= 0
    )
  ) {
    issues.push({
      field: 'construction-increment',
      message: 'Construction increment must be a positive finite value.',
    })
  }
  if (!config.seed.trim()) {
    issues.push({ field: 'seed', message: 'A deterministic seed is required.' })
  }

  return issues
}

export function validateChambers(chambers: ChamberConfig[]): ValidationIssue[] {
  return chambers.flatMap((chamber) => {
    if (
      !Number.isFinite(chamber.areaMetersSquared)
      || !Number.isFinite(chamber.minimumAreaMetersSquared)
      || !Number.isFinite(chamber.maximumAreaMetersSquared)
      || chamber.areaMetersSquared < 16
      || chamber.areaMetersSquared > 64
      || chamber.minimumAreaMetersSquared > chamber.maximumAreaMetersSquared
    ) {
      return [{
        field: `chamber-${chamber.id}`,
        message: 'Chamber area and limits must be finite, ordered, and within 16 to 64 square meters.',
      }]
    }
    if (
      chamber.areaMetersSquared < chamber.minimumAreaMetersSquared
      || chamber.areaMetersSquared > chamber.maximumAreaMetersSquared
    ) {
      return [{
        field: `chamber-${chamber.id}`,
        message: 'Chamber area is outside its permitted range.',
      }]
    }
    return []
  })
}
