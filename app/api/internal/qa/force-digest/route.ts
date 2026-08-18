export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/client'
import { getSubscription } from '@/lib/subscription'
import {
  recordDigestSkipped,
  sendDigest,
  maxDigestDeals,
  type DigestDealRow,
} from '@/lib/email/sendDailyDigest'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.PIPELINE_SECRET ?? ''}`
  if (!process.env.PIPELINE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => null) as { email?: unknown } | null
    if (!body || typeof body.email !== 'string' || body.email.length > 320 || !EMAIL.test(body.email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }
    const email = body.email.trim().toLowerCase()
    const users = await query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email],
    )
    const user = users.rows[0]
    if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

    const subscription = await getSubscription(user.id)
    if (!subscription) return NextResponse.json({ error: 'subscription not found' }, { status: 404 })

    const deals = await query<DigestDealRow>(
      `SELECT d.id, d.hotel_name, m.city, d.stars, d.photo_url,
              d.discount_pct, d.deal_price_cents, d.median_price_cents,
              d.check_in_window, d.snapshot_count
       FROM deals d
       JOIN tracked_markets m ON m.id = d.market_id
       WHERE d.status = 'active'
         AND d.is_mock = false
         AND (d.expires_at IS NULL OR d.expires_at > NOW())
         AND d.check_in_date >= CURRENT_DATE
         AND d.discount_pct >= 30
         AND d.snapshot_count >= 8
         AND ($1::text[] = '{}'::text[] OR m.city = ANY($1::text[]))
       ORDER BY d.discount_pct DESC, d.first_seen DESC
       LIMIT $2`,
      [subscription.watchlist, maxDigestDeals(subscription.status)],
    )
    const city = subscription.watchlist.length > 0 ? subscription.watchlist.join(',') : 'everywhere'
    if (deals.rows.length === 0) {
      await recordDigestSkipped({
        status: subscription.status,
        cities: subscription.watchlist,
        path: '/api/internal/qa/force-digest',
      })
      return NextResponse.json({ sent: false, reason: 'no_deals', city })
    }

    await sendDigest({
      userId: user.id,
      email: user.email,
      unsubscribeToken: subscription.alertUnsubscribeToken,
      status: subscription.status,
      deals: deals.rows,
      analyticsPath: '/api/internal/qa/force-digest',
    })
    return NextResponse.json({
      sent: true,
      city,
      dealCount: deals.rows.length,
      dealIds: deals.rows.map(deal => deal.id),
    })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
