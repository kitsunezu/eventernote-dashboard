import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleEvent } from '../types/events'
import { loadEventernoteUserFromApi, refreshEventernotePlaces } from './eventernoteApiSource'

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

function response(placeId: string, refreshing = false, dataVersion = placeId): Response {
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
    cache: { status: 'fresh', refreshing, dataVersion, pendingDetailCount: 0, pendingPlaceCount: 0 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  placeCache.getPlace.mockReset()
  placeCache.setPlace.mockReset()
})

describe('loadEventernoteUserFromApi', () => {
  it('publishes place-only changes while background enrichment is running', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('1', true))
      .mockResolvedValueOnce(response('2'))
    vi.stubGlobal('fetch', fetcher)
    const onProgress = vi.fn()

    const loading = loadEventernoteUserFromApi('test-user', onProgress)
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(loading).resolves.toMatchObject({ events: [event] })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(placeCache.setPlace).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledTimes(2)
  })

  it('does not publish unchanged snapshots on every poll', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('1', true, 'same-version'))
      .mockResolvedValueOnce(response('1', true, 'same-version'))
      .mockResolvedValueOnce(response('1', false, 'same-version'))
    vi.stubGlobal('fetch', fetcher)
    const onProgress = vi.fn()

    const loading = loadEventernoteUserFromApi('test-user', onProgress)
    await vi.advanceTimersByTimeAsync(4_000)
    await loading

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenCalledOnce()
  })
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
