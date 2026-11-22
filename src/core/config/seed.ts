import type { ConfigurationSnapshot } from './configurationStore'

export function deriveCandidateSeed(baseSeed: string, candidateIndex: number): string {
  return `${baseSeed}:candidate:${candidateIndex.toString(36)}`
}

export function deriveCandidateId(
  configuration: ConfigurationSnapshot,
  candidateIndex: number,
  algorithmVersion: string,
): string {
  if (!Number.isSafeInteger(candidateIndex) || candidateIndex < 0) {
    throw new RangeError('Candidate index must be a non-negative safe integer.')
  }
  if (!algorithmVersion) throw new RangeError('Candidate algorithm version is required.')
  const config = configuration.config
  const chambers = configuration.chambers
    .map((chamber) => ({
      id: chamber.id,
      type: chamber.type,
      enabled: chamber.enabled,
      areaMetersSquared: chamber.areaMetersSquared,
      minimumAreaMetersSquared: chamber.minimumAreaMetersSquared,
      maximumAreaMetersSquared: chamber.maximumAreaMetersSquared,
    }))
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  const canonicalInput = JSON.stringify([
    algorithmVersion,
    candidateIndex,
    [
      config.widthMeters,
      config.depthMeters,
      config.units,
      config.topology,
      config.geometry,
      config.wallThicknessMeters,
      config.minimumPassageWidthMeters,
      config.constructionIncrementMeters,
      config.uniformCorridorWidthMeters,
      config.seed,
      config.strategy,
      config.effort,
    ],
    chambers.map((chamber) => [
      chamber.id,
      chamber.type,
      chamber.enabled,
      chamber.areaMetersSquared,
      chamber.minimumAreaMetersSquared,
      chamber.maximumAreaMetersSquared,
    ]),
    configuration.wallPlacementPreference,
  ])
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < canonicalInput.length; index += 1) {
    hash ^= BigInt(canonicalInput.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return `candidate-${candidateIndex.toString(36)}-${hash.toString(16).padStart(16, '0')}`
}
