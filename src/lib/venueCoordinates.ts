import { hasUsablePlaceCoordinates } from './placeCache'
import type { PlaceEntry } from './placeCache'

export interface VenueCoordinates {
  latitude: number
  longitude: number
  approximate: boolean
}

const REGION_CENTERS: Array<{ pattern: RegExp; latitude: number; longitude: number }> = [
  { pattern: /香港|Hong Kong/i, latitude: 22.3193, longitude: 114.1694 },
  { pattern: /澳門|澳门|マカオ|Macau/i, latitude: 22.1987, longitude: 113.5439 },
  { pattern: /台北|臺北|台灣|臺灣|台湾|Taipei|Taiwan/i, latitude: 25.033, longitude: 121.5654 },
  { pattern: /横浜|神奈川|Yokohama|Kanagawa/i, latitude: 35.4437, longitude: 139.638 },
  { pattern: /大阪|Osaka/i, latitude: 34.6937, longitude: 135.5023 },
  { pattern: /名古屋|愛知|Nagoya|Aichi/i, latitude: 35.1815, longitude: 136.9066 },
  { pattern: /福岡|Fukuoka/i, latitude: 33.5902, longitude: 130.4017 },
  { pattern: /東京|Tokyo/i, latitude: 35.6762, longitude: 139.6503 },
]

export function resolveVenueCoordinates(
  venue: Pick<PlaceEntry, 'name' | 'address' | 'region' | 'latitude' | 'longitude'>,
): VenueCoordinates | undefined {
  if (hasUsablePlaceCoordinates(venue)) {
    return { latitude: venue.latitude, longitude: venue.longitude, approximate: false }
  }

  const locationText = `${venue.address} ${venue.region}`
  const center = REGION_CENTERS.find(({ pattern }) => pattern.test(locationText))
  if (!center) return undefined

  const hash = Array.from(venue.name).reduce((value, character) => value + character.codePointAt(0)!, 0)
  const angle = (hash % 360) * (Math.PI / 180)
  return {
    latitude: center.latitude + Math.sin(angle) * 0.018,
    longitude: center.longitude + Math.cos(angle) * 0.018,
    approximate: true,
  }
}
