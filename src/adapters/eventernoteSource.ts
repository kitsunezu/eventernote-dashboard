import type { EventCategory, ImportedScheduleData, ScheduleEvent } from '../types/events'
import { sortEvents } from '../lib/date'

const PROXY_BASE = '/api/eventernote'

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

/** Detect region from venue name + event title (combined for best coverage). */
function detectRegion(venue: string, title: string = ''): string {
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

function parseEventsFromDoc(doc: Document): ScheduleEvent[] {
  const items = Array.from(doc.querySelectorAll('li.clearfix'))
  const events: ScheduleEvent[] = []

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

    // Venue: first .place <a>
    let venue = ''
    for (const placeEl of Array.from(item.querySelectorAll('.event .place'))) {
      const venueLink = placeEl.querySelector('a')
      if (venueLink) {
        venue = venueLink.textContent?.trim() ?? ''
        break
      }
    }

    // Times: "開場 16:00 開演 17:00 終演 20:00"
    const timeText = item.querySelector('.event .place span.s')?.textContent ?? ''
    const { startAt, endAt } = parseEventTimes(dateStr, timeText)

    // Artists
    const artists = Array.from(item.querySelectorAll('.event .actor li a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter(Boolean)

    const region = detectRegion(venue, title)
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

  return events
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

async function fetchDoc(path: string): Promise<Document> {
  const resp = await fetch(`${PROXY_BASE}${path}`)
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${path}`)
  }
  const html = await resp.text()
  return new DOMParser().parseFromString(html, 'text/html')
}

// ── public API ────────────────────────────────────────────────────

export async function loadEventernoteUser(
  userId: string,
): Promise<ImportedScheduleData> {
  const basePath = `/users/${encodeURIComponent(userId)}/events`
  const firstDoc = await fetchDoc(basePath)

  const allEvents = parseEventsFromDoc(firstDoc)
  const pagePaths = parsePaginationPaths(firstDoc)

  const pageResults = await Promise.allSettled(
    pagePaths.map((p) => fetchDoc(p)),
  )
  const warnings: string[] = []

  for (const result of pageResults) {
    if (result.status === 'fulfilled') {
      allEvents.push(...parseEventsFromDoc(result.value))
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

  return {
    events: sortEvents(unique),
    warnings,
    sourceType: 'backend',
    importedAt: new Date().toISOString(),
  }
}
