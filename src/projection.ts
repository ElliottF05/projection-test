import { Vector3 } from '@babylonjs/core'

export const maxLat = 89 * Math.PI / 180 // radians
export const maxY = Math.log(Math.tan(Math.PI / 4 + maxLat / 2))

// Mercator helper: take latitude & longitude in radians -> normalized [-1,1]
export function mercatorNormalizedXY(latRad: number, lonRad: number) {
  const lat = Math.max(Math.min(latRad, maxLat), -maxLat)
  const x = lonRad
  const y = Math.log(Math.tan(Math.PI / 4 + lat / 2))
  const nx = x / Math.PI
  const ny = y / maxY
  return { nx, ny }
}

// Inverse Mercator: normalized XY [-1,1] -> lat/lon (radians)
export function inverseMercatorNormalizedXY(nx: number, ny: number) {
  const lon = nx * Math.PI
  const y = ny * maxY
  const lat = 2 * Math.atan(Math.exp(y)) - Math.PI / 2
  return { lat, lon }
}

export function latLonToVec3(lat: number, lon: number, radius: number) {
  const y = Math.sin(lat) * radius
  const r = Math.cos(lat) * radius
  const x = Math.cos(lon) * r
  const z = Math.sin(lon) * r
  return new Vector3(x, y, z)
}

export function projectOntoSphere(point: Vector3, radius: number) {
  const dir = point.normalize()
  return dir.scale(radius)
}
