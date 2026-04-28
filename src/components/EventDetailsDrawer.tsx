import { useEffect } from 'react'
import type { ScheduleEvent, SupportedLocale } from '../types/events'
import { formatDetailedRange } from '../lib/date'
import { getUiCopy, resolveEventCopy, resolveLinkLabel } from '../lib/localize'

interface EventDetailsDrawerProps {
  event: ScheduleEvent | null
  locale: SupportedLocale
  onClose: () => void
}

export function EventDetailsDrawer({ event, locale, onClose }: EventDetailsDrawerProps) {
  useEffect(() => {
    if (!event) {
      return undefined
    }

    function onKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [event, onClose])

  if (!event) {
    return null
  }

  const copy = resolveEventCopy(event, locale)
  const ui = getUiCopy(locale)

  return (
    <div className="event-modal" role="presentation" onClick={onClose}>
      <div className="event-modal__scrim" aria-hidden="true" />
      <section
        className="event-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={ui.details}
        onClick={(eventObject) => eventObject.stopPropagation()}
      >
        {event.previewImageUrl ? (
          <img className="event-modal__image" src={event.previewImageUrl} alt={copy.previewAlt} loading="lazy" />
        ) : null}

        <div className="event-drawer__top">
          <div>
            <p className="eyebrow">{ui.details}</p>
            <h2>{copy.title}</h2>
          </div>
          <button type="button" className="event-drawer__close" onClick={onClose} aria-label={ui.close}>
            ×
          </button>
        </div>

        <div className="detail-stack">
          <div className="detail-chip" style={{ borderColor: `${event.category.color}55`, color: event.category.color }}>
            {copy.categoryLabel}
          </div>

          <div className="detail-block">
            <h3>{ui.when}</h3>
            <p>{formatDetailedRange(event, locale)}</p>
          </div>

          {copy.location ? (
            <div className="detail-block">
              <h3>{ui.where}</h3>
              <p>{copy.location}</p>
            </div>
          ) : null}

          {copy.description ? (
            <div className="detail-block">
              <h3>{ui.summary}</h3>
              <p>{copy.description}</p>
            </div>
          ) : null}

          {copy.notes ? (
            <div className="detail-block">
              <h3>{ui.notes}</h3>
              <p>{copy.notes}</p>
            </div>
          ) : null}

          {event.links.length > 0 ? (
            <div className="detail-block">
              <h3>{ui.links}</h3>
              <div className="detail-links">
                {event.links.map((link) => (
                  <a className="event-drawer__link" key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {resolveLinkLabel(link, locale)}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}