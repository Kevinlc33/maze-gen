export const GEOMETRY_EPSILON_METERS = 1e-7

export function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= GEOMETRY_EPSILON_METERS
}
