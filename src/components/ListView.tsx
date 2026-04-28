import type { ScheduleEvent, SupportedLocale } from '../types/events'
import { EventCard } from './EventCard'

interface ListViewProps {
  events: ScheduleEvent[]
  locale: SupportedLocale
  onOpenEvent: (eventId: string) => void
}

export function ListView({ events, locale, onOpenEvent }: ListViewProps) {
  return (
    <div className="list-view">
      <div className="list-view__grid">
        {events.map((event) => (
          <EventCard key={event.id} event={event} locale={locale} onOpen={onOpenEvent} />
        ))}
      </div>
    </div>
  )
}