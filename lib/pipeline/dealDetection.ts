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
  photo_url: string | null
  check_in: Date
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

export async function detectDealsForMarket(market: Market): Promise<number> {
  // Get rolling 60-day stats per hotel+check_in for this market
  const snaps = await query<SnapshotRow>(
    `SELECT
       hotel_id,
       hotel_name,
       stars,
       photo_url,
       check_in,
       AVG(price_cents)::INT                                          AS avg_price_cents,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_cents)::INT AS median_price_cents,
       (SELECT price_cents FROM price_snapshots ps2
        WHERE ps2.hotel_id = ps.hotel_id AND ps2.market_id = ps.market_id AND ps2.check_in = ps.check_in
        ORDER BY captured_at DESC LIMIT 1)                           AS latest_price_cents,
       COUNT(*)::INT                                                  AS snapshot_count,
       bool_or(is_mock)                                              AS is_mock
     FROM price_snapshots ps
     WHERE market_id = $1
       AND captured_at >= NOW() - INTERVAL '60 days'
       AND check_in >= CURRENT_DATE
     GROUP BY hotel_id, hotel_name, stars, photo_url, check_in, market_id`,
    [market.id]
  )

  let dealsUpserted = 0
  const copyCandidates: CopyCandidate[] = []

  for (const row of snaps.rows) {
    const { hotel_id, hotel_name, stars, photo_url, check_in, median_price_cents, latest_price_cents, snapshot_count, is_mock } = row

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
      const upserted = await query<{ id: string; headline: string | null; description: string | null }>(
        `INSERT INTO deals
           (hotel_id, hotel_name, stars, photo_url, market_id, deal_price_cents,
            median_price_cents, discount_pct, check_in_window, check_in_date, nights,
            snapshot_count, ota_links, status, is_mock, expires_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,2,$11,$12,'active',$13,
                 $10::DATE + INTERVAL '90 days', NOW())
         ON CONFLICT (hotel_id, market_id, check_in_date) DO UPDATE SET
           deal_price_cents   = EXCLUDED.deal_price_cents,
           median_price_cents = EXCLUDED.median_price_cents,
           discount_pct       = EXCLUDED.discount_pct,
           snapshot_count     = EXCLUDED.snapshot_count,
           ota_links          = EXCLUDED.ota_links,
           status             = 'active',
           is_mock            = EXCLUDED.is_mock,
           updated_at         = NOW()
         RETURNING id, headline, description`,
        [
          hotel_id, hotel_name, stars, photo_url, market.id,
          latest_price_cents, median_price_cents, discountPct,
          checkInWindow, checkInStr,
          snapshot_count, JSON.stringify(links), is_mock,
        ]
      )
      const dealId = upserted.rows[0]?.id
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

  return dealsUpserted
}

export type DealRow = {
  id: string
  hotel_id: string
  hotel_name: string
  stars: number | null
  photo_url: string | null
  city: string
  deal_price_cents: number
  median_price_cents: number
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
       d.id, d.hotel_id, d.hotel_name, d.stars, d.photo_url,
       m.city,
       d.deal_price_cents, d.median_price_cents, d.discount_pct,
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

export async function getPriceHistory(hotelId: string, marketId?: number): Promise<PriceHistoryPoint[]> {
  const res = await query<PriceHistoryPoint>(
    `SELECT snapshot_date::TEXT AS date, AVG(price_cents)::INT AS price_cents
     FROM price_snapshots
     WHERE hotel_id = $1
       AND captured_at >= NOW() - INTERVAL '60 days'
       ${marketId ? 'AND market_id = $2' : ''}
     GROUP BY snapshot_date
     ORDER BY snapshot_date ASC`,
    marketId ? [hotelId, marketId] : [hotelId]
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
    priceFilter = ` AND d.deal_price_cents <= $${idx++}`
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
       d.id, d.hotel_id, d.hotel_name, d.stars, d.photo_url,
       m.city,
       d.deal_price_cents, d.median_price_cents, d.discount_pct,
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
  photo_url: string | null
  check_in: Date
  market_id: number
  city: string
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
  SELECT g.hotel_id, latest.hotel_name, latest.stars, latest.photo_url,
         g.check_in, g.market_id, g.city,
         g.median_price_cents, latest.price_cents AS latest_price_cents,
         latest.captured_at AS latest_captured_at, g.snapshot_count
  FROM (
    SELECT ps.hotel_id, ps.check_in, ps.market_id, m.city,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ps.price_cents)::INT AS median_price_cents,
           COUNT(*)::INT AS snapshot_count
    FROM price_snapshots ps
    JOIN tracked_markets m ON m.id = ps.market_id
    WHERE ps.is_mock = false
      AND ps.captured_at >= NOW() - INTERVAL '60 days'
      AND ps.check_in >= CURRENT_DATE
    GROUP BY ps.hotel_id, ps.check_in, ps.market_id, m.city
  ) g
  JOIN LATERAL (
    SELECT hotel_name, stars, photo_url, price_cents, captured_at
    FROM price_snapshots ps2
    WHERE ps2.hotel_id = g.hotel_id AND ps2.market_id = g.market_id AND ps2.check_in = g.check_in
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
    photo_url: row.photo_url,
    city: row.city,
    deal_price_cents: row.latest_price_cents,
    // Never show an inflated "usually $X" reference for a discount we
    // can't actually back up with history — collapse it to the current
    // price so DealChip/the savings line render nothing rather than a
    // misleading comparison.
    median_price_cents: discountPct > 0 ? row.median_price_cents : row.latest_price_cents,
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

  const res = await query<TrackedSnapshotRow>(
    `${TRACKED_SNAPSHOT_SELECT} ${marketFilter}
     ORDER BY
       g.snapshot_count DESC,
       GREATEST(0, latest.price_cents::numeric / NULLIF(g.median_price_cents, 0)) ASC,
       latest.captured_at DESC
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
