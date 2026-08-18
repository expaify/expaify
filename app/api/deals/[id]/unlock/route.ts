export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDealById } from '@/lib/pipeline/dealDetection'
import { getSubscription, isPremium } from '@/lib/subscription'
import { withTransaction, query } from '@/lib/db/client'
import { unlockDealForUser } from '@/lib/dealUnlocks'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const sub = await getSubscription(userId).catch(() => null)
  if (isPremium(sub?.status ?? 'free')) return NextResponse.json({ ok: true, alreadyUnlocked: true, premium: true })

  const deal = await getDealById(id).catch(() => null)
  if (!deal || deal.is_mock) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const result = await withTransaction(client => unlockDealForUser(client, userId, deal.id))
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 429 })

  if (!result.alreadyUnlocked) {
    try {
      await query(
        `INSERT INTO analytics_events
          (event_id, session_id, event_name, occurred_at, path, properties)
         VALUES ($1, $2, 'unlock_used', NOW(), $3, $4::jsonb)`,
        [crypto.randomUUID(), crypto.randomUUID(), `/api/deals/${deal.id}/unlock`, JSON.stringify({ deal_id: deal.id, remaining: result.remaining })],
      )
    } catch (error) {
      console.warn('Personal unlock analytics unavailable', error)
    }
  }

  return NextResponse.json({
    ok: true,
    alreadyUnlocked: result.alreadyUnlocked,
    remaining: result.remaining,
    deal: {
      id: deal.id, hotelId: deal.hotel_id, hotelName: deal.hotel_name, stars: deal.stars,
      photoUrl: deal.photo_url, city: deal.city, dealPriceCents: deal.deal_price_cents,
      medianPriceCents: deal.median_price_cents, discountPct: deal.discount_pct,
      checkInWindow: deal.check_in_window, checkInDate: deal.check_in_date, nights: deal.nights,
      snapshotCount: deal.snapshot_count, otaLinks: deal.ota_links, headline: deal.headline,
      isMock: deal.is_mock, firstSeen: deal.first_seen, updatedAt: deal.updated_at, locked: false,
    },
  })
}
