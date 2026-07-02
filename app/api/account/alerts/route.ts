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

  const body = (await req.json()) as { alertPreference?: string }
  const pref = body.alertPreference as AlertPref | undefined
  if (!pref || !VALID_PREFS.includes(pref)) {
    return NextResponse.json({ error: 'Invalid alertPreference' }, { status: 400 })
  }

  await upsertSubscription(session.user.id, { alertPreference: pref })
  return NextResponse.json({ ok: true })
}
