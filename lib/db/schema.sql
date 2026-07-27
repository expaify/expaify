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

-- ── Agent 3: Price Pipeline ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tracked_markets (
  id          SERIAL      PRIMARY KEY,
  city        TEXT        NOT NULL,
  country     TEXT        NOT NULL,
  iata        CHAR(3)     NOT NULL UNIQUE,
  active      BOOLEAN     NOT NULL DEFAULT true
);

INSERT INTO tracked_markets (city, country, iata) VALUES
  ('Miami',         'US', 'MIA'),
  ('New York',      'US', 'NYC'),
  ('Cancún',        'MX', 'CUN'),
  ('Paris',         'FR', 'PAR'),
  ('Rome',          'IT', 'ROM'),
  ('Barcelona',     'ES', 'BCN'),
  ('Lisbon',        'PT', 'LIS'),
  ('London',        'GB', 'LON'),
  ('Tokyo',         'JP', 'TYO'),
  ('Bangkok',       'TH', 'BKK'),
  ('Dubai',         'AE', 'DXB'),
  ('Las Vegas',     'US', 'LAS'),
  ('Orlando',       'US', 'MCO'),
  ('San Juan',      'PR', 'SJU'),
  ('Tulum',         'MX', 'TUL'),
  ('Amsterdam',     'NL', 'AMS'),
  ('Athens',        'GR', 'ATH'),
  ('Punta Cana',    'DO', 'PUJ'),
  ('Charlotte',     'US', 'CLT'),
  ('Nashville',     'US', 'BNA')
ON CONFLICT (iata) DO NOTHING;

CREATE TABLE IF NOT EXISTS price_snapshots (
  id              BIGSERIAL   PRIMARY KEY,
  hotel_id        TEXT        NOT NULL,
  hotel_name      TEXT        NOT NULL,
  stars           NUMERIC(2,1),
  photo_url       TEXT,
  market_id       INTEGER     NOT NULL REFERENCES tracked_markets(id),
  check_in        DATE        NOT NULL,
  nights          SMALLINT    NOT NULL DEFAULT 2,
  price_cents     INTEGER     NOT NULL,
  currency        CHAR(3)     NOT NULL DEFAULT 'USD',
  snapshot_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_mock         BOOLEAN     NOT NULL DEFAULT false,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT price_snapshots_unique UNIQUE (hotel_id, market_id, check_in, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_hotel_market
  ON price_snapshots (hotel_id, market_id, check_in DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_captured
  ON price_snapshots (captured_at DESC);

CREATE TABLE IF NOT EXISTS deals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            TEXT        NOT NULL,
  hotel_name          TEXT        NOT NULL,
  stars               NUMERIC(2,1),
  photo_url           TEXT,
  market_id           INTEGER     NOT NULL REFERENCES tracked_markets(id),
  deal_price_cents    INTEGER     NOT NULL,
  median_price_cents  INTEGER     NOT NULL,
  discount_pct        SMALLINT    NOT NULL,
  check_in_window     TEXT        NOT NULL,
  check_in_date       DATE        NOT NULL,
  nights              SMALLINT    NOT NULL DEFAULT 2,
  snapshot_count      INTEGER     NOT NULL,
  ota_links           JSONB       NOT NULL DEFAULT '{}',
  headline            TEXT,
  description         TEXT,
  status              TEXT        NOT NULL DEFAULT 'active',  -- active | expired
  is_mock             BOOLEAN     NOT NULL DEFAULT false,
  first_seen          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deals_hotel_market_checkin UNIQUE (hotel_id, market_id, check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_deals_status ON deals (status, first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_deals_market  ON deals (market_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_active_newest
  ON deals (first_seen DESC, id ASC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_deals_active_discount
  ON deals (discount_pct DESC, first_seen DESC, id ASC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_deals_active_price
  ON deals (deal_price_cents ASC, first_seen DESC, id ASC) WHERE status = 'active';

-- ── Auth (NextAuth v5 / Auth.js PG adapter) ───────────────────────────────
-- Table names are plural to match @auth/pg-adapter v1.x expectations
CREATE TABLE IF NOT EXISTS users (
  id            TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT        UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image         TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "userId"            TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS id TEXT DEFAULT gen_random_uuid()::TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "sessionToken" TEXT        NOT NULL PRIMARY KEY,
  "userId"       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ NOT NULL
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id TEXT DEFAULT gen_random_uuid()::TEXT;

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT        NOT NULL,
  token      TEXT        NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ── Subscriptions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT        UNIQUE,
  stripe_subscription_id  TEXT        UNIQUE,
  status                  TEXT        NOT NULL DEFAULT 'free',  -- free | trialing | active | canceled
  plan                    TEXT,                                  -- monthly | annual
  trial_ends_at           TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  alert_preference        TEXT        NOT NULL DEFAULT 'daily', -- instant | daily | off
  watchlist               TEXT[]      NOT NULL DEFAULT '{}',    -- up to 10 city slugs
  alert_min_discount      SMALLINT    NOT NULL DEFAULT 40,
  alert_timezone          TEXT        NOT NULL DEFAULT 'America/New_York',
  alert_unsubscribe_token UUID        NOT NULL DEFAULT gen_random_uuid(),
  last_alerted_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS alert_min_discount SMALLINT NOT NULL DEFAULT 40;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS alert_timezone TEXT NOT NULL DEFAULT 'America/New_York';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS alert_unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_alert_preference_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_alert_preference_check
      CHECK (alert_preference IN ('instant', 'daily', 'off'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_watchlist_limit_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_watchlist_limit_check
      CHECK (COALESCE(array_length(watchlist, 1), 0) <= 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_alert_min_discount_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_alert_min_discount_check
      CHECK (alert_min_discount BETWEEN 0 AND 90);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_unsubscribe_token ON subscriptions(alert_unsubscribe_token);

CREATE TABLE IF NOT EXISTS deal_alert_deliveries (
  id              BIGSERIAL   PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id         UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  delivery_type   TEXT        NOT NULL, -- instant | digest
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deal_alert_deliveries_unique UNIQUE (user_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_alert_deliveries_user_day
  ON deal_alert_deliveries (user_id, delivered_at DESC);

-- First-party, privacy-bounded product analytics. session_id is generated per
-- browser tab and is intentionally not tied to an account or raw search text.
CREATE TABLE IF NOT EXISTS analytics_events (
  event_id      UUID        PRIMARY KEY,
  session_id    UUID        NOT NULL,
  event_name    TEXT        NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  path          TEXT        NOT NULL,
  properties    JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_time
  ON analytics_events (session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time
  ON analytics_events (event_name, occurred_at DESC);

-- ── Admin console foundations ────────────────────────────────────────────

-- Role source: presence of a row grants admin access. Verified server-side
-- on every /api/admin/* request — never trust the client session alone.
CREATE TABLE IF NOT EXISTS admin_users (
  user_id     TEXT        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entitlement fields: how a subscription's premium access is sourced.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS entitlement_source TEXT NOT NULL DEFAULT 'none';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS comp_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS comp_granted_by TEXT REFERENCES users(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS comp_granted_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS comp_expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_entitlement_source_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_entitlement_source_check
      CHECK (entitlement_source IN ('stripe', 'comp', 'none'));
  END IF;
END $$;

-- Append-only admin audit log. No app-level update/delete path exists, and
-- the triggers below reject UPDATE/DELETE at the database level too.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id                       BIGSERIAL   PRIMARY KEY,
  action                   TEXT        NOT NULL,
  actor_user_id            TEXT        NOT NULL REFERENCES users(id),
  actor_email              TEXT        NOT NULL,
  target_user_id           TEXT        REFERENCES users(id),
  target_email             TEXT,
  searched_identifier_type TEXT,
  reason                   TEXT,
  metadata                 JSONB       NOT NULL DEFAULT '{}'::jsonb,
  before                   JSONB,
  after                    JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION admin_audit_log_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_audit_log_no_update ON admin_audit_log;
CREATE TRIGGER admin_audit_log_no_update
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_immutable();

-- Privacy request tracking. Requests are queued and reviewed, never
-- executed immediately from the admin console.
CREATE TABLE IF NOT EXISTS account_export_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_email TEXT        NOT NULL,
  user_id         TEXT        REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'requested',
  source          TEXT,
  actor_user_id   TEXT        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_export_requests_user ON account_export_requests(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'account_export_requests_status_check'
  ) THEN
    ALTER TABLE account_export_requests
      ADD CONSTRAINT account_export_requests_status_check
      CHECK (status IN ('requested', 'verifying', 'in_progress', 'completed', 'rejected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_email TEXT        NOT NULL,
  user_id         TEXT        REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'requested',
  source          TEXT,
  actor_user_id   TEXT        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user ON account_deletion_requests(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'account_deletion_requests_status_check'
  ) THEN
    ALTER TABLE account_deletion_requests
      ADD CONSTRAINT account_deletion_requests_status_check
      CHECK (status IN ('requested', 'verifying', 'in_progress', 'completed', 'rejected'));
  END IF;
END $$;
