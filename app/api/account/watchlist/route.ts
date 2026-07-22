export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db/client'
import { getSubscription, isPremium } from '@/lib/subscription'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'

const TRACKED_CITIES = new Set(TRACKED_MARKET_NAMES)

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sub = await getSubscription(session.user.id).catch(() => null)
  if (!sub || !isPremium(sub.status)) {
    return NextResponse.json({ error: 'premium required' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    watchlist?: unknown
    op?: unknown
    city?: unknown
  } | null
  if (!body) {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }

  const hasReplacement = Object.prototype.hasOwnProperty.call(body, 'watchlist')
  const hasOperation = Object.prototype.hasOwnProperty.call(body, 'op') || Object.prototype.hasOwnProperty.call(body, 'city')
  if (hasReplacement === hasOperation) {
    return NextResponse.json({ error: 'provide either watchlist or op and city' }, { status: 400 })
  }

  if (hasReplacement) {
    if (!Array.isArray(body.watchlist)) {
      return NextResponse.json({ error: 'watchlist must be an array' }, { status: 400 })
    }
    if (
      body.watchlist.length > 10 ||
      body.watchlist.some(city => typeof city !== 'string' || !TRACKED_CITIES.has(city)) ||
      new Set(body.watchlist).size !== body.watchlist.length
    ) {
      return NextResponse.json({ error: 'invalid watchlist' }, { status: 400 })
    }

    const watchlist = body.watchlist as string[]
    await query(
      `UPDATE subscriptions SET watchlist = $1, updated_at = NOW() WHERE user_id = $2`,
      [watchlist, session.user.id]
    )
    return NextResponse.json({ ok: true, watchlist })
  }

  if ((body.op !== 'add' && body.op !== 'remove') || typeof body.city !== 'string' || !TRACKED_CITIES.has(body.city)) {
    return NextResponse.json({ error: 'invalid watchlist operation' }, { status: 400 })
  }

  const result = body.op === 'add'
    ? await query<{ watchlist: string[] }>(
        `UPDATE subscriptions
         SET watchlist = CASE
               WHEN $1 = ANY(watchlist) THEN watchlist
               ELSE array_append(watchlist, $1)
             END,
             updated_at = NOW()
         WHERE user_id = $2
           AND ($1 = ANY(watchlist) OR COALESCE(array_length(watchlist, 1), 0) < 10)
         RETURNING watchlist`,
        [body.city, session.user.id]
      )
    : await query<{ watchlist: string[] }>(
        `UPDATE subscriptions
         SET watchlist = array_remove(watchlist, $1), updated_at = NOW()
         WHERE user_id = $2
         RETURNING watchlist`,
        [body.city, session.user.id]
      )

  const watchlist = result.rows[0]?.watchlist
  if (!watchlist && body.op === 'add') {
    return NextResponse.json({ error: 'watchlist_full' }, { status: 400 })
  }
  if (!watchlist) {
    return NextResponse.json({ error: 'subscription not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, watchlist })
}
