import { query } from '../db/client'
import { generateHeadlines } from '../ai/generateHeadline'
import { buildOtaLinks } from './otaLinks'
import { evaluateDeal } from './dealRules'
import { TRACKED_HOTEL_ID_PREFIX, isTrackedHotelId, type HotelDealSort } from '../deals/feedContract'

type Market = { id: number; city: string; country: string; iata: string }

type SnapshotRow = {
  hotel_id: string
  hotel_name: string
  stars: number | null
  review_evidence?: unknown
  photo_url: string | null
  check_in: Date
  currency: string
  avg_price_cents: number
  median_price_cents: number
  latest_price_cents: number
  snapshot_count: number
  is_mock: boolean
}

type CopyCandidate = {
  id: string
  hotelName: string
  city: string
  stars: number | null
  discountPct: number
  dealPriceCents: number
  medianPriceCents: number
  checkInWindow: string
}

function formatWindow(checkIn: Date, nights: number): string {
  const co = new Date(checkIn)
  co.setDate(co.getDate() + nights)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(checkIn)} – ${fmt(co)}`
}

export type NewDealAlert = {
  id: string
  hotelName: string
  city: string
  stars: number | null
  photoUrl: string | null
  checkInWindow: string
  discountPct: number
  dealPriceCents: number
  medianPriceCents: number
  snapshotCount: number
}

export type DetectionResult = {
  dealsUpserted: number
  newDeals: NewDealAlert[]
}

export async function detectDealsForMarket(market: Market): Promise<DetectionResult> {
  // Get rolling 60-day stats per hotel+check_in for this market.
  //
  // History must be grouped ONLY by (hotel_id, check_in, currency) -- the
  // real, stable identity of a tracked stay. The previous version also
  // grouped by hotel_name/stars/photo_url, which a provider can legitimately
  // change between scans (a refreshed photo URL, a slightly reworded name);
  // any such change silently fragmented one hotel's real price history into
  // separate, thin sibling groups, corrupting the median and preventing
  // snapshot_count from ever reaching MIN_SNAPSHOTS for that hotel. Same bug
  // already found and fixed in the tracked-hotel fallback path
  // (TRACKED_SNAPSHOT_SELECT below) -- this applies the identical LATERAL
  // pattern to the primary detection query: aggregate on identity alone,
  // then pull display fields from a single latest snapshot via LATERAL join.
  const snaps = await query<SnapshotRow>(
    `SELECT g.hotel_id, latest.hotel_name, latest.stars, latest.review_evidence, latest.photo_url,
            g.check_in, g.currency, g.avg_price_cents, g.median_price_cents,
            latest.price_cents AS latest_price_cents, g.snapshot_count, g.is_mock
     FROM (
       SELECT hotel_id, check_in, currency,
              AVG(price_cents)::INT AS avg_price_cents,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_cents)::INT AS median_price_cents,
              COUNT(*)::INT AS snapshot_count,
              bool_or(is_mock) AS is_mock
       FROM price_snapshots
       WHERE market_id = $1
         AND captured_at >= NOW() - INTERVAL '60 days'
         AND check_in >= CURRENT_DATE
       GROUP BY hotel_id, check_in, currency
     ) g
     JOIN LATERAL (
       SELECT hotel_name, stars, review_evidence, photo_url, price_cents
       FROM price_snapshots ps2
       WHERE ps2.hotel_id = g.hotel_id AND ps2.market_id = $1 AND ps2.check_in = g.check_in
         AND ps2.currency = g.currency
       ORDER BY captured_at DESC
       LIMIT 1
     ) latest ON true`,
    [market.id]
  )

  let dealsUpserted = 0
  const copyCandidates: CopyCandidate[] = []
  const newDeals: NewDealAlert[] = []

  const currenciesByStay = new Map<string, Set<string>>()
  for (const row of snaps.rows) {
    const stayKey = `${row.hotel_id}\u0000${row.check_in instanceof Date ? row.check_in.toISOString().slice(0, 10) : String(row.check_in)}`
    const currencies = currenciesByStay.get(stayKey) ?? new Set<string>()
    currencies.add(row.currency)
    currenciesByStay.set(stayKey, currencies)
  }
  for (const [stayKey, currencies] of currenciesByStay) {
    if (currencies.size <= 1) continue
    const separatorIndex = stayKey.indexOf('\u0000')
    const hotelId = stayKey.slice(0, separatorIndex)
    const checkIn = stayKey.slice(separatorIndex + 1)
    await query(
      `UPDATE deals SET status = 'expired', updated_at = NOW()
       WHERE hotel_id = $1 AND market_id = $2 AND check_in_date = $3 AND status = 'active'`,
      [hotelId, market.id, checkIn]
    )
  }
  const comparableSnaps = snaps.rows.filter((row) => {
    const stayKey = `${row.hotel_id}\u0000${row.check_in instanceof Date ? row.check_in.toISOString().slice(0, 10) : String(row.check_in)}`
    return currenciesByStay.get(stayKey)?.size === 1
  })

  for (const row of comparableSnaps) {
    const { hotel_id, hotel_name, stars, review_evidence, photo_url, check_in, currency, median_price_cents, latest_price_cents, snapshot_count, is_mock } = row

    const decision = evaluateDeal({
      latestPriceCents: latest_price_cents,
      medianPriceCents: median_price_cents,
      snapshotCount: snapshot_count,
    })
    const checkInStr = check_in instanceof Date ? check_in.toISOString().slice(0, 10) : String(check_in)

    if (decision.action === 'flag') {
      const { discountPct } = decision
      const checkOut = new Date(check_in)
      checkOut.setDate(checkOut.getDate() + 2)
      const checkOutStr = checkOut.toISOString().slice(0, 10)

      const links = buildOtaLinks({
        hotelName: hotel_name,
        city: market.city,
        checkIn: checkInStr,
        checkOut: checkOutStr,
      })

      const checkInWindow = formatWindow(check_in, 2)
      const upserted = await query<{ id: string; headline: string | null; description: string | null; is_new: boolean }>(
        `INSERT INTO deals
           (hotel_id, hotel_name, stars, review_evidence, photo_url, market_id, deal_price_cents,
            median_price_cents, currency, discount_pct, check_in_window, check_in_date, nights,
            snapshot_count, ota_links, status, is_mock, expires_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,2,$13,$14,'active',$15,
                 $12::DATE + INTERVAL '90 days', NOW())
         ON CONFLICT (hotel_id, market_id, check_in_date) DO UPDATE SET
           hotel_name         = EXCLUDED.hotel_name,
           photo_url          = EXCLUDED.photo_url,
           stars              = EXCLUDED.stars,
           deal_price_cents   = EXCLUDED.deal_price_cents,
           median_price_cents = EXCLUDED.median_price_cents,
           currency           = EXCLUDED.currency,
           discount_pct       = EXCLUDED.discount_pct,
           snapshot_count     = EXCLUDED.snapshot_count,
           review_evidence    = EXCLUDED.review_evidence,
           ota_links          = EXCLUDED.ota_links,
           status             = 'active',
           is_mock            = EXCLUDED.is_mock,
           updated_at         = NOW()
         RETURNING id, headline, description, (xmax = 0) AS is_new`,
        [
          hotel_id, hotel_name, stars, review_evidence, photo_url, market.id,
          latest_price_cents, median_price_cents, currency, discountPct,
          checkInWindow, checkInStr,
          snapshot_count, JSON.stringify(links), is_mock,
        ]
      )
      const dealId = upserted.rows[0]?.id
      // xmax = 0 is Postgres's standard tell for "this row was just INSERTed,
      // not touched via the ON CONFLICT UPDATE path" -- used here to alert
      // only on deals that are genuinely new tonight, not every night a
      // still-qualifying deal's price is re-confirmed. A deal that expires
      // and later re-qualifies goes through the UPDATE path (same unique
      // key), so it won't re-alert here -- consistent with the prior
      // behavior, which sorted by `first_seen` (also untouched by this
      // UPDATE) and so never picked a reactivated-but-old deal either.
      // is_mock is excluded here for the same reason the old code called
      // getActiveDeals with includeMock: false before alerting -- instant
      // email is the one path with no other mock guard between here and a
      // real subscriber's inbox.
      if (dealId && upserted.rows[0].is_new && !is_mock) {
        newDeals.push({
          id: dealId,
          hotelName: hotel_name,
          city: market.city,
          stars,
          photoUrl: photo_url,
          checkInWindow,
          discountPct,
          dealPriceCents: latest_price_cents,
          medianPriceCents: median_price_cents,
          snapshotCount: snapshot_count,
        })
      }
      if (dealId && (!upserted.rows[0].headline || !upserted.rows[0].description)) {
        copyCandidates.push({
          id: dealId,
          hotelName: hotel_name,
          city: market.city,
          stars,
          discountPct,
          dealPriceCents: latest_price_cents,
          medianPriceCents: median_price_cents,
          checkInWindow,
        })
      }
      dealsUpserted++
    } else if (decision.action === 'expire') {
      // Price recovered above the expiry threshold, or the snapshot history is
      // too thin to support a flag — expire any active deal for this hotel+checkin
      await query(
        `UPDATE deals SET status = 'expired', updated_at = NOW()
         WHERE hotel_id = $1 AND market_id = $2 AND check_in_date = $3 AND status = 'active'`,
        [hotel_id, market.id, checkInStr]
      )
    }
  }

  // Also expire deals whose check-in date has passed
  await query(
    `UPDATE deals SET status = 'expired', updated_at = NOW()
     WHERE market_id = $1 AND status = 'active' AND check_in_date < CURRENT_DATE`,
    [market.id]
  )

  if (copyCandidates.length > 0) {
    void generateHeadlines(copyCandidates).catch(() => undefined)
  }

  return { dealsUpserted, newDeals }
}

export type DealRow = {
  id: string
  hotel_id: string
  hotel_name: string
  stars: number | null
  review_evidence?: unknown
  photo_url: string | null
  city: string
  deal_price_cents: number
  median_price_cents: number
  currency: string
  discount_pct: number
  check_in_window: string
  check_in_date: string
  nights: number
  snapshot_count: number
  ota_links: Record<string, string>
  headline: string | null
  description: string | null
  is_mock: boolean
  first_seen: string | null
  expires_at: string | null
  updated_at: string | null
}

export type PriceHistoryPoint = {
  date: string
  price_cents: number
}

export async function getDealById(id: string): Promise<DealRow | null> {
  // tracked- ids are synthesized by getTrackedHotels() and never appear in
  // the `deals` table -- they must be resolved back through the same real
  // price_snapshots lookup that produced them in the first place.
  if (isTrackedHotelId(id)) return getTrackedDealById(id)

  const res = await query<DealRow>(
    `SELECT
       d.id, d.hotel_id, d.hotel_name, d.stars, d.review_evidence, d.photo_url,
       m.city,
       d.deal_price_cents, d.median_price_cents, d.currency, d.discount_pct,
       d.check_in_window, d.check_in_date::TEXT, d.nights,
       d.snapshot_count, d.ota_links, d.headline, d.description, d.is_mock,
       d.first_seen::TEXT, d.expires_at::TEXT, d.updated_at::TEXT
     FROM deals d
     JOIN tracked_markets m ON m.id = d.market_id
     WHERE d.id = $1`,
    [id]
  )
  return res.rows[0] ?? null
}

export async function getPriceHistory(hotelId: string, marketId?: number, currency = 'USD'): Promise<PriceHistoryPoint[]> {
  const params: unknown[] = [hotelId]
  let marketFilter = ''
  if (marketId) {
    params.push(marketId)
    marketFilter = `AND market_id = $${params.length}`
  }
  params.push(currency)
  const currencyFilter = `AND currency = $${params.length}`
  const res = await query<PriceHistoryPoint>(
    `SELECT snapshot_date::TEXT AS date, AVG(price_cents)::INT AS price_cents
     FROM price_snapshots
     WHERE hotel_id = $1
       AND captured_at >= NOW() - INTERVAL '60 days'
       ${marketFilter}
       ${currencyFilter}
     GROUP BY snapshot_date
     ORDER BY snapshot_date ASC`,
    params
  )
  return res.rows
}

export async function getActiveDeals(opts: {
  limit?: number
  offset?: number
  minDiscount?: number
  maxPriceCents?: number
  marketId?: number
  minStars?: number
  dateFrom?: string
  dateTo?: string
  sort?: HotelDealSort
  includeMock?: boolean
}): Promise<DealRow[]> {
  const {
    limit = 50,
    offset = 0,
    minDiscount = 0,
    maxPriceCents,
    marketId,
    minStars,
    dateFrom,
    dateTo,
    sort = 'newest',
    includeMock = false,
  } = opts

  const orderBy: Record<HotelDealSort, string> = {
    newest: 'd.first_seen DESC, d.id ASC',
    discount: 'd.discount_pct DESC, d.first_seen DESC, d.id ASC',
    price: 'd.deal_price_cents ASC, d.first_seen DESC, d.id ASC',
  }
  const params: unknown[] = [limit, offset, minDiscount]
  let idx = 4

  let marketFilter = ''
  if (marketId) {
    marketFilter = ` AND d.market_id = $${idx++}`
    params.push(marketId)
  }

  let priceFilter = ''
  if (maxPriceCents) {
    priceFilter = ` AND d.currency = 'USD' AND d.deal_price_cents <= $${idx++}`
    params.push(maxPriceCents)
  }

  let starsFilter = ''
  if (minStars && minStars > 0) {
    starsFilter = ` AND d.stars >= $${idx++}`
    params.push(minStars)
  }

  let dateFromFilter = ''
  if (dateFrom) {
    dateFromFilter = ` AND d.check_in_date >= $${idx++}`
    params.push(dateFrom)
  }

  let dateToFilter = ''
  if (dateTo) {
    dateToFilter = ` AND d.check_in_date <= $${idx++}`
    params.push(dateTo)
  }

  let mockFilter = ''
  if (!includeMock) {
    mockFilter = ` AND d.is_mock = false`
  }

  const res = await query<DealRow>(
    `SELECT
       d.id, d.hotel_id, d.hotel_name, d.stars, d.review_evidence, d.photo_url,
       m.city,
       d.deal_price_cents, d.median_price_cents, d.currency, d.discount_pct,
       d.check_in_window, d.check_in_date::TEXT, d.nights,
       d.snapshot_count, d.ota_links, d.headline, d.description, d.is_mock,
       d.first_seen::TEXT, d.expires_at::TEXT, d.updated_at::TEXT
     FROM deals d
     JOIN tracked_markets m ON m.id = d.market_id
     WHERE d.status = 'active'
       AND d.discount_pct >= $3
       ${marketFilter}
       ${priceFilter}
       ${starsFilter}
       ${dateFromFilter}
       ${dateToFilter}
       ${mockFilter}
     ORDER BY ${orderBy[sort]}
     LIMIT $1 OFFSET $2`,
    params
  )

  return res.rows
}

/**
 * Real, currently-tracked hotels that haven't (yet) cleared the MIN_SNAPSHOTS /
 * DEAL_THRESHOLD bar in dealRules.ts to be flagged as a confirmed "deal".
 *
 * getActiveDeals() only reads the `deals` table, which stays empty for a
 * market until a hotel+check-in pair accumulates enough history to be
 * statistically flagged — that can take days even once real snapshots are
 * flowing. Rather than filling that gap with entirely fabricated example
 * cards, this reads real snapshots directly: real hotel, real photo, real
 * current price. If there isn't yet enough history to compute a trustworthy
 * median, discount_pct comes back 0 (never a fabricated/overstated %).
 */
type TrackedSnapshotRow = {
  hotel_id: string
  hotel_name: string
  stars: number | null
  review_evidence: unknown
  photo_url: string | null
  check_in: Date
  market_id: number
  city: string
  currency: string
  median_price_cents: number
  latest_price_cents: number
  latest_captured_at: Date
  snapshot_count: number
}

// hotel_name/stars/photo_url are read from the single most recent snapshot
// via the LATERAL join, not grouped on directly — a provider occasionally
// returning a refreshed photo_url or a slightly different name for the
// same hotel_id must not fragment its price history into false-median
// sibling groups (grouping on photo_url previously caused exactly that:
// a stale, tiny group's "median" got compared against a price captured
// under a different photo_url, producing a fabricated-looking discount).
const TRACKED_SNAPSHOT_SELECT = `
  SELECT g.hotel_id, latest.hotel_name, latest.stars, latest.review_evidence, latest.photo_url,
         g.check_in, g.market_id, g.city, g.currency,
         g.median_price_cents, latest.price_cents AS latest_price_cents,
         latest.captured_at AS latest_captured_at, g.snapshot_count
  FROM (
    SELECT ps.hotel_id, ps.check_in, ps.market_id, m.city, ps.currency,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ps.price_cents)::INT AS median_price_cents,
           COUNT(*)::INT AS snapshot_count
    FROM price_snapshots ps
    JOIN tracked_markets m ON m.id = ps.market_id
    WHERE ps.is_mock = false
      AND ps.captured_at >= NOW() - INTERVAL '60 days'
      AND ps.check_in >= CURRENT_DATE
    GROUP BY ps.hotel_id, ps.check_in, ps.market_id, m.city, ps.currency
  ) g
  JOIN LATERAL (
    SELECT hotel_name, stars, review_evidence, photo_url, price_cents, captured_at
    FROM price_snapshots ps2
    WHERE ps2.hotel_id = g.hotel_id AND ps2.market_id = g.market_id AND ps2.check_in = g.check_in
      AND ps2.currency = g.currency
    ORDER BY captured_at DESC
    LIMIT 1
  ) latest ON true
  WHERE latest.photo_url IS NOT NULL
`

function mapTrackedRowToDealRow(row: TrackedSnapshotRow): DealRow {
  // A 2-point swing is as likely to be provider noise (occupancy/room-type
  // mix, a per-person vs per-room rate) as a real price change — require at
  // least 3 real observations before showing a computed discount at all.
  const hasComparableHistory = row.snapshot_count >= 3 && row.median_price_cents > 0
  const ratio = hasComparableHistory ? row.latest_price_cents / row.median_price_cents : 1
  const discountPct = ratio < 1 ? Math.round((1 - ratio) * 100) : 0
  const checkInStr = row.check_in.toISOString().slice(0, 10)
  const checkOut = new Date(row.check_in)
  checkOut.setDate(checkOut.getDate() + 2)
  const links = buildOtaLinks({
    hotelName: row.hotel_name,
    city: row.city,
    checkIn: checkInStr,
    checkOut: checkOut.toISOString().slice(0, 10),
  })
  return {
    id: `${TRACKED_HOTEL_ID_PREFIX}${row.hotel_id}-${checkInStr}`,
    hotel_id: row.hotel_id,
    hotel_name: row.hotel_name,
    stars: row.stars,
    review_evidence: row.review_evidence,
    photo_url: row.photo_url,
    city: row.city,
    deal_price_cents: row.latest_price_cents,
    // Never show an inflated "usually $X" reference for a discount we
    // can't actually back up with history — collapse it to the current
    // price so DealChip/the savings line render nothing rather than a
    // misleading comparison.
    median_price_cents: discountPct > 0 ? row.median_price_cents : row.latest_price_cents,
    currency: row.currency,
    discount_pct: discountPct,
    check_in_window: formatWindow(row.check_in, 2),
    check_in_date: checkInStr,
    nights: 2,
    snapshot_count: row.snapshot_count,
    ota_links: links,
    headline: null,
    description: null,
    is_mock: false,
    first_seen: null,
    expires_at: null,
    updated_at: row.latest_captured_at.toISOString(),
  }
}

/**
 * Real, currently-tracked hotels that haven't (yet) cleared the MIN_SNAPSHOTS /
 * DEAL_THRESHOLD bar in dealRules.ts to be flagged as a confirmed "deal".
 *
 * getActiveDeals() only reads the `deals` table, which stays empty for a
 * market until a hotel+check-in pair accumulates enough history to be
 * statistically flagged — that can take days even once real snapshots are
 * flowing. Rather than filling that gap with entirely fabricated example
 * cards, this reads real snapshots directly: real hotel, real photo, real
 * current price. If there isn't yet enough history to compute a trustworthy
 * median, discount_pct comes back 0 (never a fabricated/overstated %).
 */
export async function getTrackedHotels(opts: {
  limit?: number
  marketId?: number
}): Promise<DealRow[]> {
  const { limit = 6, marketId } = opts
  const params: unknown[] = [limit]
  let marketFilter = ''
  if (marketId) {
    marketFilter = ' AND g.market_id = $2'
    params.push(marketId)
  }

  // Rank within each market before picking the global top N — a plain global
  // sort here previously let one deep-history market (Las Vegas) fill every
  // slot and crowd out every other tracked city. Ranking per market_id first
  // interleaves cities (every market's best candidate before anyone's second)
  // while still preferring hotels with more/tighter history overall.
  const res = await query<TrackedSnapshotRow>(
    `WITH candidates AS (
       ${TRACKED_SNAPSHOT_SELECT} ${marketFilter}
     ), ranked AS (
       SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY market_id
           ORDER BY snapshot_count DESC,
             GREATEST(0, latest_price_cents::numeric / NULLIF(median_price_cents, 0)) ASC,
             latest_captured_at DESC
         ) AS market_rank
       FROM candidates
     )
     SELECT * FROM ranked
     ORDER BY
       market_rank ASC,
       snapshot_count DESC,
       GREATEST(0, latest_price_cents::numeric / NULLIF(median_price_cents, 0)) ASC,
       latest_captured_at DESC
     LIMIT $1`,
    params
  )

  return res.rows.map(mapTrackedRowToDealRow)
}

const TRACKED_DEAL_ID_PATTERN = /^(.+)-(\d{4}-\d{2}-\d{2})$/

/**
 * Resolves a tracked- synthetic id (see getTrackedHotels above) back to the
 * exact real snapshot row it was built from, so /deals/[dealId] has
 * something real to render instead of 404ing on every currently-live deal
 * card whenever the `deals` table itself is empty.
 */
export async function getTrackedDealById(id: string): Promise<DealRow | null> {
  if (!isTrackedHotelId(id)) return null

  const rest = id.slice(TRACKED_HOTEL_ID_PREFIX.length)
  const match = TRACKED_DEAL_ID_PATTERN.exec(rest)
  if (!match) return null
  const [, hotelId, checkInStr] = match

  const res = await query<TrackedSnapshotRow>(
    `${TRACKED_SNAPSHOT_SELECT} AND g.hotel_id = $1 AND g.check_in = $2::date
     LIMIT 1`,
    [hotelId, checkInStr]
  )

  const row = res.rows[0]
  return row ? mapTrackedRowToDealRow(row) : null
}
