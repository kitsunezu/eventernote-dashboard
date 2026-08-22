import { create } from 'zustand'
import {
  loadEventernoteUserFromApi,
  refreshEventernoteEvent,
  refreshEventernotePlaces,
} from '../adapters/eventernoteApiSource'
import { getEventCategories, getNextEvent, getVisibleEvents, sortEvents } from '../lib/date'
import { getUiCopy } from '../lib/localize'
import { readScheduleSnapshot, writeScheduleSnapshot } from '../lib/storage'
import { DEFAULT_DAY_RANGE } from '../types/events'
import type {
  DayRangeOption,
  EventIndexProgress,
  EventCategory,
  ImportedScheduleData,
  ScheduleEvent,
  ScheduleSnapshot,
  SupportedLocale,
  ViewMode,
} from '../types/events'

function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'zh-Hant'
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const lang of langs) {
    const lower = lang.toLowerCase()
    if (lower.startsWith('ja')) return 'ja'
    if (lower.startsWith('en')) return 'en'
    if (lower.startsWith('zh')) return 'zh-Hant'
  }
  return 'zh-Hant'
}

export interface ScheduleStore extends ScheduleSnapshot {
  selectedEventId: string | null
  statusMessage: string
  loading: boolean
  error: string | null
  indexProgress: EventIndexProgress | null
  setViewMode: (viewMode: ViewMode) => void
  setDaysToShow: (daysToShow: DayRangeOption) => void
  toggleCategory: (categoryId: string) => void
  clearFilters: () => void
  selectEvent: (eventId: string | null) => void
  toggleTheme: () => void
  setLocale: (locale: SupportedLocale) => void
  setStatusMessage: (statusMessage: string) => void
  importEvents: (payload: ImportedScheduleData) => void
  upsertEvent: (event: ScheduleEvent) => void
  deleteEvent: (eventId: string) => void
  loadFromEventernote: (userId: string, forceRefresh?: boolean) => Promise<void>
  refreshEvent: (userId: string, eventId: string) => Promise<void>
  refreshUnmappedPlaces: (userId: string, placeIds: string[]) => Promise<string[]>
}

const persisted = readScheduleSnapshot()

/** Re-fetch from Eventernote if cached data is older than this */
export const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

const initialSnapshot: ScheduleSnapshot = persisted ?? {
  events: [],
  places: {},
  viewMode: 'timeline',
  daysToShow: DEFAULT_DAY_RANGE,
  selectedCategoryIds: [],
  theme: 'dark',
  activeSource: 'backend',
  locale: detectLocale(),
}

let activeLoadId = 0

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  ...initialSnapshot,
  selectedEventId: null,
  statusMessage: '',
  loading: false,
  error: null,
  indexProgress: null,
  setViewMode: (viewMode) => set({ viewMode }),
  setDaysToShow: (daysToShow) => set({ daysToShow }),
  toggleCategory: (categoryId) =>
    set((state) => ({
      selectedCategoryIds: state.selectedCategoryIds.includes(categoryId)
        ? state.selectedCategoryIds.filter((id) => id !== categoryId)
        : [...state.selectedCategoryIds, categoryId],
    })),
  clearFilters: () => set({ selectedCategoryIds: [] }),
  selectEvent: (selectedEventId) => set({ selectedEventId }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setLocale: (locale) => set({ locale }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  importEvents: (payload) =>
    set({
      events: sortEvents(payload.events),
      places: payload.places,
      participationCalendar: payload.participationCalendar ?? [],
      activeSource: payload.sourceType,
      selectedEventId: null,
      statusMessage:
        payload.warnings.length > 0
          ? `Imported ${payload.events.length} events with ${payload.warnings.length} warning${payload.warnings.length === 1 ? '' : 's'}.`
          : `Imported ${payload.events.length} events from ${payload.sourceType.toUpperCase()}.`,
    }),
  upsertEvent: (event) =>
    set((state) => {
      const exists = state.events.some((item) => item.id === event.id)
      const nextEvents = sortEvents(
        exists ? state.events.map((item) => (item.id === event.id ? event : item)) : [...state.events, event],
      )

      return {
        events: nextEvents,
        activeSource: 'backend',
        selectedEventId: event.id,
        statusMessage: exists ? `Updated ${event.title}.` : `Created ${event.title}.`,
      }
    }),
  deleteEvent: (eventId) =>
    set((state) => {
      const removed = state.events.find((event) => event.id === eventId)

      return {
        events: state.events.filter((event) => event.id !== eventId),
        activeSource: 'backend',
        selectedEventId: state.selectedEventId === eventId ? null : state.selectedEventId,
        statusMessage: removed ? `Deleted ${removed.title}.` : 'Deleted an event.',
      }
    }),
  loadFromEventernote: async (userId: string, forceRefresh = false) => {
    const loadId = ++activeLoadId
    const isActiveLoad = () => loadId === activeLoadId
    const switchingUser = get().cachedUserId !== userId
    set({
      loading: true,
      error: null,
      indexProgress: null,
      selectedEventId: null,
      // Clear stale events immediately when switching to a different user
      ...(switchingUser ? { events: [], places: {}, participationCalendar: [], cachedAt: undefined } : {}),
    })
    try {
      let receivedProgress = false
      const data = await loadEventernoteUserFromApi(userId, ({
        events,
        places,
        importedAt,
        participationCalendar,
        indexProgress,
      }) => {
        receivedProgress = true
        if (isActiveLoad()) {
          set({
            events: sortEvents(events),
            places,
            participationCalendar,
            activeSource: 'backend',
            loading: indexProgress !== undefined,
            indexProgress: indexProgress ?? null,
            cachedAt: importedAt,
            cachedUserId: userId,
          })
        }
      }, forceRefresh)
      if (!isActiveLoad()) return
      const copy = getUiCopy(get().locale)
      set({
        ...(receivedProgress ? {} : {
          events: sortEvents(data.events),
          places: data.places,
          participationCalendar: data.participationCalendar ?? [],
        }),
        activeSource: 'backend',
        loading: false,
        indexProgress: null,
        cachedAt: data.importedAt,
        cachedUserId: userId,
        statusMessage: copy.loadedCount(data.events.length),
      })
    } catch (err) {
      if (!isActiveLoad()) return
      const copy = getUiCopy(get().locale)
      set({
        loading: false,
        indexProgress: null,
        error: err instanceof Error ? err.message : copy.loadFailed,
      })
    }
  },
  refreshEvent: async (userId, eventId) => {
    try {
      const data = await refreshEventernoteEvent(userId, eventId)
      if (get().cachedUserId !== userId) return
      set({
        events: sortEvents(data.events),
        places: data.places,
        participationCalendar: data.participationCalendar ?? [],
        activeSource: 'backend',
        cachedAt: data.importedAt,
      })
    } catch (error) {
      console.error(`Failed to refresh Eventernote event ${eventId}`, error)
    }
  },
  refreshUnmappedPlaces: async (userId, placeIds) => {
    const publish = (data: ImportedScheduleData) => {
      if (get().cachedUserId !== userId) return
      set({
        events: sortEvents(data.events),
        places: data.places,
        participationCalendar: data.participationCalendar ?? [],
        cachedAt: data.importedAt,
      })
    }
    const data = await refreshEventernotePlaces(userId, placeIds, publish)
    publish(data)
    return data.warnings
  },
}))

useScheduleStore.subscribe((state) => {
  writeScheduleSnapshot({
    events: state.events,
    places: state.places,
    viewMode: state.viewMode,
    daysToShow: state.daysToShow,
    selectedCategoryIds: state.selectedCategoryIds,
    theme: state.theme,
    activeSource: state.activeSource,
    locale: state.locale,
    cachedAt: state.cachedAt,
    cachedUserId: state.cachedUserId,
    participationCalendar: state.participationCalendar,
  })
})

export function selectCategories(state: ScheduleStore): EventCategory[] {
  return getEventCategories(state.events)
}

export function selectVisibleEvents(state: ScheduleStore): ScheduleEvent[] {
  return getVisibleEvents(state.events, state.daysToShow, '', state.selectedCategoryIds)
}

export function selectNextEvent(state: ScheduleStore): ScheduleEvent | null {
  return getNextEvent(selectVisibleEvents(state))
}

export function selectSelectedEvent(state: ScheduleStore): ScheduleEvent | null {
  return state.events.find((event) => event.id === state.selectedEventId) ?? null
}
