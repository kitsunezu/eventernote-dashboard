import dayjs from 'dayjs'
import 'dayjs/locale/ja'
import 'dayjs/locale/zh-tw'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { DayRangeOption, EventCategory, ScheduleEvent, SupportedLocale } from '../types/events'
import { resolveEventCopy } from './localize'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)

const CATEGORY_COLORS = ['#c97c4b', '#8aa06d', '#d7a445', '#b9685a', '#9f8053', '#6f8d74']

export function colorForCategory(seed: string): string {
  let hash = 0

  for (const character of seed) {
    hash = (hash << 5) - hash + character.charCodeAt(0)
    hash |= 0
  }

  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

export function sortEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((left, right) => {
    const startDifference = dayjs(left.startAt).valueOf() - dayjs(right.startAt).valueOf()
    if (startDifference !== 0) {
      return startDifference
    }

    return dayjs(left.endAt).valueOf() - dayjs(right.endAt).valueOf()
  })
}

function toDayjsLocale(locale: SupportedLocale): string {
  if (locale === 'zh-Hant') {
    return 'zh-tw'
  }
  return locale
}

export function formatEventTime(event: ScheduleEvent, locale: SupportedLocale = 'en'): string {
  if (event.allDay) {
    return locale === 'zh-Hant' ? '全天' : locale === 'ja' ? '終日' : 'All day'
  }

  const start = dayjs(event.startAt).locale(toDayjsLocale(locale))
  const end = dayjs(event.endAt).locale(toDayjsLocale(locale))
  return `${start.format('HH:mm')} - ${end.format('HH:mm')}`
}

export function formatEventDate(event: ScheduleEvent, locale: SupportedLocale = 'en'): string {
  const start = dayjs(event.startAt).locale(toDayjsLocale(locale))

  if (locale === 'zh-Hant' || locale === 'ja') {
    return start.format('M月D日')
  }

  return start.format('MMM D')
}

export function formatDetailedRange(event: ScheduleEvent, locale: SupportedLocale = 'en'): string {
  const start = dayjs(event.startAt).locale(toDayjsLocale(locale))

  if (event.allDay) {
    return `${formatEventDate(event, locale)} · ${formatEventTime(event, locale)}`
  }

  const end = dayjs(event.endAt).locale(toDayjsLocale(locale))
  const separator = locale === 'zh-Hant' ? '至' : locale === 'ja' ? '〜' : 'to'

  return `${formatEventDate(event, locale)} · ${start.format('HH:mm')} ${separator} ${end.format('HH:mm')}`
}

export function formatDayHeading(dayKey: string, locale: SupportedLocale = 'en'): string {
  const day = dayjs(dayKey).locale(toDayjsLocale(locale))
  return day.format('YYYY-MM-DD(ddd)')
}

export function formatDayMeta(dayKey: string, events: ScheduleEvent[], locale: SupportedLocale = 'en'): string {
  const label = dayjs(dayKey).locale(toDayjsLocale(locale)).format('dddd')
  if (locale === 'zh-Hant') {
    return `${label} · ${events.length} 筆`
  }
  if (locale === 'ja') {
    return `${label} · ${events.length} 件`
  }
  return `${label} · ${events.length} item${events.length === 1 ? '' : 's'}`
}

export function buildPreviewText(event: ScheduleEvent, locale: SupportedLocale = 'en'): string {
  const copy = resolveEventCopy(event, locale)
  const parts: string[] = []
  if (copy.description) parts.push(`出演者：${copy.description}`)
  if (copy.notes) parts.push(copy.notes)
  return parts.join(' · ')
}

export function getVisibleEvents(
  events: ScheduleEvent[],
  daysToShow: DayRangeOption,
  query: string,
  selectedCategoryIds: string[],
): ScheduleEvent[] {
  const now = dayjs()
  const normalizedQuery = query.trim().toLowerCase()

  const sorted = daysToShow === 'all'
    ? [...sortEvents(events)].reverse()   // all: newest first
    : sortEvents(events)                  // future: nearest first

  return sorted.filter((event) => {
    const eventEnd = dayjs(event.endAt)
    const isInsideDateWindow = daysToShow === 'all' ? true : eventEnd.isAfter(now)

    if (!isInsideDateWindow) {
      return false
    }

    if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(event.category.id)) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const haystack = [event.title, event.description, event.notes, event.location, event.category.label]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })
}

export function getEventCategories(events: ScheduleEvent[]): EventCategory[] {
  const unique = new Map<string, EventCategory>()

  for (const event of events) {
    if (!unique.has(event.category.id)) {
      unique.set(event.category.id, event.category)
    }
  }

  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label))
}

export function groupEventsByDay(events: ScheduleEvent[]): Array<{ day: string; events: ScheduleEvent[] }> {
  const groups = new Map<string, ScheduleEvent[]>()

  for (const event of events) {
    const day = dayjs(event.startAt).startOf('day').toISOString()
    const current = groups.get(day) ?? []
    current.push(event)
    groups.set(day, current)
  }

  return [...groups.entries()].map(([day, group]) => ({ day, events: group }))
}

export function getNextEvent(events: ScheduleEvent[]): ScheduleEvent | null {
  const now = dayjs()
  return sortEvents(events).find((event) => dayjs(event.endAt).isAfter(now)) ?? null
}

export function formatCountdown(event: ScheduleEvent | null, locale: SupportedLocale = 'en'): string {
  if (!event) {
    return locale === 'zh-Hant'
      ? '目前顯示範圍內沒有即將到來的事件。'
      : locale === 'ja'
        ? '現在の表示範囲に近日予定はありません。'
        : 'No upcoming events in the selected range.'
  }

  const now = dayjs().locale(toDayjsLocale(locale))
  const start = dayjs(event.startAt).locale(toDayjsLocale(locale))
  const end = dayjs(event.endAt).locale(toDayjsLocale(locale))

  if (start.isBefore(now) && end.isAfter(now)) {
    return locale === 'zh-Hant'
      ? `進行中，還剩 ${end.from(now, true)}`
      : locale === 'ja'
        ? `進行中、あと ${end.from(now, true)}`
        : `In progress for ${end.from(now, true)} more`
  }

  const minutes = start.diff(now, 'minute')
  if (minutes < 60) {
    return locale === 'zh-Hant'
      ? `${minutes} 分鐘後開始`
      : locale === 'ja'
        ? `${minutes} 分後に開始`
        : `Starts in ${minutes} min`
  }

  const hours = start.diff(now, 'hour')
  if (hours < 24) {
    return locale === 'zh-Hant'
      ? `${hours} 小時後開始`
      : locale === 'ja'
        ? `${hours} 時間後に開始`
        : `Starts in ${hours} hr`
  }

  return locale === 'zh-Hant'
    ? `${start.from(now, true)}後開始`
    : locale === 'ja'
      ? `${start.from(now, true)}後に開始`
      : `Starts in ${start.from(now, true)}`
}