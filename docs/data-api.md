# Event Data API

## Request flow

The active viewer calls:

```http
GET /api/users/{userId}/events
Accept: application/json
```

The server validates `userId` and reads PostgreSQL before contacting Eventernote.

1. Fresh user index: return the database snapshot.
2. Expired user index with an existing snapshot: return stale data immediately and start one background synchronization.
3. No successful snapshot: wait for the first synchronization and return its database snapshot.
4. Concurrent requests for the same user share an in-process promise. PostgreSQL advisory locks prevent duplicate work across API replicas.
5. A failed refresh keeps the previous active event relationships and records the failure in `eventernote_users` and `sync_jobs`.

The browser polls the same API briefly when `cache.refreshing` is true. Polling only reads PostgreSQL; it does not start duplicate upstream work.

## Response

```json
{
  "events": [],
  "warnings": [],
  "sourceType": "backend",
  "importedAt": "2026-08-05T08:00:00.000Z",
  "places": {},
  "cache": {
    "status": "fresh",
    "refreshing": false,
    "userIndexCheckedAt": "2026-08-05T08:00:00.000Z",
    "pendingDetailCount": 0
  }
}
```

`events` uses the existing `ScheduleEvent` contract. `places` is keyed by Eventernote place ID and is merged into the existing browser place cache for report/map compatibility.

## Database ownership

| Table | Purpose |
|---|---|
| `eventernote_users` | User-index attempts, successful freshness timestamp, latest error |
| `events` | Canonical event detail values and detail freshness |
| `user_events` | Active user-to-event relationships and discovery timestamps |
| `places` | Canonical address, region, coordinates, and place freshness |
| `sync_jobs` | Auditable synchronization state, statistics, and warnings |

The user list page is only a discovery source. Once an event detail page has been stored, later list-page parsing does not overwrite its title, time, venue, actors, or image. Place IDs from every active user event are independently eligible for refresh, so canonical addresses are populated even when the related event detail does not need refreshing.

When a place has a canonical address, its prefecture or overseas region is authoritative. Venue names and event titles are only used as a fallback, preventing tour names from assigning an event to the wrong region. Eventernote's `0,0` placeholder map coordinates are discarded while the address is retained in PostgreSQL.

The entire paginated index must succeed before `user_events.active` is updated. A partial pagination failure therefore cannot incorrectly remove older database relationships.

## Freshness and load limits

| Data | Default freshness |
|---|---|
| User event index | 6 hours |
| Event starting within 48 hours | 1 hour |
| Other future event detail | 6 hours |
| Past event detail | 30 days |
| Place detail | 90 days |

At most 40 event details are refreshed in one user synchronization, ordered by missing detail, upcoming events, then recent history. Detail concurrency defaults to 3 and upstream request starts are spaced by at least 350 ms. These values are configurable.

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `DATABASE_URL` | Local development | Standard PostgreSQL environment variables |
| `POSTGRES_PASSWORD` | Docker Compose/Portainer | None; deployment fails when absent |
| `EVENTERNOTE_UPSTREAM` | No | `https://www.eventernote.com` |
| `USER_INDEX_TTL_MS` | No | `21600000` |
| `DETAIL_FETCH_LIMIT` | No | `40` |
| `DETAIL_FETCH_CONCURRENCY` | No | `3` |
| `PLACE_FETCH_LIMIT` | No | `20` |
| `UPSTREAM_MIN_INTERVAL_MS` | No | `350` |
| `UPSTREAM_TIMEOUT_MS` | No | `20000` |
| `MAX_LIST_PAGES` | No | `30` |
| `SYNC_RETRY_COOLDOWN_MS` | No | `300000` |

Only variable names belong in git. Set the real PostgreSQL password in the Portainer stack environment.
