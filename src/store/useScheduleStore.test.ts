import dayjs from 'dayjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { colorForCategory } from '../lib/date'
import type {
  ImportedScheduleData,
  EventIndexProgress,
  ParticipationCalendarMonth,
  ScheduleEvent,
  SchedulePlace,
} from '../types/events'
import type { ScheduleStore } from './useScheduleStore'
import { selectCategories, selectVisibleEvents, useScheduleStore } from './useScheduleStore'

type ProgressCallback = (partial: {
  events: ScheduleEvent[]
  places: Record<string, SchedulePlace>
  warnings: string[]
  importedAt: string
  participationCalendar: ParticipationCalendarMonth[]
  indexProgress?: EventIndexProgress
}) => void
type LoadFromApi = (
  userId: string,
  onProgress?: ProgressCallback,
  forceRefresh?: boolean,
) => Promise<ImportedScheduleData>
type RefreshFromApi = (userId: string, eventId: string) => Promise<ImportedScheduleData>
type RefreshPlacesFromApi = (userId: string, placeIds: string[]) => Promise<ImportedScheduleData>

const loadFromApi = vi.hoisted(() => vi.fn<LoadFromApi>())
const refreshFromApi = vi.hoisted(() => vi.fn<RefreshFromApi>())
const refreshPlacesFromApi = vi.hoisted(() => vi.fn<RefreshPlacesFromApi>())

vi.mock('../adapters/eventernoteApiSource', () => ({
  loadEventernoteUserFromApi: loadFromApi,
  refreshEventernoteEvent: refreshFromApi,
  refreshEventernotePlaces: refreshPlacesFromApi,
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
    places: {
      [`place-${userId}`]: { name: `Venue ${userId}`, address: '', region: '' },
    },
    warnings: [],
    sourceType: 'backend',
    importedAt: `2026-08-05T10:00:0${userId === 'A' ? '1' : '2'}.000Z`,
    participationCalendar: [{ year: 2026, month: 8, count: userId === 'A' ? 1 : 2 }],
  }
}

function createState(overrides: Partial<ScheduleStore> = {}): ScheduleStore {
  return {
    events: testEvents,
    places: {},
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
    indexProgress: null,
    loadFromEventernote: async () => undefined,
    refreshEvent: async () => undefined,
    refreshUnmappedPlaces: async () => [],
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
    refreshPlacesFromApi.mockReset()
    useScheduleStore.setState({
      events: [],
      places: {},
      participationCalendar: [],
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

    requests.get('B')?.onProgress?.({
      events: userBEvents,
      places: { 'place-B': { name: 'Venue B', address: '', region: '' } },
      warnings: [],
      importedAt: '2026-08-05T10:00:02.000Z',
      participationCalendar: [{ year: 2026, month: 8, count: 2 }],
    })
    requests.get('B')?.deferred.resolve(createApiResult('B', userBEvents))
    await userBLoad

    requests.get('A')?.onProgress?.({
      events: userAEvents,
      places: { 'place-A': { name: 'Venue A', address: '', region: '' } },
      warnings: [],
      importedAt: '2026-08-05T10:00:01.000Z',
      participationCalendar: [{ year: 2026, month: 8, count: 1 }],
    })
    requests.get('A')?.deferred.resolve(createApiResult('A', userAEvents))
    await userALoad

    expect(useScheduleStore.getState()).toMatchObject({
      events: userBEvents,
      cachedUserId: 'B',
      cachedAt: '2026-08-05T10:00:02.000Z',
      participationCalendar: [{ year: 2026, month: 8, count: 2 }],
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

  it('renders the first database snapshot while background polling continues', async () => {
    const request = createDeferred<ImportedScheduleData>()
    const initialEvents = [{ ...testEvents[0], id: 'initial-event' }]
    loadFromApi.mockImplementation((_userId, onProgress) => {
      onProgress?.({
        events: initialEvents,
        places: { initial: { name: 'Initial Venue', address: '', region: '' } },
        warnings: [],
        importedAt: '2026-08-05T10:00:03.000Z',
        participationCalendar: [{ year: 2026, month: 8, count: 1 }],
      })
      return request.promise
    })

    const loading = useScheduleStore.getState().loadFromEventernote('A')

    expect(useScheduleStore.getState()).toMatchObject({
      events: initialEvents,
      places: { initial: { name: 'Initial Venue', address: '', region: '' } },
      cachedUserId: 'A',
      cachedAt: '2026-08-05T10:00:03.000Z',
      loading: false,
    })
    const appliedEvents = useScheduleStore.getState().events
    request.resolve(createApiResult('A', initialEvents))
    await loading
    expect(useScheduleStore.getState().events).toBe(appliedEvents)
  })

  it('keeps the cold report loading while index progress is active', async () => {
    const request = createDeferred<ImportedScheduleData>()
    loadFromApi.mockImplementation((_userId, onProgress) => {
      onProgress?.({
        events: [],
        places: {},
        warnings: [],
        importedAt: '2026-08-05T10:00:03.000Z',
        participationCalendar: [],
        indexProgress: {
          processedMonths: 2,
          totalMonths: 10,
          indexedEventCount: 25,
          totalEventCount: 100,
        },
      })
      return request.promise
    })

    const loading = useScheduleStore.getState().loadFromEventernote('A')

    expect(useScheduleStore.getState()).toMatchObject({
      loading: true,
      cachedUserId: 'A',
      indexProgress: { indexedEventCount: 25, totalEventCount: 100 },
    })
    request.resolve(createApiResult('A', testEvents))
    await loading
    expect(useScheduleStore.getState()).toMatchObject({ loading: false, indexProgress: null })
  })

  it('stores refreshed events and places together after map refresh', async () => {
    const refreshedEvents = [{ ...testEvents[0], location: 'Mapped venue' }]
    refreshPlacesFromApi.mockResolvedValue(createApiResult('A', refreshedEvents))
    useScheduleStore.setState({
      events: testEvents,
      cachedUserId: 'A',
      cachedAt: '2026-08-05T09:00:00.000Z',
    })
    await expect(useScheduleStore.getState().refreshUnmappedPlaces('A', ['101', '202']))
      .resolves.toEqual([])

    expect(refreshPlacesFromApi).toHaveBeenCalledWith('A', ['101', '202'])
    expect(useScheduleStore.getState()).toMatchObject({
      events: refreshedEvents,
      places: { 'place-A': { name: 'Venue A', address: '', region: '' } },
      cachedUserId: 'A',
      cachedAt: '2026-08-05T10:00:01.000Z',
    })
  })

  it('does not apply an unmapped-place refresh after switching users', async () => {
    const request = createDeferred<ImportedScheduleData>()
    refreshPlacesFromApi.mockReturnValue(request.promise)
    useScheduleStore.setState({ events: testEvents, cachedUserId: 'A' })

    const refresh = useScheduleStore.getState().refreshUnmappedPlaces('A', ['101'])
    const userBEvents = [{ ...testEvents[1], id: 'user-b-event' }]
    useScheduleStore.setState({ events: userBEvents, cachedUserId: 'B' })
    request.resolve(createApiResult('A', [{ ...testEvents[0], location: 'Late venue' }]))
    await refresh

    expect(useScheduleStore.getState()).toMatchObject({
      events: userBEvents,
      cachedUserId: 'B',
    })
  })
})
