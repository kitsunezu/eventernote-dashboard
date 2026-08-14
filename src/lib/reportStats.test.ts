import { describe, expect, it } from 'vitest'
import type { PlaceEntry } from './placeCache'
import type { ScheduleEvent } from '../types/events'
import {
  buildReportStats,
  getReportYears,
  getUnmappedVenuePlaceIds,
  sortVenuesByMapAvailability,
} from './reportStats'

const baseEvent: ScheduleEvent = {
  id: '1',
  title: 'Live 1',
  startAt: '2025-02-10T10:00:00.000Z',
  endAt: '2025-02-10T12:00:00.000Z',
  allDay: false,
  category: { id: 'tokyo', label: '東京', color: '#fff' },
  location: 'Venue A',
  description: 'Artist A、Artist B',
  links: [],
  sourceType: 'backend',
}

const events: ScheduleEvent[] = [
  baseEvent,
  {
    ...baseEvent,
    id: '2',
    title: 'Live 2',
    startAt: '2024-08-10T10:00:00.000Z',
    location: 'Venue B',
    description: 'Artist A',
    category: { ...baseEvent.category, id: 'osaka', label: '大阪' },
  },
  {
    ...baseEvent,
    id: '3',
    title: 'Future Live',
    startAt: '2027-01-10T10:00:00.000Z',
  },
]

const places: Record<string, PlaceEntry> = {
  a: { name: 'Venue A', address: 'Tokyo address', region: '東京' },
  b: { name: 'Venue B', address: 'Osaka address', region: '大阪' },
}

describe('report statistics', () => {
  it('only exposes years containing attended events', () => {
    expect(getReportYears(events, new Date('2026-01-01T00:00:00.000Z'))).toEqual([2025, 2024])
  })

  it('filters by year and aggregates venue, artist, and tickets', () => {
    const stats = buildReportStats(
      events,
      2025,
      places,
      { '1': 8800, '2': 5000, '3': 10000 },
      new Date('2026-01-01T00:00:00.000Z'),
    )

    expect(stats.events.map((event) => event.id)).toEqual(['1'])
    expect(stats.venues[0]).toMatchObject({ name: 'Venue A', count: 1, address: 'Tokyo address' })
    expect(stats.artists).toEqual([
      { name: 'Artist A', count: 1, eventIds: ['1'] },
      { name: 'Artist B', count: 1, eventIds: ['1'] },
    ])
    expect(stats.ticketTotal).toBe(8800)
    expect(stats.pricedEventCount).toBe(1)
  })

  it('ranks repeated values across all attended events', () => {
    const repeated = { ...baseEvent, id: '4', title: 'Live 4', startAt: '2025-04-10T10:00:00.000Z' }
    const stats = buildReportStats(
      [...events, repeated],
      'all',
      places,
      {},
      new Date('2026-01-01T00:00:00.000Z'),
    )

    expect(stats.venues[0]).toMatchObject({ name: 'Venue A', count: 2 })
    expect(stats.artists[0]).toEqual({ name: 'Artist A', count: 3, eventIds: ['4', '1', '2'] })
    expect(stats.regions).toEqual([
      { name: '東京', count: 2, eventIds: ['4', '1'] },
      { name: '大阪', count: 1, eventIds: ['2'] },
    ])
  })

  it('joins venue metadata by Eventernote place ID when names differ', () => {
    const event = {
      ...baseEvent,
      location: 'Venue alias from event',
      sourceMeta: { placeId: 'canonical' },
    }
    const stats = buildReportStats(
      [event],
      'all',
      {
        canonical: {
          name: 'Canonical venue name',
          address: '〒150-0042 東京都渋谷区宇田川町9番5号',
          region: '東京',
          latitude: 35.662,
          longitude: 139.698,
        },
      },
      {},
      new Date('2026-01-01T00:00:00.000Z'),
    )

    expect(stats.venues[0]).toMatchObject({
      name: 'Venue alias from event',
      address: '〒150-0042 東京都渋谷区宇田川町9番5号',
      latitude: 35.662,
      longitude: 139.698,
    })
  })

  it('uses refreshed place region instead of the event fallback region', () => {
    const event = {
      ...baseEvent,
      category: { ...baseEvent.category, id: 'other', label: 'Other region' },
      sourceMeta: { placeId: 'saitama-place' },
    }
    const stats = buildReportStats(
      [event],
      'all',
      {
        'saitama-place': {
          name: 'Venue A',
          address: 'Saitama address',
          region: 'Saitama',
        },
      },
      {},
      new Date('2026-01-01T00:00:00.000Z'),
    )

    expect(stats.regions).toEqual([{ name: 'Saitama', count: 1, eventIds: ['1'] }])
  })

  it('selects unique place IDs only for venues that are not mapped', () => {
    const retryEvents: ScheduleEvent[] = [
      { ...baseEvent, id: '10', location: 'Venue A', sourceMeta: { placeId: '101' } },
      { ...baseEvent, id: '11', location: 'Venue A', sourceMeta: { placeId: '101' } },
      { ...baseEvent, id: '12', location: 'Venue B', sourceMeta: { placeId: '202' } },
      { ...baseEvent, id: '13', location: 'Virtual venue' },
    ]
    const stats = buildReportStats(
      retryEvents,
      'all',
      {},
      {},
      new Date('2026-01-01T00:00:00.000Z'),
    )
    const eventsById = new Map(stats.events.map((event) => [event.id, event]))

    expect(getUnmappedVenuePlaceIds(stats.venues, new Set(['Venue B']), eventsById)).toEqual(['101'])
  })

  it('moves unmapped venues to the bottom while preserving ranking order', () => {
    const venues = [
      { name: 'Unmapped popular', count: 4, eventIds: ['1'], address: '', region: '' },
      { name: 'Mapped first', count: 3, eventIds: ['2'], address: '', region: '' },
      { name: 'Unmapped second', count: 2, eventIds: ['3'], address: '', region: '' },
      { name: 'Mapped second', count: 1, eventIds: ['4'], address: '', region: '' },
    ]

    expect(sortVenuesByMapAvailability(venues, new Set(['Mapped first', 'Mapped second']))
      .map((venue) => venue.name)).toEqual([
      'Mapped first',
      'Mapped second',
      'Unmapped popular',
      'Unmapped second',
    ])
    expect(venues.map((venue) => venue.name)[0]).toBe('Unmapped popular')
  })
})
