import { NextRequest, NextResponse } from 'next/server'
import { getActiveMarkets, runSnapshotsForMarket } from '@/lib/pipeline/snapshot'
import { detectDealsForMarket } from '@/lib/pipeline/dealDetection'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min — Vercel Pro limit

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.PIPELINE_SECRET ?? ''}`
  if (!process.env.PIPELINE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const markets = await getActiveMarkets()
  const results: Record<string, unknown> = {}

  for (const market of markets) {
    try {
      const snapshots = await runSnapshotsForMarket(market)
      const dealsFound = await detectDealsForMarket(market)
      results[market.iata] = { snapshots, dealsFound }
    } catch (err) {
      results[market.iata] = { error: err instanceof Error ? err.message : String(err) }
    }
  }

  return NextResponse.json({ ok: true, markets: markets.length, results })
}
