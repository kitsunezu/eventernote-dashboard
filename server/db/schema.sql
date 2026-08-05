CREATE TABLE IF NOT EXISTS eventernote_users (
  user_id TEXT PRIMARY KEY,
  last_index_attempt_at TIMESTAMPTZ,
  last_index_success_at TIMESTAMPTZ,
  last_index_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS places (
  place_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  detail_fetched_at TIMESTAMPTZ,
  raw_detail_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  place_id TEXT REFERENCES places(place_id) ON UPDATE CASCADE ON DELETE SET NULL,
  venue_name TEXT NOT NULL DEFAULT '',
  actors JSONB NOT NULL DEFAULT '[]'::jsonb,
  detail_description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  image_alt TEXT,
  list_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detail_fetched_at TIMESTAMPTZ,
  raw_detail_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_events (
  user_id TEXT NOT NULL REFERENCES eventernote_users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(event_id) ON UPDATE CASCADE ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES eventernote_users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('running', 'succeeded', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS user_events_active_idx
  ON user_events (user_id, active, event_id);

CREATE INDEX IF NOT EXISTS events_detail_freshness_idx
  ON events (detail_fetched_at, start_at);

CREATE INDEX IF NOT EXISTS sync_jobs_user_requested_idx
  ON sync_jobs (user_id, requested_at DESC);
