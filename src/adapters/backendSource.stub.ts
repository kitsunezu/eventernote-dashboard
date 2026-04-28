import type { EventSourceAdapter } from '../lib/sources/types'

export const backendSourceStub: EventSourceAdapter = {
  kind: 'backend',
  label: 'Backend API (stub)',
  supportsWrite: true,
  loadEvents: async () => ({
    events: [],
    warnings: ['Backend source is reserved for a future integration.'],
    sourceType: 'backend',
    importedAt: new Date().toISOString(),
  }),
  saveEvents: async () => {
    throw new Error('Backend persistence is not implemented in this build.')
  },
}