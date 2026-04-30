import { create } from 'zustand'
import { loadEventernoteUser } from '../adapters/eventernoteSource'
import { getEventCategories, getNextEvent, getVisibleEvents, sortEvents } from '../lib/date'
import { getUiCopy } from '../lib/localize'
import { readScheduleSnapshot, writeScheduleSnapshot } from '../lib/storage'
import { DEFAULT_DAY_RANGE } from '../types/events'
import type {
  DayRangeOption,
  EventCategory,
  ImportedScheduleData,
  ScheduleEvent,
  ScheduleSnapshot,
  SupportedLocale,
  ViewMode,
} from '../types/events'

function detectLocale(): SupportedLocale {
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
  loadFromEventernote: (userId: string) => Promise<void>
}

const persisted = readScheduleSnapshot()

const initialSnapshot: ScheduleSnapshot = persisted ?? {
  events: [],
  viewMode: 'timeline',
  daysToShow: DEFAULT_DAY_RANGE,
  selectedCategoryIds: [],
  theme: 'dark',
  activeSource: 'backend',
  locale: detectLocale(),
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  ...initialSnapshot,
  selectedEventId: null,
  statusMessage: '',
  loading: false,
  error: null,
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
  loadFromEventernote: async (userId: string) => {
    set({ loading: true, error: null, selectedEventId: null })
    try {
      const data = await loadEventernoteUser(userId)
      const copy = getUiCopy(get().locale)
      set({
        events: data.events,
        activeSource: 'backend',
        loading: false,
        statusMessage: copy.loadedCount(data.events.length),
      })
    } catch (err) {
      const copy = getUiCopy(get().locale)
      set({
        loading: false,
        error: err instanceof Error ? err.message : copy.loadFailed,
      })
    }
  },
}))

useScheduleStore.subscribe((state) => {
  writeScheduleSnapshot({
    events: state.events,
    viewMode: state.viewMode,
    daysToShow: state.daysToShow,
    selectedCategoryIds: state.selectedCategoryIds,
    theme: state.theme,
    activeSource: state.activeSource,
    locale: state.locale,
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