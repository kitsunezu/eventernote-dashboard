import { hasUsablePlaceCoordinates } from './placeCache'
import type { PlaceEntry } from './placeCache'
import type { ScheduleEvent } from '../types/events'

export type ReportScope = 'all' | number

export interface RankedStat {
  name: string
  count: number
  eventIds: string[]
}

export interface VenueStat extends RankedStat {
  address: string
  region: string
  latitude?: number
  longitude?: number
}

export interface ReportStats {
  events: ScheduleEvent[]
  years: number[]
  venues: VenueStat[]
  regions: RankedStat[]
  artists: RankedStat[]
  months: RankedStat[]
  ticketTotal: number
  pricedEventCount: number
}

export function getUnmappedVenuePlaceIds(
  venues: VenueStat[],
  mappedVenueNames: ReadonlySet<string>,
  eventsById: ReadonlyMap<string, ScheduleEvent>,
): string[] {
  const placeIds = new Set<string>()
  for (const venue of venues) {
    if (mappedVenueNames.has(venue.name)) continue
    for (const eventId of venue.eventIds) {
      const placeId = eventsById.get(eventId)?.sourceMeta?.placeId
      if (placeId && /^\d+$/.test(placeId)) placeIds.add(placeId)
    }
  }
  return Array.from(placeIds)
}

export function sortVenuesByMapAvailability(
  venues: VenueStat[],
  mappedVenueNames: ReadonlySet<string>,
): VenueStat[] {
  const mapped: VenueStat[] = []
  const unmapped: VenueStat[] = []

  for (const venue of venues) {
    if (mappedVenueNames.has(venue.name)) mapped.push(venue)
    else unmapped.push(venue)
  }

  return [...mapped, ...unmapped]
}

function rank(entries: Array<{ name: string; eventId: string }>): RankedStat[] {
  const counts = new Map<string, string[]>()
  for (const entry of entries) {
    const name = entry.name.trim()
    if (!name) continue
    const eventIds = counts.get(name) ?? []
    if (!eventIds.includes(entry.eventId)) eventIds.push(entry.eventId)
    counts.set(name, eventIds)
  }

  return Array.from(counts, ([name, eventIds]) => ({ name, count: eventIds.length, eventIds })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
}

export function getReportYears(events: ScheduleEvent[], now = new Date()): number[] {
  const nowTime = now.getTime()
  return Array.from(
    new Set(
      events
        .filter((event) => new Date(event.startAt).getTime() <= nowTime)
        .map((event) => new Date(event.startAt).getFullYear()),
    ),
  ).sort((a, b) => b - a)
}

export function buildReportStats(
  events: ScheduleEvent[],
  scope: ReportScope,
  places: Record<string, PlaceEntry>,
  ticketCosts: Record<string, number>,
  now = new Date(),
): ReportStats {
  const nowTime = now.getTime()
  const attendedEvents = events
    .filter((event) => {
      const start = new Date(event.startAt)
      return start.getTime() <= nowTime && (scope === 'all' || start.getFullYear() === scope)
    })
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())

  const placesByName = new Map<string, PlaceEntry>()
  for (const place of Object.values(places)) {
    if (place.name) placesByName.set(place.name, place)
  }

  const placesByVenue = new Map<string, PlaceEntry>()
  for (const event of attendedEvents) {
    const venue = event.location?.trim()
    const placeId = event.sourceMeta?.placeId
    const place = placeId ? places[placeId] : undefined
    if (venue && place && !placesByVenue.has(venue)) placesByVenue.set(venue, place)
  }

  const venueCounts = rank(attendedEvents.map((event) => ({ name: event.location ?? '', eventId: event.id })))
  const venues = venueCounts.map((venue) => {
    const place = placesByVenue.get(venue.name) ?? placesByName.get(venue.name)
    const latitude = place && hasUsablePlaceCoordinates(place) ? place.latitude : undefined
    const longitude = place && hasUsablePlaceCoordinates(place) ? place.longitude : undefined
    const fallbackRegion = attendedEvents.find((event) => event.location === venue.name)?.category.label ?? ''
    return {
      ...venue,
      address: place?.address ?? '',
      region: place?.region ?? fallbackRegion,
      latitude,
      longitude,
    }
  })

  const artists = rank(
    attendedEvents.flatMap((event) =>
      Array.from(new Set((event.description ?? '').split(/[、,\n]+/).map((artist) => artist.trim()).filter(Boolean)))
        .map((name) => ({ name, eventId: event.id })),
    ),
  )

  const months = rank(
    attendedEvents.map((event) => ({
      name: String(new Date(event.startAt).getMonth() + 1).padStart(2, '0'),
      eventId: event.id,
    })),
  ).sort((a, b) => Number(a.name) - Number(b.name))

  const regions = rank(attendedEvents.map((event) => {
    const venue = event.location?.trim()
    const placeId = event.sourceMeta?.placeId
    const place = (placeId ? places[placeId] : undefined) ?? (venue ? placesByName.get(venue) : undefined)
    return { name: place?.region || event.category.label, eventId: event.id }
  }))

  const pricedEvents = attendedEvents.filter((event) => {
    const amount = ticketCosts[event.id]
    return Number.isFinite(amount) && amount >= 0
  })

  return {
    events: attendedEvents,
    years: getReportYears(events, now),
    venues,
    regions,
    artists,
    months,
    ticketTotal: pricedEvents.reduce((sum, event) => sum + ticketCosts[event.id], 0),
    pricedEventCount: pricedEvents.length,
  }
}
