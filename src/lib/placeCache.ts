/** Persistent cache for Eventernote place IDs → venue metadata.
 *  Stored in localStorage so repeated loads skip re-parsing known venues.
 *  Also syncs to/from /places-cache.json via /api/places-cache (dev Vite plugin).
 */

const PLACE_CACHE_KEY = 'eventernote:places:v1'
const SERVER_SEED_URL = '/places-cache.json'
const SERVER_POST_URL = '/api/places-cache'

export interface PlaceEntry {
  name: string
  address: string
  region: string
}

type PlaceCache = Record<string, PlaceEntry>

function readCache(): PlaceCache {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PLACE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as PlaceCache) : {}
  } catch {
    return {}
  }
}

function writeCache(cache: PlaceCache): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // quota exceeded — silently ignore
  }
}

export function getPlace(placeId: string): PlaceEntry | undefined {
  return readCache()[placeId]
}

export function getAllPlaces(): PlaceCache {
  return readCache()
}

export function setPlace(placeId: string, entry: PlaceEntry): void {
  const cache = readCache()
  cache[placeId] = entry
  writeCache(cache)
  void postPlaceToServer(placeId, entry)
}

/**
 * Load the server-side seed file (/places-cache.json) and merge entries that
 * are not yet in localStorage.  Call once on app startup (fire-and-forget).
 */
export async function loadServerSeedCache(): Promise<void> {
  try {
    const resp = await fetch(SERVER_SEED_URL)
    if (!resp.ok) return
    const seed = (await resp.json()) as PlaceCache
    const current = readCache()
    let changed = false
    for (const [id, entry] of Object.entries(seed)) {
      if (!current[id]) {
        current[id] = entry
        changed = true
      }
    }
    if (changed) writeCache(current)
  } catch {
    // server cache is optional — silently ignore
  }
}

/**
 * Persist a new place entry to the server seed file via the Vite dev plugin
 * endpoint (POST /api/places-cache).  Silently no-ops in production where
 * the endpoint does not exist.
 */
async function postPlaceToServer(placeId: string, entry: PlaceEntry): Promise<void> {
  try {
    await fetch(SERVER_POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [placeId]: entry }),
    })
  } catch {
    // best-effort only
  }
}
