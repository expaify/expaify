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

// TEMPORARY: writes one row per call to debug a paywall bug where an active
// subscriber still sees the free-tier paywall. Never throws — must not affect
// the real paywall decision. Remove this and the _debug_paywall_log table
// once the bug is found (see DEV-PAYWALL-PREMIUM-NOT-DETECTED-01).
async function logPaywallDebug(row: {
  hadSession: boolean
  userId: string | null
  subFound: boolean
  subStatus: string | null
  subError: string | null
  premiumResult: boolean
}): Promise<void> {
  try {
    await query(
      `INSERT INTO _debug_paywall_log (had_session, user_id, sub_found, sub_status, sub_error, premium_result)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [row.hadSession, row.userId, row.subFound, row.subStatus, row.subError, row.premiumResult]
    )
  } catch {
    // best-effort only
  }
}

export async function getPaywallContext(): Promise<PaywallContext> {
  const session = await auth()
  if (!session?.user?.id) {
    void logPaywallDebug({ hadSession: false, userId: null, subFound: false, subStatus: null, subError: null, premiumResult: false })
    return { userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: FREE_WEEKLY_LIMIT }
  }

  let subError: string | null = null
  const sub = await getSubscription(session.user.id).catch((err) => {
    subError = err instanceof Error ? err.message : String(err)
    return null
  })
  if (sub && isPremium(sub.status)) {
    void logPaywallDebug({ hadSession: true, userId: session.user.id, subFound: true, subStatus: sub.status, subError, premiumResult: true })
    return { userId: session.user.id, premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: FREE_WEEKLY_LIMIT }
  }
  void logPaywallDebug({ hadSession: true, userId: session.user.id, subFound: !!sub, subStatus: sub?.status ?? null, subError, premiumResult: false })

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
