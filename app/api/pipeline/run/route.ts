export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActiveMarkets, runSnapshotsForMarket, RateLimitError } from '@/lib/pipeline/snapshot'
import { detectDealsForMarket, getActiveDeals } from '@/lib/pipeline/dealDetection'
import { sendInstantAlerts } from '@/lib/email/sendDealAlert'
import { generateHeadlines } from '@/lib/ai/generateHeadline'
import { pingIndexNow } from '@/lib/indexNow'

export const runtime = 'nodejs'
export const maxDuration = 300

const MARKET_BATCH_SIZE = 6

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.PIPELINE_SECRET ?? ''}`
  if (!process.env.PIPELINE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let markets: Awaited<ReturnType<typeof getActiveMarkets>>
  try {
    markets = await getActiveMarkets()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: `DB unavailable: ${msg}` }, { status: 503 })
  }

  const results: Record<string, unknown> = {}
  let totalNewDeals = 0
  let rateLimited = false
  let marketsAttempted = 0
  let emptyMarketCount = 0

  for (let batchStart = 0; batchStart < markets.length; batchStart += MARKET_BATCH_SIZE) {
    const batch = markets.slice(batchStart, batchStart + MARKET_BATCH_SIZE)
    await Promise.all(batch.map(async (market, batchIndex) => {
      const marketIndex = batchStart + batchIndex
      try {
        const snapshots = await runSnapshotsForMarket(market, marketIndex)
        const dealsFound = await detectDealsForMarket(market)
        results[market.iata] = { snapshots, dealsFound }
        totalNewDeals += dealsFound
        marketsAttempted += 1
        // A market is "empty" this run if every check-in it attempted came back
        // with zero hotels processed -- previously invisible, since a market
        // returning 0 hotels was never distinguished from one that worked
        // normally. See REPAIR-PIPELINE-SILENT-FAILURE-VISIBILITY-01.
        if (snapshots.every(s => s.hotelsProcessed === 0)) emptyMarketCount += 1
      } catch (err) {
        results[market.iata] = { error: err instanceof Error ? err.message : String(err) }
        marketsAttempted += 1
        emptyMarketCount += 1
        if (err instanceof RateLimitError) rateLimited = true
      }
    }))

    // Finish the current in-flight batch, but do not start more provider calls
    // after the shared RapidAPI quota reports that it is exhausted.
    if (rateLimited) break
  }

  // More than half of attempted markets came back with nothing. This is the
  // exact shape of the silent 2026-07-06 to 2026-07-27 outage: every provider
  // failing (or returning empty) for most markets, night after night, while
  // the pipeline itself never threw and always reported ok:true. A single
  // market returning 0 is not unusual; most/all of them doing so, especially
  // repeatedly, means the pipeline is not actually doing its job.
  const pipelineDegraded = marketsAttempted > 0 && emptyMarketCount / marketsAttempted > 0.5

  // Generate AI headlines for deals missing one
  const headlineCandidates = await getActiveDeals({ limit: 20, sort: 'newest', includeMock: false })
    .then(rows => rows.filter(r => !r.headline))
    .catch(() => [])
  void generateHeadlines(
    headlineCandidates.map(d => ({
      id: d.id,
      hotelName: d.hotel_name,
      city: d.city,
      stars: d.stars,
      discountPct: d.discount_pct,
      dealPriceCents: d.deal_price_cents,
      medianPriceCents: d.median_price_cents,
      checkInWindow: d.check_in_window,
    }))
  ).catch(() => { /* non-fatal — headlines are cosmetic */ })

  // Send instant alerts for the top new deal (if any)
  let alertsSent = 0
  try {
    if (totalNewDeals > 0) {
      const topDeals = await getActiveDeals({ limit: 1, sort: 'newest', includeMock: false })
      if (topDeals[0]) {
        const d = topDeals[0]
        alertsSent = await sendInstantAlerts({
          id: d.id,
          hotelName: d.hotel_name,
          city: d.city,
          stars: d.stars,
          photoUrl: d.photo_url,
          checkInWindow: d.check_in_window,
          discountPct: d.discount_pct,
          dealPriceCents: d.deal_price_cents,
          medianPriceCents: d.median_price_cents,
          snapshotCount: d.snapshot_count,
        })
      }
    }
  } catch (err) {
    results['_alerts'] = { error: err instanceof Error ? err.message : String(err) }
  }

  // Ping Bing/Yandex's instant-indexing endpoint for newly published deal
  // pages -- best-effort, never blocks or fails the pipeline response.
  if (totalNewDeals > 0) {
    try {
      const newest = await getActiveDeals({ limit: Math.min(totalNewDeals, 100), sort: 'newest', includeMock: false })
      const urls = newest.map(d => `https://expaify.com/deals/${d.id}`)
      urls.push('https://expaify.com/deals')
      void pingIndexNow(urls)
    } catch {
      // non-fatal — indexing pings are cosmetic
    }
  }

  return NextResponse.json({
    ok: true,
    markets: markets.length,
    totalNewDeals,
    alertsSent,
    rateLimited,
    emptyMarketCount,
    marketsAttempted,
    pipelineDegraded,
    results,
  })
}
