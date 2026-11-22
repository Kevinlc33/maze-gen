import type { DoorType, Point2D, StableEntity } from '../domain/types'

export interface StraightWall extends StableEntity {
  kind: 'straight'
  start: Point2D
  end: Point2D
  thicknessMeters: number
}

export interface CircularWall extends StableEntity {
  kind: 'circular'
  center: Point2D
  radiusMeters: number
  startAngleRadians: number
  endAngleRadians: number
  thicknessMeters: number
}

export type Wall = StraightWall | CircularWall

export interface ChamberRegion extends StableEntity {
  kind: 'rectangle' | 'circle' | 'irregular'
  areaMetersSquared: number
  points: Point2D[]
}

export interface DoorPortal extends StableEntity {
  kind: 'portal'
  type: DoorType
  position: Point2D
  widthMeters: number
  connectedRegionIds: [string, string]
  dependencies: string[]
}

export interface EntranceExit extends StableEntity {
  kind: 'entrance' | 'exit'
  position: Point2D
  connectedRegionId: string
}

export interface MazeGeometry {
  schemaVersion: '1'
  levelId: string
  boundsWidthMeters: number
  boundsDepthMeters: number
  walls: Wall[]
  chambers: ChamberRegion[]
  portals: DoorPortal[]
  entrance: EntranceExit
  exit: EntranceExit
}
