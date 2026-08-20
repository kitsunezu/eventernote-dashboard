import type { SchedulePlace } from '../types/events'

export interface VenueCoordinates {
  latitude: number
  longitude: number
  approximate: boolean
}

export function resolveVenueCoordinates(
  venue: Pick<SchedulePlace, 'name' | 'address' | 'region' | 'latitude' | 'longitude'>,
): VenueCoordinates | undefined {
  if (hasUsablePlaceCoordinates(venue)) {
    return { latitude: venue.latitude, longitude: venue.longitude, approximate: false }
  }

  return undefined
}

export function hasUsablePlaceCoordinates(
  place: Pick<SchedulePlace, 'latitude' | 'longitude'>,
): place is SchedulePlace & { latitude: number; longitude: number } {
  return typeof place.latitude === 'number'
    && Number.isFinite(place.latitude)
    && typeof place.longitude === 'number'
    && Number.isFinite(place.longitude)
    && !(place.latitude === 0 && place.longitude === 0)
}
