import { describe, expect, it } from 'vitest'
import { parseIcsSchedule } from './importIcs'

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

const start = new Date(Date.now() + 60 * 60 * 1000)
const end = new Date(start.getTime() + 60 * 60 * 1000)

const recurringIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:test-recurring
DTSTAMP:${toIcsDate(new Date())}
DTSTART:${toIcsDate(start)}
DTEND:${toIcsDate(end)}
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Recurring sync
CATEGORIES:Work
DESCRIPTION:Daily status sync
END:VEVENT
END:VCALENDAR`

describe('parseIcsSchedule', () => {
  it('parses recurring events within the safe window', () => {
    const result = parseIcsSchedule(recurringIcs, 30)
    expect(result.events.length).toBeGreaterThanOrEqual(1)
    expect(result.events[0].title).toBe('Recurring sync')
  })
})