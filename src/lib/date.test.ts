import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import type { ScheduleEvent } from '../types/events'
import { colorForCategory, formatCountdown, getVisibleEvents, groupEventsByDay } from './date'

const events: ScheduleEvent[] = [
  {
    id: 'past',
    title: 'Past sync',
    startAt: dayjs().subtract(2, 'day').toISOString(),
    endAt: dayjs().subtract(2, 'day').add(1, 'hour').toISOString(),
    allDay: false,
    category: { id: 'archive', label: 'Archive', color: colorForCategory('archive') },
    links: [],
    sourceType: 'sample',
  },
  {
    id: 'a',
    title: 'Design review',
    startAt: dayjs().add(2, 'hour').toISOString(),
    endAt: dayjs().add(3, 'hour').toISOString(),
    allDay: false,
    category: { id: 'work', label: 'Work', color: colorForCategory('work') },
    location: 'Studio',
    links: [],
    sourceType: 'sample',
  },
  {
    id: 'b',
    title: 'Dinner',
    startAt: dayjs().add(10, 'day').toISOString(),
    endAt: dayjs().add(10, 'day').add(2, 'hour').toISOString(),
    allDay: false,
    category: { id: 'personal', label: 'Personal', color: colorForCategory('personal') },
    links: [],
    sourceType: 'sample',
  },
]

describe('date helpers', () => {
  it('filters future events by query', () => {
    const visible = getVisibleEvents(events, 'future', 'design', [])
    expect(visible).toHaveLength(1)
    expect(visible[0].id).toBe('a')
  })

  it('includes past events when range is all', () => {
    const visible = getVisibleEvents(events, 'all', '', [])
    expect(visible[0].id).toBe('past')
    expect(visible).toHaveLength(3)
  })

  it('groups visible events by start day', () => {
    const groups = groupEventsByDay(events)
    expect(groups).toHaveLength(3)
  })

  it('renders a useful countdown string', () => {
    expect(formatCountdown(events[0])).toContain('Starts in')
  })
})