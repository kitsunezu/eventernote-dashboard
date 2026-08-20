import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleSnapshot } from '../types/events'
import { readScheduleSnapshot, STORAGE_KEY, writeScheduleSnapshot } from './storage'

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  }
}

function snapshot(): ScheduleSnapshot {
  return {
    events: [],
    places: {
      '101': { name: 'Venue', address: 'Tokyo', region: '東京' },
    },
    viewMode: 'timeline',
    daysToShow: 'future',
    selectedCategoryIds: [],
    theme: 'dark',
    activeSource: 'backend',
    locale: 'zh-Hant',
    cachedAt: '2026-08-20T10:00:00.000Z',
    cachedUserId: 'test-user',
    participationCalendar: [{ year: 2026, month: 8, count: 1 }],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('schedule snapshot storage', () => {
  it('keeps a complete event and place snapshot fresh', () => {
    const localStorage = createStorage({ [STORAGE_KEY]: JSON.stringify(snapshot()) })
    vi.stubGlobal('window', { localStorage })

    expect(readScheduleSnapshot()).toMatchObject({
      cachedAt: '2026-08-20T10:00:00.000Z',
      cachedUserId: 'test-user',
      places: { '101': { name: 'Venue' } },
      participationCalendar: [{ year: 2026, month: 8, count: 1 }],
    })
  })

  it('forces an API refresh for legacy snapshots that have no places', () => {
    const withoutPlaces = { ...snapshot() } as Partial<ScheduleSnapshot>
    delete withoutPlaces.places
    const localStorage = createStorage({ [STORAGE_KEY]: JSON.stringify(withoutPlaces) })
    vi.stubGlobal('window', { localStorage })

    expect(readScheduleSnapshot()).toMatchObject({
      places: {},
      cachedAt: undefined,
      cachedUserId: 'test-user',
    })
  })

  it('removes the retired standalone place cache when saving', () => {
    const localStorage = createStorage({ 'eventernote:places:v1': '{}' })
    vi.stubGlobal('window', { localStorage })

    writeScheduleSnapshot(snapshot())

    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(snapshot()))
    expect(localStorage.removeItem).toHaveBeenCalledWith('eventernote:places:v1')
  })
})
