export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDealById, getPriceHistory } from '@/lib/pipeline/dealDetection'
import { query } from '@/lib/db/client'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  const deal = await getDealById(id).catch(() => null)
  if (!deal) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Resolve market_id for price history
  const mktRes = await query<{ id: number }>(
    'SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1',
    [deal.city]
  ).catch(() => ({ rows: [] as { id: number }[] }))
  const marketId = mktRes.rows[0]?.id

  const history = await getPriceHistory(deal.hotel_id, marketId).catch(() => [])

  return NextResponse.json({ deal, history })
}
