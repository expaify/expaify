export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActiveMarkets, runSnapshotsForMarket } from '@/lib/pipeline/snapshot'
import { detectDealsForMarket, getActiveDeals, type NewDealAlert } from '@/lib/pipeline/dealDetection'
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
  const allNewDeals: NewDealAlert[] = []
  let totalNewDeals = 0
  let rateLimitedCount = 0
  let marketsAttempted = 0
  let emptyMarketCount = 0

  for (let batchStart = 0; batchStart < markets.length; batchStart += MARKET_BATCH_SIZE) {
    const batch = markets.slice(batchStart, batchStart + MARKET_BATCH_SIZE)
    await Promise.all(batch.map(async (market, batchIndex) => {
      const marketIndex = batchStart + batchIndex
      try {
        const snapshots = await runSnapshotsForMarket(market, marketIndex)
        const { dealsUpserted, newDeals } = await detectDealsForMarket(market)
        results[market.iata] = { snapshots, dealsFound: dealsUpserted, newDealCount: newDeals.length }
        totalNewDeals += dealsUpserted
        allNewDeals.push(...newDeals)
        rateLimitedCount += snapshots.reduce((count, snapshot) => count + (snapshot.rateLimitedCount ?? 0), 0)
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
      }
    }))
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

  // Send instant alerts for every genuinely new deal found tonight -- this
  // used to alert on only the single newest deal system-wide regardless of
  // how many actually qualified, so subscribers missed almost everything
  // that didn't happen to be the most recent insert. sendInstantAlerts
  // already applies each recipient's own watchlist/threshold/daily-cap
  // filtering per deal, so fanning out here is just "ask it for every deal,"
  // not "guess who wants which one." Each deal is isolated in its own
  // try/catch so one failure can't suppress alerts for the rest of the night.
  // A recipient's daily instant cap (MAX_INSTANT_PER_DAY in sendDealAlert.ts)
  // is evaluated per deal as this loop runs, so send order decides which
  // deals "win" a spot for anyone with several new matches tonight. Sort
  // best-discount-first so that cap is spent on the strongest drops, not
  // whatever order markets happened to finish in.
  const sortedNewDeals = [...allNewDeals].sort((a, b) => b.discountPct - a.discountPct)

  let alertsSent = 0
  const alertErrors: string[] = []
  for (const deal of sortedNewDeals) {
    try {
      alertsSent += await sendInstantAlerts(deal)
    } catch (err) {
      alertErrors.push(`${deal.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (alertErrors.length > 0) results['_alerts'] = { errors: alertErrors }

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
    rateLimitedCount,
    emptyMarketCount,
    marketsAttempted,
    pipelineDegraded,
    results,
  })
}
