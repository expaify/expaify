import { auth } from '@/auth'
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

// Apply paywall mask to a list of deals: redact name/price beyond free limit
export function applyPaywall<T extends { id: string; hotelName: string; dealPrice: unknown; medianPrice: unknown; discountPct: number }>(
  deals: T[],
  context: PaywallContext
): Array<T & { locked: boolean }> {
  if (context.premium) {
    return deals.map((d) => ({ ...d, locked: false }))
  }

  return deals.map((d, i) => {
    const locked = i >= FREE_WEEKLY_LIMIT
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
