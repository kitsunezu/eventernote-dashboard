import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { ServerConfig } from './config.js'
import { GEOCODER_STRATEGY_VERSION } from './geocoder.js'
import type { VenueGeocoder } from './geocoder.js'
import type { EventRepository } from './repository.js'
import { EventSyncService, fetchUserEventIndex } from './sync.js'
import type { EventernoteClient } from './upstream.js'

const config: ServerConfig = {
  port: 8787,
  eventernoteOrigin: 'https://www.eventernote.com',
  userIndexTtlMs: 1,
  detailFetchLimit: 1,
  detailFetchConcurrency: 1,
  placeFetchLimit: 1,
  upstreamMinIntervalMs: 1,
  upstreamTimeoutMs: 1_000,
  maxListPages: 1,
  syncRetryCooldownMs: 1,
  gsiGeocoderUrl: 'https://example.test/gsi',
  nominatimGeocoderUrl: 'https://example.test/nominatim',
  geocoderTimeoutMs: 1_000,
  nominatimMinIntervalMs: 1_100,
}

function userEventPage(eventId: string, paginationPages: number[]): string {
  return `
    <ul>
      <li class="clearfix">
        <div class="date"><p>2026-08-14</p></div>
        <div class="event">
          <h4><a href="/events/${eventId}">Event ${eventId}</a></h4>
          <div class="place"><a href="/places/${eventId}">Venue ${eventId}</a><span class="s">開演 20:00</span></div>
        </div>
      </li>
    </ul>
    <div class="pagination">
      ${paginationPages.map((page) => `<a href="/users/test-user/events?page=${page}">${page}</a>`).join('')}
    </div>
  `
}

function calendarPage(months: Array<{ month: number; count: number }>): string {
  return months.map(({ month, count }) => (
    `<a href="/users/test-user/events/?year=2025&month=${month}">${count}</a>`
  )).join('')
}

describe('fetchUserEventIndex', () => {
  it('uses participation-calendar month pages and deduplicates repeated rows', async () => {
    const htmlByPath = new Map<string, string>([
      ['/users/test-user', calendarPage([{ month: 6, count: 3 }])],
      ['/users/test-user/events/?year=2025&month=6', [
        userEventPage('201', []),
        userEventPage('202', []),
        userEventPage('201', []),
      ].join('')],
    ])
    const fetchHtml = vi.fn(async (path: string) => htmlByPath.get(path) ?? '')

    const events = await fetchUserEventIndex('test-user', fetchHtml, 5)

    expect(events.map((event) => event.id)).toEqual(['201', '202'])
    expect(fetchHtml.mock.calls.map(([path]) => path)).toEqual([
      '/users/test-user',
      '/users/test-user/events/?year=2025&month=6',
    ])
  })

  it('rejects a month page when its row count disagrees with the calendar', async () => {
    const fetchHtml = vi.fn(async (path: string) => {
      if (path === '/users/test-user') return calendarPage([{ month: 6, count: 2 }])
      return userEventPage('201', [])
    })

    await expect(fetchUserEventIndex('test-user', fetchHtml, 5))
      .rejects.toThrow('Eventernote participation calendar mismatch')
  })

  it('follows pagination links discovered on later pages', async () => {
    const htmlByPage = new Map<number, string>([
      [1, userEventPage('101', [2, 3, 5])],
      [2, userEventPage('102', [1, 3, 4, 5])],
      [3, userEventPage('103', [1, 2, 4, 5])],
      [4, userEventPage('104', [2, 3, 5])],
      [5, userEventPage('105', [1, 3, 4])],
    ])
    const fetchHtml = vi.fn(async (path: string) => {
      if (path === '/users/test-user') return ''
      const page = Number(new URL(path, 'https://www.eventernote.com').searchParams.get('page') ?? '1')
      return htmlByPage.get(page) ?? ''
    })

    const events = await fetchUserEventIndex('test-user', fetchHtml, 5)

    expect(events.map((event) => event.id)).toEqual(['101', '102', '103', '105', '104'])
    expect(fetchHtml).toHaveBeenCalledTimes(6)
    expect(new Set(fetchHtml.mock.calls.map(([path]) => (
      Number(new URL(path, 'https://www.eventernote.com').searchParams.get('page') ?? '1')
    )))).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it('rejects an index whose discovered page number exceeds the configured limit', async () => {
    const fetchHtml = vi.fn(async (path: string) => {
      if (path === '/users/test-user') return ''
      return userEventPage('101', [2, 41])
    })

    await expect(fetchUserEventIndex('test-user', fetchHtml, 40))
      .rejects.toThrow('User index has at least 41 pages; maximum is 40')
    expect(fetchHtml).toHaveBeenCalledTimes(2)
  })
})

describe('EventSyncService.refreshEvent', () => {
  it('always refreshes both the event detail and its place, then geocodes the address', async () => {
    const eventHtml = `
      <div class="gb_events_detail_title"><h2>Fresh event</h2></div>
      <div class="gb_events_info_table"><table>
        <tr><td>開催日時</td><td>2026-08-14</td></tr>
        <tr><td>時間</td><td>開演 20:00 終演 22:00</td></tr>
        <tr><td>開催場所</td><td><a href="/places/18844">Shibuya LOVEZ</a></td></tr>
        <tr><td>出演者</td><td><a href="/actors/1">Artist</a></td></tr>
      </table></div>
    `
    const placeHtml = `
      <div class="gb_place_detail_title"><h2>Shibuya LOVEZ</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td>〒150-0042 東京都渋谷区宇田川町9番5号</td></tr>
      </table></div>
      <script>var lat = '0'; var lon = '0';</script>
    `
    const repository = {
      hasActiveEvent: vi.fn().mockResolvedValue(true),
      saveEventDetail: vi.fn().mockResolvedValue(undefined),
      getPlace: vi.fn().mockResolvedValue({
        id: '18844',
        name: 'Shibuya LOVEZ',
        address: '〒150-0042 東京都渋谷区宇田川町9番5号',
        region: '東京',
        geocodeAttemptedAt: new Date().toISOString(),
        geocodeVersion: 0,
      }),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = {
      fetchHtml: vi.fn(async (path: string) => path.startsWith('/events/') ? eventHtml : placeHtml),
    }
    const geocoder = {
      geocode: vi.fn().mockResolvedValue({ latitude: 35.663025, longitude: 139.696213 }),
    }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    await expect(service.refreshEvent('test-user', '475077')).resolves.toEqual([])

    expect(upstream.fetchHtml.mock.calls.map(([path]) => path)).toEqual([
      '/events/475077',
      '/places/18844',
    ])
    expect(repository.saveEventDetail).toHaveBeenCalledOnce()
    expect(geocoder.geocode).toHaveBeenCalledWith(
      'Shibuya LOVEZ',
      '〒150-0042 東京都渋谷区宇田川町9番5号',
    )
    expect(repository.savePlaceDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '18844',
        latitude: 35.663025,
        longitude: 139.696213,
      }),
      expect.any(String),
      GEOCODER_STRATEGY_VERSION,
    )
  })

  it('keeps the failed-geocode cooldown for a normal event refresh', async () => {
    const eventHtml = `
      <div class="gb_events_detail_title"><h2>Fresh event</h2></div>
      <div class="gb_events_info_table"><table>
        <tr><td>開催日時</td><td>2026-08-14</td></tr>
        <tr><td>時間</td><td>開演 20:00 終演 22:00</td></tr>
        <tr><td>開催場所</td><td><a href="/places/18844">Shibuya LOVEZ</a></td></tr>
      </table></div>
    `
    const placeHtml = `
      <div class="gb_place_detail_title"><h2>Shibuya LOVEZ</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td>〒150-0042 東京都渋谷区宇田川町9番5号</td></tr>
      </table></div>
    `
    const repository = {
      hasActiveEvent: vi.fn().mockResolvedValue(true),
      saveEventDetail: vi.fn().mockResolvedValue(undefined),
      getPlace: vi.fn().mockResolvedValue({
        id: '18844',
        name: 'Shibuya LOVEZ',
        address: '〒150-0042 東京都渋谷区宇田川町9番5号',
        region: '東京',
        geocodeAttemptedAt: new Date().toISOString(),
        geocodeVersion: GEOCODER_STRATEGY_VERSION,
      }),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = {
      fetchHtml: vi.fn(async (path: string) => path.startsWith('/events/') ? eventHtml : placeHtml),
    }
    const geocoder = { geocode: vi.fn() }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    await service.refreshEvent('test-user', '475077')

    expect(geocoder.geocode).not.toHaveBeenCalled()
    expect(repository.savePlaceDetail).toHaveBeenCalledWith(expect.any(Object), expect.any(String), undefined)
  })
})

describe('EventSyncService.startEnrichment', () => {
  it('drains place candidates across bounded batches', async () => {
    const lockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
      release: vi.fn(),
    }
    const pool = { connect: vi.fn().mockResolvedValue(lockClient) }
    const candidates = [
      { place_id: '101', name: 'Venue 101' },
      { place_id: '202', name: 'Venue 202' },
    ]
    const repository = {
      createEnrichmentJob: vi.fn().mockResolvedValue('job-1'),
      getStoredEvents: vi.fn().mockResolvedValue([]),
      getPlaceCandidatesForUser: vi.fn(async (_userId: string, _staleBefore: Date, limit: number) => (
        candidates.slice(0, limit)
      )),
      getPlace: vi.fn().mockResolvedValue(undefined),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
      completeSyncJob: vi.fn().mockResolvedValue(undefined),
      failEnrichmentJob: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = {
      fetchHtml: vi.fn(async (path: string) => `
        <div class="gb_place_detail_title"><h2>${path}</h2></div>
        <script>var lat = '35.68'; var lon = '139.76';</script>
      `),
    }
    const geocoder = { geocode: vi.fn() }
    const service = new EventSyncService(
      pool as unknown as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    const enrichment = service.startEnrichment('test-user')
    expect(service.isRunning('test-user')).toBe(true)
    await enrichment

    expect(upstream.fetchHtml.mock.calls.map(([path]) => path)).toEqual(['/places/101', '/places/202'])
    expect(repository.savePlaceDetail).toHaveBeenCalledTimes(2)
    expect(repository.completeSyncJob).toHaveBeenCalledWith('job-1', expect.objectContaining({
      refreshedPlaces: 2,
    }))
    expect(service.isRunning('test-user')).toBe(false)
  })
})

describe('EventSyncService.refreshUnmappedPlaces', () => {
  it('forces a new geocode attempt after a recent failure', async () => {
    const placeHtml = `
      <div class="gb_place_detail_title"><h2>Shibuya LOVEZ</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td>〒150-0042 東京都渋谷区宇田川町9番5号</td></tr>
      </table></div>
    `
    const place = {
      id: '18844',
      name: 'Shibuya LOVEZ',
      address: '〒150-0042 東京都渋谷区宇田川町9番5号',
      region: '東京',
      geocodeAttemptedAt: new Date().toISOString(),
    }
    const repository = {
      getRequestedPlacesForUser: vi.fn().mockResolvedValue([place]),
      getPlace: vi.fn().mockResolvedValue(place),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = { fetchHtml: vi.fn().mockResolvedValue(placeHtml) }
    const geocoder = {
      geocode: vi.fn().mockResolvedValue({ latitude: 35.663025, longitude: 139.696213 }),
    }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    await expect(service.refreshUnmappedPlaces('test-user', ['18844', '18844'])).resolves.toEqual([])

    expect(repository.getRequestedPlacesForUser).toHaveBeenCalledWith('test-user', ['18844'])
    expect(geocoder.geocode).toHaveBeenCalledOnce()
    expect(repository.savePlaceDetail).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 35.663025, longitude: 139.696213 }),
      expect.any(String),
      GEOCODER_STRATEGY_VERSION,
    )
  })

  it('continues refreshing when one requested place fails', async () => {
    const places = [
      { id: '101', name: 'Broken venue', address: 'Tokyo', region: '東京' },
      { id: '202', name: 'Working venue', address: 'Osaka', region: '大阪' },
    ]
    const placeHtml = `
      <div class="gb_place_detail_title"><h2>Working venue</h2></div>
      <div class="gb_place_detail_table"><table><tr><td>所在地</td><td>Osaka</td></tr></table></div>
    `
    const repository = {
      getRequestedPlacesForUser: vi.fn().mockResolvedValue(places),
      getPlace: vi.fn().mockResolvedValue(undefined),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = {
      fetchHtml: vi.fn(async (path: string) => {
        if (path === '/places/101') throw new Error('upstream failed')
        return placeHtml
      }),
    }
    const geocoder = {
      geocode: vi.fn().mockResolvedValue({ latitude: 34.6937, longitude: 135.5023 }),
    }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    const warnings = await service.refreshUnmappedPlaces('test-user', ['101', '202'])

    expect(warnings).toEqual(['Place 101: upstream failed'])
    expect(repository.savePlaceDetail).toHaveBeenCalledOnce()
    expect(repository.savePlaceDetail).toHaveBeenCalledWith(
      expect.objectContaining({ id: '202', latitude: 34.6937, longitude: 135.5023 }),
      expect.any(String),
      GEOCODER_STRATEGY_VERSION,
    )
  })

  it('reports a warning when a forced geocode finds no coordinates', async () => {
    const place = { id: '303', name: 'Unknown venue', address: 'Unknown address', region: '' }
    const placeHtml = `
      <div class="gb_place_detail_title"><h2>Unknown venue</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td>Unknown address</td></tr>
      </table></div>
    `
    const repository = {
      getRequestedPlacesForUser: vi.fn().mockResolvedValue([place]),
      getPlace: vi.fn().mockResolvedValue(place),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = { fetchHtml: vi.fn().mockResolvedValue(placeHtml) }
    const geocoder = { geocode: vi.fn().mockResolvedValue(undefined) }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    await expect(service.refreshUnmappedPlaces('test-user', ['303']))
      .resolves.toEqual(['Place 303: no coordinates found'])
    expect(repository.savePlaceDetail).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      GEOCODER_STRATEGY_VERSION,
    )
  })

  it('throttles an immediate second manual retry for the same place', async () => {
    const place = { id: '404', name: 'Retry venue', address: 'Tokyo', region: '東京' }
    const placeHtml = `
      <div class="gb_place_detail_title"><h2>Retry venue</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td>Tokyo</td></tr>
      </table></div>
    `
    const repository = {
      getRequestedPlacesForUser: vi.fn().mockResolvedValue([place]),
      getPlace: vi.fn().mockResolvedValue(place),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = { fetchHtml: vi.fn().mockResolvedValue(placeHtml) }
    const geocoder = {
      geocode: vi.fn().mockResolvedValue({ latitude: 35.68, longitude: 139.76 }),
    }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    await expect(service.refreshUnmappedPlaces('test-user', ['404'])).resolves.toEqual([])
    await expect(service.refreshUnmappedPlaces('test-user', ['404']))
      .resolves.toEqual(['Place 404: manual retry is temporarily throttled'])
    expect(upstream.fetchHtml).toHaveBeenCalledOnce()
  })

  it('coalesces concurrent refreshes for the same place across users', async () => {
    let releaseUpstream!: (value: string) => void
    const upstreamResponse = new Promise<string>((resolve) => { releaseUpstream = resolve })
    const place = { id: '505', name: 'Shared venue', address: 'Tokyo', region: '東京' }
    const repository = {
      getRequestedPlacesForUser: vi.fn().mockResolvedValue([place]),
      getPlace: vi.fn().mockResolvedValue(place),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = { fetchHtml: vi.fn().mockReturnValue(upstreamResponse) }
    const geocoder = {
      geocode: vi.fn().mockResolvedValue({ latitude: 35.68, longitude: 139.76 }),
    }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    const first = service.refreshUnmappedPlaces('user-a', ['505'])
    await vi.waitFor(() => expect(upstream.fetchHtml).toHaveBeenCalledOnce())
    const second = service.refreshUnmappedPlaces('user-b', ['505'])
    releaseUpstream(`
      <div class="gb_place_detail_title"><h2>Shared venue</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td>Tokyo</td></tr>
      </table></div>
    `)

    await expect(Promise.all([first, second])).resolves.toEqual([[], []])
    expect(upstream.fetchHtml).toHaveBeenCalledOnce()
    expect(geocoder.geocode).toHaveBeenCalledOnce()
    expect(repository.savePlaceDetail).toHaveBeenCalledOnce()
  })

  it('bounds the number of concurrent manual user refreshes', async () => {
    let releaseUpstream!: (value: string) => void
    const upstreamResponse = new Promise<string>((resolve) => { releaseUpstream = resolve })
    const repository = {
      getRequestedPlacesForUser: vi.fn(async (_userId: string, placeIds: string[]) => [{
        id: placeIds[0],
        name: `Venue ${placeIds[0]}`,
        address: 'Tokyo',
        region: '東京',
      }]),
      getPlace: vi.fn().mockResolvedValue(undefined),
      savePlaceDetail: vi.fn().mockResolvedValue(undefined),
    }
    const upstream = { fetchHtml: vi.fn().mockReturnValue(upstreamResponse) }
    const geocoder = {
      geocode: vi.fn().mockResolvedValue({ latitude: 35.68, longitude: 139.76 }),
    }
    const service = new EventSyncService(
      {} as Pool,
      repository as unknown as EventRepository,
      upstream as unknown as EventernoteClient,
      geocoder as unknown as VenueGeocoder,
      config,
    )

    const running = Array.from({ length: 4 }, (_, index) =>
      service.refreshUnmappedPlaces(`user-${index}`, [String(600 + index)]))
    await expect(service.refreshUnmappedPlaces('user-5', ['605']))
      .resolves.toEqual(['Manual place refresh is temporarily busy'])
    releaseUpstream(`
      <div class="gb_place_detail_title"><h2>Venue</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td>Tokyo</td></tr>
      </table></div>
    `)
    await Promise.all(running)
  })
})
