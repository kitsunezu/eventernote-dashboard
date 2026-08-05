import { load } from 'cheerio'
import type { EventDetail, EventSeed, ParsedUserEventsPage, PlaceDetail } from './types.js'
import { detectRegion } from './regions.js'

function absoluteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  return new URL(value, 'https://www.eventernote.com').toString()
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function hasUsableCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90
    && Math.abs(longitude) <= 180
    && !(Math.abs(latitude) < 1 && Math.abs(longitude) < 1)
}

export function parseEventTimes(date: string, text: string): { startAt: string; endAt: string } {
  const openTime = text.match(/開場\s*(\d{1,2}:\d{2})/)?.[1]
  const startTime = text.match(/開演\s*(\d{1,2}:\d{2})/)?.[1]
  const endTime = text.match(/終演\s*(\d{1,2}:\d{2})/)?.[1]
  const normalizedStart = startTime ?? openTime ?? '00:00'
  let startDate = date

  if (openTime && startTime && timeToMinutes(startTime) < timeToMinutes(openTime)) {
    startDate = addDays(date, 1)
  }

  const endDate = endTime && timeToMinutes(endTime) < timeToMinutes(normalizedStart)
    ? addDays(startDate, 1)
    : startDate

  return {
    startAt: `${startDate}T${normalizedStart.padStart(5, '0')}:00`,
    endAt: endTime
      ? `${endDate}T${endTime.padStart(5, '0')}:00`
      : `${startDate}T${normalizedStart.padStart(5, '0')}:00`,
  }
}

export function parseUserEventsPage(html: string): ParsedUserEventsPage {
  const $ = load(html)
  const events: EventSeed[] = []

  $('li.clearfix').each((_, item) => {
    const dateText = $(item).find('.date p').toArray()
      .map((element) => $(element).text())
      .find((text) => /\d{4}-\d{2}-\d{2}/.test(text))
    const date = dateText?.match(/(\d{4}-\d{2}-\d{2})/)?.[1]
    const titleLink = $(item).find('.event h4 a').first()
    const eventId = titleLink.attr('href')?.match(/\/events\/(\d+)/)?.[1]
    if (!date || !eventId) return

    const venueLink = $(item).find('.event .place a[href^="/places/"]').first()
    const actors = $(item).find('.event .actor li a').toArray()
      .map((actor) => $(actor).text().trim())
      .filter(Boolean)
    const image = $(item).find('.date img').first()
    const { startAt, endAt } = parseEventTimes(date, $(item).find('.event .place span.s').text())

    events.push({
      id: eventId,
      title: titleLink.text().trim(),
      startAt,
      endAt,
      placeId: venueLink.attr('href')?.match(/\/places\/(\d+)/)?.[1] ?? '',
      venue: venueLink.text().trim(),
      actors,
      imageUrl: absoluteUrl(image.attr('src')),
      imageAlt: image.attr('alt')?.trim() || undefined,
    })
  })

  const paginationPaths = Array.from(new Set(
    $('.pagination a').toArray()
      .map((link) => $(link).attr('href'))
      .filter((href): href is string => Boolean(href?.includes('page=')))
      .filter((href) => !/[?&]page=1(?:&|$)/.test(href)),
  ))

  return { events, paginationPaths }
}

export function parseEventDetail(html: string, eventId: string): EventDetail {
  const $ = load(html)
  const table = $('.gb_events_info_table table').first()
  const rows = table.find('tr').toArray()
  const rowByLabel = (label: string) => rows.find((row) => {
    return $(row).find('td').first().text().trim() === label
  })
  const date = $(rowByLabel('開催日時')).find('td').eq(1).text()
    .match(/(\d{4}-\d{2}-\d{2})/)?.[1]
  if (!date) throw new Error(`Event ${eventId} detail page has no 開催日時`)

  const timeText = $(rowByLabel('時間')).find('td').eq(1).text().replace(/\s+/g, ' ').trim()
  const venueCell = $(rowByLabel('開催場所')).find('td').eq(1)
  const venueLink = venueCell.find('a[href^="/places/"]').first()
  const actors = $(rowByLabel('出演者')).find('a[href^="/actors/"]').toArray()
    .map((actor) => $(actor).text().trim())
    .filter(Boolean)
  const title = $('.gb_events_detail_title h2').first().text().trim()
    || $('meta[property="og:title"]').attr('content')?.trim()
    || ''
  const imageUrl = absoluteUrl(
    table.find('img[src*="/images/events/"]').first().attr('src')
      ?? $('meta[property="og:image"]').attr('content'),
  )
  const descriptionRow = rows.find((row) => $(row).find('td').first().find('img').length > 0)
  const description = descriptionRow
    ? $(descriptionRow).find('td').eq(1).text().replace(/\s+/g, ' ').trim()
    : ''
  const { startAt, endAt } = parseEventTimes(date, timeText)

  return {
    id: eventId,
    title,
    startAt,
    endAt,
    placeId: venueLink.attr('href')?.match(/\/places\/(\d+)/)?.[1] ?? '',
    venue: venueLink.text().trim(),
    actors,
    imageUrl,
    imageAlt: title || undefined,
    description,
  }
}

export function parsePlaceDetail(html: string, placeId: string, fallbackName: string): PlaceDetail {
  const $ = load(html)
  const table = $('.gb_place_detail_table table').first()
  const rows = table.find('tr').toArray()
  const addressRow = rows.find((row) => $(row).find('td').first().text().trim() === '所在地')
  const address = addressRow
    ? $(addressRow).find('td').eq(1).text().replace(/\s+/g, ' ').trim()
    : ''
  const scripts = $('script').toArray().map((script) => $(script).text()).join('\n')
  const latitude = Number(scripts.match(/\bvar\s+lat\s*=\s*['"](-?\d+(?:\.\d+)?)['"]/)?.[1])
  const longitude = Number(scripts.match(/\bvar\s+lon\s*=\s*['"](-?\d+(?:\.\d+)?)['"]/)?.[1])
  const name = $('.gb_place_detail_title h2').first().text().trim() || fallbackName
  const hasCoordinates = hasUsableCoordinates(latitude, longitude)

  return {
    id: placeId,
    name,
    address,
    region: detectRegion(name, '', address),
    latitude: hasCoordinates ? latitude : undefined,
    longitude: hasCoordinates ? longitude : undefined,
  }
}
