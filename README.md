# Eventernote Dashboard

Eventernote Dashboard is a React and TypeScript viewer for public Eventernote schedules. Enter an Eventernote user ID on the landing page, fetch that user's public event pages through a local proxy, and browse the results in a timeline-oriented dashboard.

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
2. The app requests Eventernote pages through /api/eventernote to avoid browser CORS issues.
3. The scraper follows pagination on the user's events pages.
4. It fetches individual event detail pages to enrich performer information.
5. Events are deduplicated by Eventernote event ID, sorted by time, and grouped by day for display.
6. Venue and title text are used to infer a region-style category color for each event.

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
- Nginx for the production container

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Development

```bash
npm install
npm run dev
```

The development server runs at http://localhost:5173.

Important detail: both the Vite dev server and the production Nginx container proxy /api/eventernote to https://www.eventernote.com, so the scraper-based viewer can work without direct browser access to Eventernote.

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
```

### docker-compose

```yaml
services:
  eventernote-dashboard:
    image: ghcr.io/kitsunezu/eventernote-dashboard:latest
    restart: unless-stopped
    ports:
      - "3003:80"
```

### Build locally

```bash
docker build -t eventernote-dashboard .
docker run -p 3003:80 eventernote-dashboard
```

The production image builds the app with Node 22 Alpine, serves the static bundle with Nginx, and keeps the /api/eventernote reverse proxy available inside the container.

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
admin/
└── index.html          # Reserved secondary entry, currently loading the main app entry
```
