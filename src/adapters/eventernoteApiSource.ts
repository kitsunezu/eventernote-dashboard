import { getPlace, setPlace } from '../lib/placeCache'
import type { ImportedScheduleData, ScheduleEvent } from '../types/events'

const POLL_INTERVAL_MS = 2_000
const MAX_REFRESH_POLLS = 10

interface ApiResponse extends ImportedScheduleData {
  places: Record<string, {
    name: string
    address: string
    region: string
    latitude?: number
    longitude?: number
  }>
  cache: {
    status: 'fresh' | 'stale'
    refreshing: boolean
    userIndexCheckedAt?: string
    pendingDetailCount: number
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function isApiResponse(value: unknown): value is ApiResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ApiResponse>
  return Array.isArray(candidate.events)
    && Array.isArray(candidate.warnings)
    && typeof candidate.importedAt === 'string'
    && Boolean(candidate.cache)
    && Boolean(candidate.places)
}

async function fetchUserEvents(userId: string, forceRefresh = false): Promise<ApiResponse> {
  const query = forceRefresh ? '?refresh=1' : ''
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/events${query}`, {
    headers: { 'Accept': 'application/json' },
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error)
      : `HTTP ${response.status}`
    throw new Error(message)
  }
  if (!isApiResponse(payload)) throw new Error('Event API returned an invalid response')
  return payload
}

async function refreshUserEvent(userId: string, eventId: string): Promise<ApiResponse> {
  const response = await fetch(
    `/api/users/${encodeURIComponent(userId)}/events/${encodeURIComponent(eventId)}/refresh`,
    {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    },
  )
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error)
      : `HTTP ${response.status}`
    throw new Error(message)
  }
  if (!isApiResponse(payload)) throw new Error('Event refresh API returned an invalid response')
  return payload
}

function persistPlaces(response: ApiResponse): void {
  for (const [placeId, place] of Object.entries(response.places)) {
    const current = getPlace(placeId)
    if (JSON.stringify(current) !== JSON.stringify(place)) setPlace(placeId, place)
  }
}

export async function loadEventernoteUserFromApi(
  userId: string,
  onProgress?: (partial: { events: ScheduleEvent[]; warnings: string[] }) => void,
  forceRefresh = false,
): Promise<ImportedScheduleData> {
  let response = await fetchUserEvents(userId, forceRefresh)
  persistPlaces(response)
  onProgress?.({ events: response.events, warnings: response.warnings })

  for (let attempt = 0; response.cache.refreshing && attempt < MAX_REFRESH_POLLS; attempt += 1) {
    await delay(POLL_INTERVAL_MS)
    const updated = await fetchUserEvents(userId)
    persistPlaces(updated)
    if (updated.importedAt !== response.importedAt || updated.events.length !== response.events.length) {
      onProgress?.({ events: updated.events, warnings: updated.warnings })
    }
    response = updated
  }

  return {
    events: response.events,
    warnings: response.warnings,
    sourceType: 'backend',
    importedAt: response.importedAt,
  }
}

export async function refreshEventernoteEvent(
  userId: string,
  eventId: string,
): Promise<ImportedScheduleData> {
  const response = await refreshUserEvent(userId, eventId)
  persistPlaces(response)
  return {
    events: response.events,
    warnings: response.warnings,
    sourceType: 'backend',
    importedAt: response.importedAt,
  }
}
