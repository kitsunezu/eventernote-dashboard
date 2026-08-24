import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import dayjs from 'dayjs'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Grid3x3,
  MapPin,
  X,
} from 'lucide-react'
import type { ScheduleEvent, SupportedLocale } from '../types/events'
import {
  buildCalendarDays,
  buildCalendarMonthCounts,
  buildCalendarYearDays,
  type CalendarYearDay,
} from '../lib/calendar'
import { formatDetailedRange, formatEventTime, sortEvents } from '../lib/date'
import { getUiCopy, resolveEventCopy } from '../lib/localize'

interface CalendarViewProps {
  events: ScheduleEvent[]
  locale: SupportedLocale
  onOpenEvent: (eventId: string) => void
}

type CalendarScope = 'month' | 'year'
type CalendarStyle = 'standard' | 'github'

const intlLocales: Record<SupportedLocale, string> = {
  'zh-Hant': 'zh-TW',
  en: 'en',
  ja: 'ja',
}

function getInitialMonth(events: ScheduleEvent[]): string {
  const now = dayjs()
  const sortedEvents = sortEvents(events)
  const nextEvent = sortedEvents.find((event) => dayjs(event.endAt).isAfter(now))
  const anchor = nextEvent ?? sortedEvents.at(-1)
  return (anchor ? dayjs(anchor.startAt) : now).startOf('month').format('YYYY-MM-DD')
}

function getSelectedDate(month: string, events: ScheduleEvent[]): string {
  const monthDate = dayjs(month)
  const today = dayjs()

  if (today.isSame(monthDate, 'month')) return today.format('YYYY-MM-DD')

  const firstEvent = sortEvents(events).find((event) => dayjs(event.startAt).isSame(monthDate, 'month'))
  return (firstEvent ? dayjs(firstEvent.startAt) : monthDate).format('YYYY-MM-DD')
}

function heatLevel(eventCount: number): number {
  if (eventCount === 0) return 0
  if (eventCount === 1) return 1
  if (eventCount === 2) return 2
  if (eventCount === 3) return 3
  return 4
}

interface HeatmapProps {
  days: CalendarYearDay[]
  locale: SupportedLocale
  eventCount: (count: number) => string
  onSelectDay: (day: CalendarYearDay) => void
}

function CalendarHeatmap({ days, locale, eventCount, onSelectDay }: HeatmapProps) {
  const dateLocale = intlLocales[locale]
  const dateFormatter = new Intl.DateTimeFormat(intlLocales[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const weekdayFormatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' })
  const monthFormatter = new Intl.DateTimeFormat(dateLocale, { month: 'short' })
  const firstYearDay = days.find((day) => day.inCurrentYear)
  const yearStart = firstYearDay ? dayjs(firstYearDay.dateKey).startOf('year') : dayjs().startOf('year')
  const gridStart = dayjs(days[0]?.dateKey ?? yearStart)
  const weekCount = Math.ceil(days.length / 7)
  const weekdayLabels = Array.from(
    { length: 7 },
    (_, index) => weekdayFormatter.format(new Date(2026, 0, 4 + index)),
  )
  const monthLabels = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthDate = yearStart.month(monthIndex).startOf('month')
    return {
      label: monthFormatter.format(monthDate.toDate()),
      week: Math.floor(monthDate.diff(gridStart, 'day') / 7) + 1,
    }
  })
  const chartStyle = { '--heatmap-weeks': weekCount } as CSSProperties

  return (
    <div className="calendar-heatmap">
      <div className="calendar-heatmap__scroll">
        <div className="calendar-heatmap__chart" style={chartStyle}>
          <div className="calendar-heatmap__months" aria-hidden="true">
            {monthLabels.map((item, index) => (
              <span key={`${item.label}-${index}`} style={{ gridColumnStart: item.week }}>
                {item.label}
              </span>
            ))}
          </div>
          <div className="calendar-heatmap__body">
            <div className="calendar-heatmap__weekdays" aria-hidden="true">
              {weekdayLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
            </div>
            <div className="calendar-heatmap__months-portrait" aria-hidden="true">
              {monthLabels.map((item, index) => (
                <span key={`${item.label}-${index}`} style={{ gridRowStart: item.week }}>
                  {item.label}
                </span>
              ))}
            </div>
            <div className="calendar-heatmap__grid" role="grid">
              {days.map((day) => {
                const label = `${dateFormatter.format(dayjs(day.dateKey).toDate())} · ${eventCount(day.events.length)}`
                const className = `calendar-heatmap__day level-${heatLevel(day.events.length)}${day.inCurrentYear ? '' : ' is-outside'}`
                return day.events.length > 0 && day.inCurrentYear ? (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={className}
                    onClick={() => onSelectDay(day)}
                    aria-label={label}
                    title={label}
                  >
                    <span className="calendar-heatmap__tooltip">{label}</span>
                  </button>
                ) : (
                  <span
                    key={day.dateKey}
                    className={className}
                    role="gridcell"
                    aria-label={label}
                    title={label}
                  >
                    <span className="calendar-heatmap__tooltip">{label}</span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="calendar-heatmap__legend" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`level-${level}`} />)}
      </div>
    </div>
  )
}

export function CalendarView({ events, locale, onOpenEvent }: CalendarViewProps) {
  const copy = getUiCopy(locale)
  const initialMonth = useMemo(() => getInitialMonth(events), [events])
  const [month, setMonth] = useState(initialMonth)
  const [selectedDate, setSelectedDate] = useState(() => getSelectedDate(initialMonth, events))
  const [scope, setScope] = useState<CalendarScope>('month')
  const [calendarStyle, setCalendarStyle] = useState<CalendarStyle>('standard')
  const [heatmapDate, setHeatmapDate] = useState<string | null>(null)
  const [heatmapEventIndex, setHeatmapEventIndex] = useState(0)
  const monthDate = dayjs(month)
  const year = monthDate.year()
  const days = useMemo(() => buildCalendarDays(month, events), [events, month])
  const yearDays = buildCalendarYearDays(year, events)
  const monthCounts = buildCalendarMonthCounts(year, events)
  const dateLocale = intlLocales[locale]
  const monthLabel = new Intl.DateTimeFormat(dateLocale, {
    year: 'numeric',
    month: 'long',
  }).format(monthDate.toDate())
  const yearLabel = new Intl.DateTimeFormat(dateLocale, { year: 'numeric' }).format(monthDate.toDate())
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'narrow' })
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2026, 0, 4 + index)))
  }, [dateLocale])
  const monthNameFormatter = useMemo(
    () => new Intl.DateTimeFormat(dateLocale, { month: 'long' }),
    [dateLocale],
  )
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(dateLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }),
    [dateLocale],
  )
  const todayKey = dayjs().format('YYYY-MM-DD')
  const selectedDay = days.find((day) => day.dateKey === selectedDate)
  const selectedEvents = selectedDay ? sortEvents(selectedDay.events) : []
  const selectedHeatmapDay = heatmapDate
    ? yearDays.find((day) => day.dateKey === heatmapDate)
    : undefined
  const heatmapEvents = selectedHeatmapDay ? sortEvents(selectedHeatmapDay.events) : []
  const heatmapEvent = heatmapEvents[heatmapEventIndex]
  const heatmapEventCopy = heatmapEvent ? resolveEventCopy(heatmapEvent, locale) : undefined
  const titleLabel = scope === 'month' ? monthLabel : yearLabel
  const scopeToggleLabel = calendarStyle === 'github'
    ? copy.standardCalendar
    : scope === 'month'
      ? copy.showYearCalendar
      : copy.showMonthCalendar

  useEffect(() => {
    if (!heatmapDate) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setHeatmapDate(null)
      if (event.key === 'ArrowLeft' && heatmapEvents.length > 1) {
        setHeatmapEventIndex((current) => (current - 1 + heatmapEvents.length) % heatmapEvents.length)
      }
      if (event.key === 'ArrowRight' && heatmapEvents.length > 1) {
        setHeatmapEventIndex((current) => (current + 1) % heatmapEvents.length)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [heatmapDate, heatmapEvents.length])

  function moveCalendar(amount: number) {
    const unit = scope === 'month' ? 'month' : 'year'
    const nextMonth = monthDate.add(amount, unit).startOf('month').format('YYYY-MM-DD')
    setMonth(nextMonth)
    setSelectedDate(getSelectedDate(nextMonth, events))
  }

  function selectDay(dateKey: string) {
    setSelectedDate(dateKey)
    if (!dayjs(dateKey).isSame(monthDate, 'month')) {
      setMonth(dayjs(dateKey).startOf('month').format('YYYY-MM-DD'))
    }
  }

  function selectCalendarStyle(style: CalendarStyle) {
    setCalendarStyle(style)
    setScope(style === 'github' ? 'year' : 'month')
  }

  function toggleCalendarScope() {
    if (calendarStyle === 'github') {
      setCalendarStyle('standard')
      setScope('month')
      return
    }
    setScope((current) => current === 'month' ? 'year' : 'month')
  }

  function openHeatmapDay(day: CalendarYearDay) {
    setHeatmapDate(day.dateKey)
    setHeatmapEventIndex(0)
  }

  function moveHeatmapEvent(amount: number) {
    setHeatmapEventIndex((current) => (current + amount + heatmapEvents.length) % heatmapEvents.length)
  }

  return (
    <section className="calendar-view" aria-label={copy.calendar}>
      <header className="calendar-view__toolbar">
        <div className="calendar-view__heading-area">
          <div className="calendar-view__style-controls">
            <div className="calendar-control-group" role="group" aria-label={copy.calendarStyle}>
              <button
                type="button"
                className={`icon-button${calendarStyle === 'standard' ? ' is-active' : ''}`}
                onClick={() => selectCalendarStyle('standard')}
                aria-label={copy.standardCalendar}
                aria-pressed={calendarStyle === 'standard'}
                title={copy.standardCalendar}
              >
                <CalendarDays className="ui-icon" />
              </button>
              <button
                type="button"
                className={`icon-button${calendarStyle === 'github' ? ' is-active' : ''}`}
                onClick={() => selectCalendarStyle('github')}
                aria-label={copy.githubCalendar}
                aria-pressed={calendarStyle === 'github'}
                title={copy.githubCalendar}
              >
                <Grid3x3 className="ui-icon" />
              </button>
            </div>

          </div>

          <div className="calendar-view__navigation">
            <button
              type="button"
              className="calendar-view__title"
              onClick={toggleCalendarScope}
              aria-label={scopeToggleLabel}
              title={scopeToggleLabel}
            >
              <h2>{titleLabel}</h2>
              <ChevronsUpDown className="ui-icon" />
            </button>

            <div className="calendar-view__controls">
              <button
                type="button"
                className="button button--ghost icon-button"
                onClick={() => moveCalendar(-1)}
                aria-label={scope === 'month' ? copy.previousMonth : copy.previousYear}
                title={scope === 'month' ? copy.previousMonth : copy.previousYear}
              >
                <ChevronLeft className="ui-icon" />
              </button>
              <button
                type="button"
                className="button button--ghost icon-button"
                onClick={() => moveCalendar(1)}
                aria-label={scope === 'month' ? copy.nextMonth : copy.nextYear}
                title={scope === 'month' ? copy.nextMonth : copy.nextYear}
              >
                <ChevronRight className="ui-icon" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {scope === 'year' ? (
        calendarStyle === 'github' ? (
          <CalendarHeatmap
            days={yearDays}
            locale={locale}
            eventCount={copy.eventCount}
            onSelectDay={openHeatmapDay}
          />
        ) : (
          <div className="calendar-year" aria-label={yearLabel}>
            {monthCounts.map((item) => (
              <button
                key={item.monthKey}
                type="button"
                className="calendar-year__month"
                onClick={() => {
                  setMonth(item.monthKey)
                  setSelectedDate(getSelectedDate(item.monthKey, events))
                  setScope('month')
                }}
                aria-label={`${monthNameFormatter.format(dayjs(item.monthKey).toDate())} · ${copy.eventCount(item.eventCount)}`}
              >
                <span>{monthNameFormatter.format(dayjs(item.monthKey).toDate())}</span>
                <strong>
                  {item.eventCount}<small>{copy.eventCountSuffix(item.eventCount)}</small>
                </strong>
              </button>
            ))}
          </div>
        )
      ) : (
        <>
        <div className="calendar-grid calendar-grid--desktop calendar-grid--images" role="grid" aria-label={monthLabel}>
          {weekdayLabels.map((label, index) => (
            <div key={`${label}-${index}`} className="calendar-grid__weekday" role="columnheader">
              {label}
            </div>
          ))}
          {days.map((day) => {
            const visibleEventCount = 2
            return (
              <div
                key={day.dateKey}
                className={`calendar-day${day.inCurrentMonth ? '' : ' calendar-day--outside'}${day.dateKey === todayKey ? ' calendar-day--today' : ''}`}
                role="gridcell"
              >
                <time dateTime={day.dateKey} className="calendar-day__number">
                  {day.dayNumber}
                </time>
                <div className="calendar-day__events">
                  {day.events.slice(0, visibleEventCount).map((event) => {
                    const eventCopy = resolveEventCopy(event, locale)
                    const eventLabel = `${formatEventTime(event, locale)} ${eventCopy.title}`
                    return (
                      <button
                        key={event.id}
                        type="button"
                        className="calendar-event-image"
                        style={{ '--event-color': event.category.color } as CSSProperties}
                        onClick={() => onOpenEvent(event.id)}
                        aria-label={eventLabel}
                        title={eventCopy.title}
                      >
                        {event.previewImageUrl ? (
                          <img src={event.previewImageUrl} alt="" loading="lazy" />
                        ) : (
                          <span>{eventCopy.title.slice(0, 1)}</span>
                        )}
                      </button>
                    )
                  })}
                  {day.events.length > visibleEventCount ? (
                    <span className="calendar-day__more">{copy.moreEvents(day.events.length - visibleEventCount)}</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="calendar-mobile">
          <div className="calendar-mobile__grid" role="grid" aria-label={monthLabel}>
            {weekdayLabels.map((label, index) => (
              <div key={`${label}-${index}`} className="calendar-grid__weekday" role="columnheader">
                {label}
              </div>
            ))}
              {days.map((day) => {
                const dateLabel = `${fullDateFormatter.format(dayjs(day.dateKey).toDate())} · ${copy.eventCount(day.events.length)}`
                return (
                  <div key={day.dateKey} className="calendar-mobile__cell" role="gridcell">
                    <button
                      type="button"
                      className={`calendar-mobile__day${day.inCurrentMonth ? '' : ' is-outside'}${day.dateKey === todayKey ? ' is-today' : ''}${day.dateKey === selectedDate ? ' is-selected' : ''}`}
                      onClick={() => selectDay(day.dateKey)}
                      aria-label={dateLabel}
                      aria-pressed={day.dateKey === selectedDate}
                    >
                      <time dateTime={day.dateKey}>{day.dayNumber}</time>
                      <span className="calendar-mobile__dots" aria-hidden="true">
                        {day.events.slice(0, 3).map((event) => (
                          <i key={event.id} style={{ '--event-color': event.category.color } as CSSProperties} />
                        ))}
                      </span>
                    </button>
                  </div>
                )
              })}
          </div>

          <section className="calendar-mobile__agenda" aria-live="polite">
            <header>
              <h3>{fullDateFormatter.format(dayjs(selectedDate).toDate())}</h3>
              <span>{copy.eventCount(selectedEvents.length)}</span>
            </header>
            <div className="calendar-mobile__events">
              {selectedEvents.length > 0 ? selectedEvents.map((event) => {
                const eventCopy = resolveEventCopy(event, locale)
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="calendar-mobile-event calendar-mobile-event--image"
                    style={{ '--event-color': event.category.color } as CSSProperties}
                    onClick={() => onOpenEvent(event.id)}
                  >
                    {event.previewImageUrl ? (
                      <img src={event.previewImageUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="calendar-mobile-event__fallback">{eventCopy.title.slice(0, 1)}</span>
                    )}
                    <span className="calendar-mobile-event__body">
                      <span>{formatEventTime(event, locale)}</span>
                      <strong>{eventCopy.title}</strong>
                      {eventCopy.location ? (
                        <span className="calendar-mobile-event__location">
                          <MapPin aria-hidden="true" />
                          {eventCopy.location}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              }) : (
                <p className="calendar-mobile__empty">{copy.noEventsTitle}</p>
              )}
            </div>
          </section>
        </div>
        </>
      )}

      {heatmapEvent && heatmapEventCopy && selectedHeatmapDay ? (
        <div
          className="heatmap-event-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHeatmapDate(null)
          }}
        >
          <section
            className="heatmap-event-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="heatmap-event-title"
          >
            <header className="heatmap-event-modal__header">
              <div>
                <p>{fullDateFormatter.format(dayjs(selectedHeatmapDay.dateKey).toDate())}</p>
                <span>{copy.eventCount(heatmapEvents.length)}</span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setHeatmapDate(null)}
                aria-label={copy.close}
                title={copy.close}
              >
                <X className="ui-icon" />
              </button>
            </header>

            <div className="heatmap-event-modal__content" aria-live="polite">
              {heatmapEvent.previewImageUrl ? (
                <img src={heatmapEvent.previewImageUrl} alt={heatmapEventCopy.previewAlt} />
              ) : null}
              <span className="heatmap-event-modal__category">{heatmapEventCopy.categoryLabel}</span>
              <h3 id="heatmap-event-title">{heatmapEventCopy.title}</h3>
              <dl>
                <div>
                  <dt>{copy.when}</dt>
                  <dd>{formatDetailedRange(heatmapEvent, locale)}</dd>
                </div>
                {heatmapEventCopy.location ? (
                  <div>
                    <dt>{copy.where}</dt>
                    <dd>{heatmapEventCopy.location}</dd>
                  </div>
                ) : null}
              </dl>
              {heatmapEventCopy.description ? <p>{heatmapEventCopy.description}</p> : null}
            </div>

            <footer className="heatmap-event-modal__footer">
              <div className="heatmap-event-modal__pager">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => moveHeatmapEvent(-1)}
                  disabled={heatmapEvents.length < 2}
                  aria-label={copy.previousEvent}
                  title={copy.previousEvent}
                >
                  <ChevronLeft className="ui-icon" />
                </button>
                <span>{heatmapEventIndex + 1} / {heatmapEvents.length}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => moveHeatmapEvent(1)}
                  disabled={heatmapEvents.length < 2}
                  aria-label={copy.nextEventInDay}
                  title={copy.nextEventInDay}
                >
                  <ChevronRight className="ui-icon" />
                </button>
              </div>
              <button
                type="button"
                className="button button--solid"
                onClick={() => {
                  setHeatmapDate(null)
                  onOpenEvent(heatmapEvent.id)
                }}
              >
                {copy.details}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}
