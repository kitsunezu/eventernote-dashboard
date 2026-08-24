import { useRef, useState, type CSSProperties } from 'react'
import type { ScheduleEvent, SupportedLocale } from '../types/events'
import { buildPreviewText, formatEventDate, formatEventTime } from '../lib/date'
import { getUiCopy, resolveEventCopy, resolveLinkLabel } from '../lib/localize'
import { calculateTooltipPosition, shouldPlaceTooltipBelow } from '../lib/tooltipPosition'
import { CalendarIcon, ClockIcon, LinkChainIcon, PinIcon } from './Icons'

interface EventCardProps {
  event: ScheduleEvent
  locale: SupportedLocale
  onOpen: (eventId: string) => void
  onRefresh?: (eventId: string) => void
}

type TooltipStyle = CSSProperties & {
  '--tooltip-left'?: string
  '--tooltip-width'?: string
  '--tooltip-top'?: string
  '--tooltip-bottom'?: string
}

export function EventCard({ event, locale, onOpen, onRefresh }: EventCardProps) {
  const preview = buildPreviewText(event, locale)
  const copy = resolveEventCopy(event, locale)
  const ui = getUiCopy(locale)
  const primaryLink = event.links[0]
  const tooltipContainerRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<TooltipStyle | undefined>(undefined)

  function updateTooltipPosition() {
    if (!preview || !tooltipContainerRef.current || !tooltipRef.current || typeof window === 'undefined') {
      return
    }

    const rect = tooltipContainerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const { left, width } = calculateTooltipPosition(window.innerWidth, rect.left)
    const placeBelow = shouldPlaceTooltipBelow(
      window.innerHeight,
      rect.top,
      rect.bottom,
      tooltipRect.height,
    )

    setTooltipStyle({
      '--tooltip-left': `${left}px`,
      '--tooltip-width': `${width}px`,
      '--tooltip-top': placeBelow ? 'calc(100% + 10px)' : 'auto',
      '--tooltip-bottom': placeBelow ? 'auto' : 'calc(100% + 10px)',
    })
  }

  return (
    <article
      className={`event-card${primaryLink ? ' event-card--hasLink' : ''}`}
      onMouseEnter={updateTooltipPosition}
      onFocusCapture={updateTooltipPosition}
    >
      <span className="event-card__accent" style={{ background: event.category.color }} aria-hidden="true" />
      <span
        className="event-card__image"
        style={{ '--event-color': event.category.color } as CSSProperties}
      >
        {event.previewImageUrl ? (
          <img src={event.previewImageUrl} alt={copy.previewAlt} loading="lazy" />
        ) : (
          <span aria-hidden="true">{copy.title.slice(0, 1)}</span>
        )}
      </span>
      <div ref={tooltipContainerRef} className="event-card__body">
        {primaryLink ? (
          <a
            className="event-card__linkButton icon-button"
            href={primaryLink.url}
            target="_blank"
            rel="noreferrer"
            aria-label={resolveLinkLabel(primaryLink, locale)}
            title={resolveLinkLabel(primaryLink, locale)}
            onClick={() => onRefresh?.(event.id)}
          >
            <LinkChainIcon className="ui-icon" />
            <span className="visually-hidden">{resolveLinkLabel(primaryLink, locale)}</span>
          </a>
        ) : null}

        <button
          type="button"
          className="event-card__content"
          onClick={() => onOpen(event.id)}
          aria-label={`${ui.details}: ${copy.title}`}
        >
          <span className="event-card__header">
            <h3 className="event-card__title">{copy.title}</h3>
            {copy.location ? (
              <span className="event-card__location">
                <PinIcon className="ui-icon" />
                <span className="event-card__locationText">{copy.location}</span>
              </span>
            ) : null}
          </span>

          <span className="event-card__facts">
            <span className="event-card__fact">
              <CalendarIcon className="ui-icon" />
              <span>{formatEventDate(event, locale)}</span>
            </span>
            <span className="event-card__fact">
              <ClockIcon className="ui-icon" />
              <span>{formatEventTime(event, locale)}</span>
            </span>
          </span>
        </button>

        {preview ? (
          <div ref={tooltipRef} className="event-card__tooltip" style={tooltipStyle}>
            {event.previewImageUrl ? (
              <img
                className="event-card__tooltipImage"
                src={event.previewImageUrl}
                alt={copy.previewAlt}
                loading="lazy"
              />
            ) : null}
            <p>{preview}</p>
          </div>
        ) : null}
      </div>
    </article>
  )
}
