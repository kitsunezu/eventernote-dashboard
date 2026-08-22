export interface ServerConfig {
  port: number
  databaseUrl?: string
  eventernoteOrigin: string
  userIndexTtlMs: number
  detailFetchLimit: number
  detailFetchConcurrency: number
  placeFetchLimit: number
  placeFetchConcurrency: number
  upstreamMinIntervalMs: number
  upstreamTimeoutMs: number
  maxListPages: number
  syncRetryCooldownMs: number
  gsiGeocoderUrl: string
  nominatimGeocoderUrl: string
  geocoderTimeoutMs: number
  nominatimMinIntervalMs: number
  internalImportToken?: string
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

export function loadConfig(): ServerConfig {
  return {
    port: positiveInteger('PORT', 8787),
    databaseUrl: process.env.DATABASE_URL,
    eventernoteOrigin: process.env.EVENTERNOTE_UPSTREAM ?? 'https://www.eventernote.com',
    userIndexTtlMs: positiveInteger('USER_INDEX_TTL_MS', 6 * 60 * 60 * 1000),
    detailFetchLimit: positiveInteger('DETAIL_FETCH_LIMIT', 40),
    detailFetchConcurrency: positiveInteger('DETAIL_FETCH_CONCURRENCY', 3),
    placeFetchLimit: positiveInteger('PLACE_FETCH_LIMIT', 20),
    placeFetchConcurrency: positiveInteger('PLACE_FETCH_CONCURRENCY', 4),
    upstreamMinIntervalMs: positiveInteger('UPSTREAM_MIN_INTERVAL_MS', 350),
    upstreamTimeoutMs: positiveInteger('UPSTREAM_TIMEOUT_MS', 20_000),
    maxListPages: positiveInteger('MAX_LIST_PAGES', 100),
    syncRetryCooldownMs: positiveInteger('SYNC_RETRY_COOLDOWN_MS', 5 * 60 * 1000),
    gsiGeocoderUrl: process.env.GSI_GEOCODER_URL
      ?? 'https://msearch.gsi.go.jp/address-search/AddressSearch',
    nominatimGeocoderUrl: process.env.NOMINATIM_GEOCODER_URL
      ?? 'https://nominatim.openstreetmap.org/search',
    geocoderTimeoutMs: positiveInteger('GEOCODER_TIMEOUT_MS', 10_000),
    nominatimMinIntervalMs: positiveInteger('NOMINATIM_MIN_INTERVAL_MS', 1_100),
    internalImportToken: process.env.DASHBOARD_IMPORT_TOKEN,
  }
}
