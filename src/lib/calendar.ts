import dayjs from 'dayjs'
import type { ScheduleEvent } from '../types/events'

export interface CalendarDay {
  dateKey: string
  dayNumber: number
  inCurrentMonth: boolean
  events: ScheduleEvent[]
}

export interface CalendarYearDay {
  dateKey: string
  inCurrentYear: boolean
  events: ScheduleEvent[]
}

export interface CalendarMonthCount {
  month: number
  monthKey: string
  eventCount: number
}

function groupEventsByDate(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const eventsByDay = new Map<string, ScheduleEvent[]>()

  for (const event of events) {
    const dateKey = dayjs(event.startAt).format('YYYY-MM-DD')
    const dayEvents = eventsByDay.get(dateKey) ?? []
    dayEvents.push(event)
    eventsByDay.set(dateKey, dayEvents)
  }

  return eventsByDay
}

export function buildCalendarDays(month: string, events: ScheduleEvent[]): CalendarDay[] {
  const monthStart = dayjs(month).startOf('month')
  const gridStart = monthStart.startOf('week')
  const eventsByDay = groupEventsByDate(events)

  return Array.from({ length: 42 }, (_, index) => {
    const date = gridStart.add(index, 'day')
    const dateKey = date.format('YYYY-MM-DD')

    return {
      dateKey,
      dayNumber: date.date(),
      inCurrentMonth: date.month() === monthStart.month() && date.year() === monthStart.year(),
      events: eventsByDay.get(dateKey) ?? [],
    }
  })
}

export function buildCalendarYearDays(year: number, events: ScheduleEvent[]): CalendarYearDay[] {
  const yearStart = dayjs(`${year}-01-01`)
  const yearEnd = yearStart.endOf('year')
  const gridStart = yearStart.startOf('week')
  const gridEnd = yearEnd.endOf('week')
  const eventsByDay = groupEventsByDate(events)
  const dayCount = gridEnd.diff(gridStart, 'day') + 1

  return Array.from({ length: dayCount }, (_, index) => {
    const date = gridStart.add(index, 'day')
    const dateKey = date.format('YYYY-MM-DD')

    return {
      dateKey,
      inCurrentYear: date.year() === year,
      events: eventsByDay.get(dateKey) ?? [],
    }
  })
}

export function buildCalendarMonthCounts(year: number, events: ScheduleEvent[]): CalendarMonthCount[] {
  const counts = Array.from({ length: 12 }, () => 0)

  for (const event of events) {
    const start = dayjs(event.startAt)
    if (start.year() === year) counts[start.month()] += 1
  }

  return counts.map((eventCount, month) => ({
    month,
    monthKey: dayjs(`${year}-01-01`).month(month).format('YYYY-MM-DD'),
    eventCount,
  }))
}
