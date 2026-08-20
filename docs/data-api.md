# Event Data API

## Request flow

The active viewer calls:

```http
GET /api/users/{userId}/events
Accept: application/json
```

Opening an event detail or following an Eventernote event link also starts an immediate targeted refresh:

```http
POST /api/users/{userId}/events/{eventId}/refresh
```

The targeted refresh verifies that the event belongs to the user's remembered schedule, then fetches the event detail and its place page without applying the normal freshness TTL. The response uses the same event API shape so the open drawer and report cache can update in place.

The attendance report can explicitly retry places that still have no usable coordinates:

```http
POST /api/users/{userId}/places/refresh
Content-Type: application/json

{ "placeIds": ["18844"] }
```

The endpoint accepts at most 20 numeric place IDs per request. It only refreshes places connected to that user's remembered events and still lacking usable coordinates. Unlike background synchronization, this explicit action bypasses the 30-day failed-geocode cooldown. Concurrent work for the same place is coalesced, global manual geocoding and queued user jobs are bounded, and each place has a 60-second manual retry cooldown. The response uses the same event API shape so the report map updates in place; places that remain unresolved are returned as warnings.

The server validates `userId` and reads PostgreSQL before contacting Eventernote.

1. Fresh user index: return the database snapshot.
2. Expired user index with an existing snapshot: return stale data immediately and start one background synchronization.
3. No successful snapshot: wait only for the complete paginated user index, then return its database snapshot.
4. Concurrent requests for the same user share an in-process promise. PostgreSQL advisory locks prevent duplicate work across API replicas.
5. A failed refresh keeps every previously discovered event relationship and records the failure in `eventernote_users` and `sync_jobs`.

Event and place enrichment continues in the background after the index is available. Each configured batch remains bounded, but one background job keeps taking batches until every currently eligible record has been attempted. The browser polls the same API while `cache.refreshing` is true, renders the first database snapshot immediately, and applies place-only changes to both the map and report region statistics. Polling only reads PostgreSQL; it does not start duplicate upstream work.

## Response

```json
{
  "events": [],
  "participationCalendar": [{ "year": 2026, "month": 8, "count": 4 }],
  "warnings": [],
  "sourceType": "backend",
  "importedAt": "2026-08-05T08:00:00.000Z",
  "places": {},
  "cache": {
    "status": "fresh",
    "refreshing": false,
    "userIndexCheckedAt": "2026-08-05T08:00:00.000Z",
    "pendingDetailCount": 0,
    "pendingPlaceCount": 0
  }
}
```

`events` uses the existing `ScheduleEvent` contract. `participationCalendar` contains the authoritative Eventernote count for each non-empty year/month and drives the report's attended-event total and monthly distribution. `places` is keyed by Eventernote place ID and is merged into the existing browser place cache for report/map compatibility.

## Database ownership

| Table | Purpose |
|---|---|
| `eventernote_users` | User-index attempts, successful freshness timestamp, latest error |
| `events` | Canonical event detail values and detail freshness |
| `user_events` | Permanent user-to-event relationships and discovery timestamps |
| `user_event_months` | Highest observed Eventernote participation-calendar count per user/year/month |
| `places` | Canonical address, region, coordinates, and place freshness |
| `sync_jobs` | Auditable synchronization state, statistics, and warnings |

The user list page is only a discovery source. Once an event detail page has been stored, later list-page parsing does not overwrite its title, time, venue, actors, or image. A later sync never removes an existing `user_events` relationship, because Eventernote can temporarily replace or duplicate list rows. Place IDs from every remembered user event are independently eligible for refresh, so canonical addresses are populated even when the related event detail does not need refreshing.

When a place has an address, its prefecture or overseas region is authoritative. Mainland Chinese addresses are grouped by their city when one can be extracted, for example `中國・廣州` or `中國・深圳`. Venue names and event titles are only used as a fallback, preventing tour names from assigning an event to the wrong region. Eventernote's `0,0` placeholder map coordinates are discarded while the address is retained in PostgreSQL.

Venue coordinates are resolved in order: valid Eventernote coordinates, coordinates embedded in its map link, the Japanese GSI address service with progressively simplified address queries, then address-level Nominatim results. If address lookup still fails, Nominatim searches the venue name and its aliases with progressively broader address scopes. A POI is accepted only when its name and administrative location match, or when a name-only search produces exactly one strong name match. The matched third-party display address and coordinates replace incomplete Eventernote location data in PostgreSQL. Results are tagged with the geocoding strategy version and reused for the same venue across users and later refreshes; older strategies are retried once after an upgrade. Failed searches retain the 30-day retry interval. Nominatim requests are serialized and spaced by at least 1.1 seconds; ambiguous POIs and synthetic city-center map points are not used.

The server reads the participation calendar from the user's Eventernote event-list page, fetches every non-empty month link, recursively follows pagination, and deduplicates available rows by Eventernote event ID. The calendar count remains authoritative when Eventernote repeats one event row or omits another: the mismatch is stored as a sync warning instead of failing the index. If the calendar is unavailable, the server falls back to event-list pagination and report statistics fall back to the discovered event data. Calendar counts are stored monotonically, and previously discovered user-event relationships are never removed by a later sync.

## Freshness and load limits

| Data | Default freshness |
|---|---|
| User event index | 6 hours |
| Event starting within 48 hours | 1 hour |
| Other future event detail | 6 hours |
| Past event detail | 30 days |
| Place detail | 90 days |

Event and place enrichment uses batches of at most 40 event details and 20 places by default. It continues with later batches in the same background job, ordered by missing detail, upcoming events, then recent history. Detail concurrency defaults to 3 and upstream request starts are spaced by at least 350 ms. These values are configurable.

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
| `MAX_LIST_PAGES` | No | `100` |
| `SYNC_RETRY_COOLDOWN_MS` | No | `300000` |
| `GSI_GEOCODER_URL` | No | `https://msearch.gsi.go.jp/address-search/AddressSearch` |
| `NOMINATIM_GEOCODER_URL` | No | `https://nominatim.openstreetmap.org/search` |
| `GEOCODER_TIMEOUT_MS` | No | `10000` |
| `NOMINATIM_MIN_INTERVAL_MS` | No | `1100` |
| `DASHBOARD_IMPORT_TOKEN` | For autofill import | Endpoint disabled when unset |

Only variable names belong in git. Set the real PostgreSQL password in the Portainer stack environment.

## Internal reviewed-event import

The separate `eventernote-autofill` service can persist a newly created Eventernote event through:

```http
POST /api/internal/events/import
Authorization: Bearer <DASHBOARD_IMPORT_TOKEN>
Content-Type: application/json
```

The endpoint is disabled when `DASHBOARD_IMPORT_TOKEN` is unset. It validates the Eventernote user, event ID, date/time, place ID, actor list, and field lengths, then transactionally upserts `eventernote_users`, `places`, `events`, and `user_events`. It is intended for the shared `eventernote-internal` Docker network; do not expose it as a separately routed public API.
