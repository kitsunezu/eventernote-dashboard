import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { ServerConfig } from './config.js'
import type { VenueGeocoder } from './geocoder.js'
import type { EventRepository } from './repository.js'
import { EventSyncService } from './sync.js'
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
      1,
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
    expect(repository.savePlaceDetail).toHaveBeenCalledWith(expect.any(Object), expect.any(String), false)
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
      true,
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
      true,
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
    expect(repository.savePlaceDetail).toHaveBeenCalledWith(expect.any(Object), expect.any(String), true)
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
