import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { GEOCODER_STRATEGY_VERSION } from './geocoder.js'
import { EventRepository } from './repository.js'

describe('EventRepository.getSnapshot', () => {
  it('counts unique places without details and uses the stored place region', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM eventernote_users')) return { rows: [] }
      return {
        rows: ['1', '2'].map((eventId) => ({
          event_id: eventId,
          title: `Event ${eventId}`,
          start_at: '2026-08-14T10:00:00.000Z',
          end_at: '2026-08-14T12:00:00.000Z',
          place_id: '202',
          venue_name: 'Venue 202',
          actors: [],
          image_url: null,
          image_alt: null,
          detail_fetched_at: null,
          place_name: 'Venue 202',
          address: '',
          region: 'Saitama',
          latitude: null,
          longitude: null,
          place_detail_fetched_at: null,
        })),
      }
    })
    const pool = { query } as unknown as Pool

    const snapshot = await new EventRepository(pool).getSnapshot('test-user')

    expect(snapshot.pendingDetailCount).toBe(2)
    expect(snapshot.pendingPlaceCount).toBe(1)
    expect(snapshot.events.map((event) => event.category.label)).toEqual(['Saitama', 'Saitama'])
  })

  it('reclassifies places previously stored as other when the address is now recognized', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM eventernote_users')) return { rows: [] }
      return {
        rows: [{
          event_id: '1',
          title: 'Live in Seoul',
          start_at: '2026-08-14T10:00:00.000Z',
          end_at: '2026-08-14T12:00:00.000Z',
          place_id: '303',
          venue_name: 'Olympic Hall',
          actors: [],
          image_url: null,
          image_alt: null,
          detail_fetched_at: new Date('2026-08-14T09:00:00.000Z'),
          place_name: 'Olympic Hall',
          address: '424 Olympic-ro, Songpa-gu, Seoul, South Korea',
          region: '其他地區',
          latitude: 37.521,
          longitude: 127.115,
          place_detail_fetched_at: new Date('2026-08-14T09:00:00.000Z'),
        }],
      }
    })
    const pool = { query } as unknown as Pool

    const snapshot = await new EventRepository(pool).getSnapshot('test-user')

    expect(snapshot.events[0].category.label).toBe('韓國')
    expect(snapshot.places['303'].region).toBe('韓國')
  })
})

describe('EventRepository.getRequestedPlacesForUser', () => {
  it('queries requested places through the active user-event relationship', async () => {
    const attemptedAt = new Date('2026-08-13T10:00:00.000Z')
    const query = vi.fn().mockResolvedValue({
      rows: [{
        place_id: '202',
        name: 'Venue 202',
        address: 'Osaka',
        region: '大阪',
        latitude: null,
        longitude: null,
        detail_fetched_at: new Date('2026-08-12T10:00:00.000Z'),
        geocode_attempted_at: attemptedAt,
      }],
    })
    const pool = { query } as unknown as Pool

    await expect(new EventRepository(pool).getRequestedPlacesForUser('test-user', ['202', '101']))
      .resolves.toEqual([{
        id: '202',
        name: 'Venue 202',
        address: 'Osaka',
        region: '大阪',
        geocodeAttemptedAt: attemptedAt.toISOString(),
      }])

    const [sql, parameters] = query.mock.calls[0]
    expect(String(sql)).toContain('p.place_id = ANY($2::text[])')
    expect(String(sql)).toContain('ue.user_id = $1 AND ue.active = TRUE')
    expect(parameters).toEqual(['test-user', ['202', '101']])
  })

  it('does not query when no place IDs are requested', async () => {
    const query = vi.fn()
    const pool = { query } as unknown as Pool

    await expect(new EventRepository(pool).getRequestedPlacesForUser('test-user', []))
      .resolves.toEqual([])
    expect(query).not.toHaveBeenCalled()
  })
})

describe('EventRepository.savePlaceDetail', () => {
  it('preserves existing coordinates when the same address has no new result', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const pool = { query } as unknown as Pool

    await new EventRepository(pool).savePlaceDetail({
      id: '202',
      name: 'Venue 202',
      address: 'Osaka',
      region: '大阪',
    }, 'hash', GEOCODER_STRATEGY_VERSION)

    const [sql, parameters] = query.mock.calls[0]
    expect(String(sql)).toContain('WHEN places.address = EXCLUDED.address')
    expect(String(sql)).toContain('THEN places.latitude')
    expect(String(sql)).toContain('THEN places.longitude')
    expect(parameters).toEqual([
      '202',
      'Venue 202',
      'Osaka',
      '大阪',
      null,
      null,
      'hash',
      GEOCODER_STRATEGY_VERSION,
    ])
  })
})
