import { query } from '@/lib/db/client'

export type Personalization = {
  active: boolean
  watchlist: string[]
  minDiscountPct: 30 | 40 | 50
  alertPreference: 'instant' | 'daily' | 'off'
}

export function normalizeMinDiscountPct(value: number): 30 | 40 | 50 {
  return value === 30 || value === 50 ? value : 40
}

/**
 * The server-held counterpart to DealFeed.tsx's own `personalizationActive`
 * concept (and the Personalization type it already defines): a signed-in,
 * onboarded user's saved watchlist should drive /deals by default, unless
 * the request already carries its own explicit intent -- a restored/shared
 * search (criteriaResolution.status === 'valid') or the "Show all deals"
 * escape hatch (?all=1) -- either of which always wins over an inferred
 * preference. minDiscountPct/alertPreference are carried through as
 * descriptive copy only (what DealFeed's subtitle already showed in its
 * dead-code form) -- they do not override the page's own, separately
 * adjustable discount/price/stars filter state.
 */
export function buildPersonalization(
  sub: { watchlist: string[]; alertMinDiscount: number; alertPreference: 'instant' | 'daily' | 'off' } | null | undefined,
  opts: { signedIn: boolean; onboardingDone: boolean; hasExplicitRequest: boolean; allOverride: boolean }
): Personalization | undefined {
  if (!opts.signedIn || !opts.onboardingDone || !sub) return undefined
  return {
    active: !opts.hasExplicitRequest && !opts.allOverride,
    watchlist: sub.watchlist,
    minDiscountPct: normalizeMinDiscountPct(sub.alertMinDiscount),
    alertPreference: sub.alertPreference,
  }
}

// Resolves a saved watchlist (city names) to the real tracked_markets ids
// getActiveDeals needs to filter by. A city that no longer matches a
// tracked market (renamed/retired) is silently dropped rather than erroring
// the whole feed -- the user still sees their other watchlisted cities.
export async function resolveWatchlistMarketIds(watchlist: string[]): Promise<number[]> {
  if (watchlist.length === 0) return []
  const res = await query<{ id: number }>(
    'SELECT id FROM tracked_markets WHERE city = ANY($1)',
    [watchlist],
  ).catch(() => ({ rows: [] as { id: number }[] }))
  return res.rows.map(row => row.id)
}
