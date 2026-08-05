import type { ImportedScheduleData, ScheduleEvent } from '../src/types/events.js'

export interface EventSeed {
  id: string
  title: string
  startAt: string
  endAt: string
  placeId: string
  venue: string
  actors: string[]
  imageUrl?: string
  imageAlt?: string
}

export interface EventDetail extends EventSeed {
  description: string
}

export interface PlaceDetail {
  id: string
  name: string
  address: string
  region: string
  latitude?: number
  longitude?: number
}

export interface StoredPlaceDetail extends PlaceDetail {
  geocodeAttemptedAt?: string
}

export interface ParsedUserEventsPage {
  events: EventSeed[]
  paginationPaths: string[]
}

export interface StoredEvent extends ScheduleEvent {
  detailFetchedAt?: string
  placeId?: string
}

export interface StoredUserSnapshot {
  events: ScheduleEvent[]
  places: Record<string, Omit<PlaceDetail, 'id'>>
  lastIndexSuccessAt?: string
  lastIndexAttemptAt?: string
  lastError?: string
  pendingDetailCount: number
}

export interface EventApiResponse extends ImportedScheduleData {
  places: StoredUserSnapshot['places']
  cache: {
    status: 'fresh' | 'stale'
    refreshing: boolean
    userIndexCheckedAt?: string
    pendingDetailCount: number
  }
}

export interface SyncStats {
  discoveredEvents: number
  refreshedDetails: number
  refreshedPlaces: number
  warnings: string[]
}
