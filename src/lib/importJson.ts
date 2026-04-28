import { z } from 'zod'
import type { ImportedScheduleData, ScheduleEvent } from '../types/events'
import { colorForCategory, sortEvents } from './date'

const localizedEventSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    location: z.string().optional(),
  })
  .partial()

const localizedRecordSchema = z
  .object({
    'zh-Hant': localizedEventSchema.optional(),
    en: localizedEventSchema.optional(),
    ja: localizedEventSchema.optional(),
  })
  .partial()

const localizedLinkLabelSchema = z
  .object({
    'zh-Hant': z.string().min(1).optional(),
    en: z.string().min(1).optional(),
    ja: z.string().min(1).optional(),
  })
  .partial()

const isoDateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return value
}, z.string().datetime({ offset: true }))

const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  localizedLabel: localizedLinkLabelSchema.optional(),
})

const categorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1).optional(),
  labels: z.record(z.string(), z.string()).optional(),
})

const nestedEventSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  startAt: isoDateSchema,
  endAt: isoDateSchema,
  allDay: z.boolean().optional().default(false),
  category: categorySchema,
  description: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
  links: z.array(linkSchema).optional().default([]),
  localized: localizedRecordSchema.optional(),
  previewImageUrl: z.string().url().optional(),
  previewImageAlt: z.string().optional(),
})

const flatEventSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  startAt: isoDateSchema,
  endAt: isoDateSchema,
  allDay: z.boolean().optional().default(false),
  categoryId: z.string().min(1).optional(),
  categoryLabel: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
  links: z.array(linkSchema).optional().default([]),
  localized: localizedRecordSchema.optional(),
  previewImageUrl: z.string().url().optional(),
  previewImageAlt: z.string().optional(),
})

const eventSchema = z.union([nestedEventSchema, flatEventSchema]).transform((event): ScheduleEvent => {
  const category =
    'category' in event
      ? {
          id: event.category.id,
          label: event.category.label,
          color: event.category.color ?? colorForCategory(event.category.id),
          labels: event.category.labels,
        }
      : {
          id: event.categoryId ?? 'general',
          label: event.categoryLabel ?? event.categoryId ?? 'General',
          color: event.color ?? colorForCategory(event.categoryId ?? 'general'),
        }

  const eventId = event.id ?? `${category.id}-${event.title}-${event.startAt}`

  return {
    id: eventId,
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay ?? false,
    category,
    description: event.description,
    notes: event.notes,
    location: event.location,
    links: event.links,
    sourceType: 'json',
    localized: event.localized,
    previewImageUrl: event.previewImageUrl,
    previewImageAlt: event.previewImageAlt,
  }
})

const payloadSchema = z.union([z.array(eventSchema), z.object({ events: z.array(eventSchema) })])

export function parseJsonSchedule(text: string): ImportedScheduleData {
  const parsed = JSON.parse(text) as unknown
  const validated = payloadSchema.parse(parsed)
  const events = Array.isArray(validated) ? validated : validated.events

  return {
    events: sortEvents(events),
    warnings: [],
    sourceType: 'json',
    importedAt: new Date().toISOString(),
  }
}