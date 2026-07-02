-- Price snapshots written by the nightly job
CREATE TABLE IF NOT EXISTS snapshots (
  id          BIGSERIAL PRIMARY KEY,
  origin      CHAR(3)  NOT NULL,          -- IATA
  destination CHAR(3)  NOT NULL,          -- IATA
  date        DATE     NOT NULL,          -- the travel date or snapshot date
  price_cents INTEGER  NOT NULL,          -- integer minor units
  currency    CHAR(3)  NOT NULL DEFAULT 'USD',
  source      TEXT     NOT NULL DEFAULT 'travelpayouts',
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT snapshots_route_date_unique UNIQUE (origin, destination, date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_route
  ON snapshots (origin, destination, date DESC);

-- Hotel price snapshots written by the nightly job
CREATE TABLE IF NOT EXISTS hotel_snapshots (
  id BIGSERIAL PRIMARY KEY,
  hotel_id TEXT NOT NULL,
  date DATE NOT NULL,
  price_per_night_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hotel_snapshots_unique UNIQUE (hotel_id, date)
);

CREATE INDEX IF NOT EXISTS idx_hotel_snapshots_hotel
  ON hotel_snapshots (hotel_id, date DESC);

-- Convenience view: route baselines (used by scoreDeal)
CREATE OR REPLACE VIEW route_baseline AS
SELECT
  origin,
  destination,
  ARRAY_AGG(price_cents ORDER BY date DESC) AS price_cents_history,
  COUNT(*)::INT                              AS point_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_cents) AS median_cents
FROM snapshots
WHERE fetched_at >= NOW() - INTERVAL '90 days'
GROUP BY origin, destination;

-- Price alerts — users subscribe to be emailed when a route drops below a target
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  hotel_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ
);
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS hotel_id TEXT;
CREATE INDEX IF NOT EXISTS price_alerts_active_idx ON price_alerts(active) WHERE active = true;

-- Routes searched by users — auto-enrolled into nightly snapshot pipeline
CREATE TABLE IF NOT EXISTS searched_routes (
  origin            CHAR(3) NOT NULL,
  destination       CHAR(3) NOT NULL,
  first_searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_count      INTEGER NOT NULL DEFAULT 1,
  last_searched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (origin, destination)
);
CREATE INDEX IF NOT EXISTS idx_searched_routes_count ON searched_routes(search_count DESC);

-- ── Auth (NextAuth v5 / Auth.js PG adapter) ───────────────────────────────
CREATE TABLE IF NOT EXISTS "user" (
  id            TEXT        NOT NULL PRIMARY KEY,
  name          TEXT,
  email         TEXT        UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image         TEXT
);

CREATE TABLE IF NOT EXISTS account (
  "userId"            TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type                TEXT        NOT NULL,
  provider            TEXT        NOT NULL,
  "providerAccountId" TEXT        NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  PRIMARY KEY (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS session (
  "sessionToken" TEXT        NOT NULL PRIMARY KEY,
  "userId"       TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT        NOT NULL,
  token      TEXT        NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ── Subscriptions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT        UNIQUE,
  stripe_subscription_id  TEXT        UNIQUE,
  status                  TEXT        NOT NULL DEFAULT 'free',  -- free | trialing | active | canceled
  plan                    TEXT,                                  -- monthly | annual
  trial_ends_at           TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  alert_preference        TEXT        NOT NULL DEFAULT 'daily', -- instant | daily | off
  watchlist               TEXT[]      NOT NULL DEFAULT '{}',    -- up to 10 city slugs
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
