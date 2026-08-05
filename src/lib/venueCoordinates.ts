import { hasUsablePlaceCoordinates } from './placeCache'
import type { PlaceEntry } from './placeCache'

export interface VenueCoordinates {
  latitude: number
  longitude: number
  approximate: boolean
}

export function resolveVenueCoordinates(
  venue: Pick<PlaceEntry, 'name' | 'address' | 'region' | 'latitude' | 'longitude'>,
): VenueCoordinates | undefined {
  if (hasUsablePlaceCoordinates(venue)) {
    return { latitude: venue.latitude, longitude: venue.longitude, approximate: false }
  }

  return undefined
}
