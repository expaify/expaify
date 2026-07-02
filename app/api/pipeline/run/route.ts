export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActiveMarkets, runSnapshotsForMarket } from '@/lib/pipeline/snapshot'
import { detectDealsForMarket, getActiveDeals } from '@/lib/pipeline/dealDetection'
import { sendInstantAlerts } from '@/lib/email/sendDealAlert'
import { generateHeadlines } from '@/lib/ai/generateHeadline'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.PIPELINE_SECRET ?? ''}`
  if (!process.env.PIPELINE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const markets = await getActiveMarkets()
  const results: Record<string, unknown> = {}
  let totalNewDeals = 0

  for (let mi = 0; mi < markets.length; mi++) {
    const market = markets[mi]
    try {
      const snapshots = await runSnapshotsForMarket(market, mi)
      const dealsFound = await detectDealsForMarket(market)
      results[market.iata] = { snapshots, dealsFound }
      totalNewDeals += dealsFound
    } catch (err) {
      results[market.iata] = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Generate AI headlines for deals missing one
  const headlineCandidates = await getActiveDeals({ limit: 20, sort: 'newest', includeMock: false })
    .then(rows => rows.filter(r => !r.headline))
    .catch(() => [])
  await generateHeadlines(
    headlineCandidates.map(d => ({
      id: d.id,
      hotelName: d.hotel_name,
      city: d.city,
      discountPct: d.discount_pct,
      dealPriceCents: d.deal_price_cents,
    }))
  )

  // Send instant alerts for the top new deal (if any)
  let alertsSent = 0
  if (totalNewDeals > 0) {
    const topDeals = await getActiveDeals({ limit: 1, sort: 'newest', includeMock: false })
    if (topDeals[0]) {
      const d = topDeals[0]
      alertsSent = await sendInstantAlerts({
        id: d.id,
        hotelName: d.hotel_name,
        city: d.city,
        stars: d.stars,
        checkInWindow: d.check_in_window,
        discountPct: d.discount_pct,
        dealPriceCents: d.deal_price_cents,
        medianPriceCents: d.median_price_cents,
        snapshotCount: d.snapshot_count,
      })
    }
  }

  return NextResponse.json({ ok: true, markets: markets.length, totalNewDeals, alertsSent, results })
}
