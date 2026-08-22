import type {
  EventIndexProgress,
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
    indexProgress?: EventIndexProgress
  }
}

export interface EventernoteLoadProgress {
  events: ScheduleEvent[]
  places: Record<string, SchedulePlace>
  warnings: string[]
  importedAt: string
  participationCalendar: ParticipationCalendarMonth[]
  indexProgress?: EventIndexProgress
}

export interface ActorSuggestion {
  id: string
  name: string
  kana: string
}

function sourceApiPath(sourceId: string): string {
  if (sourceId.startsWith('actor:')) {
    const [actorId] = sourceId.slice('actor:'.length).split(':')
    return `/api/actors/${encodeURIComponent(actorId)}`
  }
  return `/api/users/${encodeURIComponent(sourceId)}`
}

function actorNameFromSourceId(sourceId: string): string | undefined {
  if (!sourceId.startsWith('actor:')) return undefined
  const [, ...nameParts] = sourceId.slice('actor:'.length).split(':')
  return nameParts.length > 0 ? nameParts.join(':') : undefined
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
  const query = new URLSearchParams()
  if (forceRefresh) query.set('refresh', '1')
  const actorName = actorNameFromSourceId(userId)
  if (actorName) query.set('name', actorName)
  const queryString = query.size > 0 ? `?${query}` : ''
  const response = await fetch(`${sourceApiPath(userId)}/events${queryString}`, {
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
    `${sourceApiPath(userId)}/events/${encodeURIComponent(eventId)}/refresh`,
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
  const response = await fetch(`${sourceApiPath(userId)}/places/refresh`, {
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
  onProgress?: (partial: EventernoteLoadProgress) => void,
  forceRefresh = false,
): Promise<ImportedScheduleData> {
  let response = await fetchUserEvents(userId, forceRefresh)
  let publishedVersion = ''

  function publishIfChanged(next: ApiResponse): void {
    const indexProgress = next.cache.indexProgress
    const version = `${next.cache.dataVersion}:${next.cache.pendingDetailCount}:${next.cache.pendingPlaceCount}`
      + `:${indexProgress?.processedMonths ?? '-'}:${indexProgress?.indexedEventCount ?? '-'}`
    if (version === publishedVersion) return
    publishedVersion = version
    onProgress?.({
      events: next.events,
      places: next.places,
      warnings: next.warnings,
      importedAt: next.importedAt,
      participationCalendar: next.participationCalendar,
      indexProgress,
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
  onBatch?: (partial: ImportedScheduleData) => void,
): Promise<ImportedScheduleData> {
  const uniquePlaceIds = Array.from(new Set(placeIds))
  let latest: ApiResponse | undefined
  const warnings: string[] = []
  for (let index = 0; index < uniquePlaceIds.length; index += PLACE_REFRESH_BATCH_SIZE) {
    try {
      latest = await refreshUserPlaces(userId, uniquePlaceIds.slice(index, index + PLACE_REFRESH_BATCH_SIZE))
      warnings.push(...latest.warnings)
      onBatch?.({
        events: latest.events,
        places: latest.places,
        warnings: [...warnings],
        sourceType: 'backend',
        importedAt: latest.importedAt,
        participationCalendar: latest.participationCalendar,
      })
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

export async function searchEventernoteActors(
  keyword: string,
  signal?: AbortSignal,
): Promise<ActorSuggestion[]> {
  const response = await fetch(`/api/actors/search?keyword=${encodeURIComponent(keyword)}`, {
    headers: { 'Accept': 'application/json' },
    signal,
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) throw new Error(`Actor search failed with HTTP ${response.status}`)
  if (!payload || typeof payload !== 'object' || !('suggestions' in payload)
    || !Array.isArray(payload.suggestions)) {
    throw new Error('Actor search returned an invalid response')
  }
  return payload.suggestions.filter((item): item is ActorSuggestion => {
    if (!item || typeof item !== 'object') return false
    const suggestion = item as Partial<ActorSuggestion>
    return typeof suggestion.id === 'string'
      && typeof suggestion.name === 'string'
      && typeof suggestion.kana === 'string'
  })
}
