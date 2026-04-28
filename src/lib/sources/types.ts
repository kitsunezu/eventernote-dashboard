import type { EventSourceKind, ImportedScheduleData, ScheduleEvent } from '../../types/events'

export interface EventSourceAdapter {
  kind: EventSourceKind
  label: string
  supportsWrite: boolean
  loadEvents: () => Promise<ImportedScheduleData>
  saveEvents?: (events: ScheduleEvent[]) => Promise<void>
  refresh?: () => Promise<ImportedScheduleData>
}