import type { Pool, PoolClient } from 'pg'
import type { ScheduleEvent } from '../src/types/events.js'
import { colorForRegion, detectRegion } from './regions.js'
import type {
  EventDetail,
  EventSeed,
  ExternalEventImport,
  PlaceDetail,
  StoredPlaceDetail,
  StoredEvent,
  StoredUserSnapshot,
  SyncStats,
} from './types.js'

interface EventRow {
  event_id: string
  title: string
  start_at: string
  end_at: string
  place_id: string | null
  venue_name: string
  place_name: string | null
  actors: string[] | string
  image_url: string | null
  image_alt: string | null
  detail_fetched_at: Date | null
  address: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
}

interface PlaceRow {
  place_id: string
  name: string
  address: string
  region: string
  latitude: number | null
  longitude: number | null
  detail_fetched_at: Date | null
  geocode_attempted_at: Date | null
  geocode_version: number
}

function actorsFromRow(value: string[] | string): string[] {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((actor): actor is string => typeof actor === 'string') : []
  } catch {
    return []
  }
}

function optionalIso(value: Date | null): string | undefined {
  return value?.toISOString()
}

export class EventRepository {
  private readonly pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  async importExternalEvent(input: ExternalEventImport): Promise<void> {
    const { event, userId } = input
    const startTime = event.startTime || event.openTime || '00:00'
    const endTime = event.endTime || startTime
    const startAt = `${event.date}T${startTime}:00`
    const endAt = `${event.date}T${endTime}:00`
    const region = detectRegion(event.venue, event.title, event.placeAddress)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO eventernote_users (user_id, last_index_attempt_at, last_index_success_at, updated_at)
         VALUES ($1, NOW(), NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           last_index_attempt_at = NOW(), last_index_success_at = NOW(),
           last_index_error = NULL, updated_at = NOW()`,
        [userId],
      )
      if (event.placeId) {
        await client.query(
          `INSERT INTO places (place_id, name, address, region, detail_fetched_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (place_id) DO UPDATE SET
             name = EXCLUDED.name, address = EXCLUDED.address, region = EXCLUDED.region,
             detail_fetched_at = NOW(), updated_at = NOW()`,
          [event.placeId, event.venue, event.placeAddress, region],
        )
      }
      await client.query(
        `INSERT INTO events (
           event_id, title, start_at, end_at, place_id, venue_name, actors,
           detail_description, image_url, image_alt, list_seen_at, detail_fetched_at, updated_at
         ) VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7::jsonb, $8, NULLIF($9, ''), $10, NOW(), NOW(), NOW())
         ON CONFLICT (event_id) DO UPDATE SET
           title = EXCLUDED.title, start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at,
           place_id = EXCLUDED.place_id, venue_name = EXCLUDED.venue_name,
           actors = EXCLUDED.actors, detail_description = EXCLUDED.detail_description,
           image_url = COALESCE(EXCLUDED.image_url, events.image_url),
           image_alt = EXCLUDED.image_alt, detail_fetched_at = NOW(), updated_at = NOW()`,
        [event.id, event.title, startAt, endAt, event.placeId, event.venue,
          JSON.stringify(event.actors), event.description, event.imageUrl, event.title],
      )
      await client.query(
        `INSERT INTO user_events (user_id, event_id, active, first_seen_at, last_seen_at)
         VALUES ($1, $2, TRUE, NOW(), NOW())
         ON CONFLICT (user_id, event_id) DO UPDATE SET active = TRUE, last_seen_at = NOW()`,
        [userId, event.id],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getSnapshot(userId: string): Promise<StoredUserSnapshot> {
    const [userResult, eventsResult] = await Promise.all([
      this.pool.query<{
        last_index_attempt_at: Date | null
        last_index_success_at: Date | null
        last_index_error: string | null
      }>(
        `SELECT last_index_attempt_at, last_index_success_at, last_index_error
         FROM eventernote_users
         WHERE user_id = $1`,
        [userId],
      ),
      this.pool.query<EventRow>(
        `SELECT e.event_id, e.title, e.start_at, e.end_at, e.place_id, e.venue_name,
                e.actors, e.image_url, e.image_alt, e.detail_fetched_at,
                p.name AS place_name, p.address, p.region, p.latitude, p.longitude
         FROM user_events ue
         JOIN events e ON e.event_id = ue.event_id
         LEFT JOIN places p ON p.place_id = e.place_id
         WHERE ue.user_id = $1 AND ue.active = TRUE
         ORDER BY e.start_at ASC, e.event_id ASC`,
        [userId],
      ),
    ])

    const places: StoredUserSnapshot['places'] = {}
    let pendingDetailCount = 0
    const events = eventsResult.rows.map((row): ScheduleEvent => {
      const actors = actorsFromRow(row.actors)
      const region = detectRegion(row.venue_name, row.title, row.address ?? '')
      if (!row.detail_fetched_at) pendingDetailCount += 1
      if (row.place_id) {
        places[row.place_id] = {
          name: row.place_name || row.venue_name,
          address: row.address ?? '',
          region,
          ...(row.latitude === null ? {} : { latitude: row.latitude }),
          ...(row.longitude === null ? {} : { longitude: row.longitude }),
        }
      }

      return {
        id: row.event_id,
        title: row.title,
        startAt: row.start_at,
        endAt: row.end_at,
        allDay: false,
        category: { id: region, label: region, color: colorForRegion(region) },
        description: actors.length > 0 ? actors.join('、') : undefined,
        location: row.venue_name || undefined,
        links: [{ label: 'Eventernote', url: `https://www.eventernote.com/events/${row.event_id}` }],
        sourceType: 'backend',
        sourceMeta: {
          ...(row.place_id ? { placeId: row.place_id } : {}),
          ...(row.address ? { address: row.address } : {}),
          ...(row.latitude === null ? {} : { latitude: String(row.latitude) }),
          ...(row.longitude === null ? {} : { longitude: String(row.longitude) }),
        },
        previewImageUrl: row.image_url ?? undefined,
        previewImageAlt: row.image_alt ?? undefined,
      }
    })
    const user = userResult.rows[0]

    return {
      events,
      places,
      lastIndexSuccessAt: user?.last_index_success_at?.toISOString(),
      lastIndexAttemptAt: user?.last_index_attempt_at?.toISOString(),
      lastError: user?.last_index_error ?? undefined,
      pendingDetailCount,
    }
  }

  async createSyncJob(userId: string): Promise<string> {
    await this.pool.query(
      `INSERT INTO eventernote_users (user_id, last_index_attempt_at, updated_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET last_index_attempt_at = NOW(), updated_at = NOW()`,
      [userId],
    )
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO sync_jobs (user_id, state)
       VALUES ($1, 'running')
       RETURNING id`,
      [userId],
    )
    return result.rows[0].id
  }

  async completeSyncJob(jobId: string, stats: SyncStats): Promise<void> {
    await this.pool.query(
      `UPDATE sync_jobs
       SET state = 'succeeded', completed_at = NOW(), stats = $2::jsonb
       WHERE id = $1`,
      [jobId, JSON.stringify(stats)],
    )
  }

  async failSyncJob(userId: string, jobId: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE sync_jobs
       SET state = 'failed', completed_at = NOW(), error = $2
       WHERE id = $1`,
      [jobId, error],
    )
    await this.pool.query(
      `UPDATE eventernote_users
       SET last_index_error = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, error],
    )
  }

  async saveUserIndex(userId: string, events: EventSeed[]): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO eventernote_users (user_id, last_index_attempt_at, updated_at)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      )
      await client.query('UPDATE user_events SET active = FALSE WHERE user_id = $1', [userId])

      for (const event of events) {
        await this.upsertEventSeed(client, event)
        await client.query(
          `INSERT INTO user_events (user_id, event_id, active)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (user_id, event_id) DO UPDATE
           SET active = TRUE, last_seen_at = NOW()`,
          [userId, event.id],
        )
      }

      await client.query(
        `UPDATE eventernote_users
         SET last_index_success_at = NOW(), last_index_error = NULL, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  private async upsertEventSeed(client: PoolClient, event: EventSeed): Promise<void> {
    if (event.placeId) {
      await client.query(
        `INSERT INTO places (place_id, name)
         VALUES ($1, $2)
         ON CONFLICT (place_id) DO UPDATE
         SET name = CASE WHEN places.name = '' THEN EXCLUDED.name ELSE places.name END,
             updated_at = NOW()`,
        [event.placeId, event.venue],
      )
    }
    await client.query(
      `INSERT INTO events (
         event_id, title, start_at, end_at, place_id, venue_name, actors,
         image_url, image_alt, list_seen_at
       ) VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7::jsonb, $8, $9, NOW())
       ON CONFLICT (event_id) DO UPDATE SET
         title = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.title ELSE events.title END,
         start_at = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.start_at ELSE events.start_at END,
         end_at = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.end_at ELSE events.end_at END,
         place_id = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.place_id ELSE events.place_id END,
         venue_name = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.venue_name ELSE events.venue_name END,
         actors = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.actors ELSE events.actors END,
         image_url = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.image_url ELSE events.image_url END,
         image_alt = CASE WHEN events.detail_fetched_at IS NULL THEN EXCLUDED.image_alt ELSE events.image_alt END,
         list_seen_at = NOW(), updated_at = NOW()`,
      [
        event.id,
        event.title,
        event.startAt,
        event.endAt,
        event.placeId,
        event.venue,
        JSON.stringify(event.actors),
        event.imageUrl ?? null,
        event.imageAlt ?? null,
      ],
    )
  }

  async getStoredEvents(userId: string): Promise<StoredEvent[]> {
    const result = await this.pool.query<EventRow>(
      `SELECT e.event_id, e.title, e.start_at, e.end_at, e.place_id, e.venue_name,
              e.actors, e.image_url, e.image_alt, e.detail_fetched_at,
              p.name AS place_name, p.address, p.region, p.latitude, p.longitude
       FROM user_events ue
       JOIN events e ON e.event_id = ue.event_id
       LEFT JOIN places p ON p.place_id = e.place_id
       WHERE ue.user_id = $1 AND ue.active = TRUE`,
      [userId],
    )
    return result.rows.map((row) => ({
      id: row.event_id,
      title: row.title,
      startAt: row.start_at,
      endAt: row.end_at,
      allDay: false,
      category: { id: '', label: '', color: '' },
      location: row.venue_name,
      links: [],
      sourceType: 'backend',
      detailFetchedAt: optionalIso(row.detail_fetched_at),
      placeId: row.place_id ?? undefined,
    }))
  }

  async saveEventDetail(detail: EventDetail, rawHash: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      if (detail.placeId) {
        await client.query(
          `INSERT INTO places (place_id, name)
           VALUES ($1, $2)
           ON CONFLICT (place_id) DO UPDATE
           SET name = EXCLUDED.name, updated_at = NOW()`,
          [detail.placeId, detail.venue],
        )
      }
      await client.query(
        `UPDATE events SET
           title = $2, start_at = $3, end_at = $4, place_id = NULLIF($5, ''),
           venue_name = $6, actors = $7::jsonb, detail_description = $8,
           image_url = COALESCE($9, image_url), image_alt = COALESCE($10, image_alt),
           detail_fetched_at = NOW(), raw_detail_hash = $11, updated_at = NOW()
         WHERE event_id = $1`,
        [
          detail.id,
          detail.title,
          detail.startAt,
          detail.endAt,
          detail.placeId,
          detail.venue,
          JSON.stringify(detail.actors),
          detail.description,
          detail.imageUrl ?? null,
          detail.imageAlt ?? null,
          rawHash,
        ],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getPlaceCandidatesForUser(userId: string, staleBefore: Date, limit: number): Promise<PlaceRow[]> {
    const result = await this.pool.query<PlaceRow>(
      `SELECT p.place_id, p.name, p.address, p.region, p.latitude, p.longitude,
              p.detail_fetched_at
       FROM places p
       WHERE EXISTS (
         SELECT 1
         FROM user_events ue
         JOIN events e ON e.event_id = ue.event_id
         WHERE ue.user_id = $1 AND ue.active = TRUE AND e.place_id = p.place_id
       )
         AND (p.detail_fetched_at IS NULL OR p.detail_fetched_at < $2)
       ORDER BY p.detail_fetched_at ASC NULLS FIRST, p.place_id ASC
       LIMIT $3`,
      [userId, staleBefore, limit],
    )
    return result.rows
  }

  async getRequestedPlacesForUser(userId: string, placeIds: string[]): Promise<StoredPlaceDetail[]> {
    if (placeIds.length === 0) return []
    const result = await this.pool.query<PlaceRow>(
      `SELECT p.place_id, p.name, p.address, p.region, p.latitude, p.longitude,
              p.detail_fetched_at, p.geocode_attempted_at
       FROM places p
       WHERE p.place_id = ANY($2::text[])
         AND EXISTS (
           SELECT 1
           FROM user_events ue
           JOIN events e ON e.event_id = ue.event_id
           WHERE ue.user_id = $1 AND ue.active = TRUE AND e.place_id = p.place_id
         )
       ORDER BY array_position($2::text[], p.place_id)`,
      [userId, placeIds],
    )
    return result.rows.map((row) => ({
      id: row.place_id,
      name: row.name,
      address: row.address,
      region: row.region,
      ...(row.latitude === null ? {} : { latitude: row.latitude }),
      ...(row.longitude === null ? {} : { longitude: row.longitude }),
      ...(row.geocode_attempted_at === null
        ? {}
        : { geocodeAttemptedAt: row.geocode_attempted_at.toISOString() }),
    }))
  }

  async getPlace(placeId: string): Promise<StoredPlaceDetail | undefined> {
    const result = await this.pool.query<PlaceRow>(
      `SELECT place_id, name, address, region, latitude, longitude,
              detail_fetched_at, geocode_attempted_at, geocode_version
       FROM places
       WHERE place_id = $1`,
      [placeId],
    )
    const row = result.rows[0]
    if (!row) return undefined
    return {
      id: row.place_id,
      name: row.name,
      address: row.address,
      region: row.region,
      ...(row.latitude === null ? {} : { latitude: row.latitude }),
      ...(row.longitude === null ? {} : { longitude: row.longitude }),
      ...(row.geocode_attempted_at === null
        ? {}
        : { geocodeAttemptedAt: row.geocode_attempted_at.toISOString() }),
      geocodeVersion: row.geocode_version,
    }
  }

  async hasActiveEvent(userId: string, eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
       FROM user_events
       WHERE user_id = $1 AND event_id = $2 AND active = TRUE
       LIMIT 1`,
      [userId, eventId],
    )
    return result.rowCount === 1
  }

  async savePlaceDetail(
    detail: PlaceDetail,
    rawHash: string,
    geocodeVersion?: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO places (
         place_id, name, address, region, latitude, longitude, detail_fetched_at,
         raw_detail_hash, geocode_attempted_at, geocode_version
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7,
         CASE WHEN $8::INTEGER IS NOT NULL THEN NOW() END, COALESCE($8, 0))
       ON CONFLICT (place_id) DO UPDATE SET
          name = EXCLUDED.name, address = EXCLUDED.address, region = EXCLUDED.region,
          latitude = CASE
            WHEN places.address = EXCLUDED.address
              AND (EXCLUDED.latitude IS NULL OR EXCLUDED.longitude IS NULL)
            THEN places.latitude
            ELSE EXCLUDED.latitude
          END,
          longitude = CASE
            WHEN places.address = EXCLUDED.address
              AND (EXCLUDED.latitude IS NULL OR EXCLUDED.longitude IS NULL)
            THEN places.longitude
            ELSE EXCLUDED.longitude
          END,
          detail_fetched_at = NOW(), raw_detail_hash = EXCLUDED.raw_detail_hash,
         geocode_attempted_at = CASE
           WHEN places.address <> EXCLUDED.address THEN EXCLUDED.geocode_attempted_at
           WHEN $8::INTEGER IS NOT NULL THEN NOW()
           ELSE places.geocode_attempted_at
         END,
         geocode_version = CASE
           WHEN places.address <> EXCLUDED.address THEN EXCLUDED.geocode_version
           WHEN $8::INTEGER IS NOT NULL THEN $8
           ELSE places.geocode_version
         END,
         updated_at = NOW()`,
      [
        detail.id,
        detail.name,
        detail.address,
        detail.region,
        detail.latitude ?? null,
        detail.longitude ?? null,
        rawHash,
        geocodeVersion ?? null,
      ],
    )
  }
}
