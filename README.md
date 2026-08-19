# Eventernote Dashboard

English | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md)

Eventernote Dashboard is a React and TypeScript viewer for public Eventernote schedules. Enter an Eventernote user ID on the landing page, load the database-backed schedule API, and browse the results in a timeline-oriented dashboard.

## Current Features

- Landing page for entering an Eventernote user ID
- Viewer page that loads the selected user's public event list
- Timeline view grouped by day
- Countdown banner for the next upcoming event in the current range
- Schedule range switcher for all events or future events only
- Event cards with date, time, venue, thumbnail preview, and direct Eventernote link
- Event details drawer with category, full time range, location, performer summary, notes, and external links

## How It Works

The current app is centered on the Eventernote viewer flow.

1. The landing page collects a user ID and navigates to /{userId}.
2. The browser requests `GET /api/users/{userId}/events`; it does not scrape Eventernote directly.
3. The API returns fresh PostgreSQL data immediately, or stale data while starting a background refresh.
4. The server reads the user's Eventernote participation calendar, fetches each non-empty month, verifies the row count, and deduplicates event IDs. It falls back to the event-list pagination when the calendar is unavailable.
5. Missing or expired event detail pages are fetched with bounded concurrency, parsed, and saved as the authoritative event values.
6. Missing or expired place pages are fetched separately for canonical addresses and coordinates. Invalid or absent Eventernote coordinates fall back through its map link, progressively simplified Japanese GSI and Nominatim address searches, then validated venue-name POI search.
7. Events are deduplicated by Eventernote event ID, sorted by time, and grouped by day for display.

Opening an event detail or following its Eventernote link triggers a targeted refresh of that event and place before the updated database values are returned to the app.

The schema, API contract, refresh policy, and failure behavior are documented in [docs/data-api.md](docs/data-api.md).

## Current Routes

| Path | Purpose |
|---|---|
| / | Landing page for entering a user ID |
| /{userId} | Event viewer for that Eventernote user |

There is no dedicated, wired admin UI in the current app surface. The repository still contains admin-related files, and the production Nginx config reserves /admin/, but admin/index.html currently loads the same src/main.tsx entry as the main app.

## Tech Stack

- React 19
- TypeScript 6
- Zustand 5
- Vite 8
- dayjs
- Vitest
- ESLint
- PostgreSQL 17
- Node.js API service
- Nginx web/reverse-proxy service

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Development

Start PostgreSQL first and provide `DATABASE_URL`, then run both Vite and the API watcher:

```bash
npm install
$env:DATABASE_URL = 'postgresql://eventernote:local-password@localhost:5432/eventernote'
npm run dev
```

The web app runs at http://localhost:5173 and proxies application API calls to the API service on port 8787.

### Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

## Docker

A pre-built image is published to GitHub Container Registry:

```bash
docker pull ghcr.io/kitsunezu/eventernote-dashboard:latest
docker pull ghcr.io/kitsunezu/eventernote-dashboard:api-latest
```

### docker-compose

Set `POSTGRES_PASSWORD` in Portainer's stack environment, then deploy the committed `docker-compose.yml`. The stack creates the web, API, and PostgreSQL services plus the persistent `eventernote-db-data` volume.

To accept reviewed events from the separate `eventernote-autofill` service, also set a long random `DASHBOARD_IMPORT_TOKEN` in both stacks. The import route is disabled when this value is empty and should only be called over the shared `eventernote-internal` Docker network.

### Build locally

```bash
docker build --target web -t eventernote-dashboard:web .
docker build --target api -t eventernote-dashboard:api .
```

The production workflow publishes both targets before requesting the Portainer stack redeploy.

If Eventernote's hostname ever resolves inconsistently from your deployment environment, you can override the proxy target without rebuilding the image:

```bash
EVENTERNOTE_UPSTREAM=https://35.75.153.225
EVENTERNOTE_HOST=www.eventernote.com
```

Keep EVENTERNOTE_HOST set to www.eventernote.com so the upstream Host header and TLS name stay correct even when EVENTERNOTE_UPSTREAM is pinned to an IP.

## Tests

The current test suite covers utility and parsing logic, including:

- date formatting and filtering helpers
- Eventernote parsing behavior
- ICS import parsing
- JSON import parsing
- Zustand store selectors and filtering behavior

Run the suite with:

```bash
npm run test
```

## Inactive Modules Still Present In The Repo

This repository still includes code for features that are not wired into the current viewer flow:

- admin editor UI in src/components/AdminPage.tsx
- category filter UI in src/components/Filters.tsx
- list view UI in src/components/ListView.tsx
- ICS and JSON file adapters
- ICS export and PNG export utilities
- sample data and backend stub adapters

Those files remain in the codebase, but they are not connected to src/App.tsx or src/main.tsx in the current build, so they are intentionally not described above as active user-facing functionality.

## Project Structure

```text
src/
├── App.tsx             # Landing page / viewer flow
├── adapters/           # Eventernote scraper and dormant file adapters
├── components/         # Active viewer components plus some inactive UI modules
├── lib/                # Date, localization, storage, and parsing utilities
├── store/              # Zustand schedule store
└── types/              # Shared TypeScript types
server/
├── db/schema.sql       # PostgreSQL schema
├── index.ts            # HTTP API entrypoint
├── parser.ts           # Eventernote list/detail/place parsing
├── repository.ts       # Database reads and transactional writes
└── sync.ts             # Freshness, locking, and upstream synchronization
admin/
└── index.html          # Reserved secondary entry, currently loading the main app entry
```
