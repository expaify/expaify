import { withTransaction } from '@/lib/db/client'
import { writeAdminAuditLog } from '@/lib/admin/audit'
import { validateReason } from '@/lib/admin/reason'
import type { AdminActor } from '@/lib/admin/role'
import type { Result } from '@/lib/types'

export interface CreatePrivacyRequestInput {
  targetUserId: string
  source: string
  actor: AdminActor
}

export interface PrivacyRequestResult {
  id: string
  status: string
}

async function createPrivacyRequest(
  table: 'account_export_requests' | 'account_deletion_requests',
  action: 'export_request_created' | 'deletion_request_created',
  input: CreatePrivacyRequestInput
): Promise<Result<PrivacyRequestResult>> {
  const sourceResult = validateReason(input.source)
  if (!sourceResult.ok) {
    return { ok: false, reason: sourceResult.reason }
  }

  try {
    return await withTransaction(async (client) => {
      const targetResult = await client.query<{ email: string | null }>(
        'SELECT email FROM users WHERE id = $1',
        [input.targetUserId]
      )
      const targetEmail = targetResult.rows[0]?.email ?? null
      if (targetResult.rowCount === 0 || !targetEmail) {
        throw new Error('target_not_found')
      }

      const beforeCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ${table} WHERE user_id = $1`,
        [input.targetUserId]
      )
      const existingCount = Number(beforeCountResult.rows[0]?.count ?? 0)

      const insertResult = await client.query<{ id: string; status: string }>(
        `INSERT INTO ${table} (requested_email, user_id, status, source, actor_user_id)
         VALUES ($1, $2, 'requested', $3, $4)
         RETURNING id, status`,
        [targetEmail, input.targetUserId, sourceResult.value, input.actor.userId]
      )
      const row = insertResult.rows[0]

      await writeAdminAuditLog(client, {
        action,
        actorUserId: input.actor.userId,
        actorEmail: input.actor.email,
        targetUserId: input.targetUserId,
        targetEmail,
        reason: sourceResult.value,
        before: { existingRequests: existingCount },
        after: { id: row.id, status: row.status },
      })

      return { ok: true, data: { id: row.id, status: row.status } }
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'target_not_found') {
      return { ok: false, reason: 'User not found' }
    }
    return { ok: false, reason: 'Could not create the request' }
  }
}

export function createExportRequest(input: CreatePrivacyRequestInput): Promise<Result<PrivacyRequestResult>> {
  return createPrivacyRequest('account_export_requests', 'export_request_created', input)
}

export function createDeletionRequest(input: CreatePrivacyRequestInput): Promise<Result<PrivacyRequestResult>> {
  return createPrivacyRequest('account_deletion_requests', 'deletion_request_created', input)
}
