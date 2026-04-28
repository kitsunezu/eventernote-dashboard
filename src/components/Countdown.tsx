import type { ScheduleEvent, SupportedLocale } from '../types/events'
import { formatCountdown, formatEventDate, formatEventTime } from '../lib/date'
import { getUiCopy, resolveEventCopy } from '../lib/localize'
import { CalendarIcon, ClockIcon, PinIcon } from './Icons'

interface CountdownProps {
  locale: SupportedLocale
  nextEvent: ScheduleEvent | null
}

export function Countdown({ locale, nextEvent }: CountdownProps) {
  const copy = getUiCopy(locale)
  const eventCopy = nextEvent ? resolveEventCopy(nextEvent, locale) : null

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

      <div className="countdown__pill">{formatCountdown(nextEvent, locale)}</div>
    </section>
  )
}