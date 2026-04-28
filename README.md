# Eventernote Dashboard

A personal event schedule viewer built with React and TypeScript. It fetches events from [Eventernote](https://www.eventernote.com) and lets you view, filter, import, and export them in a clean timeline or list layout.

## Features

- **Timeline & List views** — browse events grouped by date or in a flat list
- **Countdown** — live countdown to the next upcoming event
- **Category filtering** — filter events by category; toggle individual categories on/off
- **Day-range filter** — show all events or only future ones
- **Dark / Light theme** — toggle with one click
- **Multilingual UI** — English, Traditional Chinese (繁體中文), and Japanese (日本語)
- **Localized event content** — each event can store title, description, notes, and location in multiple languages
- **Event details drawer** — slide-in panel with full event metadata and external links
- **Import** — drag-and-drop ICS or JSON files to add events
- **Export** — download all events as an ICS calendar file or capture cards as a PNG screenshot
- **Admin page** — full CRUD editor at `/admin` for manually creating and editing events
- **Persistent state** — view mode, filters, theme, and events survive page refresh via localStorage

## Tech Stack

| Category | Package | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | 6 |
| State | Zustand | 5 |
| Build | Vite | 8 |
| Date handling | dayjs | 1.x |
| iCal parsing | ical.js | 2.x |
| Validation | Zod | 4 |
| Screenshot | html-to-image | 1.x |
| Tests | Vitest | 4 |
| Web server (prod) | Nginx (Alpine) | — |

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`. The Vite dev server proxies `/api/eventernote` to `https://www.eventernote.com` so the Eventernote adapter works without CORS issues.

### Tests

```bash
npm run test
```

### Production Build

```bash
npm run build        # type-check + Vite build → dist/
npm run preview      # serve dist/ locally
```

## URL Routing

| Path | Behaviour |
|---|---|
| `/` | Landing page — enter an Eventernote user ID |
| `/{userId}` | Load and display events for that user |
| `/admin` | Admin page for creating / editing events |

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

The multi-stage Dockerfile builds the app with Node 22 Alpine and serves it with Nginx Alpine on port 80.

## Event Sources

| Source | Description |
|---|---|
| Eventernote | Scraped from the Eventernote user page; venue names drive region detection and category colour |
| ICS file | Standard iCalendar import; recurring events are expanded up to 30 days (max 200 instances) |
| JSON file | Zod-validated JSON in nested or flat category format |
| Sample | Built-in sample events shown on first load |

## Import / Export Formats

**ICS import** — accepts `.ics` files; CATEGORIES property maps to event categories.

**JSON import** — accepts `.json` files in either of these shapes:

```jsonc
// Nested (category as object)
{ "title": "...", "startAt": "2026-01-01T18:00:00+09:00", "category": { "id": "concert", "label": "Concert", "color": "#e05858" }, ... }

// Flat (category as string ID)
{ "title": "...", "startAt": "2026-01-01T18:00:00+09:00", "categoryId": "concert", ... }
```

**ICS export** — downloads all current events as a single `.ics` file.

**PNG export** — captures the visible event cards as a `.png` image.

## Project Structure

```
src/
├── adapters/          # Event source adapters (Eventernote, ICS, JSON, stub)
├── components/        # React UI components
├── data/              # Built-in sample events
├── lib/               # Utilities: date helpers, import/export, localization, storage
│   └── sources/       # EventSourceAdapter interface
├── store/             # Zustand global store
└── types/             # TypeScript type definitions
admin/                 # Separate Vite entry point for the admin page
```
