import type { ImportedScheduleData } from '../types/events'
import type { EventSourceAdapter } from '../lib/sources/types'
import { parseJsonSchedule } from '../lib/importJson'

export async function loadJsonFile(file: File): Promise<ImportedScheduleData> {
  return parseJsonSchedule(await file.text())
}

export const jsonFileSourceAdapter: EventSourceAdapter = {
  kind: 'json',
  label: 'JSON file import',
  supportsWrite: false,
  loadEvents: async () => ({
    events: [],
    warnings: ['JSON file adapter requires an explicit file input trigger.'],
    sourceType: 'json',
    importedAt: new Date().toISOString(),
  }),
}