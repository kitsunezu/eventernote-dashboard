import { createHash } from 'node:crypto'
import type { Pool } from 'pg'
import type { ServerConfig } from './config.js'
import { hasUsableCoordinates } from './coordinates.js'
import type { Coordinates } from './coordinates.js'
import { GEOCODER_STRATEGY_VERSION, VenueGeocoder } from './geocoder.js'
import { parseEventDetail, parseParticipationCalendar, parsePlaceDetail, parseUserEventsPage } from './parser.js'
import { EventRepository } from './repository.js'
import type { EventSeed, ParsedUserEventsPage, StoredEvent, SyncStats } from './types.js'
import { EventernoteClient } from './upstream.js'

const PLACE_TTL_MS = 90 * 24 * 60 * 60 * 1000
const CLOSE_EVENT_TTL_MS = 60 * 60 * 1000
const FUTURE_EVENT_TTL_MS = 6 * 60 * 60 * 1000
const PAST_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const FAILED_GEOCODE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MANUAL_PLACE_REFRESH_COOLDOWN_MS = 60 * 1000
const MAX_MANUAL_USER_REFRESHES = 4
const ENRICHMENT_RETRY_COOLDOWN_MS = 5 * 60 * 1000

interface PlaceRefreshInFlight {
  forceGeocode: boolean
  promise: Promise<boolean>
}

function hashHtml(html: string): string {
  return createHash('sha256').update(html).digest('hex')
}

function detailTtlMs(event: StoredEvent, now: number): number {
  const startAt = new Date(event.startAt).getTime()
  if (startAt < now) return PAST_EVENT_TTL_MS
  if (startAt - now <= 48 * 60 * 60 * 1000) return CLOSE_EVENT_TTL_MS
  return FUTURE_EVENT_TTL_MS
}

function compareRefreshPriority(left: StoredEvent, right: StoredEvent, now: number): number {
  const leftMissing = left.detailFetchedAt ? 1 : 0
  const rightMissing = right.detailFetchedAt ? 1 : 0
  if (leftMissing !== rightMissing) return leftMissing - rightMissing

  const leftFuture = new Date(left.startAt).getTime() >= now ? 0 : 1
  const rightFuture = new Date(right.startAt).getTime() >= now ? 0 : 1
  if (leftFuture !== rightFuture) return leftFuture - rightFuture
  return leftFuture === 0
    ? left.startAt.localeCompare(right.startAt)
    : right.startAt.localeCompare(left.startAt)
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  async function worker(): Promise<void> {
    while (index < items.length) {
      const item = items[index]
      index += 1
      await work(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

function paginationPageNumber(path: string, expectedPathname: string): number | undefined {
  try {
    const url = new URL(path, 'https://www.eventernote.com')
    const normalizedPathname = (value: string) => value.replace(/\/$/, '')
    if (url.origin !== 'https://www.eventernote.com'
      || normalizedPathname(url.pathname) !== normalizedPathname(expectedPathname)) return undefined
    const rawPage = url.searchParams.get('page')
    if (!rawPage || !/^\d+$/.test(rawPage)) return undefined
    const page = Number(rawPage)
    return Number.isSafeInteger(page) && page > 1 ? page : undefined
  } catch {
    return undefined
  }
}

export async function fetchUserEventIndex(
  userId: string,
  fetchHtml: (path: string) => Promise<string>,
  maxPages: number,
): Promise<EventSeed[]> {
  const profilePath = `/users/${encodeURIComponent(userId)}`
  const calendar = parseParticipationCalendar(await fetchHtml(profilePath), userId)
  if (calendar.length > 0) {
    const byId = new Map<string, EventSeed>()
    for (const month of calendar) {
      const pages = await fetchPaginatedEventPages(month.path, fetchHtml, maxPages)
      const events = pages.flatMap((page) => page.events)
      if (events.length !== month.count) {
        throw new Error(
          `Eventernote participation calendar mismatch for ${month.path}: expected ${month.count} rows, found ${events.length}`,
        )
      }
      for (const event of events) byId.set(event.id, event)
    }
    return Array.from(byId.values())
  }

  return fetchPaginatedEventIndex(`/users/${encodeURIComponent(userId)}/events`, fetchHtml, maxPages)
}

async function fetchPaginatedEventIndex(
  startPath: string,
  fetchHtml: (path: string) => Promise<string>,
  maxPages: number,
): Promise<EventSeed[]> {
  const pages = await fetchPaginatedEventPages(startPath, fetchHtml, maxPages)
  const byId = new Map<string, EventSeed>()
  for (const page of pages) {
    for (const event of page.events) byId.set(event.id, event)
  }
  return Array.from(byId.values())
}

async function fetchPaginatedEventPages(
  startPath: string,
  fetchHtml: (path: string) => Promise<string>,
  maxPages: number,
): Promise<ParsedUserEventsPage[]> {
  const expectedPathname = new URL(startPath, 'https://www.eventernote.com').pathname
  const firstPage = parseUserEventsPage(await fetchHtml(startPath))
  const pages = [firstPage]
  const discoveredPages = new Set([1])
  const queuedPaths: string[] = []

  function enqueue(paths: string[]): void {
    for (const path of paths) {
      const page = paginationPageNumber(path, expectedPathname)
      if (page === undefined || discoveredPages.has(page)) continue
      if (page > maxPages) {
        throw new Error(`User index has at least ${page} pages; maximum is ${maxPages}`)
      }
      discoveredPages.add(page)
      queuedPaths.push(path)
    }
  }

  enqueue(firstPage.paginationPaths)
  while (queuedPaths.length > 0) {
    const batch = queuedPaths.splice(0, 2)
    const fetchedPages = await Promise.all(batch.map(async (path) => {
      return parseUserEventsPage(await fetchHtml(path))
    }))
    for (const page of fetchedPages) {
      pages.push(page)
      enqueue(page.paginationPaths)
    }
  }

  return pages
}

export class EventSyncService {
  private readonly inFlight = new Map<string, Promise<void>>()
  private readonly enrichmentInFlight = new Map<string, Promise<void>>()
  private readonly enrichmentCompletedAt = new Map<string, number>()
  private readonly placeRefreshes = new Map<string, PlaceRefreshInFlight>()
  private readonly manualUserRefreshes = new Map<string, Promise<string[]>>()
  private readonly manualPlaceRefreshes = new Map<string, Promise<boolean>>()
  private readonly manualPlaceRefreshStartedAt = new Map<string, number>()
  private manualPlaceActiveCount = 0
  private readonly manualPlaceWaiters: Array<() => void> = []
  private readonly pool: Pool
  private readonly repository: EventRepository
  private readonly upstream: EventernoteClient
  private readonly geocoder: VenueGeocoder
  private readonly config: ServerConfig

  constructor(
    pool: Pool,
    repository: EventRepository,
    upstream: EventernoteClient,
    geocoder: VenueGeocoder,
    config: ServerConfig,
  ) {
    this.pool = pool
    this.repository = repository
    this.upstream = upstream
    this.geocoder = geocoder
    this.config = config
  }

  isRunning(userId: string): boolean {
    return this.inFlight.has(userId) || this.enrichmentInFlight.has(userId)
  }

  start(userId: string): Promise<void> {
    const existing = this.inFlight.get(userId)
    if (existing) return existing
    const synchronization = this.synchronizeIndexWithLock(userId)
      .then(() => {
        void this.startEnrichment(userId, true).catch((error) => {
          console.error(`Background enrichment failed for ${userId}`, error)
        })
      })
      .finally(() => this.inFlight.delete(userId))
    this.inFlight.set(userId, synchronization)
    return synchronization
  }

  startEnrichment(userId: string, bypassCooldown = false): Promise<void> {
    const existing = this.enrichmentInFlight.get(userId)
    if (existing) return existing
    const completedAt = this.enrichmentCompletedAt.get(userId)
    if (!bypassCooldown && completedAt !== undefined
      && Date.now() - completedAt < ENRICHMENT_RETRY_COOLDOWN_MS) {
      return Promise.resolve()
    }
    const enrichment = this.synchronizeEnrichmentWithLock(userId)
      .finally(() => {
        const completedAt = Date.now()
        this.enrichmentCompletedAt.set(userId, completedAt)
        const cleanup = setTimeout(() => {
          if (this.enrichmentCompletedAt.get(userId) === completedAt) {
            this.enrichmentCompletedAt.delete(userId)
          }
        }, ENRICHMENT_RETRY_COOLDOWN_MS)
        cleanup.unref()
        if (this.enrichmentInFlight.get(userId) === enrichment) {
          this.enrichmentInFlight.delete(userId)
        }
      })
    this.enrichmentInFlight.set(userId, enrichment)
    return enrichment
  }

  async refreshEvent(userId: string, eventId: string): Promise<string[]> {
    if (!await this.repository.hasActiveEvent(userId, eventId)) {
      throw new Error(`Event ${eventId} is not active for ${userId}`)
    }

    const warnings: string[] = []
    const html = await this.upstream.fetchHtml(`/events/${eventId}`)
    const detail = parseEventDetail(html, eventId)
    await this.repository.saveEventDetail(detail, hashHtml(html))

    if (detail.placeId) {
      try {
        await this.refreshPlace(detail.placeId, detail.venue)
      } catch (error) {
        warnings.push(`Place ${detail.placeId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return warnings
  }

  refreshUnmappedPlaces(userId: string, placeIds: string[]): Promise<string[]> {
    if (this.manualUserRefreshes.has(userId)) {
      return Promise.resolve(['Another manual place refresh is already running'])
    }
    if (this.manualUserRefreshes.size >= MAX_MANUAL_USER_REFRESHES) {
      return Promise.resolve(['Manual place refresh is temporarily busy'])
    }
    const refresh = this.performUnmappedPlaceRefresh(userId, placeIds).finally(() => {
      if (this.manualUserRefreshes.get(userId) === refresh) this.manualUserRefreshes.delete(userId)
    })
    this.manualUserRefreshes.set(userId, refresh)
    return refresh
  }

  private async performUnmappedPlaceRefresh(userId: string, placeIds: string[]): Promise<string[]> {
    const requestedIds = Array.from(new Set(placeIds))
    const places = (await this.repository.getRequestedPlacesForUser(userId, requestedIds))
      .filter((place) => !hasUsableCoordinates(place))
    const warnings: string[] = []
    const now = Date.now()
    for (const [placeId, startedAt] of this.manualPlaceRefreshStartedAt) {
      if (now - startedAt >= MANUAL_PLACE_REFRESH_COOLDOWN_MS) {
        this.manualPlaceRefreshStartedAt.delete(placeId)
      }
    }

    await mapWithConcurrency(places, 2, async (place) => {
      try {
        let refresh = this.manualPlaceRefreshes.get(place.id)
        if (!refresh) {
          const startedAt = this.manualPlaceRefreshStartedAt.get(place.id)
          if (startedAt !== undefined && now - startedAt < MANUAL_PLACE_REFRESH_COOLDOWN_MS) {
            warnings.push(`Place ${place.id}: manual retry is temporarily throttled`)
            return
          }
          this.manualPlaceRefreshStartedAt.set(place.id, now)
          refresh = this.withManualPlaceSlot(
            () => this.refreshPlace(place.id, place.name, true),
          ).finally(() => {
            if (this.manualPlaceRefreshes.get(place.id) === refresh) {
              this.manualPlaceRefreshes.delete(place.id)
            }
          })
          this.manualPlaceRefreshes.set(place.id, refresh)
        }
        if (!await refresh) warnings.push(`Place ${place.id}: no coordinates found`)
      } catch (error) {
        warnings.push(`Place ${place.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
    return warnings
  }

  private async withManualPlaceSlot<T>(work: () => Promise<T>): Promise<T> {
    if (this.manualPlaceActiveCount >= 2) {
      await new Promise<void>((resolve) => this.manualPlaceWaiters.push(resolve))
    }
    this.manualPlaceActiveCount += 1
    try {
      return await work()
    } finally {
      this.manualPlaceActiveCount -= 1
      this.manualPlaceWaiters.shift()?.()
    }
  }

  private async synchronizeIndexWithLock(userId: string): Promise<void> {
    const lockClient = await this.pool.connect()
    let acquired = false
    try {
      const result = await lockClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [`eventernote-user:${userId}`],
      )
      acquired = result.rows[0].acquired
      if (!acquired) {
        await this.waitForPeerSync(userId)
        return
      }
      await this.synchronizeIndex(userId)
    } finally {
      if (acquired) {
        await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`eventernote-user:${userId}`])
          .catch(() => undefined)
      }
      lockClient.release()
    }
  }

  private async synchronizeEnrichmentWithLock(userId: string): Promise<void> {
    const lockClient = await this.pool.connect()
    let acquired = false
    try {
      const result = await lockClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [`eventernote-enrichment:${userId}`],
      )
      acquired = result.rows[0].acquired
      if (!acquired) return
      await this.synchronizeEnrichment(userId)
    } finally {
      if (acquired) {
        await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`eventernote-enrichment:${userId}`])
          .catch(() => undefined)
      }
      lockClient.release()
    }
  }

  private async waitForPeerSync(userId: string): Promise<void> {
    const previousSuccess = (await this.repository.getSnapshot(userId)).lastIndexSuccessAt
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const currentSuccess = (await this.repository.getSnapshot(userId)).lastIndexSuccessAt
      if (currentSuccess && currentSuccess !== previousSuccess) return
    }
    throw new Error(`Timed out waiting for another synchronization of ${userId}`)
  }

  private async synchronizeIndex(userId: string): Promise<void> {
    const jobId = await this.repository.createSyncJob(userId)
    const stats: SyncStats = {
      discoveredEvents: 0,
      refreshedDetails: 0,
      refreshedPlaces: 0,
      warnings: [],
    }

    try {
      const events = await this.fetchUserIndex(userId)
      stats.discoveredEvents = events.length
      await this.repository.saveUserIndex(userId, events)

      await this.repository.completeSyncJob(jobId, stats)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.repository.failSyncJob(userId, jobId, message)
      throw error
    }
  }

  private async synchronizeEnrichment(userId: string): Promise<void> {
    const jobId = await this.repository.createEnrichmentJob(userId)
    const stats: SyncStats = {
      discoveredEvents: 0,
      refreshedDetails: 0,
      refreshedPlaces: 0,
      warnings: [],
    }

    try {
      const attemptedPlaceIds = new Set<string>()
      await Promise.all([
        this.refreshPendingEventDetails(userId, stats),
        this.refreshPendingPlaces(userId, stats, attemptedPlaceIds),
      ])
      await this.refreshPendingPlaces(userId, stats, attemptedPlaceIds)
      await this.repository.completeSyncJob(jobId, stats)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.repository.failEnrichmentJob(jobId, message)
      throw error
    }
  }

  private async refreshPendingEventDetails(userId: string, stats: SyncStats): Promise<void> {
    const attemptedEventIds = new Set<string>()
    while (true) {
      const now = Date.now()
      const detailCandidates = (await this.repository.getStoredEvents(userId))
        .filter((event) => {
          if (attemptedEventIds.has(event.id)) return false
          if (!event.detailFetchedAt) return true
          return now - new Date(event.detailFetchedAt).getTime() >= detailTtlMs(event, now)
        })
        .sort((left, right) => compareRefreshPriority(left, right, now))
        .slice(0, this.config.detailFetchLimit)
      if (detailCandidates.length === 0) return
      detailCandidates.forEach((event) => attemptedEventIds.add(event.id))

      await mapWithConcurrency(detailCandidates, this.config.detailFetchConcurrency, async (event) => {
        try {
          const html = await this.upstream.fetchHtml(`/events/${event.id}`)
          const detail = parseEventDetail(html, event.id)
          await this.repository.saveEventDetail(detail, hashHtml(html))
          stats.refreshedDetails += 1
        } catch (error) {
          stats.warnings.push(
            `Detail ${event.id}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      })
    }
  }

  private async refreshPendingPlaces(
    userId: string,
    stats: SyncStats,
    attemptedPlaceIds: Set<string>,
  ): Promise<void> {
    while (true) {
      const placeCandidates = (await this.repository.getPlaceCandidatesForUser(
        userId,
        new Date(Date.now() - PLACE_TTL_MS),
        attemptedPlaceIds.size + this.config.placeFetchLimit,
      ))
        .filter((place) => !attemptedPlaceIds.has(place.place_id))
        .slice(0, this.config.placeFetchLimit)
      if (placeCandidates.length === 0) return
      placeCandidates.forEach((place) => attemptedPlaceIds.add(place.place_id))

      await mapWithConcurrency(placeCandidates, 2, async (place) => {
        try {
          await this.refreshPlace(place.place_id, place.name)
          stats.refreshedPlaces += 1
        } catch (error) {
          stats.warnings.push(
            `Place ${place.place_id}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      })
    }
  }

  private async fetchUserIndex(userId: string): Promise<EventSeed[]> {
    return fetchUserEventIndex(
      userId,
      (path) => this.upstream.fetchHtml(path),
      this.config.maxListPages,
    )
  }

  private refreshPlace(placeId: string, fallbackName: string, forceGeocode = false): Promise<boolean> {
    const existing = this.placeRefreshes.get(placeId)
    if (existing) {
      if (!forceGeocode || existing.forceGeocode) return existing.promise
      return existing.promise.then(() => this.refreshPlace(placeId, fallbackName, true))
    }

    const promise = this.performPlaceRefresh(placeId, fallbackName, forceGeocode).finally(() => {
      if (this.placeRefreshes.get(placeId)?.promise === promise) this.placeRefreshes.delete(placeId)
    })
    this.placeRefreshes.set(placeId, { forceGeocode, promise })
    return promise
  }

  private async performPlaceRefresh(
    placeId: string,
    fallbackName: string,
    forceGeocode: boolean,
  ): Promise<boolean> {
    const html = await this.upstream.fetchHtml(`/places/${placeId}`)
    const detail = parsePlaceDetail(html, placeId, fallbackName)
    let geocodeAttempted = false
    if (!hasUsableCoordinates(detail)) {
      const stored = await this.repository.getPlace(placeId)
      const storedCoordinatesAreCurrent = stored?.address === detail.address && hasUsableCoordinates(stored)
      const recentFailedAttempt = stored?.address === detail.address
        && stored.geocodeAttemptedAt !== undefined
        && stored.geocodeVersion === GEOCODER_STRATEGY_VERSION
        && Date.now() - new Date(stored.geocodeAttemptedAt).getTime() < FAILED_GEOCODE_TTL_MS
      let resolved: Coordinates | undefined = storedCoordinatesAreCurrent ? stored : undefined
      if (!resolved && (forceGeocode || !recentFailedAttempt)) {
        geocodeAttempted = true
        resolved = await this.geocoder.geocode(detail.name, detail.address)
      }
      if (resolved) {
        detail.latitude = resolved.latitude
        detail.longitude = resolved.longitude
      }
    }
    await this.repository.savePlaceDetail(
      detail,
      hashHtml(html),
      geocodeAttempted ? GEOCODER_STRATEGY_VERSION : undefined,
    )
    return hasUsableCoordinates(detail)
  }
}
