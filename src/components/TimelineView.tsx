import type { ScheduleEvent, SupportedLocale, TimelineImageLayout } from '../types/events'
import { formatDayHeading, groupEventsByDay } from '../lib/date'
import { EventCard } from './EventCard'

interface TimelineViewProps {
  events: ScheduleEvent[]
  locale: SupportedLocale
  imageLayout: TimelineImageLayout
  onOpenEvent: (eventId: string) => void
  onRefreshEvent: (eventId: string) => void
}

export function TimelineView({ events, locale, imageLayout, onOpenEvent, onRefreshEvent }: TimelineViewProps) {
  const groups = groupEventsByDay(events)

  return (
    <div className="timeline">
      <div className="timeline__rail" aria-hidden="true" />
      {groups.map((group) => (
        <section key={group.day} className="timeline-day">
          <div className="timeline-day__heading">
            <h2>{formatDayHeading(group.day, locale)}</h2>
          </div>

          <div className="event-list">
            {group.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                locale={locale}
                imageLayout={imageLayout}
                onOpen={onOpenEvent}
                onRefresh={onRefreshEvent}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
