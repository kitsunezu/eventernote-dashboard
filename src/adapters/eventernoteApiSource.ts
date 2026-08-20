import type {
  ImportedScheduleData,
  ParticipationCalendarMonth,
  ScheduleEvent,
  SchedulePlace,
} from '../types/events'

const POLL_INTERVAL_MS = 2_000
const MAX_REFRESH_POLLS = 900
const PLACE_REFRESH_BATCH_SIZE = 20

interface ApiResponse extends ImportedScheduleData {
  participationCalendar: ParticipationCalendarMonth[]
  places: Record<string, SchedulePlace>
  cache: {
    status: 'fresh' | 'stale'
    refreshing: boolean
    userIndexCheckedAt?: string
    dataVersion: string
    pendingDetailCount: number
    pendingPlaceCount: number
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
    && Array.isArray(candidate.participationCalendar)
    && typeof candidate.importedAt === 'string'
    && Boolean(candidate.cache)
    && Boolean(candidate.places && typeof candidate.places === 'object')
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

async function refreshUserPlaces(userId: string, placeIds: string[]): Promise<ApiResponse> {
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/places/refresh`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ placeIds }),
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error)
      : `HTTP ${response.status}`
    throw new Error(message)
  }
  if (!isApiResponse(payload)) throw new Error('Place refresh API returned an invalid response')
  return payload
}

export async function loadEventernoteUserFromApi(
  userId: string,
  onProgress?: (partial: {
    events: ScheduleEvent[]
    places: Record<string, SchedulePlace>
    warnings: string[]
    importedAt: string
    participationCalendar: ParticipationCalendarMonth[]
  }) => void,
  forceRefresh = false,
): Promise<ImportedScheduleData> {
  let response = await fetchUserEvents(userId, forceRefresh)
  let publishedVersion = ''

  function publishIfChanged(next: ApiResponse): void {
    const version = `${next.cache.dataVersion}:${next.cache.pendingDetailCount}:${next.cache.pendingPlaceCount}`
    if (version === publishedVersion) return
    publishedVersion = version
    onProgress?.({
      events: next.events,
      places: next.places,
      warnings: next.warnings,
      importedAt: next.importedAt,
      participationCalendar: next.participationCalendar,
    })
  }

  publishIfChanged(response)

  for (let attempt = 0; response.cache.refreshing && attempt < MAX_REFRESH_POLLS; attempt += 1) {
    await delay(POLL_INTERVAL_MS)
    const updated = await fetchUserEvents(userId)
    publishIfChanged(updated)
    response = updated
  }

  return {
    events: response.events,
    places: response.places,
    warnings: response.warnings,
    sourceType: 'backend',
    importedAt: response.importedAt,
    participationCalendar: response.participationCalendar,
  }
}

export async function refreshEventernoteEvent(
  userId: string,
  eventId: string,
): Promise<ImportedScheduleData> {
  const response = await refreshUserEvent(userId, eventId)
  return {
    events: response.events,
    places: response.places,
    warnings: response.warnings,
    sourceType: 'backend',
    importedAt: response.importedAt,
    participationCalendar: response.participationCalendar,
  }
}

export async function refreshEventernotePlaces(
  userId: string,
  placeIds: string[],
): Promise<ImportedScheduleData> {
  const uniquePlaceIds = Array.from(new Set(placeIds))
  let latest: ApiResponse | undefined
  const warnings: string[] = []
  for (let index = 0; index < uniquePlaceIds.length; index += PLACE_REFRESH_BATCH_SIZE) {
    try {
      latest = await refreshUserPlaces(userId, uniquePlaceIds.slice(index, index + PLACE_REFRESH_BATCH_SIZE))
      warnings.push(...latest.warnings)
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Place refresh failed')
    }
  }
  if (!latest) throw new Error(warnings[0] ?? 'No places were selected for refresh')
  return {
    events: latest.events,
    places: latest.places,
    warnings,
    sourceType: 'backend',
    importedAt: latest.importedAt,
    participationCalendar: latest.participationCalendar,
  }
}
