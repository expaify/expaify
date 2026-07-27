/**
 * Deterministic deal-decision rules (EXP-AGENT-3-PRICE-PIPELINE-001).
 *
 * Pure function — no DB, no I/O — so the flag/expire thresholds and the
 * minimum-history guarantee ("below 8 snapshots never flag") are unit-testable.
 * dealDetection.ts feeds it per-hotel stats computed from stored snapshots.
 */

export const DEAL_THRESHOLD = 0.70    // price must be ≤ 70% of median to flag
export const EXPIRE_THRESHOLD = 0.85  // price back above 85% of median → expire
export const MIN_SNAPSHOTS = 8        // below this history depth, never flag

export type DealStats = {
  latestPriceCents: number
  medianPriceCents: number
  snapshotCount: number
}

export type DealDecision =
  | { action: 'flag'; discountPct: number }
  | { action: 'expire' }
  | { action: 'hold' }

export function evaluateDeal(stats: DealStats): DealDecision {
  const { latestPriceCents, medianPriceCents, snapshotCount } = stats

  // Thin or degenerate history: never flag, and retire any deal that was
  // flagged on data this thin — an active deal below the floor would violate
  // the "below 8 snapshots never flag" guarantee.
  if (snapshotCount < MIN_SNAPSHOTS) return { action: 'expire' }
  if (medianPriceCents <= 0 || latestPriceCents <= 0) return { action: 'expire' }

  const ratio = latestPriceCents / medianPriceCents

  if (ratio <= DEAL_THRESHOLD) {
    return { action: 'flag', discountPct: Math.round((1 - ratio) * 100) }
  }
  if (ratio > EXPIRE_THRESHOLD) {
    return { action: 'expire' }
  }
  // Between thresholds: keep existing state (hysteresis band).
  return { action: 'hold' }
}
