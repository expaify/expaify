export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { upsertSubscription, isPremium, getSubscription } from '@/lib/subscription'

const VALID_PREFS = ['instant', 'daily', 'off'] as const
type AlertPref = (typeof VALID_PREFS)[number]

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sub = await getSubscription(session.user.id)
  if (!sub || !isPremium(sub.status)) {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    alertPreference?: string
    alertMinDiscount?: unknown
    alertTimezone?: unknown
  } | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const hasPreference = body.alertPreference !== undefined
  const hasMinDiscount = body.alertMinDiscount !== undefined
  const hasTimezone = body.alertTimezone !== undefined
  if (!hasPreference && !hasMinDiscount && !hasTimezone) {
    return NextResponse.json({ error: 'No alert settings provided' }, { status: 400 })
  }

  const pref = body.alertPreference as AlertPref | undefined
  if (hasPreference && (!pref || !VALID_PREFS.includes(pref))) {
    return NextResponse.json({ error: 'Invalid alertPreference' }, { status: 400 })
  }

  const patch: Parameters<typeof upsertSubscription>[1] = {}
  if (pref) patch.alertPreference = pref
  if (hasMinDiscount) {
    const min = Number(body.alertMinDiscount)
    if (!Number.isInteger(min) || min < 0 || min > 90) {
      return NextResponse.json({ error: 'Invalid alertMinDiscount' }, { status: 400 })
    }
    patch.alertMinDiscount = min
  }
  if (hasTimezone) {
    if (typeof body.alertTimezone !== 'string' || body.alertTimezone.length > 64) {
      return NextResponse.json({ error: 'Invalid alertTimezone' }, { status: 400 })
    }
    patch.alertTimezone = body.alertTimezone
  }

  await upsertSubscription(session.user.id, patch)
  return NextResponse.json({ ok: true })
}
