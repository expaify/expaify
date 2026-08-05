import { auth } from '@/auth'
import { query } from './db/client'
import { getSubscription, isPremium } from './subscription'

export type PaywallContext = {
  userId: string | null
  premium: boolean
  freeUnlockedThisWeek: number
  freeUnlockLimit: number
}

const FREE_WEEKLY_LIMIT = 3

export async function getPaywallContext(): Promise<PaywallContext> {
  const session = await auth()
  if (!session?.user?.id) {
    return { userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: FREE_WEEKLY_LIMIT }
  }

  const sub = await getSubscription(session.user.id).catch(() => null)
  if (sub && isPremium(sub.status)) {
    return { userId: session.user.id, premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: FREE_WEEKLY_LIMIT }
  }

  // Count how many free unlocks already used this week (tracked client-side cookie for MVP,
  // can be server-tracked in a future sprint — free plan paywall is enforced by not returning
  // price data beyond the limit in the API)
  return {
    userId: session.user.id,
    premium: false,
    freeUnlockedThisWeek: 0,
    freeUnlockLimit: FREE_WEEKLY_LIMIT,
  }
}

// The free plan unlocks exactly 3 deals per week. The set must be deterministic
// across every query shape (sort, filters, offset) or a free caller can rotate
// more prices into view. It is also pinned to the current week: deals first seen
// before the week started, newest first, topped up with the earliest deals of the
// current week when the pre-week pool is thin. Both halves are stable for the
// whole week, so the set only changes at the week boundary.
export async function getFreeUnlockedDealIds(): Promise<Set<string>> {
  const res = await query<{ id: string }>(
    `SELECT id
     FROM deals
     WHERE status = 'active' AND is_mock = false
     ORDER BY
       (first_seen >= date_trunc('week', NOW())) ASC,
       CASE WHEN first_seen >= date_trunc('week', NOW()) THEN first_seen END ASC,
       first_seen DESC
     LIMIT ${FREE_WEEKLY_LIMIT}`
  ).catch(() => ({ rows: [] as { id: string }[] }))
  return new Set(res.rows.map((r) => r.id))
}

// Apply paywall mask to a list of deals: redact name/price outside the weekly unlock set
export function applyPaywall<T extends { id: string; hotelName: string; dealPrice: unknown; medianPrice: unknown; discountPct: number }>(
  deals: T[],
  context: PaywallContext,
  unlockedIds: Set<string>
): Array<T & { locked: boolean }> {
  if (context.premium) {
    return deals.map((d) => ({ ...d, locked: false }))
  }

  return deals.map((d) => {
    const locked = !unlockedIds.has(d.id)
    if (!locked) return { ...d, locked: false }
    return {
      ...d,
      locked: true,
      hotelName: 'Members-only deal',
      dealPrice: null,
      medianPrice: null,
    }
  })
}
