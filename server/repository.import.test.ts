import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { EventRepository } from './repository.js'
import type { ExternalEventImport } from './types.js'

const input: ExternalEventImport = {
  userId: 'reviewer',
  event: {
    id: '475077', title: 'Reviewed event', date: '2026-08-14', openTime: '18:00',
    startTime: '19:00', endTime: '', description: 'Checked source',
    officialUrl: 'https://example.com/event', imageUrl: 'https://example.com/event.jpg',
    venue: 'Example Hall', placeId: '9090', placeAddress: 'Hong Kong',
    actors: ['Actor One'],
  },
}

describe('EventRepository.importExternalEvent', () => {
  it('upserts a reviewed event and user relationship in one transaction', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const release = vi.fn()
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool
    await new EventRepository(pool).importExternalEvent(input)
    expect(query.mock.calls[0][0]).toBe('BEGIN')
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO events'))).toBe(true)
    const eventCall = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO events'))
    expect(eventCall?.[1]).toContain('2026-08-14T19:00:00')
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO user_events'))).toBe(true)
    expect(release).toHaveBeenCalledOnce()
  })

  it('rolls back and releases the connection when an upsert fails', async () => {
    let call = 0
    const query = vi.fn().mockImplementation(() => {
      call += 1
      if (call === 3) return Promise.reject(new Error('database error'))
      return Promise.resolve({ rows: [], rowCount: 1 })
    })
    const release = vi.fn()
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as unknown as Pool
    await expect(new EventRepository(pool).importExternalEvent(input)).rejects.toThrow('database error')
    expect(query).toHaveBeenCalledWith('ROLLBACK')
    expect(release).toHaveBeenCalledOnce()
  })
})
