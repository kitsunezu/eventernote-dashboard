import { createHash } from 'node:crypto'
import type { Pool } from 'pg'
import type { ServerConfig } from './config.js'
import { parseEventDetail, parsePlaceDetail, parseUserEventsPage } from './parser.js'
import { EventRepository } from './repository.js'
import type { EventSeed, StoredEvent, SyncStats } from './types.js'
import { EventernoteClient } from './upstream.js'

const PLACE_TTL_MS = 90 * 24 * 60 * 60 * 1000
const CLOSE_EVENT_TTL_MS = 60 * 60 * 1000
const FUTURE_EVENT_TTL_MS = 6 * 60 * 60 * 1000
const PAST_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000

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

export class EventSyncService {
  private readonly inFlight = new Map<string, Promise<void>>()
  private readonly pool: Pool
  private readonly repository: EventRepository
  private readonly upstream: EventernoteClient
  private readonly config: ServerConfig

  constructor(
    pool: Pool,
    repository: EventRepository,
    upstream: EventernoteClient,
    config: ServerConfig,
  ) {
    this.pool = pool
    this.repository = repository
    this.upstream = upstream
    this.config = config
  }

  isRunning(userId: string): boolean {
    return this.inFlight.has(userId)
  }

  start(userId: string): Promise<void> {
    const existing = this.inFlight.get(userId)
    if (existing) return existing
    const synchronization = this.synchronizeWithLock(userId)
      .finally(() => this.inFlight.delete(userId))
    this.inFlight.set(userId, synchronization)
    return synchronization
  }

  private async synchronizeWithLock(userId: string): Promise<void> {
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
      await this.synchronize(userId)
    } finally {
      if (acquired) {
        await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`eventernote-user:${userId}`])
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

  private async synchronize(userId: string): Promise<void> {
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

      const storedEvents = await this.repository.getStoredEvents(userId)
      const now = Date.now()
      const detailCandidates = storedEvents
        .filter((event) => {
          if (!event.detailFetchedAt) return true
          return now - new Date(event.detailFetchedAt).getTime() >= detailTtlMs(event, now)
        })
        .sort((left, right) => compareRefreshPriority(left, right, now))
        .slice(0, this.config.detailFetchLimit)

      const refreshedPlaceIds = new Set<string>()
      await mapWithConcurrency(detailCandidates, this.config.detailFetchConcurrency, async (event) => {
        try {
          const html = await this.upstream.fetchHtml(`/events/${event.id}`)
          const detail = parseEventDetail(html, event.id)
          await this.repository.saveEventDetail(detail, hashHtml(html))
          if (detail.placeId) refreshedPlaceIds.add(detail.placeId)
          stats.refreshedDetails += 1
        } catch (error) {
          stats.warnings.push(
            `Detail ${event.id}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      })

      const placeCandidates = await this.repository.getPlaceCandidates(
        Array.from(refreshedPlaceIds),
        new Date(Date.now() - PLACE_TTL_MS),
        this.config.placeFetchLimit,
      )
      await mapWithConcurrency(placeCandidates, 2, async (place) => {
        try {
          const html = await this.upstream.fetchHtml(`/places/${place.place_id}`)
          const detail = parsePlaceDetail(html, place.place_id, place.name)
          await this.repository.savePlaceDetail(detail, hashHtml(html))
          stats.refreshedPlaces += 1
        } catch (error) {
          stats.warnings.push(
            `Place ${place.place_id}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      })

      await this.repository.completeSyncJob(jobId, stats)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.repository.failSyncJob(userId, jobId, message)
      throw error
    }
  }

  private async fetchUserIndex(userId: string): Promise<EventSeed[]> {
    const firstPath = `/users/${encodeURIComponent(userId)}/events`
    const firstPage = parseUserEventsPage(await this.upstream.fetchHtml(firstPath))
    if (firstPage.paginationPaths.length > this.config.maxListPages) {
      throw new Error(
        `User index has ${firstPage.paginationPaths.length} pages; maximum is ${this.config.maxListPages}`,
      )
    }

    const pages = [firstPage]
    await mapWithConcurrency(firstPage.paginationPaths, 2, async (path) => {
      pages.push(parseUserEventsPage(await this.upstream.fetchHtml(path)))
    })

    const byId = new Map<string, EventSeed>()
    for (const page of pages) {
      for (const event of page.events) byId.set(event.id, event)
    }
    return Array.from(byId.values())
  }
}
