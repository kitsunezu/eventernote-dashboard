export type ViewMode = 'timeline' | 'list'

export type ThemeMode = 'dark' | 'light'

export type SupportedLocale = 'zh-Hant' | 'en' | 'ja'

export type EventSourceKind = 'sample' | 'json' | 'ics' | 'backend' | 'google' | 'outlook'

export const DAY_RANGE_OPTIONS = ['all', 'future'] as const

export type DayRangeOption = (typeof DAY_RANGE_OPTIONS)[number]

export const DEFAULT_DAY_RANGE: DayRangeOption = 'future'

export interface EventLink {
  label: string
  url: string
  localizedLabel?: Partial<Record<SupportedLocale, string>>
}

export interface EventCategory {
  id: string
  label: string
  color: string
  labels?: Partial<Record<SupportedLocale, string>>
}

export interface LocalizedEventContent {
  title?: string
  description?: string
  notes?: string
  location?: string
}

export interface ScheduleEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  allDay: boolean
  category: EventCategory
  description?: string
  notes?: string
  location?: string
  links: EventLink[]
  sourceType: EventSourceKind
  sourceMeta?: Record<string, string>
  localized?: Partial<Record<SupportedLocale, LocalizedEventContent>>
  previewImageUrl?: string
  previewImageAlt?: string
}

export interface ImportedScheduleData {
  events: ScheduleEvent[]
  warnings: string[]
  sourceType: EventSourceKind
  importedAt: string
}

export interface ScheduleSnapshot {
  events: ScheduleEvent[]
  viewMode: ViewMode
  daysToShow: DayRangeOption
  selectedCategoryIds: string[]
  theme: ThemeMode
  activeSource: EventSourceKind
  locale: SupportedLocale
}