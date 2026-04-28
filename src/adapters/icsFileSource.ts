import type { ImportedScheduleData } from '../types/events'
import type { EventSourceAdapter } from '../lib/sources/types'
import { parseIcsSchedule } from '../lib/importIcs'

export async function loadIcsFile(file: File, daysToExpand = 30): Promise<ImportedScheduleData> {
  return parseIcsSchedule(await file.text(), daysToExpand)
}

export const icsFileSourceAdapter: EventSourceAdapter = {
  kind: 'ics',
  label: 'iCalendar file import',
  supportsWrite: false,
  loadEvents: async () => ({
    events: [],
    warnings: ['ICS file adapter requires an explicit file input trigger.'],
    sourceType: 'ics',
    importedAt: new Date().toISOString(),
  }),
}