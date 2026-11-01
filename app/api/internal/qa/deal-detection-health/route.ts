export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isValidPipelineSecret } from '@/lib/pipeline/auth'
import { getActiveMarkets } from '@/lib/pipeline/snapshot'
import { getMarketSnapshotStats, type SnapshotRow } from '@/lib/pipeline/dealDetection'
import { evaluateDeal, MIN_SNAPSHOTS, DEAL_THRESHOLD, EXPIRE_THRESHOLD } from '@/lib/pipeline/dealRules'

function stayKey(row: SnapshotRow): string {
  const checkIn = row.check_in instanceof Date ? row.check_in.toISOString().slice(0, 10) : String(row.check_in)
  return `${row.hotel_id}\u0000${checkIn}`
}

export async function GET(req: NextRequest) {
  if (!isValidPipelineSecret(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const iataFilter = req.nextUrl.searchParams.get('iata')?.toUpperCase()
  const markets = await getActiveMarkets()
  const selected = iataFilter ? markets.filter((m) => m.iata === iataFilter) : markets

  const perMarket: Record<string, unknown> = {}

  for (const market of selected) {
    const snaps = await getMarketSnapshotStats(market.id)

    // Mirror detectDealsForMarket's own currency-exclusion exactly, so this
    // diagnostic never reports a stay as "comparable" that the real
    // detector would have excluded.
    const currenciesByStay = new Map<string, Set<string>>()
    for (const row of snaps.rows) {
      const key = stayKey(row)
      const set = currenciesByStay.get(key) ?? new Set<string>()
      set.add(row.currency)
      currenciesByStay.set(key, set)
    }
    let multiCurrencyExcluded = 0
    const comparable = snaps.rows.filter((row) => {
      const ok = currenciesByStay.get(stayKey(row))?.size === 1
      if (!ok) multiCurrencyExcluded++
      return ok
    })

    const depthBuckets = { belowMinSnapshots: 0, atOrAboveMinSnapshots: 0 }
    const decisionBuckets = { flag: 0, hold: 0, expire: 0 }
    type Example = {
      hotel_id: string
      check_in: string
      snapshot_count: number
      median_price_cents: number
      latest_price_cents: number
      ratio: number | null
    }
    const candidateExamples: Example[] = []

    for (const row of comparable) {
      if (row.snapshot_count < MIN_SNAPSHOTS) depthBuckets.belowMinSnapshots++
      else depthBuckets.atOrAboveMinSnapshots++

      const decision = evaluateDeal({
        latestPriceCents: row.latest_price_cents,
        medianPriceCents: row.median_price_cents,
        snapshotCount: row.snapshot_count,
      })
      decisionBuckets[decision.action === 'flag' ? 'flag' : decision.action === 'hold' ? 'hold' : 'expire']++

      const ratio = row.median_price_cents > 0 ? Math.round((row.latest_price_cents / row.median_price_cents) * 1000) / 1000 : null
      candidateExamples.push({
        hotel_id: row.hotel_id,
        check_in: row.check_in instanceof Date ? row.check_in.toISOString().slice(0, 10) : String(row.check_in),
        snapshot_count: row.snapshot_count,
        median_price_cents: row.median_price_cents,
        latest_price_cents: row.latest_price_cents,
        ratio,
      })
    }
    // Fisher-Yates shuffle, then cap -- a uniformly random sample instead of
    // "whatever order Postgres returned rows in," so this diagnostic can
    // actually surface a real per-provider skew if one exists, rather than
    // always reflecting the SQL engine's incidental row order.
    for (let i = candidateExamples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidateExamples[i], candidateExamples[j]] = [candidateExamples[j], candidateExamples[i]]
    }
    const examples = candidateExamples.slice(0, 5)

    perMarket[market.iata] = {
      totalStayGroups: snaps.rows.length,
      comparableAfterCurrencyFilter: comparable.length,
      multiCurrencyExcluded,
      depthBuckets,
      decisionBuckets,
      thresholds: { MIN_SNAPSHOTS, DEAL_THRESHOLD, EXPIRE_THRESHOLD },
      examples,
    }
  }

  return NextResponse.json({ ok: true, marketsChecked: selected.map((m) => m.iata), results: perMarket })
}
