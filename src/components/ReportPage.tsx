import { useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  ChevronDown,
  MapPin,
  RefreshCw,
  Share2,
  Ticket,
  Users,
} from 'lucide-react'
import { getReportCopy } from '../lib/localize'
import { getAllPlaces } from '../lib/placeCache'
import { buildReportStats } from '../lib/reportStats'
import type { RankedStat, ReportScope } from '../lib/reportStats'
import {
  REPORT_CURRENCIES,
  readTicketCosts,
  writeTicketCosts,
} from '../lib/ticketCosts'
import type { ReportCurrency } from '../lib/ticketCosts'
import { resolveVenueCoordinates } from '../lib/venueCoordinates'
import type { ScheduleEvent, SupportedLocale, ThemeMode } from '../types/events'
import { MoonIcon, SunIcon } from './Icons'
import { VenueMap } from './VenueMap'
import type { VenueMapPoint } from './VenueMap'

interface ReportPageProps {
  userId: string
  events: ScheduleEvent[]
  locale: SupportedLocale
  theme: ThemeMode
  loading: boolean
  error: string | null
  onThemeToggle: () => void
  onRefresh: () => void
}

function eventOccurrenceList(
  eventIds: string[],
  eventsById: Map<string, ScheduleEvent>,
  locale: SupportedLocale,
) {
  return (
    <div className="report-occurrences">
      {eventIds.flatMap((eventId) => {
        const event = eventsById.get(eventId)
        if (!event) return []
        const eventUrl = event.links.find((link) => link.label === 'Eventernote')?.url
        const content = (
          <>
            <time>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(event.startAt))}</time>
            <span><strong>{event.title}</strong>{event.location && <small>{event.location}</small>}</span>
          </>
        )
        return eventUrl
          ? [<a key={event.id} href={eventUrl} target="_blank" rel="noreferrer">{content}</a>]
          : [<div key={event.id}>{content}</div>]
      })}
    </div>
  )
}

function rankedRows(
  items: RankedStat[],
  emptyText: string,
  eventsById: Map<string, ScheduleEvent>,
  locale: SupportedLocale,
  expandLabel: (name: string, count: number) => string,
) {
  if (items.length === 0) return <p className="report-empty-inline">{emptyText}</p>
  const max = items[0]?.count ?? 1
  return (
    <ol className="report-ranking">
      {items.map((item, index) => (
        <li key={item.name}>
          <details>
            <summary aria-label={expandLabel(item.name, item.count)}>
              <span className="report-ranking__position">{String(index + 1).padStart(2, '0')}</span>
              <span className="report-ranking__body">
                <span className="report-ranking__label">{item.name}</span>
                <span className="report-ranking__bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
                </span>
              </span>
              <strong>{item.count}</strong>
              <ChevronDown className="report-ranking__chevron" size={15} />
            </summary>
            {eventOccurrenceList(item.eventIds, eventsById, locale)}
          </details>
        </li>
      ))}
    </ol>
  )
}

export function ReportPage({
  userId,
  events,
  locale,
  theme,
  loading,
  error,
  onThemeToggle,
  onRefresh,
}: ReportPageProps) {
  const copy = getReportCopy(locale)
  const reportRef = useRef<HTMLDivElement>(null)
  const [scope, setScope] = useState<ReportScope>('all')
  const [ticketData, setTicketData] = useState(() => readTicketCosts(userId))
  const [selectedVenue, setSelectedVenue] = useState('')
  const [expandedMonth, setExpandedMonth] = useState('')
  const [status, setStatus] = useState('')
  const statusTimerRef = useRef<number | null>(null)

  const stats = useMemo(
    () => buildReportStats(events, scope, getAllPlaces(), ticketData.amounts),
    [events, scope, ticketData.amounts],
  )

  const eventsById = useMemo(() => new Map(stats.events.map((event) => [event.id, event])), [stats.events])
  const mapPoints = useMemo<VenueMapPoint[]>(
    () => stats.venues.flatMap((venue) => {
      const coordinates = resolveVenueCoordinates(venue)
      if (!coordinates) return []
      return [{
        name: venue.name,
        address: venue.address,
        ...coordinates,
        count: venue.count,
        events: venue.eventIds.flatMap((eventId) => {
          const event = eventsById.get(eventId)
          return event ? [event] : []
        }),
      }]
    }),
    [eventsById, stats.venues],
  )
  const mappedVenueNames = useMemo(() => new Set(mapPoints.map((point) => point.name)), [mapPoints])
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: ticketData.currency, maximumFractionDigits: 0 }),
    [locale, ticketData.currency],
  )

  function updateTicket(eventId: string, rawValue: string) {
    const amounts = { ...ticketData.amounts }
    if (rawValue === '') {
      delete amounts[eventId]
    } else {
      const amount = Number(rawValue)
      if (!Number.isFinite(amount) || amount < 0) return
      amounts[eventId] = amount
    }
    const next = { ...ticketData, amounts }
    setTicketData(next)
    writeTicketCosts(userId, next)
  }

  function updateCurrency(currency: ReportCurrency) {
    const next = { ...ticketData, currency }
    setTicketData(next)
    writeTicketCosts(userId, next)
  }

  function showStatus(message: string) {
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current)
    setStatus(message)
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 3200)
  }

  async function createReportBlob(): Promise<Blob | null> {
    if (!reportRef.current) return null
    const capture = reportRef.current.cloneNode(true) as HTMLElement
    capture.classList.add('is-capturing')
    capture.querySelectorAll('.report-ranking').forEach((ranking) => {
      Array.from(ranking.children).slice(8).forEach((row) => row.remove())
    })
    capture.querySelectorAll('.report-occurrences').forEach((occurrences) => occurrences.remove())
    reportRef.current.parentElement?.appendChild(capture)
    try {
      return await toBlob(capture, {
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: true,
        width: 1120,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
        style: { position: 'static', left: 'auto', top: 'auto', margin: '0' },
        filter: (node) => !(node instanceof HTMLElement && node.dataset.capture === 'exclude'),
      })
    } finally {
      capture.remove()
    }
  }

  async function downloadReport() {
    try {
      const blob = await createReportBlob()
      if (!blob) throw new Error('Image generation failed')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `eventernote-${userId}-${scope}.png`
      anchor.click()
      URL.revokeObjectURL(url)
      showStatus(copy.imageReady)
    } catch {
      showStatus(copy.shareFailed)
    }
  }

  async function shareReport() {
    const text = copy.shareText(userId, stats.events.length)
    try {
      const blob = await createReportBlob()
      const file = blob ? new File([blob], `eventernote-${userId}-${scope}.png`, { type: 'image/png' }) : null
      if (navigator.share) {
        const shareData: ShareData = { title: copy.title(userId), text, url: window.location.href }
        if (file && navigator.canShare?.({ files: [file] })) shareData.files = [file]
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`)
      showStatus(copy.shareCopied)
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      showStatus(copy.shareFailed)
    }
  }

  const shareText = encodeURIComponent(copy.shareText(userId, stats.events.length))
  const shareUrl = encodeURIComponent(window.location.href)

  if (loading && events.length === 0) {
    return (
      <div className="report-loading" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <p>{getReportCopy(locale).subtitle}</p>
      </div>
    )
  }

  if (error && events.length === 0) {
    return (
      <div className="report-loading" role="alert">
        <h1>{copy.noReportTitle}</h1>
        <p>{error}</p>
        <button type="button" className="report-button report-button--primary" onClick={onRefresh}>
          <RefreshCw size={17} /> {copy.refresh}
        </button>
      </div>
    )
  }

  return (
    <div className="report-root">
      <div className="report-toolbar" data-capture="exclude">
        <a className="report-icon-button" href={`/${userId}`} title={copy.back} aria-label={copy.back}>
          <ArrowLeft size={18} />
        </a>
        <div className="report-toolbar__spacer" />
        <button type="button" className="report-icon-button" onClick={onRefresh} title={copy.refresh} aria-label={copy.refresh}>
          <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
        </button>
        <button type="button" className="report-icon-button" onClick={onThemeToggle} aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <SunIcon className="ui-icon" /> : <MoonIcon className="ui-icon" />}
        </button>
      </div>

      <div ref={reportRef} className="report-sheet">
        <header className="report-hero">
          <div>
            <p className="report-eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title(userId)}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="report-scope" role="group" aria-label={copy.allYears}>
            <button type="button" className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>
              {copy.allYears}
            </button>
            {stats.years.map((year) => (
              <button key={year} type="button" className={scope === year ? 'is-active' : ''} onClick={() => setScope(year)}>
                {year}
              </button>
            ))}
          </div>
        </header>

        {stats.events.length === 0 ? (
          <section className="report-empty">
            <CalendarDays size={30} />
            <h2>{copy.noReportTitle}</h2>
            <p>{copy.noReportBody}</p>
          </section>
        ) : (
          <>
            <section className="report-metrics" aria-label={copy.attendedEvents}>
              <div><CalendarDays /><span>{copy.attendedEvents}</span><strong>{stats.events.length}</strong></div>
              <div><Building2 /><span>{copy.venues}</span><strong>{stats.venues.length}</strong></div>
              <div><MapPin /><span>{copy.regions}</span><strong>{stats.regions.length}</strong></div>
              <div><Users /><span>{copy.artists}</span><strong>{stats.artists.length}</strong></div>
              <div className="report-metric--spend">
                <Ticket />
                <span>{copy.ticketSpend}</span>
                <strong>{formatter.format(stats.ticketTotal)}</strong>
                <small>{copy.ticketCoverage(stats.pricedEventCount, stats.events.length)}</small>
              </div>
            </section>

            <section className="report-grid report-grid--rankings">
              <div className="report-section">
                <h2>{copy.venueRanking}</h2>
                {rankedRows(stats.venues, copy.unknownVenue, eventsById, locale, copy.expandEvents)}
              </div>
              <div className="report-section">
                <h2>{copy.artistRanking}</h2>
                {rankedRows(stats.artists, copy.noArtistData, eventsById, locale, copy.expandEvents)}
              </div>
              <div className="report-section">
                <h2>{copy.regionBreakdown}</h2>
                {rankedRows(stats.regions, copy.unknownVenue, eventsById, locale, copy.expandEvents)}
              </div>
              <div className="report-section">
                <h2>{copy.activityByMonth}</h2>
                <div className="report-months">
                  {Array.from({ length: 12 }, (_, index) => {
                    const month = String(index + 1).padStart(2, '0')
                    const count = stats.months.find((item) => item.name === month)?.count ?? 0
                    const max = Math.max(...stats.months.map((item) => item.count), 1)
                    const monthStat = stats.months.find((item) => item.name === month)
                    return (
                      <button
                        key={month}
                        type="button"
                        className={expandedMonth === month ? 'is-active' : ''}
                        title={`${month}: ${count}`}
                        aria-expanded={expandedMonth === month}
                        onClick={() => setExpandedMonth((current) => current === month ? '' : month)}
                      >
                        <span><i style={{ height: `${Math.max(count ? 10 : 2, (count / max) * 100)}%` }} /></span>
                        <small>{index + 1}</small>
                        <em>{monthStat?.count ?? 0}</em>
                      </button>
                    )
                  })}
                </div>
                {expandedMonth && eventOccurrenceList(
                  stats.months.find((item) => item.name === expandedMonth)?.eventIds ?? [],
                  eventsById,
                  locale,
                )}
              </div>
            </section>

            <section className="report-section report-map-section">
              <div className="report-section__heading">
                <div><h2>{copy.venueMap}</h2><p>{copy.mapHint}</p></div>
                <span className="report-map-coverage">{copy.mapCoverage(mapPoints.length, stats.venues.length)}</span>
              </div>
              <div className="report-map-layout">
                <div className="report-map__embed" data-capture="exclude">
                  <VenueMap
                    points={mapPoints}
                    selectedVenue={selectedVenue}
                    locale={locale}
                    eventCountLabel={copy.eventOccurrences}
                    approximateLocationLabel={copy.approximateLocation}
                    onSelectVenue={setSelectedVenue}
                  />
                </div>
                <div className="report-venue-list">
                  {stats.venues.map((venue) => (
                    <button key={venue.name} type="button" className={selectedVenue === venue.name ? 'is-active' : ''} onClick={() => setSelectedVenue(venue.name)} disabled={!mappedVenueNames.has(venue.name)}>
                      <MapPin size={16} />
                      <span><strong>{venue.name}</strong><small>{venue.address || venue.region}</small></span>
                      <em>{venue.count}</em>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="report-section report-tickets" data-capture="exclude">
              <div className="report-section__heading">
                <div><h2>{copy.ticketLedger}</h2><p>{copy.ticketLedgerHint}</p></div>
                <label className="report-currency">
                  <span className="visually-hidden">Currency</span>
                  <select value={ticketData.currency} onChange={(event) => updateCurrency(event.target.value as ReportCurrency)}>
                    {REPORT_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                  </select>
                </label>
              </div>
              <div className="report-ticket-list">
                {stats.events.map((event) => (
                  <label key={event.id}>
                    <span><strong>{event.title}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(event.startAt))}</small></span>
                    <span className="report-ticket-input"><small>{ticketData.currency}</small><input type="number" min="0" step="1" inputMode="numeric" aria-label={`${event.title} ${copy.ticketPrice}`} value={ticketData.amounts[event.id] ?? ''} onChange={(e) => updateTicket(event.id, e.target.value)} placeholder="0" /></span>
                  </label>
                ))}
              </div>
              <p className="report-local-note"><Ticket size={14} /> {copy.localOnly}</p>
            </section>
          </>
        )}

        <footer className="report-signature">Eventernote Dashboard · {scope === 'all' ? copy.allYears : scope}</footer>
      </div>

      <div className="report-share-panel" data-capture="exclude">
        <button type="button" className="report-button report-button--primary" onClick={downloadReport}>
          <Camera size={17} /> {copy.downloadImage}
        </button>
        <button type="button" className="report-button" onClick={shareReport}>
          <Share2 size={17} /> {copy.share}
        </button>
        <span>{copy.shareTo}</span>
        <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noreferrer">X</a>
        <a href={`https://social-plugins.line.me/lineit/share?url=${shareUrl}`} target="_blank" rel="noreferrer">LINE</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noreferrer">Facebook</a>
      </div>
      {status && <div className="report-toast" role="status">{status}</div>}
    </div>
  )
}
