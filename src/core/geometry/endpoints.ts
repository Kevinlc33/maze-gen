import type { EntranceExit, MazeGeometry } from './models'

export interface EndpointIssue {
  field: 'entrance' | 'exit'
  message: string
}

export function validateEndpoints(geometry: MazeGeometry): EndpointIssue[] {
  const issues: EndpointIssue[] = []

  if (geometry.entrance.kind !== 'entrance') {
    issues.push({ field: 'entrance', message: 'The level must contain exactly one entrance.' })
  }
  if (geometry.exit.kind !== 'exit') {
    issues.push({ field: 'exit', message: 'The level must contain exactly one final exit.' })
  }
  if (!pointInsideBounds(geometry.entrance.position, geometry) || !geometry.entrance.connectedRegionId) {
    issues.push({ field: 'entrance', message: 'The entrance must have valid bounds and physical access.' })
  }
  if (!pointInsideBounds(geometry.exit.position, geometry) || !geometry.exit.connectedRegionId) {
    issues.push({ field: 'exit', message: 'The exit must have valid bounds and physical access.' })
  }

  return issues
}

function pointInsideBounds(point: EntranceExit['position'], geometry: MazeGeometry): boolean {
  return (
    Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(geometry.boundsWidthMeters)
    && Number.isFinite(geometry.boundsDepthMeters)
    && geometry.boundsWidthMeters > 0
    && geometry.boundsDepthMeters > 0
    && point.x >= 0
    && point.y >= 0
    && point.x <= geometry.boundsWidthMeters
    && point.y <= geometry.boundsDepthMeters
  )
}
