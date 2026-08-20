import { hasUsableCoordinates } from './coordinates.js'
import type { Coordinates } from './coordinates.js'
import { detectRegion, extractChineseCity, extractJapanesePrefecture } from './regions.js'

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

export const GEOCODER_STRATEGY_VERSION = 4

export interface GeocodedPlace extends Coordinates {
  countryCode?: string
  locality?: string
  resolvedAddress?: string
}

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
  display_name?: unknown
  name?: unknown
  address?: unknown
  namedetails?: unknown
}

const CJK_ADMINISTRATIVE_UNIT = /[^\p{N}\s,，]{1,16}?(?:特別行政區|特别行政区|自治区|自治區|省|市|区|區|县|縣|州)/gu

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean)))
}

function semanticAddressScopes(address: string): string[] {
  const normalizedAddress = address.normalize('NFKC').replace(/^[\p{N}\s-]+(?=\p{L})/u, '').trim()
  const matches = Array.from(normalizedAddress.matchAll(CJK_ADMINISTRATIVE_UNIT))
  const cjkUnits = matches
    .filter((match, index) => index === 0 || match.index === matches[index - 1].index + matches[index - 1][0].length)
    .map((match) => match[0])
  const cjkScopes = cjkUnits.length > 0
    ? cjkUnits.map((_, index) => cjkUnits.slice(0, cjkUnits.length - index).join(''))
    : []
  const commaSegments = normalizedAddress.split(/[,，]/).map((value) => value.trim()).filter(Boolean)
  const commaScopes = commaSegments.slice(1).map((_, index) => commaSegments.slice(index + 1).join(', '))

  return unique([...cjkScopes, ...commaScopes])
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
  ])
}

function nameVariants(name: string): string[] {
  const bracketed = Array.from(name.matchAll(/[（(]([^）)]+)[）)]/g), (match) => match[1])
  return unique([
    name,
    name.replace(/[（(][^）)]+[）)]/g, ' '),
    ...bracketed,
  ])
}

function japaneseAdministrativeArea(address: string): string {
  const prefecture = extractJapanesePrefecture(address)
  if (!prefecture) return ''
  const remainder = address.slice(address.indexOf(prefecture) + prefecture.length)
  const municipality = remainder.match(/^[^0-9０-９\s,，-]{1,12}?(?:市|区|町|村|郡)/)?.[0] ?? ''
  return `${prefecture}${municipality}`
}

export function buildVenueSearchQueries(name: string, address: string): string[] {
  const names = nameVariants(name)
  if (names.length === 0) return []

  const withoutPostalCode = address.replace(/〒?\s*\d{3}-?\d{4}\s*/g, '').trim()
  const withoutExactName = withoutPostalCode.replace(name, '')
    .replace(/(?:[,，]\s*){2,}/g, ', ')
    .replace(/^[,，]\s*|\s*[,，]$/g, '')
    .trim()
  const prefecture = extractJapanesePrefecture(withoutExactName) ?? ''
  const commaSegments = withoutExactName.split(/[,，]/).map((value) => value.trim()).filter(Boolean)
  const semanticScopes = semanticAddressScopes(withoutExactName)
  const locationScopes = prefecture
    ? unique([withoutExactName, japaneseAdministrativeArea(withoutExactName), prefecture])
    : unique([
        withoutExactName,
        ...semanticScopes,
        ...commaSegments.slice(1).map((_, index) => commaSegments.slice(index + 1).join(', ')),
      ])

  const exactLocation = locationScopes[0]
  const broaderLocations = locationScopes.slice(1)
  const preferredFallbackLocation = broaderLocations[0] ?? exactLocation
  const broadestLocation = locationScopes.at(-1)
  return unique([
    exactLocation ? `${names[0]}, ${exactLocation}` : '',
    ...broaderLocations.map((location) => `${names[0]}, ${location}`),
    ...(preferredFallbackLocation
      ? names.slice(1).map((venueName) => `${venueName}, ${preferredFallbackLocation}`)
      : []),
    ...(broadestLocation
      ? names.slice(1).map((venueName) => `${venueName}, ${broadestLocation}`)
      : []),
    ...names,
  ]).slice(0, 12)
}

function addressFields(candidate: NominatimResult): Record<string, unknown> {
  if (!candidate.address || typeof candidate.address !== 'object' || Array.isArray(candidate.address)) {
    return {}
  }
  return candidate.address as Record<string, unknown>
}

function countryCode(candidate: NominatimResult): string | undefined {
  const value = addressFields(candidate).country_code
  return typeof value === 'string' && /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : undefined
}

function locality(candidate: NominatimResult): string | undefined {
  const address = addressFields(candidate)
  for (const key of ['city', 'municipality', 'town', 'county', 'state']) {
    const value = address[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function resolvedAddress(candidate: NominatimResult): string | undefined {
  return typeof candidate.display_name === 'string' && candidate.display_name.trim()
    ? candidate.display_name.trim()
    : undefined
}

function coordinates(
  latitude: unknown,
  longitude: unknown,
  metadata: Pick<GeocodedPlace, 'countryCode' | 'locality' | 'resolvedAddress'> = {},
): GeocodedPlace | undefined {
  const value = { latitude: Number(latitude), longitude: Number(longitude) }
  return hasUsableCoordinates(value) ? { ...value, ...metadata } : undefined
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

function normalized(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/〒?\s*\d{3}-?\d{4}/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function objectStrings(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.values(value).filter((item): item is string => typeof item === 'string')
}

function nominatimCandidateText(candidate: NominatimResult): string {
  return [
    typeof candidate.display_name === 'string' ? candidate.display_name : '',
    typeof candidate.name === 'string' ? candidate.name : '',
    ...objectStrings(candidate.address),
    ...objectStrings(candidate.namedetails),
  ].join(' ')
}

function venueCandidateMatches(candidate: NominatimResult, name: string, address: string): boolean {
  const rawCandidateText = nominatimCandidateText(candidate)
  const candidateText = normalized(rawCandidateText)
  const normalizedNames = nameVariants(name)
    .map(normalized)
    .filter((value) => value.length >= 2)
  const matchesName = normalizedNames.some((value) => candidateText.includes(value))
  if (!matchesName) return false
  const candidateName = typeof candidate.name === 'string' ? normalized(candidate.name) : ''
  const exactName = candidateName.length >= 4 && normalizedNames.some((value) => value === candidateName)

  const prefecture = extractJapanesePrefecture(address)
  if (prefecture) {
    if (!candidateText.includes(normalized(prefecture))) return false
    const administrativeArea = japaneseAdministrativeArea(address).slice(prefecture.length)
    return !administrativeArea || candidateText.includes(normalized(administrativeArea))
  }

  const expectedCity = extractChineseCity(`${name} ${address}`)
  if (expectedCity) {
    return extractChineseCity(rawCandidateText) === expectedCity
  }

  const expectedRegion = detectRegion(name, '', address)
  if (expectedRegion !== '其他地區') {
    const candidateRegion = detectRegion(
      typeof candidate.name === 'string' ? candidate.name : '',
      '',
      rawCandidateText,
    )
    if (candidateRegion !== '其他地區') return candidateRegion === expectedRegion
  }

  const addressSegments = [
    ...address.replace(/〒?\s*\d{3}-?\d{4}\s*/g, '').split(/[,，]/),
    ...semanticAddressScopes(address),
  ]
    .map(normalized)
    .filter((value) => value.length >= 4)
    .filter((value) => !nameVariants(name).map(normalized).some((venueName) => {
      return venueName.length >= 3 && (value.includes(venueName) || venueName.includes(value))
    }))
  return addressSegments.some((segment) => candidateText.includes(segment)) || exactName
}

function nominatimCoordinates(
  value: unknown,
  matches: (candidate: NominatimResult) => boolean = () => true,
  includePlaceMetadata = false,
  requireUniqueMatch = false,
): GeocodedPlace | undefined {
  if (!Array.isArray(value)) return undefined
  const candidates = (value as NominatimResult[]).filter((candidate) => {
    const placeRank = Number(candidate.place_rank)
    return Number.isFinite(placeRank) && placeRank >= 28 && matches(candidate)
  })
  if (requireUniqueMatch && candidates.length !== 1) return undefined

  for (const candidate of candidates) {
    const code = countryCode(candidate)
    const candidateLocality = locality(candidate)
    const candidateAddress = resolvedAddress(candidate)
    const metadata = includePlaceMetadata
      ? {
          ...(code ? { countryCode: code } : {}),
          ...(candidateLocality ? { locality: candidateLocality } : {}),
          ...(candidateAddress ? { resolvedAddress: candidateAddress } : {}),
        }
      : { ...(code ? { countryCode: code } : {}) }
    const result = coordinates(candidate.lat, candidate.lon, metadata)
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

  async geocode(name: string, address: string): Promise<GeocodedPlace | undefined> {
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

    for (const query of buildVenueSearchQueries(name, address)) {
      const result = await this.searchNominatim(
        query,
        Boolean(expectedPrefecture),
        (candidate) => venueCandidateMatches(candidate, name, address),
        true,
      )
      if (result) return result
    }

    return undefined
  }

  private async searchGsi(query: string, expectedPrefecture: string): Promise<GeocodedPlace | undefined> {
    const url = new URL(this.gsiUrl)
    url.searchParams.set('q', query)
    return gsiCoordinates(await this.fetchJson(url), expectedPrefecture)
  }

  private async searchNominatim(
    query: string,
    japaneseAddress: boolean,
    matches?: (candidate: NominatimResult) => boolean,
    venueSearch = false,
  ): Promise<GeocodedPlace | undefined> {
    await this.waitForNominatimSlot()
    const url = new URL(this.nominatimUrl)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('namedetails', '1')
    url.searchParams.set('limit', '5')
    url.searchParams.set('q', query)
    if (japaneseAddress) url.searchParams.set('countrycodes', 'jp')
    return nominatimCoordinates(await this.fetchJson(url, {
      'User-Agent': 'eventernote-dashboard/1.0 (https://github.com/kitsunezu/eventernote-dashboard)',
      'Accept-Language': 'ja,en;q=0.8',
    }), matches, venueSearch, venueSearch)
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
