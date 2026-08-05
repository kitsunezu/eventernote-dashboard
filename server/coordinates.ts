export interface Coordinates {
  latitude: number
  longitude: number
}

export function hasUsableCoordinates(
  value: { latitude?: number | null; longitude?: number | null },
): value is Coordinates {
  const { latitude, longitude } = value
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90
    && Math.abs(longitude) <= 180
    && !(Math.abs(latitude) < 1 && Math.abs(longitude) < 1)
}
