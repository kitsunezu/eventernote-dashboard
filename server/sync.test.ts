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
})
