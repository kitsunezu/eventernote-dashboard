import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleEvent } from '../types/events'
import { refreshEventernotePlaces } from './eventernoteApiSource'

const placeCache = vi.hoisted(() => ({
  getPlace: vi.fn(),
  setPlace: vi.fn(),
}))

vi.mock('../lib/placeCache', () => placeCache)

const event: ScheduleEvent = {
  id: '1',
  title: 'Event',
  startAt: '2026-08-01T10:00:00.000Z',
  endAt: '2026-08-01T12:00:00.000Z',
  allDay: false,
  category: { id: 'tokyo', label: '東京', color: '#fff' },
  links: [],
  sourceType: 'backend',
}

function response(placeId: string): Response {
  return new Response(JSON.stringify({
    events: [event],
    warnings: [],
    sourceType: 'backend',
    importedAt: '2026-08-13T10:00:00.000Z',
    places: {
      [placeId]: {
        name: `Venue ${placeId}`,
        address: 'Tokyo',
        region: '東京',
        latitude: 35.68,
        longitude: 139.76,
      },
    },
    cache: { status: 'fresh', refreshing: false, pendingDetailCount: 0 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  placeCache.getPlace.mockReset()
  placeCache.setPlace.mockReset()
})

describe('refreshEventernotePlaces', () => {
  it('deduplicates and sends place IDs in batches of 20', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('1'))
      .mockResolvedValueOnce(response('21'))
    vi.stubGlobal('fetch', fetcher)
    const placeIds = [...Array.from({ length: 21 }, (_, index) => String(index + 1)), '1']

    await expect(refreshEventernotePlaces('test-user', placeIds)).resolves.toMatchObject({
      events: [event],
      warnings: [],
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ placeIds: placeIds.slice(0, 20) })
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ placeIds: ['21'] })
    expect(placeCache.setPlace).toHaveBeenCalledTimes(2)
  })

  it('returns earlier successful data when a later batch fails', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('1'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Temporary failure' }), { status: 502 }))
    vi.stubGlobal('fetch', fetcher)

    await expect(refreshEventernotePlaces(
      'test-user',
      Array.from({ length: 21 }, (_, index) => String(index + 1)),
    )).resolves.toMatchObject({
      events: [event],
      warnings: ['Temporary failure'],
    })
    expect(placeCache.setPlace).toHaveBeenCalledOnce()
  })
})
