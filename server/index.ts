import { timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { z } from 'zod'
import { loadConfig } from './config.js'
import { createPool, migrate } from './db.js'
import { VenueGeocoder } from './geocoder.js'
import { EventRepository } from './repository.js'
import { EventSyncService } from './sync.js'
import type { EventApiResponse } from './types.js'
import { EventernoteClient } from './upstream.js'

const USER_ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

const importSchema = z.object({
  userId: z.string().regex(USER_ID_PATTERN),
  event: z.object({
    id: z.string().regex(/^\d+$/),
    title: z.string().trim().min(1).max(500),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    openTime: z.string().regex(/^$|^\d{2}:\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^$|^\d{2}:\d{2}$/),
    description: z.string().max(10_000),
    officialUrl: z.string().max(2_000),
    imageUrl: z.string().max(2_000),
    venue: z.string().max(300),
    placeId: z.string().regex(/^\d*$/),
    placeAddress: z.string().max(500),
    actors: z.array(z.string().max(200)).max(100),
  }),
})

const placeRefreshSchema = z.object({
  placeIds: z.array(z.string().regex(/^\d+$/)).min(1).max(20),
})

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error('Request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function hasImportToken(request: IncomingMessage, expected?: string): boolean {
  if (!expected) return false
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? ''
  const left = Buffer.from(expected)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

function jsonResponse(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

async function main(): Promise<void> {
  const config = loadConfig()
  const pool = createPool(config.databaseUrl)
  await migrate(pool)
  const repository = new EventRepository(pool)
  const upstream = new EventernoteClient(
    config.eventernoteOrigin,
    config.upstreamTimeoutMs,
    config.upstreamMinIntervalMs,
  )
  const geocoder = new VenueGeocoder(
    config.gsiGeocoderUrl,
    config.nominatimGeocoderUrl,
    config.geocoderTimeoutMs,
    config.nominatimMinIntervalMs,
  )
  const syncService = new EventSyncService(pool, repository, upstream, geocoder, config)

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
      if (request.method === 'GET' && url.pathname === '/health') {
        await pool.query('SELECT 1')
        jsonResponse(response, 200, { ok: true })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/internal/events/import') {
        if (!config.internalImportToken) {
          jsonResponse(response, 503, { error: 'Internal event import is not configured' })
          return
        }
        if (!hasImportToken(request, config.internalImportToken)) {
          jsonResponse(response, 401, { error: 'Unauthorized' })
          return
        }
        const input = importSchema.parse(await readJson(request))
        await repository.importExternalEvent(input)
        jsonResponse(response, 201, { ok: true, eventId: input.event.id })
        return
      }

      const placeRefreshRoute = url.pathname.match(/^\/api\/users\/([^/]+)\/places\/refresh$/)
      if (request.method === 'POST' && placeRefreshRoute) {
        const userId = decodeURIComponent(placeRefreshRoute[1])
        if (!USER_ID_PATTERN.test(userId)) {
          jsonResponse(response, 400, { error: 'Invalid Eventernote user ID' })
          return
        }
        const { placeIds } = placeRefreshSchema.parse(await readJson(request))
        const warnings = await syncService.refreshUnmappedPlaces(userId, placeIds)
        const snapshot = await repository.getSnapshot(userId)
        const userIndexFresh = snapshot.lastIndexSuccessAt !== undefined
          && Date.now() - new Date(snapshot.lastIndexSuccessAt).getTime() < config.userIndexTtlMs
        const payload: EventApiResponse = {
          events: snapshot.events,
          warnings,
          sourceType: 'backend',
          importedAt: snapshot.lastIndexSuccessAt ?? new Date().toISOString(),
          places: snapshot.places,
          cache: {
            status: userIndexFresh ? 'fresh' : 'stale',
            refreshing: syncService.isRunning(userId),
            userIndexCheckedAt: snapshot.lastIndexSuccessAt,
            pendingDetailCount: snapshot.pendingDetailCount,
            pendingPlaceCount: snapshot.pendingPlaceCount,
          },
        }
        jsonResponse(response, 200, payload)
        return
      }

      const refreshRoute = url.pathname.match(/^\/api\/users\/([^/]+)\/events\/(\d+)\/refresh$/)
      if (request.method === 'POST' && refreshRoute) {
        const userId = decodeURIComponent(refreshRoute[1])
        if (!USER_ID_PATTERN.test(userId)) {
          jsonResponse(response, 400, { error: 'Invalid Eventernote user ID' })
          return
        }
        const warnings = await syncService.refreshEvent(userId, refreshRoute[2])
        const snapshot = await repository.getSnapshot(userId)
        const userIndexFresh = snapshot.lastIndexSuccessAt !== undefined
          && Date.now() - new Date(snapshot.lastIndexSuccessAt).getTime() < config.userIndexTtlMs
        const payload: EventApiResponse = {
          events: snapshot.events,
          warnings,
          sourceType: 'backend',
          importedAt: snapshot.lastIndexSuccessAt ?? new Date().toISOString(),
          places: snapshot.places,
          cache: {
            status: userIndexFresh ? 'fresh' : 'stale',
            refreshing: syncService.isRunning(userId),
            userIndexCheckedAt: snapshot.lastIndexSuccessAt,
            pendingDetailCount: snapshot.pendingDetailCount,
            pendingPlaceCount: snapshot.pendingPlaceCount,
          },
        }
        jsonResponse(response, 200, payload)
        return
      }

      const route = url.pathname.match(/^\/api\/users\/([^/]+)\/events$/)
      if (request.method !== 'GET' || !route) {
        jsonResponse(response, 404, { error: 'Not found' })
        return
      }

      const userId = decodeURIComponent(route[1])
      if (!USER_ID_PATTERN.test(userId)) {
        jsonResponse(response, 400, { error: 'Invalid Eventernote user ID' })
        return
      }

      let snapshot = await repository.getSnapshot(userId)
      const age = snapshot.lastIndexSuccessAt
        ? Date.now() - new Date(snapshot.lastIndexSuccessAt).getTime()
        : Number.POSITIVE_INFINITY
      const fresh = age < config.userIndexTtlMs
      const forceRefresh = url.searchParams.get('refresh') === '1'
      const attemptAge = snapshot.lastIndexAttemptAt
        ? Date.now() - new Date(snapshot.lastIndexAttemptAt).getTime()
        : Number.POSITIVE_INFINITY
      const retryAllowed = attemptAge >= config.syncRetryCooldownMs

      if ((!fresh || forceRefresh) && snapshot.lastIndexSuccessAt && retryAllowed) {
        void syncService.start(userId).catch((error) => {
          console.error(`Background sync failed for ${userId}`, error)
        })
      } else if (!fresh && !snapshot.lastIndexSuccessAt && retryAllowed) {
        await syncService.start(userId)
        snapshot = await repository.getSnapshot(userId)
      } else if (!fresh && !snapshot.lastIndexSuccessAt) {
        throw new Error('The previous synchronization failed; retry is temporarily throttled')
      }

      if ((snapshot.pendingDetailCount > 0 || snapshot.pendingPlaceCount > 0)
        && !syncService.isRunning(userId)) {
        void syncService.startEnrichment(userId).catch((error) => {
          console.error(`Background enrichment failed for ${userId}`, error)
        })
      }

      const stillStale = !snapshot.lastIndexSuccessAt
        || Date.now() - new Date(snapshot.lastIndexSuccessAt).getTime() >= config.userIndexTtlMs
      const payload: EventApiResponse = {
        events: snapshot.events,
        warnings: snapshot.lastError ? [snapshot.lastError] : [],
        sourceType: 'backend',
        importedAt: snapshot.lastIndexSuccessAt ?? new Date().toISOString(),
        places: snapshot.places,
        cache: {
          status: stillStale ? 'stale' : 'fresh',
          refreshing: syncService.isRunning(userId),
          userIndexCheckedAt: snapshot.lastIndexSuccessAt,
          pendingDetailCount: snapshot.pendingDetailCount,
          pendingPlaceCount: snapshot.pendingPlaceCount,
        },
      }
      jsonResponse(response, 200, payload)
    } catch (error) {
      console.error('API request failed', error)
      jsonResponse(response, error instanceof z.ZodError ? 400 : 502, {
        error: error instanceof z.ZodError
          ? error.issues.map((issue) => issue.message).join('; ')
          : error instanceof Error ? error.message : 'Failed to load Eventernote data',
      })
    }
  })

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`Eventernote API listening on port ${config.port}`)
  })

  const shutdown = () => {
    server.close(() => {
      void pool.end().finally(() => process.exit(0))
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  console.error('Failed to start Eventernote API', error)
  process.exit(1)
})
