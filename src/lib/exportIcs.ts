import dayjs from 'dayjs'
import type { ScheduleEvent } from '../types/events'

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function formatUtcDateTime(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function formatDateOnly(value: string): string {
  return dayjs(value).format('YYYYMMDD')
}

export function buildIcs(events: ScheduleEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eventernote Dashboard//EN', 'CALSCALE:GREGORIAN']

  for (const event of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${escapeIcsText(event.id)}`)
    lines.push(`DTSTAMP:${formatUtcDateTime(new Date().toISOString())}`)

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.startAt)}`)
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(dayjs(event.endAt).add(1, 'day').toISOString())}`)
    } else {
      lines.push(`DTSTART:${formatUtcDateTime(event.startAt)}`)
      lines.push(`DTEND:${formatUtcDateTime(event.endAt)}`)
    }

    lines.push(`SUMMARY:${escapeIcsText(event.title)}`)
    lines.push(`CATEGORIES:${escapeIcsText(event.category.label)}`)
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
    }
    if (event.notes) {
      lines.push(`COMMENT:${escapeIcsText(event.notes)}`)
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`)
    }
    if (event.links[0]) {
      lines.push(`URL:${escapeIcsText(event.links[0].url)}`)
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function exportEventsAsIcsFile(events: ScheduleEvent[], fileName: string): void {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}