import { describe, expect, it } from 'vitest'
import { buildCalendarDays, buildCalendarMonthCounts, buildCalendarYearDays } from './calendar'
import type { ScheduleEvent } from '../types/events'

function event(id: string, startAt: string): ScheduleEvent {
  return {
    id,
    title: id,
    startAt,
    endAt: startAt,
    allDay: false,
    category: { id: 'event', label: 'Event', color: '#5865f2' },
    links: [],
    sourceType: 'backend',
  }
}

describe('buildCalendarDays', () => {
  it('builds a stable six-week grid starting on Sunday', () => {
    const days = buildCalendarDays('2026-08-01', [])

    expect(days).toHaveLength(42)
    expect(days[0].dateKey).toBe('2026-07-26')
    expect(days.at(-1)?.dateKey).toBe('2026-09-05')
    expect(days.filter((day) => day.inCurrentMonth)).toHaveLength(31)
  })

  it('groups events by their local start date', () => {
    const days = buildCalendarDays('2026-08-01', [
      event('morning', '2026-08-12T09:00:00+08:00'),
      event('evening', '2026-08-12T19:00:00+08:00'),
    ])

    expect(days.find((day) => day.dateKey === '2026-08-12')?.events.map((item) => item.id))
      .toEqual(['morning', 'evening'])
  })

  it('builds a Sunday-aligned year heatmap and excludes padding from the year', () => {
    const days = buildCalendarYearDays(2026, [event('new-year', '2026-01-01T10:00:00+08:00')])

    expect(days[0]).toMatchObject({ dateKey: '2025-12-28', inCurrentYear: false })
    expect(days.at(-1)).toMatchObject({ dateKey: '2027-01-02', inCurrentYear: false })
    expect(days.find((day) => day.dateKey === '2026-01-01')?.events[0].id).toBe('new-year')
  })

  it('counts events for each month in the selected year', () => {
    const months = buildCalendarMonthCounts(2026, [
      event('august-one', '2026-08-12T09:00:00+08:00'),
      event('august-two', '2026-08-25T09:00:00+08:00'),
      event('next-year', '2027-08-12T09:00:00+08:00'),
    ])

    expect(months[7]).toMatchObject({ month: 7, monthKey: '2026-08-01', eventCount: 2 })
    expect(months.reduce((total, month) => total + month.eventCount, 0)).toBe(2)
  })
})
