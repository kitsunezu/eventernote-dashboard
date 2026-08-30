import type { CountdownStyle, ScheduleEvent, SupportedLocale } from '../types/events'
import { formatCountdown, formatEventDate, formatEventTime } from '../lib/date'
import { getUiCopy, resolveEventCopy } from '../lib/localize'
import { CalendarIcon, ClockIcon, PinIcon } from './Icons'
import { AdmitOneTicket } from './ui/AdmitOneTicket'

interface CountdownProps {
  locale: SupportedLocale
  nextEvent: ScheduleEvent | null
  style: CountdownStyle
}

export function Countdown({ locale, nextEvent, style }: CountdownProps) {
  const copy = getUiCopy(locale)
  const eventCopy = nextEvent ? resolveEventCopy(nextEvent, locale) : null
  const countdown = formatCountdown(nextEvent, locale)

  if (style === 'ticket') {
    return (
      <section className="countdown-ticket-shell" aria-live="polite">
        <AdmitOneTicket
          name={eventCopy?.title ?? copy.noUpcoming}
          presenter={copy.nextEventTicket}
          venue={eventCopy?.location ?? ''}
          dates={nextEvent
            ? `${formatEventDate(nextEvent, locale)} · ${formatEventTime(nextEvent, locale)}`
            : ''}
          stubText={countdown}
          watermark={nextEvent ? new Date(nextEvent.startAt).getFullYear().toString() : '—'}
        />
      </section>
    )
  }

  return (
    <section className="countdown" aria-live="polite">
      <div className="countdown__summary">
        <strong>{eventCopy?.title ?? copy.noUpcoming}</strong>

        {nextEvent ? (
          <div className="countdown__facts">
            <span className="countdown__fact">
              <CalendarIcon className="ui-icon" />
              <span>{formatEventDate(nextEvent, locale)}</span>
            </span>
            <span className="countdown__fact">
              <ClockIcon className="ui-icon" />
              <span>{formatEventTime(nextEvent, locale)}</span>
            </span>
            {eventCopy?.location ? (
              <span className="countdown__fact">
                <PinIcon className="ui-icon" />
                <span>{eventCopy.location}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="countdown__pill">{countdown}</div>
    </section>
  )
}
