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
