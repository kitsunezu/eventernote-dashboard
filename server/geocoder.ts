import { hasUsableCoordinates } from './coordinates.js'
import type { Coordinates } from './coordinates.js'
import { extractJapanesePrefecture } from './regions.js'

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

interface GsiFeature {
  geometry?: {
    coordinates?: unknown
  }
  properties?: {
    title?: unknown
  }
}

interface NominatimResult {
  lat?: unknown
  lon?: unknown
  place_rank?: unknown
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean)))
}

export function buildGeocodingQueries(name: string, address: string): string[] {
  const withoutPostalCode = address.replace(/〒?\s*\d{3}-?\d{4}\s*/g, '').trim()
  const withoutExactName = withoutPostalCode.replace(name, '').trim()
  const prefecture = extractJapanesePrefecture(withoutExactName) ?? ''
  const japaneseStreetAddress = prefecture
    ? withoutExactName.split(/\s+/)[0]
    : ''
  const numberedJapaneseAddress = prefecture
    ? withoutExactName.match(/^(.+?[0-9０-９]+(?:(?:丁目|番地?)[0-9０-９]*|号|[-－ー][0-9０-９]+)*)/)?.[1] ?? ''
    : ''
  const commaSegments = withoutExactName.split(',').map((value) => value.trim()).filter(Boolean)
  const internationalSuffixes = prefecture || commaSegments.length < 3
    ? []
    : commaSegments.slice(1, -1).map((_, index) => commaSegments.slice(index + 1).join(', '))

  return unique([
    address,
    withoutPostalCode,
    withoutExactName,
    japaneseStreetAddress,
    numberedJapaneseAddress,
    ...internationalSuffixes,
    prefecture ? `${name} ${prefecture}` : '',
  ])
}

function coordinates(latitude: unknown, longitude: unknown): Coordinates | undefined {
  const value = { latitude: Number(latitude), longitude: Number(longitude) }
  return hasUsableCoordinates(value) ? value : undefined
}

function gsiCoordinates(value: unknown, expectedPrefecture: string): Coordinates | undefined {
  if (!Array.isArray(value)) return undefined
  for (const candidate of value as GsiFeature[]) {
    const pair = candidate.geometry?.coordinates
    const title = typeof candidate.properties?.title === 'string' ? candidate.properties.title : ''
    if (!Array.isArray(pair) || pair.length < 2) continue
    if (expectedPrefecture && !title.includes(expectedPrefecture)) continue
    const result = coordinates(pair[1], pair[0])
    if (result) return result
  }
  return undefined
}

function nominatimCoordinates(value: unknown): Coordinates | undefined {
  if (!Array.isArray(value)) return undefined
  for (const candidate of value as NominatimResult[]) {
    const placeRank = Number(candidate.place_rank)
    if (!Number.isFinite(placeRank) || placeRank < 28) continue
    const result = coordinates(candidate.lat, candidate.lon)
    if (result) return result
  }
  return undefined
}

export class VenueGeocoder {
  private readonly gsiUrl: string
  private readonly nominatimUrl: string
  private readonly timeoutMs: number
  private readonly nominatimMinIntervalMs: number
  private readonly fetcher: Fetcher
  private nominatimGate: Promise<void> = Promise.resolve()
  private nextNominatimStartAt = 0

  constructor(
    gsiUrl: string,
    nominatimUrl: string,
    timeoutMs: number,
    nominatimMinIntervalMs: number,
    fetcher: Fetcher = fetch,
  ) {
    this.gsiUrl = gsiUrl
    this.nominatimUrl = nominatimUrl
    this.timeoutMs = timeoutMs
    this.nominatimMinIntervalMs = nominatimMinIntervalMs
    this.fetcher = fetcher
  }

  async geocode(name: string, address: string): Promise<Coordinates | undefined> {
    if (!address.trim()) return undefined
    const queries = buildGeocodingQueries(name, address)
    const expectedPrefecture = extractJapanesePrefecture(address) ?? ''

    if (expectedPrefecture) {
      for (const query of queries) {
        const result = await this.searchGsi(query, expectedPrefecture)
        if (result) return result
      }
    }

    for (const query of queries) {
      const result = await this.searchNominatim(query, Boolean(expectedPrefecture))
      if (result) return result
    }
    return undefined
  }

  private async searchGsi(query: string, expectedPrefecture: string): Promise<Coordinates | undefined> {
    const url = new URL(this.gsiUrl)
    url.searchParams.set('q', query)
    return gsiCoordinates(await this.fetchJson(url), expectedPrefecture)
  }

  private async searchNominatim(query: string, japaneseAddress: boolean): Promise<Coordinates | undefined> {
    await this.waitForNominatimSlot()
    const url = new URL(this.nominatimUrl)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '3')
    url.searchParams.set('q', query)
    if (japaneseAddress) url.searchParams.set('countrycodes', 'jp')
    return nominatimCoordinates(await this.fetchJson(url, {
      'User-Agent': 'eventernote-dashboard/1.0 (https://github.com/kitsunezu/eventernote-dashboard)',
      'Accept-Language': 'ja,en;q=0.8',
    }))
  }

  private async fetchJson(url: URL, headers?: Record<string, string>): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(url, { headers, signal: controller.signal })
      if (!response.ok) return undefined
      return response.json()
    } catch {
      return undefined
    } finally {
      clearTimeout(timeout)
    }
  }

  private async waitForNominatimSlot(): Promise<void> {
    const wait = this.nominatimGate.then(async () => {
      const waitMs = Math.max(0, this.nextNominatimStartAt - Date.now())
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs))
      this.nextNominatimStartAt = Date.now() + this.nominatimMinIntervalMs
    })
    this.nominatimGate = wait.catch(() => undefined)
    await wait
  }
}
