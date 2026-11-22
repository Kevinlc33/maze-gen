export const METERS_PER_FOOT = 0.3048

export function feetToMeters(feet: number): number {
  return feet * METERS_PER_FOOT
}

export function metersToFeet(meters: number): number {
  return meters / METERS_PER_FOOT
}

export function quantizeMeters(valueMeters: number, incrementMeters: number | null): number {
  if (incrementMeters === null || incrementMeters <= 0) {
    return valueMeters
  }

  return Math.round(valueMeters / incrementMeters) * incrementMeters
}
