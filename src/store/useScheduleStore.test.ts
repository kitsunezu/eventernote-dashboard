import dayjs from 'dayjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { colorForCategory } from '../lib/date'
import type { ImportedScheduleData, ScheduleEvent } from '../types/events'
import type { ScheduleStore } from './useScheduleStore'
import { selectCategories, selectVisibleEvents, useScheduleStore } from './useScheduleStore'

type ProgressCallback = (partial: { events: ScheduleEvent[]; warnings: string[] }) => void
type LoadFromApi = (
  userId: string,
  onProgress?: ProgressCallback,
  forceRefresh?: boolean,
) => Promise<ImportedScheduleData>
type RefreshFromApi = (userId: string, eventId: string) => Promise<ImportedScheduleData>

const loadFromApi = vi.hoisted(() => vi.fn<LoadFromApi>())
const refreshFromApi = vi.hoisted(() => vi.fn<RefreshFromApi>())

vi.mock('../adapters/eventernoteApiSource', () => ({
  loadEventernoteUserFromApi: loadFromApi,
  refreshEventernoteEvent: refreshFromApi,
}))

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

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createApiResult(userId: string, events: ScheduleEvent[]): ImportedScheduleData {
  return {
    events,
    warnings: [],
    sourceType: 'backend',
    importedAt: `2026-08-05T10:00:0${userId === 'A' ? '1' : '2'}.000Z`,
  }
}

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
    refreshEvent: async () => undefined,
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

describe('useScheduleStore Eventernote loading', () => {
  beforeEach(() => {
    loadFromApi.mockReset()
    refreshFromApi.mockReset()
    useScheduleStore.setState({
      events: [],
      activeSource: 'backend',
      cachedAt: undefined,
      cachedUserId: undefined,
      selectedEventId: null,
      statusMessage: '',
      loading: false,
      error: null,
    })
  })

  it('ignores stale progress and completion after switching users', async () => {
    const requests = new Map<string, {
      deferred: ReturnType<typeof createDeferred<ImportedScheduleData>>
      onProgress?: ProgressCallback
    }>()
    loadFromApi.mockImplementation((userId, onProgress) => {
      const request = { deferred: createDeferred<ImportedScheduleData>(), onProgress }
      requests.set(userId, request)
      return request.deferred.promise
    })

    const userAEvents = [{ ...testEvents[0], id: 'user-a-event', title: 'User A' }]
    const userBEvents = [{ ...testEvents[1], id: 'user-b-event', title: 'User B' }]
    const userALoad = useScheduleStore.getState().loadFromEventernote('A')
    const userBLoad = useScheduleStore.getState().loadFromEventernote('B')

    requests.get('B')?.onProgress?.({ events: userBEvents, warnings: [] })
    requests.get('B')?.deferred.resolve(createApiResult('B', userBEvents))
    await userBLoad

    requests.get('A')?.onProgress?.({ events: userAEvents, warnings: [] })
    requests.get('A')?.deferred.resolve(createApiResult('A', userAEvents))
    await userALoad

    expect(useScheduleStore.getState()).toMatchObject({
      events: userBEvents,
      cachedUserId: 'B',
      cachedAt: '2026-08-05T10:00:02.000Z',
      loading: false,
      error: null,
    })
  })

  it('ignores a stale failure after the active user finishes loading', async () => {
    const userARequest = createDeferred<ImportedScheduleData>()
    const userBRequest = createDeferred<ImportedScheduleData>()
    loadFromApi.mockImplementation((userId) => userId === 'A' ? userARequest.promise : userBRequest.promise)

    const userBEvents = [{ ...testEvents[1], id: 'user-b-event', title: 'User B' }]
    const userALoad = useScheduleStore.getState().loadFromEventernote('A')
    const userBLoad = useScheduleStore.getState().loadFromEventernote('B')

    userBRequest.resolve(createApiResult('B', userBEvents))
    await userBLoad
    userARequest.reject(new Error('User A failed late'))
    await userALoad

    expect(useScheduleStore.getState()).toMatchObject({
      events: userBEvents,
      cachedUserId: 'B',
      loading: false,
      error: null,
    })
  })

  it('replaces cached event data after an on-demand event refresh', async () => {
    const refreshedEvents = [{ ...testEvents[0], title: 'Fresh title', location: 'Fresh venue' }]
    refreshFromApi.mockResolvedValue(createApiResult('A', refreshedEvents))
    useScheduleStore.setState({
      events: testEvents,
      cachedUserId: 'A',
      selectedEventId: testEvents[0].id,
    })

    await useScheduleStore.getState().refreshEvent('A', testEvents[0].id)

    expect(refreshFromApi).toHaveBeenCalledWith('A', testEvents[0].id)
    expect(useScheduleStore.getState()).toMatchObject({
      events: refreshedEvents,
      cachedUserId: 'A',
      selectedEventId: testEvents[0].id,
    })
  })
})
