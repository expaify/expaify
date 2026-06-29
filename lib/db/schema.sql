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
