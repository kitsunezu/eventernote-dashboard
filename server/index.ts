import { createServer } from 'node:http'
import { loadConfig } from './config.js'
import { createPool, migrate } from './db.js'
import { VenueGeocoder } from './geocoder.js'
import { EventRepository } from './repository.js'
import { EventSyncService } from './sync.js'
import type { EventApiResponse } from './types.js'
import { EventernoteClient } from './upstream.js'

const USER_ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

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
        },
      }
      jsonResponse(response, 200, payload)
    } catch (error) {
      console.error('API request failed', error)
      jsonResponse(response, 502, {
        error: error instanceof Error ? error.message : 'Failed to load Eventernote data',
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
