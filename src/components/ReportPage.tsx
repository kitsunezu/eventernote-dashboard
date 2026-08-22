import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Users,
} from 'lucide-react'
import { getReportCopy } from '../lib/localize'
import { buildReportStats, getUnmappedVenuePlaceIds, sortVenuesByMapAvailability } from '../lib/reportStats'
import type { RankedStat, ReportScope } from '../lib/reportStats'
import { resolveVenueCoordinates } from '../lib/venueCoordinates'
import type {
  EventIndexProgress,
  ParticipationCalendarMonth,
  ScheduleEvent,
  SchedulePlace,
  SupportedLocale,
  ThemeMode,
} from '../types/events'
import { MoonIcon, SunIcon } from './Icons'
import { VenueMap } from './VenueMap'
import type { VenueMapPoint } from './VenueMap'

interface ReportPageProps {
  userId: string
  actorName?: string
  events: ScheduleEvent[]
  places: Record<string, SchedulePlace>
  participationCalendar: ParticipationCalendarMonth[]
  locale: SupportedLocale
  theme: ThemeMode
  loading: boolean
  error: string | null
  indexProgress: EventIndexProgress | null
  onThemeToggle: () => void
  onRefresh: () => void
  onRefreshEvent: (eventId: string) => void
  onRefreshUnmappedPlaces: (placeIds: string[]) => Promise<string[]>
}

function eventOccurrenceList(
  eventIds: string[],
  eventsById: Map<string, ScheduleEvent>,
  locale: SupportedLocale,
  onRefreshEvent: (eventId: string) => void,
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
          ? [<a key={event.id} href={eventUrl} target="_blank" rel="noreferrer" onClick={() => onRefreshEvent(event.id)}>{content}</a>]
          : [<div key={event.id}>{content}</div>]
      })}
    </div>
  )
}

interface RankedRowProps {
  item: RankedStat
  index: number
  max: number
  eventsById: Map<string, ScheduleEvent>
  locale: SupportedLocale
  expandLabel: (name: string, count: number) => string
  onRefreshEvent: (eventId: string) => void
}

function ReportIndexProgress({
  progress,
  preparing,
  progressLabel,
}: {
  progress: EventIndexProgress | null
  preparing: string
  progressLabel: (indexed: number, total: number) => string
}) {
  const hasTotal = Boolean(progress?.totalEventCount)
  const percentage = hasTotal
    ? Math.min(100, Math.round((progress?.indexedEventCount ?? 0) / (progress?.totalEventCount ?? 1) * 100))
    : 0
  const label = hasTotal && progress
    ? progressLabel(progress.indexedEventCount, progress.totalEventCount)
    : preparing

  return (
    <div className="report-index-progress" aria-live="polite">
      <div className="report-index-progress__label">
        <span>{label}</span>
        {hasTotal && <strong>{percentage}%</strong>}
      </div>
      <div
        className={`report-index-progress__track${hasTotal ? '' : ' is-indeterminate'}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        {...(hasTotal && progress ? {
          'aria-valuemax': progress.totalEventCount,
          'aria-valuenow': progress.indexedEventCount,
        } : {})}
      >
        <span style={hasTotal ? { width: `${percentage}%` } : undefined} />
      </div>
    </div>
  )
}

const INITIAL_RANKED_ITEMS = 20
const RANKED_ITEMS_BATCH = 20

function RankedRow({ item, index, max, eventsById, locale, expandLabel, onRefreshEvent }: RankedRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <li>
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
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
        {expanded && eventOccurrenceList(item.eventIds, eventsById, locale, onRefreshEvent)}
      </details>
    </li>
  )
}

interface RankedListProps {
  items: RankedStat[]
  emptyText: string
  eventsById: Map<string, ScheduleEvent>
  locale: SupportedLocale
  expandLabel: (name: string, count: number) => string
  loadMoreLabel: (visible: number, total: number) => string
  onRefreshEvent: (eventId: string) => void
  lazyLoad?: boolean
}

function RankedList({
  items,
  emptyText,
  eventsById,
  locale,
  expandLabel,
  loadMoreLabel,
  onRefreshEvent,
  lazyLoad = false,
}: RankedListProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const loadMoreRef = useRef<HTMLLIElement>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_RANKED_ITEMS)
  const visibleItems = lazyLoad ? items.slice(0, visibleCount) : items
  const hasMore = lazyLoad && visibleItems.length < items.length

  useEffect(() => {
    const list = listRef.current
    const loadMore = loadMoreRef.current
    if (!list || !loadMore || !hasMore || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setVisibleCount((current) => Math.min(current + RANKED_ITEMS_BATCH, items.length))
    }, { root: list, rootMargin: '0px 0px 160px 0px' })

    observer.observe(loadMore)
    return () => observer.disconnect()
  }, [hasMore, items.length])

  if (items.length === 0) return <p className="report-empty-inline">{emptyText}</p>
  const max = items[0]?.count ?? 1
  return (
    <ol ref={listRef} className="report-ranking">
      {visibleItems.map((item, index) => (
        <RankedRow
          key={item.name}
          item={item}
          index={index}
          max={max}
          eventsById={eventsById}
          locale={locale}
          expandLabel={expandLabel}
          onRefreshEvent={onRefreshEvent}
        />
      ))}
      {hasMore && (
        <li ref={loadMoreRef} className="report-ranking__load-more">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => Math.min(current + RANKED_ITEMS_BATCH, items.length))}
          >
            {loadMoreLabel(visibleItems.length, items.length)}
          </button>
        </li>
      )}
    </ol>
  )
}

const CAPTURE_SECTION_CLASSES = new Set([
  'report-hero',
  'report-empty',
  'report-metrics',
  'report-grid--rankings',
  'report-map-section',
  'report-signature',
])

function createCaptureElement(report: HTMLDivElement): HTMLElement {
  const capture = report.cloneNode(false) as HTMLElement
  capture.classList.add('is-capturing')
  for (const child of report.children) {
    if (Array.from(child.classList).some((className) => CAPTURE_SECTION_CLASSES.has(className))) {
      capture.appendChild(child.cloneNode(true))
    }
  }
  capture.querySelectorAll('.report-ranking').forEach((ranking) => {
    Array.from(ranking.children).slice(8).forEach((row) => row.remove())
  })
  capture.querySelectorAll('.report-occurrences').forEach((occurrences) => occurrences.remove())
  return capture
}

export function ReportPage({
  userId,
  actorName,
  events,
  places,
  participationCalendar,
  locale,
  theme,
  loading,
  error,
  indexProgress,
  onThemeToggle,
  onRefresh,
  onRefreshEvent,
  onRefreshUnmappedPlaces,
}: ReportPageProps) {
  const baseCopy = getReportCopy(locale)
  const copy = actorName ? {
    ...baseCopy,
    title: baseCopy.actorTitle,
    subtitle: baseCopy.actorSubtitle,
    attendedEvents: baseCopy.actorAttendedEvents,
    artists: baseCopy.actorArtists,
    artistRanking: baseCopy.actorArtistRanking,
    shareText: baseCopy.actorShareText,
    eventOccurrences: baseCopy.actorEventOccurrences,
    expandEvents: baseCopy.actorExpandEvents,
    noReportTitle: baseCopy.actorNoReportTitle,
    noReportBody: baseCopy.actorNoReportBody,
  } : baseCopy
  const reportRef = useRef<HTMLDivElement>(null)
  const [scope, setScope] = useState<ReportScope>('all')
  const [selectedVenue, setSelectedVenue] = useState('')
  const [expandedMonth, setExpandedMonth] = useState('')
  const [status, setStatus] = useState('')
  const [refreshingPlaceSubject, setRefreshingPlaceSubject] = useState<string | null>(null)
  const statusTimerRef = useRef<number | null>(null)
  const autoAttemptedPlaceIdsRef = useRef(new Set<string>())
  const refreshSubjectRef = useRef(userId)
  const refreshingUnmapped = refreshingPlaceSubject === userId

  const stats = useMemo(
    () => buildReportStats(events, scope, places, new Date(), participationCalendar, actorName),
    [actorName, events, participationCalendar, places, scope],
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
  const mapVenueList = useMemo(
    () => sortVenuesByMapAvailability(stats.venues, mappedVenueNames),
    [mappedVenueNames, stats.venues],
  )
  const unmappedPlaceIds = useMemo(
    () => getUnmappedVenuePlaceIds(stats.venues, mappedVenueNames, eventsById),
    [eventsById, mappedVenueNames, stats.venues],
  )
  const showStatus = useCallback((message: string) => {
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current)
    setStatus(message)
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 3200)
  }, [])

  const refreshUnmappedPlaces = useCallback(async (placeIds: string[], showCompletion: boolean) => {
    if (refreshingUnmapped || placeIds.length === 0) return
    const refreshSubject = userId
    setRefreshingPlaceSubject(refreshSubject)
    try {
      const warnings = await onRefreshUnmappedPlaces(placeIds)
      if (showCompletion && refreshSubjectRef.current === refreshSubject) {
        showStatus(warnings.length > 0 ? copy.mapRefreshPartial : copy.mapRefreshComplete)
      }
    } catch {
      if (refreshSubjectRef.current === refreshSubject) showStatus(copy.mapRefreshFailed)
    } finally {
      setRefreshingPlaceSubject((current) => current === refreshSubject ? null : current)
    }
  }, [copy.mapRefreshComplete, copy.mapRefreshFailed, copy.mapRefreshPartial, onRefreshUnmappedPlaces, refreshingUnmapped, showStatus, userId])

  useEffect(() => {
    refreshSubjectRef.current = userId
    autoAttemptedPlaceIdsRef.current.clear()
  }, [userId])

  useEffect(() => {
    if (loading || refreshingUnmapped) return
    const pendingPlaceIds = unmappedPlaceIds.filter((placeId) => !autoAttemptedPlaceIdsRef.current.has(placeId))
    if (pendingPlaceIds.length === 0) return
    pendingPlaceIds.forEach((placeId) => autoAttemptedPlaceIdsRef.current.add(placeId))
    void refreshUnmappedPlaces(pendingPlaceIds, false)
  }, [loading, refreshUnmappedPlaces, refreshingUnmapped, unmappedPlaceIds])

  const mapRefreshLabel = refreshingUnmapped
    ? copy.mapRefreshing
    : unmappedPlaceIds.length === 0
      ? copy.mapRefreshUnavailable
      : copy.mapRefresh

  async function createReportBlob(): Promise<Blob | null> {
    if (!reportRef.current) return null
    const capture = createCaptureElement(reportRef.current)
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
    const text = copy.shareText(userId, stats.attendedEventCount)
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

  const shareText = encodeURIComponent(copy.shareText(userId, stats.attendedEventCount))
  const shareUrl = encodeURIComponent(window.location.href)

  if (loading && events.length === 0 && participationCalendar.length === 0) {
    return (
      <div className="report-loading report-loading--pending" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <ReportIndexProgress
          progress={indexProgress}
          preparing={copy.indexPreparing}
          progressLabel={copy.indexProgress}
        />
      </div>
    )
  }

  if (error && events.length === 0 && participationCalendar.length === 0) {
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
        <a className="report-icon-button" href="/" title={copy.back} aria-label={copy.back}>
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

      {indexProgress && (
        <div className="report-index-banner" data-capture="exclude">
          <ReportIndexProgress
            progress={indexProgress}
            preparing={copy.indexPreparing}
            progressLabel={copy.indexProgress}
          />
        </div>
      )}

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

        {stats.attendedEventCount === 0 && stats.events.length === 0 ? (
          <section className="report-empty">
            <CalendarDays size={30} />
            <h2>{copy.noReportTitle}</h2>
            <p>{copy.noReportBody}</p>
          </section>
        ) : (
          <>
            <section className="report-metrics" aria-label={copy.attendedEvents}>
              <div><CalendarDays /><span>{copy.attendedEvents}</span><strong>{stats.attendedEventCount}</strong></div>
              <div><Building2 /><span>{copy.venues}</span><strong>{stats.venues.length}</strong></div>
              <div><MapPin /><span>{copy.regions}</span><strong>{stats.regions.length}</strong></div>
              <div><Users /><span>{copy.artists}</span><strong>{stats.artists.length}</strong></div>
            </section>

            <section className="report-grid report-grid--rankings">
              <div className="report-section">
                <h2>{copy.venueRanking}</h2>
                <RankedList
                  key={`venues-${scope}`}
                  items={stats.venues}
                  emptyText={copy.unknownVenue}
                  eventsById={eventsById}
                  locale={locale}
                  expandLabel={copy.expandEvents}
                  loadMoreLabel={copy.loadMoreRankings}
                  onRefreshEvent={onRefreshEvent}
                  lazyLoad
                />
              </div>
              <div className="report-section">
                <h2>{copy.artistRanking}</h2>
                <RankedList
                  key={`artists-${scope}`}
                  items={stats.artists}
                  emptyText={copy.noArtistData}
                  eventsById={eventsById}
                  locale={locale}
                  expandLabel={copy.expandEvents}
                  loadMoreLabel={copy.loadMoreRankings}
                  onRefreshEvent={onRefreshEvent}
                  lazyLoad
                />
              </div>
              <div className="report-section">
                <h2>{copy.regionBreakdown}</h2>
                <RankedList
                  items={stats.regions}
                  emptyText={copy.unknownVenue}
                  eventsById={eventsById}
                  locale={locale}
                  expandLabel={copy.expandEvents}
                  loadMoreLabel={copy.loadMoreRankings}
                  onRefreshEvent={onRefreshEvent}
                />
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
                  onRefreshEvent,
                )}
              </div>
            </section>

            <section className="report-section report-map-section" aria-busy={refreshingUnmapped}>
              <div className="report-section__heading">
                <div><h2>{copy.venueMap}</h2><p>{copy.mapHint}</p></div>
                <div className="report-map-actions">
                  <span className="report-map-coverage" aria-live="polite">{copy.mapCoverage(mapPoints.length, stats.venues.length)}</span>
                  <button
                    type="button"
                    className="report-map-refresh"
                    data-capture="exclude"
                    onClick={() => void refreshUnmappedPlaces(unmappedPlaceIds, true)}
                    disabled={refreshingUnmapped || unmappedPlaceIds.length === 0}
                    aria-disabled={refreshingUnmapped || unmappedPlaceIds.length === 0}
                    title={mapRefreshLabel}
                    aria-label={mapRefreshLabel}
                  >
                    <RefreshCw size={15} className={refreshingUnmapped ? 'is-spinning' : ''} />
                  </button>
                </div>
              </div>
              <div className="report-map-layout">
                <div className="report-map__embed">
                  <VenueMap
                    points={mapPoints}
                    selectedVenue={selectedVenue}
                    locale={locale}
                    eventCountLabel={copy.eventOccurrences}
                    approximateLocationLabel={copy.approximateLocation}
                    onSelectVenue={setSelectedVenue}
                    onCloseVenue={(venue) => setSelectedVenue((selected) => selected === venue ? '' : selected)}
                    onRefreshEvent={onRefreshEvent}
                  />
                </div>
                <div className="report-venue-list">
                  {mapVenueList.map((venue) => (
                    <button key={venue.name} type="button" className={selectedVenue === venue.name ? 'is-active' : ''} onClick={() => setSelectedVenue(venue.name)} disabled={!mappedVenueNames.has(venue.name)}>
                      <MapPin size={16} />
                      <span><strong>{venue.name}</strong><small>{venue.address || venue.region}</small></span>
                      <em>{venue.count}</em>
                    </button>
                  ))}
                </div>
              </div>
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
