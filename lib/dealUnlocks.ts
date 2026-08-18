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

  await client.query(
    `INSERT INTO deal_unlocks (user_id, deal_id) VALUES ($1, $2)
     ON CONFLICT (user_id, deal_id) DO NOTHING`,
    [userId, dealId],
  )
  return { ok: true, alreadyUnlocked: false, remaining: FREE_WEEKLY_LIMIT - used - 1 }
}
