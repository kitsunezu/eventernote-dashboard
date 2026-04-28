import { describe, expect, it } from 'vitest'
import { parseJsonSchedule } from './importJson'

describe('parseJsonSchedule', () => {
  it('accepts nested category shape', () => {
    const result = parseJsonSchedule(
      JSON.stringify([
        {
          title: 'Planning',
          startAt: '2026-04-28T09:00:00.000Z',
          endAt: '2026-04-28T10:00:00.000Z',
          category: { id: 'work', label: 'Work', color: '#00aaff' },
          links: [],
        },
      ]),
    )

    expect(result.events[0].category.label).toBe('Work')
    expect(result.sourceType).toBe('json')
  })

  it('accepts flat category fields', () => {
    const result = parseJsonSchedule(
      JSON.stringify({
        events: [
          {
            title: 'Workout',
            startAt: '2026-04-28T09:00:00.000Z',
            endAt: '2026-04-28T10:00:00.000Z',
            categoryId: 'health',
            categoryLabel: 'Health',
            links: [],
          },
        ],
      }),
    )

    expect(result.events[0].category.id).toBe('health')
  })
})