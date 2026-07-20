import { query } from '../db/client'
import { generateHeadlines } from '../ai/generateHeadline'
import { buildOtaLinks } from './otaLinks'
import { evaluateDeal } from './dealRules'

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
  sort?: 'newest' | 'discount'
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

  const orderBy = sort === 'discount' ? 'discount_pct DESC, first_seen DESC' : 'first_seen DESC'
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
     ORDER BY ${orderBy}
     LIMIT $1 OFFSET $2`,
    params
  )

  return res.rows
}
