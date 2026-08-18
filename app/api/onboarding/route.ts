export const dynamic = 'force-dynamic'

import { after, NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'
import { syncFreeSubscriber } from '@/lib/mailchimp'
import { sendFreeWelcome } from '@/lib/email/sendFreeWelcome'
import {
  getSubscription,
  isPremium,
  upsertSubscription,
} from '@/lib/subscription'
import { FREE_WATCHLIST_CAP, PREMIUM_WATCHLIST_CAP } from '@/lib/alertLimits'

const VALID_ALERT_PREFS = ['instant', 'daily', 'off'] as const
const VALID_DISCOUNTS = [30, 40, 50] as const

type AlertPref = (typeof VALID_ALERT_PREFS)[number]
type MinDiscountPct = (typeof VALID_DISCOUNTS)[number]

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const sub = await getSubscription(userId).catch(() => null)
  const firstCompletion = !sub?.onboardingDone
  const premium = isPremium(sub?.status ?? 'free')

  const body = (await req.json()) as {
    alertPreference?: unknown
    minDiscountPct?: unknown
    watchlist?: unknown
    everywhere?: unknown
  }

  let alertPreference = parseAlertPreference(body.alertPreference)
  const minDiscountPct = parseMinDiscountPct(body.minDiscountPct)
  if (!alertPreference || !minDiscountPct) {
    return NextResponse.json({ error: 'Invalid onboarding preferences' }, { status: 400 })
  }

  if (!premium && alertPreference === 'instant') alertPreference = 'daily'

  const watchlist = normalizeWatchlist(
    body.watchlist,
    body.everywhere === true,
    premium ? PREMIUM_WATCHLIST_CAP : FREE_WATCHLIST_CAP
  )

  await upsertSubscription(userId, {
    alertPreference,
    minDiscountPct,
    watchlist,
    onboardingDone: true,
  })

  const email = session.user.email
  if (!premium && email && firstCompletion) {
    const city = watchlist[0] ? (CITY_DISPLAY_TO_SLUG[watchlist[0]] ?? 'everywhere') : 'everywhere'
    after(async () => {
      try {
        await syncFreeSubscriber({ email, city, source: 'onboarding' })
      } catch (error) {
        console.warn('Mailchimp free subscriber sync failed', error)
      }
      try {
        const saved = await getSubscription(userId)
        if (saved) await sendFreeWelcome({ email, city: watchlist[0] ?? 'Everywhere', unsubscribeToken: saved.alertUnsubscribeToken })
      } catch (error) {
        console.warn('Free welcome email failed', error)
      }
    })
  }

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

function normalizeWatchlist(value: unknown, everywhere: boolean, maxCities: number): string[] {
  if (everywhere) return []
  if (!Array.isArray(value)) return []

  const selected = value.filter(
    (city): city is string => typeof city === 'string' && TRACKED_MARKET_NAMES.includes(city)
  )

  return selected.length > 0 ? Array.from(new Set(selected)).slice(0, maxCities) : []
}
