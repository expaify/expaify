export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db/client'
import { getSubscription, isPremium } from '@/lib/subscription'
import { CITY_NAMES } from '@/lib/cities'

const CITIES = new Set(CITY_NAMES)

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sub = await getSubscription(session.user.id).catch(() => null)
  if (!sub || !isPremium(sub.status)) {
    return NextResponse.json({ error: 'premium required' }, { status: 403 })
  }

  const body = (await req.json()) as { watchlist?: unknown }
  if (!Array.isArray(body.watchlist)) {
    return NextResponse.json({ error: 'watchlist must be an array' }, { status: 400 })
  }

  const watchlist = body.watchlist
    .filter((c): c is string => typeof c === 'string' && CITIES.has(c))
    .slice(0, 10)

  await query(
    `UPDATE subscriptions SET watchlist = $1, updated_at = NOW() WHERE user_id = $2`,
    [watchlist, session.user.id]
  )

  return NextResponse.json({ ok: true, watchlist })
}
