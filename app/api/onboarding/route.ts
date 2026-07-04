export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import { upsertSubscription } from '@/lib/subscription'

const VALID_ALERT_PREFS = ['instant', 'daily', 'off'] as const
const VALID_DISCOUNTS = [30, 40, 50] as const

type AlertPref = (typeof VALID_ALERT_PREFS)[number]
type MinDiscountPct = (typeof VALID_DISCOUNTS)[number]

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    alertPreference?: unknown
    minDiscountPct?: unknown
    watchlist?: unknown
    everywhere?: unknown
  }

  const alertPreference = parseAlertPreference(body.alertPreference)
  const minDiscountPct = parseMinDiscountPct(body.minDiscountPct)
  if (!alertPreference || !minDiscountPct) {
    return NextResponse.json({ error: 'Invalid onboarding preferences' }, { status: 400 })
  }

  const watchlist = normalizeWatchlist(body.watchlist, body.everywhere === true)

  await upsertSubscription(session.user.id, {
    alertPreference,
    minDiscountPct,
    watchlist,
    onboardingDone: true,
  })

  return NextResponse.json({ ok: true, alertPreference, minDiscountPct, watchlist })
}

function parseAlertPreference(value: unknown): AlertPref | null {
  if (typeof value !== 'string') return null
  return VALID_ALERT_PREFS.includes(value as AlertPref) ? (value as AlertPref) : null
}

function parseMinDiscountPct(value: unknown): MinDiscountPct | null {
  if (typeof value !== 'number') return null
  return VALID_DISCOUNTS.includes(value as MinDiscountPct) ? (value as MinDiscountPct) : null
}

function normalizeWatchlist(value: unknown, everywhere: boolean): string[] {
  if (everywhere) return []
  if (!Array.isArray(value)) return []

  const selected = value.filter(
    (city): city is string => typeof city === 'string' && TRACKED_MARKET_NAMES.includes(city)
  )

  return selected.length > 0 ? Array.from(new Set(selected)).slice(0, 10) : []
}
