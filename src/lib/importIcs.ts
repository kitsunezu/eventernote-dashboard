import dayjs from 'dayjs'
import ICAL from 'ical.js'
import type { ImportedScheduleData, ScheduleEvent } from '../types/events'
import { colorForCategory, sortEvents } from './date'

const RECURRING_EVENT_LIMIT = 200

function cleanDescription(description?: string): { description?: string; notes?: string } {
  if (!description) {
    return {}
  }

  const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const [headline, ...rest] = lines

  return {
    description: headline,
    notes: rest.length > 0 ? rest.join('\n') : headline,
  }
}

function mapComponentToEvent(component: any, occurrenceStart?: any): ScheduleEvent {
  const calendarEvent = new ICAL.Event(component)
  const startDate = occurrenceStart ?? calendarEvent.startDate
  const duration = calendarEvent.duration ?? calendarEvent.endDate.subtractDate(calendarEvent.startDate)
  const endDate = startDate.clone()
  endDate.addDuration(duration)
  const categoryRaw = component.getFirstPropertyValue('categories')
  const categoryId = String(categoryRaw ?? 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'general'
  const url = component.getFirstPropertyValue('url')
  const color = String(component.getFirstPropertyValue('color') ?? colorForCategory(categoryId))
  const description = cleanDescription(calendarEvent.description)

  return {
    id: `${calendarEvent.uid ?? calendarEvent.summary}-${startDate.toString()}`,
    title: calendarEvent.summary ?? 'Untitled event',
    startAt: startDate.toJSDate().toISOString(),
    endAt: endDate.toJSDate().toISOString(),
    allDay: Boolean(startDate.isDate),
    category: {
      id: categoryId,
      label: String(categoryRaw ?? 'General'),
      color,
    },
    description: description.description,
    notes: description.notes,
    location: calendarEvent.location ?? undefined,
    links: url ? [{ label: 'Open event link', url: String(url) }] : [],
    sourceType: 'ics',
    sourceMeta: calendarEvent.organizer ? { organizer: String(calendarEvent.organizer) } : undefined,
  }
}

export function parseIcsSchedule(text: string, daysToExpand = 30): ImportedScheduleData {
  const root = new ICAL.Component(ICAL.parse(text))
  const components = root.getAllSubcomponents('vevent')
  const warnings: string[] = []
  const events: ScheduleEvent[] = []
  const expansionStart = dayjs().startOf('day')
  const expansionEnd = expansionStart.add(daysToExpand, 'day').endOf('day')

  for (const component of components) {
    const calendarEvent = new ICAL.Event(component)

    if (!calendarEvent.isRecurring()) {
      events.push(mapComponentToEvent(component))
      continue
    }

    const expansion = new ICAL.RecurExpansion({ component, dtstart: calendarEvent.startDate })
    let emitted = 0
    while (!expansion.complete && emitted < RECURRING_EVENT_LIMIT) {
      const occurrenceStart = expansion.next()
      if (!occurrenceStart) {
        break
      }

      const occurrenceDate = dayjs(occurrenceStart.toJSDate())
      if (occurrenceDate.isBefore(expansionStart)) {
        continue
      }
      if (occurrenceDate.isAfter(expansionEnd)) {
        break
      }

      events.push(mapComponentToEvent(component, occurrenceStart))
      emitted += 1
    }

    if (emitted >= RECURRING_EVENT_LIMIT) {
      warnings.push(`Stopped expanding ${calendarEvent.summary ?? 'an event'} after ${RECURRING_EVENT_LIMIT} instances.`)
    }
  }

  return {
    events: sortEvents(events),
    warnings,
    sourceType: 'ics',
    importedAt: new Date().toISOString(),
  }
}