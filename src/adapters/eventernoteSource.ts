import type { EventCategory, ImportedScheduleData, ScheduleEvent } from '../types/events'
import { sortEvents } from '../lib/date'
import { getAllPlaces, getPlace, setPlace } from '../lib/placeCache'

const PROXY_BASE = '/api/eventernote'
/** Concurrency limit for detail-page fetches (upcoming events only) */
const DETAIL_FETCH_CONCURRENCY = 3

// ── region → color ────────────────────────────────────────────────

const REGION_COLORS: Record<string, string> = {
  '香港': '#e05858',
  '台灣': '#4d9e7a',
  '東京': '#5b7bc4',
  '神奈川': '#4a9fa5',
  '大阪': '#e08842',
  '名古屋': '#9b72b8',
  '福岡': '#c4a63a',
  '北海道': '#5b9ed4',
  '東北': '#6b8f71',
  '広島': '#c47a5b',
  '京都': '#c45b8f',
  '神戸': '#7b9bc4',
  'その他': '#8a7c6e',
}

function colorForRegion(region: string): string {
  return REGION_COLORS[region] ?? '#8a7c6e'
}

/** Detect region from a structured Japanese address (都道府県 prefix). Most accurate. */
function detectRegionFromAddress(address: string): string | null {
  if (/東京都/.test(address)) return '東京'
  if (/神奈川県/.test(address)) return '神奈川'
  if (/大阪府/.test(address)) return '大阪'
  if (/愛知県/.test(address)) return '名古屋'
  if (/福岡県/.test(address)) return '福岡'
  if (/北海道/.test(address)) return '北海道'
  if (/宮城県/.test(address)) return '東北'
  if (/広島県/.test(address)) return '広島'
  if (/京都府/.test(address)) return '京都'
  if (/兵庫県/.test(address)) return '神戸'
  return null
}

/** Detect region from venue name + event title (combined for best coverage).
 *  If an address string is available, it is checked first for highest accuracy. */
function detectRegion(venue: string, title: string = '', address: string = ''): string {
  if (address) {
    const fromAddress = detectRegionFromAddress(address)
    if (fromAddress) return fromAddress
  }
  const text = `${venue} ${title}`
  if (/hong.?kong|asia.?world|asiaworld|東華/i.test(text)) return '香港'
  if (/taipei|台北|台灣|taiwan|大佳/i.test(text)) return '台灣'
  if (/osaka|大阪|梅田|難波|なんば|心斎橋|cool.japan.park/i.test(text)) return '大阪'
  if (/nagoya|名古屋|愛知/i.test(text)) return '名古屋'
  if (/fukuoka|福岡|博多/i.test(text)) return '福岡'
  if (/sapporo|札幌|北海道/i.test(text)) return '北海道'
  if (/sendai|仙台/i.test(text)) return '東北'
  if (/hiroshima|広島/i.test(text)) return '広島'
  if (/kyoto|京都/i.test(text)) return '京都'
  if (/kobe|神戸/i.test(text)) return '神戸'
  if (/yokohama|横浜|kawasaki|川崎/i.test(text)) return '神奈川'
  if (/tokyo|東京|渋谷|shibuya|shinjuku|新宿|池袋|akihabara|秋葉原|原宿|武蔵野|白金|北参道|下北|吉祥寺|六本木|恵比寿|中野|高田馬場|新代田|dome.city/i.test(text)) return '東京'
  return 'その他'
}

// ── time helpers ──────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, '')
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16)
      return Number.isNaN(codePoint) ? `&${entity};` : String.fromCodePoint(codePoint)
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10)
      return Number.isNaN(codePoint) ? `&${entity};` : String.fromCodePoint(codePoint)
    }

    switch (entity) {
      case 'amp':
        return '&'
      case 'lt':
        return '<'
      case 'gt':
        return '>'
      case 'quot':
        return '"'
      case 'apos':
      case 'nbsp':
      case '#39':
        return entity === 'nbsp' ? ' ' : "'"
      default:
        return `&${entity};`
    }
  })
}

/**
 * Parse 開演 → startAt, 終演 → endAt.
 * Handles overnight events where 開演 < 開場 (next-day start).
 */
function parseEventTimes(
  dateStr: string,
  timeText: string,
): { startAt: string; endAt: string } {
  const kaijoTime = timeText.match(/開場\s+(\d{2}:\d{2})/)?.[1]
  const kaienTime = timeText.match(/開演\s+(\d{2}:\d{2})/)?.[1]
  const shuenTime = timeText.match(/終演\s+(\d{2}:\d{2})/)?.[1]

  // 開演 is preferred start; fall back to 開場
  const startTime = kaienTime ?? kaijoTime ?? '00:00'

  // Overnight: if show-start (開演) is earlier in the clock than doors-open (開場),
  // the show actually starts at midnight-ish on the next calendar day.
  let startDateStr = dateStr
  if (
    kaijoTime &&
    kaienTime &&
    timeToMinutes(kaienTime) < timeToMinutes(kaijoTime)
  ) {
    startDateStr = addDays(dateStr, 1)
  }

  let endDateStr = startDateStr
  if (shuenTime && timeToMinutes(shuenTime) < timeToMinutes(startTime)) {
    endDateStr = addDays(startDateStr, 1)
  }

  const startAt = `${startDateStr}T${startTime}:00`
  const endAt = shuenTime ? `${endDateStr}T${shuenTime}:00` : startAt

  return { startAt, endAt }
}

// ── HTML parsing ──────────────────────────────────────────────────

function parseEventsFromDoc(doc: Document): { events: ScheduleEvent[]; placeIdToName: Map<string, string> } {
  const items = Array.from(doc.querySelectorAll('li.clearfix'))
  const events: ScheduleEvent[] = []
  // placeId → venue name; collected across all items on this page
  const placeIdToName = new Map<string, string>()

  for (const item of items) {
    // Date — class can be day0 / day1 / day2 etc., so search all <p> elements
    const dateEl = Array.from(item.querySelectorAll<HTMLElement>('.date p')).find(
      (p) => /\d{4}-\d{2}-\d{2}/.test(p.textContent ?? ''),
    )
    if (!dateEl) continue
    const dateMatch = dateEl.textContent?.match(/(\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) continue
    const dateStr = dateMatch[1]

    // Thumbnail
    const imgEl = item.querySelector<HTMLImageElement>('.date img')
    const imageUrl = imgEl?.src ?? undefined
    const imageAlt = imgEl?.alt ?? undefined

    // Title + event URL
    const titleEl = item.querySelector<HTMLAnchorElement>('.event h4 a')
    if (!titleEl) continue
    const title = titleEl.textContent?.trim() ?? ''
    const eventPath = titleEl.getAttribute('href') ?? ''
    const eventId = eventPath.match(/\/events\/(\d+)/)?.[1]
    if (!eventId) continue

    // Venue: first .place <a> — also extract place ID for later enrichment
    let venue = ''
    let listPagePlaceId = ''
    for (const placeEl of Array.from(item.querySelectorAll('.event .place'))) {
      const venueLink = placeEl.querySelector('a')
      if (venueLink) {
        venue = venueLink.textContent?.trim() ?? ''
        const href = venueLink.getAttribute('href') ?? ''
        listPagePlaceId = href.match(/\/places\/(\d+)/)?.[1] ?? ''
        break
      }
    }
    if (listPagePlaceId && venue) placeIdToName.set(listPagePlaceId, venue)

    // Times: "開場 16:00 開演 17:00 終演 20:00"
    const timeText = item.querySelector('.event .place span.s')?.textContent ?? ''
    const { startAt, endAt } = parseEventTimes(dateStr, timeText)

    // Artists
    const artists = Array.from(item.querySelectorAll('.event .actor li a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter(Boolean)

    // Use place cache immediately if this place is already known
    const cachedPlace = listPagePlaceId ? getPlace(listPagePlaceId) : undefined
    const region = cachedPlace?.region ?? detectRegion(venue, title)
    const category: EventCategory = {
      id: region,
      label: region,
      color: colorForRegion(region),
    }

    events.push({
      id: eventId,
      title,
      startAt,
      endAt,
      allDay: false,
      category,
      location: venue || undefined,
      description: artists.length > 0 ? artists.join('、') : undefined,
      links: [
        {
          label: 'Eventernote',
          url: `https://www.eventernote.com/events/${eventId}`,
        },
      ],
      sourceType: 'backend',
      previewImageUrl: imageUrl,
      previewImageAlt: imageAlt,
    })
  }

  return { events, placeIdToName }
}

/**
 * Fetch place pages for all place IDs not yet in the cache.
 * Covers both past and upcoming events — called once after collecting all list pages.
 */
async function enrichAllPlaces(placeIdToName: Map<string, string>): Promise<void> {
  const toFetch = Array.from(placeIdToName.entries()).filter(([id]) => !getPlace(id))
  if (toFetch.length === 0) return

  const queue = [...toFetch]
  let active = 0
  let index = 0

  await new Promise<void>((resolve) => {
    function next() {
      while (active < DETAIL_FETCH_CONCURRENCY && index < queue.length) {
        const [placeId, venueName] = queue[index++]
        active++
        fetchDoc(`/places/${placeId}`)
          .then((doc) => {
            const address = parsePlaceAddressFromDoc(doc)
            const region = detectRegion(venueName, '', address)
            setPlace(placeId, { name: venueName, address, region })
          })
          .catch(() => { /* ignore — best-effort */ })
          .finally(() => {
            active--
            if (index < queue.length) next()
            else if (active === 0) resolve()
          })
      }
      if (queue.length === 0) resolve()
    }
    next()
  })
}

/**
 * Apply place cache entries to events by matching venue name.
 * Used to enrich past events (which never get a detail-page fetch) whenever
 * a matching place is already known from the cache.
 */
function applyPlaceCacheByName(events: ScheduleEvent[]): ScheduleEvent[] {
  const cache = getAllPlaces()
  // Build name → entry lookup (O(n) once)
  const byName = new Map<string, { address: string; region: string }>()
  for (const entry of Object.values(cache)) {
    if (entry.name) byName.set(entry.name, entry)
  }
  if (byName.size === 0) return events
  return events.map((event) => {
    if (!event.location) return event
    const cached = byName.get(event.location)
    if (!cached) return event
    const region = cached.region
    const category = { id: region, label: region, color: colorForRegion(region) }
    return { ...event, category }
  })
}

function applyDetailMap(
  events: ScheduleEvent[],
  detailMap: Map<string, { placeId: string; venue: string; address: string; actors: string[] }>,
): ScheduleEvent[] {
  return events.map((event) => {
    const detail = detailMap.get(event.id)
    if (!detail) return event
    const venue = detail.venue || event.location
    const description =
      detail.actors.length > 0 ? detail.actors.join('\u3001') : event.description
    // Prefer place cache (persistent) then address, then name/title regex
    const cached = detail.placeId ? getPlace(detail.placeId) : undefined
    const region = detail.venue
      ? (cached?.region ?? detectRegion(detail.venue, event.title, detail.address))
      : event.category.id
    const category = detail.venue
      ? { id: region, label: region, color: colorForRegion(region) }
      : event.category
    return { ...event, location: venue, description, category }
  })
}

function parseActorsFromEventDetailDoc(doc: Document): string[] {
  const actorRow = Array.from(doc.querySelectorAll('tr')).find((row) => {
    const labelCell = row.querySelector('td')
    return labelCell?.textContent?.trim() === '出演者'
  })

  if (!actorRow) {
    return []
  }

  return Array.from(actorRow.querySelectorAll('ul.actors.inline.unstyled a[href^="/actors/"]'))
    .map((anchor) => anchor.textContent?.trim() ?? '')
    .filter(Boolean)
}

function parseVenueFromDetailDoc(doc: Document): { placeId: string; venue: string; address: string } {
  const venueRow = Array.from(doc.querySelectorAll('tr')).find((row) => {
    const labelCell = row.querySelector('td')
    return labelCell?.textContent?.trim() === '開催場所'
  })
  if (!venueRow) return { placeId: '', venue: '', address: '' }
  const td = venueRow.querySelector('td:nth-child(2)')
  const link = td?.querySelector('a')
  const venue = link?.textContent?.trim() ?? ''
  // Extract place ID from href like "/places/9093"
  const href = link?.getAttribute('href') ?? ''
  const placeId = href.match(/\/places\/(\d+)/)?.[1] ?? ''
  // Address appears as text content beyond the link (may be in a span or bare text node)
  const fullText = td?.textContent?.trim() ?? ''
  const address = fullText.replace(venue, '').trim()
  return { placeId, venue, address }
}

/**
 * Parse the canonical address from a place detail page (/places/{id}).
 * The page contains a table inside .gb_place_detail_table; the address is in
 * the row whose first <td> reads "所在地".  The address text is inside an <a>
 * Google Maps link.
 */
function parsePlaceAddressFromDoc(doc: Document): string {
  const table = doc.querySelector('.gb_place_detail_table table')
  if (!table) return ''
  const row = Array.from(table.querySelectorAll('tr')).find((tr) => {
    return tr.querySelector('td')?.textContent?.trim() === '所在地'
  })
  if (!row) return ''
  const valueTd = row.querySelector('td:nth-child(2)')
  // Address is the text of the Maps <a> link, or bare text if no link
  return (valueTd?.querySelector('a')?.textContent ?? valueTd?.textContent ?? '').trim()
}

export function parseActorsFromEventDetailHtml(html: string): string[] {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return parseActorsFromEventDetailDoc(doc)
  }

  const actorRowMatch = html.match(/<tr>\s*<td>\s*出演者\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/)
  if (!actorRowMatch) {
    return []
  }

  return Array.from(actorRowMatch[1].matchAll(/<a[^>]+href="\/actors\/[^\"]+"[^>]*>([\s\S]*?)<\/a>/g))
    .map((match) => decodeHtmlEntities(stripHtmlTags(match[1])).trim())
    .filter(Boolean)
}

/** Return unique relative paths like "/users/slan1024/events?page=2&..." */
function parsePaginationPaths(doc: Document): string[] {
  const seen = new Set<string>()
  for (const link of Array.from(doc.querySelectorAll('.pagination a'))) {
    const href = link.getAttribute('href')
    if (href && href.includes('page=') && !href.includes('page=1')) {
      seen.add(href)
    }
  }
  return Array.from(seen)
}

  async function fetchHtml(path: string): Promise<string> {
  const resp = await fetch(`${PROXY_BASE}${path}`)
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${path}`)
  }

    return resp.text()
  }

  async function fetchDoc(path: string): Promise<Document> {
    const html = await fetchHtml(path)
    return new DOMParser().parseFromString(html, 'text/html')
  }

  /**
   * Fetch detail pages for upcoming events only (concurrency-limited).
   * Enriches venue (more accurate full name) and actor list from detail page.
   * Past events are left as-is to keep fetch count low.
   * onProgress is called after each successful detail fetch with the full updated event list.
   */
  async function enrichUpcomingEventDetails(
    events: ScheduleEvent[],
    onProgress?: (updatedEvents: ScheduleEvent[]) => void,
  ): Promise<{ events: ScheduleEvent[]; warnings: string[] }> {
    const now = new Date().toISOString()
    const upcoming = events.filter((e) => e.startAt >= now)
    const warnings: string[] = []

    if (upcoming.length === 0) return { events, warnings }

    // Fetch detail pages with concurrency cap
    const detailMap = new Map<string, { placeId: string; venue: string; address: string; actors: string[] }>()
    // Track place IDs already being fetched to avoid duplicate place-page requests
    const fetchingPlaceIds = new Set<string>()
    const queue = [...upcoming]
    let active = 0
    let index = 0

    await new Promise<void>((resolve) => {
      function next() {
        while (active < DETAIL_FETCH_CONCURRENCY && index < queue.length) {
          const event = queue[index++]
          active++
          fetchDoc(`/events/${event.id}`)
            .then(async (doc) => {
              const { placeId, venue, address } = parseVenueFromDetailDoc(doc)
              const actors = parseActorsFromEventDetailDoc(doc)
              // Compute region and persist to place cache if this is a new place
              if (placeId && !getPlace(placeId) && !fetchingPlaceIds.has(placeId)) {
                fetchingPlaceIds.add(placeId)
                // Fetch the place detail page for the canonical 所在地 address
                let resolvedAddress = address
                try {
                  const placeDoc = await fetchDoc(`/places/${placeId}`)
                  const placeAddress = parsePlaceAddressFromDoc(placeDoc)
                  if (placeAddress) resolvedAddress = placeAddress
                } catch {
                  // ignore — fall back to event-detail address
                }
                const region = detectRegion(venue, event.title, resolvedAddress)
                setPlace(placeId, { name: venue, address: resolvedAddress, region })
              }
              detailMap.set(event.id, { placeId, venue, address, actors })
              // Emit incremental progress after each successful detail fetch
              onProgress?.(applyDetailMap(events, detailMap))
            })
            .catch((err) => {
              warnings.push(`Detail fetch failed for ${event.id}: ${err instanceof Error ? err.message : String(err)}`)
            })
            .finally(() => {
              active--
              if (index < queue.length) {
                next()
              } else if (active === 0) {
                resolve()
              }
            })
        }
        if (queue.length === 0) resolve()
      }
      next()
    })

    return {
      events: applyDetailMap(events, detailMap),
      warnings,
    }
  }

export async function loadEventernoteUser(
  userId: string,
  onProgress?: (partial: { events: ScheduleEvent[]; warnings: string[] }) => void,
): Promise<ImportedScheduleData> {
  const basePath = `/users/${encodeURIComponent(userId)}/events`
  const firstDoc = await fetchDoc(basePath)

  const { events: firstPageEvents, placeIdToName } = parseEventsFromDoc(firstDoc)
  const allEvents = firstPageEvents
  const pagePaths = parsePaginationPaths(firstDoc)

  const pageResults = await Promise.allSettled(
    pagePaths.map((p) => fetchDoc(p)),
  )
  const warnings: string[] = []

  for (const result of pageResults) {
    if (result.status === 'fulfilled') {
      const { events, placeIdToName: pageMap } = parseEventsFromDoc(result.value)
      allEvents.push(...events)
      for (const [id, name] of pageMap) placeIdToName.set(id, name)
    } else {
      warnings.push(String(result.reason))
    }
  }

  // Deduplicate by event id
  const seen = new Set<string>()
  const unique = allEvents.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  // Phase 0: fetch place pages for ALL uncached venues (past + upcoming)
  await enrichAllPlaces(placeIdToName)

  // Phase 1: emit with correct regions from place cache (covers past events too)
  onProgress?.({ events: sortEvents(applyPlaceCacheByName(unique)), warnings: [...warnings] })

  // Phase 2: enrich upcoming events with accurate venue + actors from detail pages
  const enriched = await enrichUpcomingEventDetails(unique, (updatedEvents) => {
    onProgress?.({ events: sortEvents(updatedEvents), warnings: [...warnings] })
  })

  // Phase 3: apply the now-populated place cache to past events so their region
  // is correct when the user switches from 未來 to 所有.
  const final = applyPlaceCacheByName(enriched.events)

  return {
    events: sortEvents(final),
    warnings: [...warnings, ...enriched.warnings],
    sourceType: 'backend',
    importedAt: new Date().toISOString(),
  }
}
