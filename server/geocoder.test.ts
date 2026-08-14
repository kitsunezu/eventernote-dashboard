import { describe, expect, it } from 'vitest'
import { buildGeocodingQueries, buildVenueSearchQueries, VenueGeocoder } from './geocoder.js'

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

  it('builds venue-name queries from precise to broad location scopes', () => {
    expect(buildVenueSearchQueries(
      'Shibuya LOVEZ(シブヤ ラブズ)',
      '〒150-0042 東京都渋谷区宇田川町9番5号 Shibuya LOVEZ(シブヤ ラブズ)',
    )).toEqual(expect.arrayContaining([
      'Shibuya LOVEZ(シブヤ ラブズ), 東京都渋谷区宇田川町9番5号',
      'Shibuya LOVEZ, 東京都渋谷区',
      'シブヤ ラブズ, 東京都',
    ]))
    expect(buildVenueSearchQueries(
      'The Burrow',
      '1/F, The Burrow, 212 Choi Hung Road, San Po Kong, Kowloon, Hong Kong',
    )).toContain('The Burrow, Kowloon, Hong Kong')
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

  it('falls back to a venue-name result whose location matches the original address', async () => {
    const requestedQueries: string[] = []
    const fetcher = async (input: string | URL) => {
      const query = new URL(input).searchParams.get('q') ?? ''
      requestedQueries.push(query)
      const body = query === 'Shibuya LOVEZ, 東京都渋谷区'
        ? [{
            lat: '35.663025',
            lon: '139.696213',
            place_rank: 30,
            name: 'Shibuya LOVEZ',
            display_name: 'Shibuya LOVEZ, 宇田川町, 渋谷区, 東京都, 日本',
            address: { quarter: '宇田川町', city: '渋谷区', province: '東京都' },
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
      '〒150-0042 東京都渋谷区宇田川町9番5号 Shibuya LOVEZ(シブヤ ラブズ)',
    )).resolves.toEqual({ latitude: 35.663025, longitude: 139.696213 })
    expect(requestedQueries).toContain('Shibuya LOVEZ, 東京都渋谷区')
  })

  it('rejects a same-name venue result from a different city', async () => {
    const fetcher = async (input: string | URL) => {
      const query = new URL(input).searchParams.get('q') ?? ''
      const body = query.includes('Example Hall')
        ? [{
            lat: '34.6937',
            lon: '135.5023',
            place_rank: 30,
            name: 'Example Hall',
            display_name: 'Example Hall, 北区, 大阪府, 日本',
            address: { city: '大阪市', province: '大阪府' },
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
      'Example Hall',
      '東京都渋谷区宇田川町1番1号',
    )).resolves.toBeUndefined()
  })

  it('does not count the venue name inside an overseas address as a location match', async () => {
    const fetcher = async (input: string | URL) => {
      const query = new URL(input).searchParams.get('q') ?? ''
      const body = query === 'Example Hall, Hong Kong'
        ? [{
            lat: '34.6937',
            lon: '135.5023',
            place_rank: 30,
            name: 'Example Hall',
            display_name: 'Example Hall, 北区, 大阪府, 日本',
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
      'Example Hall',
      'Example Hall, Kowloon, Hong Kong',
    )).resolves.toBeUndefined()
  })

  it('accepts a matching overseas venue when Nominatim localizes the country name', async () => {
    const fetcher = async (input: string | URL) => {
      const query = new URL(input).searchParams.get('q') ?? ''
      const body = query === 'Calgary TELUS Convention Centre, Alberta, Canada'
        ? [{
            lat: '51.0458853',
            lon: '-114.0612817',
            place_rank: 30,
            name: 'Calgary TELUS Convention Centre North Building',
            display_name: 'Calgary TELUS Convention Centre North Building, カルガリー, アルバータ州, カナダ',
            address: { city: 'カルガリー', state: 'アルバータ州', country: 'カナダ', country_code: 'ca' },
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
      'Calgary TELUS Convention Centre',
      'T2G 0K6 136 8th Avenue SE Calgary, Alberta, Canada',
    )).resolves.toEqual({ latitude: 51.0458853, longitude: -114.0612817 })
  })

})
