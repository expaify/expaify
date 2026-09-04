import type { PoolClient } from 'pg'
import { FREE_WEEKLY_LIMIT } from './paywall'

export type UnlockResult =
  | { ok: true; alreadyUnlocked: boolean; remaining: number }
  | { ok: false; reason: 'weekly_limit_reached' }

export async function unlockDealForUser(client: Pick<PoolClient, 'query'>, userId: string, dealId: string): Promise<UnlockResult> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId])
  const existing = await client.query(
    `SELECT 1 FROM deal_unlocks
     WHERE user_id = $1 AND deal_id = $2
       AND unlocked_at >= date_trunc('week', NOW())
     LIMIT 1`,
    [userId, dealId],
  )
  const countResult = await client.query<{ count: number }>(
    `SELECT COUNT(*)::INT AS count FROM deal_unlocks
     WHERE user_id = $1 AND unlocked_at >= date_trunc('week', NOW())`,
    [userId],
  )
  const used = countResult.rows[0]?.count ?? 0
  if (existing.rowCount) return { ok: true, alreadyUnlocked: true, remaining: Math.max(0, FREE_WEEKLY_LIMIT - used) }
  if (used >= FREE_WEEKLY_LIMIT) return { ok: false, reason: 'weekly_limit_reached' }

  // (user_id, deal_id) is a lifetime-unique row, but the quota is weekly --
  // a user who unlocked this deal in an earlier week has a real row here
  // whose unlocked_at is now outside "this week" (the `existing` check above
  // already confirmed that). DO NOTHING silently no-op'd that case: this
  // function still reported a fresh, successful unlock with a decremented
  // remaining count, but unlocked_at never advanced -- so the deal stayed
  // outside the "this week" window everywhere else that filters on it
  // (getFreeUnlockedDealIds), leaving it locked on the actual feed despite
  // the success response. DO UPDATE refreshes the timestamp so a same-week
  // duplicate (short-circuited above by the `existing` check, never reaches
  // this query at all) and a genuine re-unlock in a later week both leave
  // the row correctly inside the current week's window.
  await client.query(
    `INSERT INTO deal_unlocks (user_id, deal_id) VALUES ($1, $2)
     ON CONFLICT (user_id, deal_id) DO UPDATE SET unlocked_at = NOW()`,
    [userId, dealId],
  )
  return { ok: true, alreadyUnlocked: false, remaining: FREE_WEEKLY_LIMIT - used - 1 }
}
