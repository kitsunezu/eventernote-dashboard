import { DAY_RANGE_OPTIONS, DEFAULT_DAY_RANGE, type DayRangeOption, type ScheduleSnapshot } from '../types/events'

export const STORAGE_KEY = 'schedule-canvas:v2'
const LEGACY_PLACE_CACHE_KEY = 'eventernote:places:v1'

function isDayRangeOption(value: unknown): value is DayRangeOption {
  return typeof value === 'string' && DAY_RANGE_OPTIONS.includes(value as DayRangeOption)
}

export function readScheduleSnapshot(): ScheduleSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<ScheduleSnapshot>
    if (!Array.isArray(parsed.events) || typeof parsed.viewMode !== 'string' || typeof parsed.theme !== 'string') {
      return null
    }

    return {
      events: parsed.events,
      places: parsed.places && typeof parsed.places === 'object' ? parsed.places : {},
      viewMode: parsed.viewMode,
      daysToShow: isDayRangeOption(parsed.daysToShow) ? parsed.daysToShow : DEFAULT_DAY_RANGE,
      selectedCategoryIds: parsed.selectedCategoryIds ?? [],
      theme: parsed.theme,
      activeSource: parsed.activeSource ?? 'sample',
      locale: parsed.locale ?? 'zh-Hant',
      cachedAt: parsed.places && typeof parsed.cachedAt === 'string' ? parsed.cachedAt : undefined,
      cachedUserId: typeof parsed.cachedUserId === 'string' ? parsed.cachedUserId : undefined,
      participationCalendar: Array.isArray(parsed.participationCalendar)
        ? parsed.participationCalendar
        : [],
    }
  } catch {
    return null
  }
}

export function writeScheduleSnapshot(snapshot: ScheduleSnapshot): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  window.localStorage.removeItem(LEGACY_PLACE_CACHE_KEY)
}
