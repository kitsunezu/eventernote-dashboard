import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { GEOCODER_STRATEGY_VERSION } from './geocoder.js'
import { EventRepository } from './repository.js'

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
