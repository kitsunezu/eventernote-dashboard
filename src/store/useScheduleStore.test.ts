import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { colorForCategory } from '../lib/date'
import type { ScheduleEvent } from '../types/events'
import type { ScheduleStore } from './useScheduleStore'
import { selectCategories, selectVisibleEvents } from './useScheduleStore'

const testEvents: ScheduleEvent[] = [
  {
    id: 'store-1',
    title: 'Client review',
    startAt: dayjs().add(4, 'hour').toISOString(),
    endAt: dayjs().add(5, 'hour').toISOString(),
    allDay: false,
    category: { id: 'work', label: 'Work', color: colorForCategory('work') },
    links: [],
    sourceType: 'sample',
  },
  {
    id: 'store-2',
    title: 'Gym',
    startAt: dayjs().add(1, 'day').toISOString(),
    endAt: dayjs().add(1, 'day').add(90, 'minute').toISOString(),
    allDay: false,
    category: { id: 'health', label: 'Health', color: colorForCategory('health') },
    links: [],
    sourceType: 'sample',
  },
]

function createState(overrides: Partial<ScheduleStore> = {}): ScheduleStore {
  return {
    events: testEvents,
    viewMode: 'timeline',
    daysToShow: 'future',
    selectedCategoryIds: [],
    theme: 'dark',
    activeSource: 'sample',
    locale: 'zh-Hant',
    selectedEventId: null,
    statusMessage: '',
    setViewMode: () => undefined,
    setDaysToShow: () => undefined,
    toggleCategory: () => undefined,
    clearFilters: () => undefined,
    selectEvent: () => undefined,
    toggleTheme: () => undefined,
    setLocale: () => undefined,
    setStatusMessage: () => undefined,
    importEvents: () => undefined,
    upsertEvent: () => undefined,
    deleteEvent: () => undefined,
    loading: false,
    error: null,
    loadFromEventernote: async () => undefined,
    ...overrides,
  }
}

describe('useScheduleStore selectors', () => {
  it('builds distinct category chips', () => {
    const state = createState()
    expect(selectCategories(state)).toHaveLength(2)
  })

  it('respects category filters', () => {
    const state = createState({ selectedCategoryIds: ['health'] })
    const visible = selectVisibleEvents(state)
    expect(visible).toHaveLength(1)
    expect(visible[0].category.id).toBe('health')
  })
})