import { withTransaction } from '@/lib/db/client'
import { writeAdminAuditLog } from '@/lib/admin/audit'
import { validateReason } from '@/lib/admin/reason'
import type { AdminActor } from '@/lib/admin/role'
import type { Result } from '@/lib/types'

export interface GrantCompInput {
  targetUserId: string
  reason: string
  expiresAt?: string | null
  actor: AdminActor
}

export interface RemoveLocalAccessInput {
  targetUserId: string
  reason: string
  actor: AdminActor
}

export async function grantCompAccess(input: GrantCompInput): Promise<Result<{ status: string }>> {
  const reasonResult = validateReason(input.reason)
  if (!reasonResult.ok) {
    return { ok: false, reason: reasonResult.reason }
  }
  const expiresAt = input.expiresAt ?? null

  try {
    return await withTransaction(async (client) => {
      const targetResult = await client.query<{ email: string | null }>(
        'SELECT email FROM users WHERE id = $1',
        [input.targetUserId]
      )
      const targetEmail = targetResult.rows[0]?.email ?? null
      if (targetResult.rowCount === 0) {
        throw new Error('target_not_found')
      }

      const beforeResult = await client.query<{
        status: string
        entitlement_source: string
        comp_reason: string | null
        comp_granted_by: string | null
        comp_granted_at: Date | null
        comp_expires_at: Date | null
      }>(
        `SELECT status, entitlement_source, comp_reason, comp_granted_by, comp_granted_at, comp_expires_at
         FROM subscriptions WHERE user_id = $1 FOR UPDATE`,
        [input.targetUserId]
      )
      const before = beforeResult.rows[0] ?? { status: 'free', entitlement_source: 'none' }

      await client.query(
        `INSERT INTO subscriptions
           (user_id, status, entitlement_source, comp_reason, comp_granted_by, comp_granted_at, comp_expires_at, updated_at)
         VALUES ($1, 'active', 'comp', $2, $3, NOW(), $4, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           status = 'active',
           entitlement_source = 'comp',
           comp_reason = EXCLUDED.comp_reason,
           comp_granted_by = EXCLUDED.comp_granted_by,
           comp_granted_at = NOW(),
           comp_expires_at = EXCLUDED.comp_expires_at,
           updated_at = NOW()`,
        [input.targetUserId, reasonResult.value, input.actor.userId, expiresAt]
      )

      await writeAdminAuditLog(client, {
        action: 'comp_granted',
        actorUserId: input.actor.userId,
        actorEmail: input.actor.email,
        targetUserId: input.targetUserId,
        targetEmail,
        reason: reasonResult.value,
        before,
        after: {
          status: 'active',
          entitlement_source: 'comp',
          comp_reason: reasonResult.value,
          comp_granted_by: input.actor.userId,
          comp_expires_at: expiresAt,
        },
      })

      return { ok: true, data: { status: 'active' } }
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'target_not_found') {
      return { ok: false, reason: 'User not found' }
    }
    return { ok: false, reason: 'Could not grant comp access' }
  }
}

export async function removeLocalAccess(input: RemoveLocalAccessInput): Promise<Result<{ status: string }>> {
  const reasonResult = validateReason(input.reason)
  if (!reasonResult.ok) {
    return { ok: false, reason: reasonResult.reason }
  }

  try {
    return await withTransaction(async (client) => {
      const targetResult = await client.query<{ email: string | null }>(
        'SELECT email FROM users WHERE id = $1',
        [input.targetUserId]
      )
      if (targetResult.rowCount === 0) {
        throw new Error('target_not_found')
      }
      const targetEmail = targetResult.rows[0]?.email ?? null

      const beforeResult = await client.query<{ status: string; entitlement_source: string }>(
        'SELECT status, entitlement_source FROM subscriptions WHERE user_id = $1 FOR UPDATE',
        [input.targetUserId]
      )
      const before = beforeResult.rows[0]
      if (!before) {
        throw new Error('no_subscription')
      }

      await client.query(
        `UPDATE subscriptions SET
           status = 'free',
           entitlement_source = 'none',
           comp_reason = NULL,
           comp_granted_by = NULL,
           comp_granted_at = NULL,
           comp_expires_at = NULL,
           updated_at = NOW()
         WHERE user_id = $1`,
        [input.targetUserId]
      )

      await writeAdminAuditLog(client, {
        action: 'local_access_removed',
        actorUserId: input.actor.userId,
        actorEmail: input.actor.email,
        targetUserId: input.targetUserId,
        targetEmail,
        reason: reasonResult.value,
        before,
        after: { status: 'free', entitlement_source: 'none' },
      })

      return { ok: true, data: { status: 'free' } }
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'target_not_found') {
      return { ok: false, reason: 'User not found' }
    }
    if (err instanceof Error && err.message === 'no_subscription') {
      return { ok: false, reason: 'No subscription record for this user' }
    }
    return { ok: false, reason: 'Could not remove local access' }
  }
}
