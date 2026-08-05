import { describe, expect, it } from 'vitest'
import { buildGeocodingQueries, VenueGeocoder } from './geocoder.js'

describe('VenueGeocoder', () => {
  it('builds progressively simpler address queries', () => {
    const queries = buildGeocodingQueries(
      'Shibuya LOVEZ(シブヤ ラブズ)',
      '〒150-0042 東京都渋谷区宇田川町9番5号 Shibuya LOVEZ',
    )
    expect(queries).toContain('東京都渋谷区宇田川町9番5号')
    expect(buildGeocodingQueries('Example Hall', '15 Kennedy Road, Hong Kong'))
      .not.toContain('Example Hall')
    expect(buildGeocodingQueries(
      'The Burrow',
      '1/F, The Burrow, 212 Choi Hung Road, San Po Kong, Kowloon, Hong Kong',
    )).toContain('212 Choi Hung Road, San Po Kong, Kowloon, Hong Kong')
  })

  it('falls back from the full venue address to a matching GSI street address', async () => {
    const requestedQueries: string[] = []
    const fetcher = async (input: string | URL) => {
      const url = new URL(input)
      const query = url.searchParams.get('q') ?? ''
      requestedQueries.push(query)
      const body = query === '東京都渋谷区宇田川町9番5号'
        ? [{
            geometry: { coordinates: [139.696213, 35.663025] },
            properties: { title: '東京都渋谷区宇田川町９番５号' },
          }]
        : []
      return new Response(JSON.stringify(body), { status: 200 })
    }
    const geocoder = new VenueGeocoder(
      'https://msearch.gsi.go.jp/address-search/AddressSearch',
      'https://nominatim.openstreetmap.org/search',
      1_000,
      1,
      fetcher,
    )

    await expect(geocoder.geocode(
      'Shibuya LOVEZ(シブヤ ラブズ)',
      '〒150-0042 東京都渋谷区宇田川町9番5号 Shibuya LOVEZ',
    )).resolves.toEqual({ latitude: 35.663025, longitude: 139.696213 })
    expect(requestedQueries.at(-1)).toBe('東京都渋谷区宇田川町9番5号')
  })

  it('accepts only address-level Nominatim results', async () => {
    const fetcher = async () => new Response(JSON.stringify([
      { lat: '22.3193', lon: '114.1694', place_rank: 20 },
      { lat: '22.28201', lon: '114.15612', place_rank: 30 },
    ]), { status: 200 })
    const geocoder = new VenueGeocoder(
      'https://msearch.gsi.go.jp/address-search/AddressSearch',
      'https://nominatim.openstreetmap.org/search',
      1_000,
      1,
      fetcher,
    )

    await expect(geocoder.geocode('Example Hall', '15 Kennedy Road, Hong Kong'))
      .resolves.toEqual({ latitude: 22.28201, longitude: 114.15612 })
  })
})
