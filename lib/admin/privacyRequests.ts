import { query, withTransaction } from '@/lib/db/client'
import { writeAdminAuditLog } from '@/lib/admin/audit'
import { validateReason } from '@/lib/admin/reason'
import type { AdminActor } from '@/lib/admin/role'
import type { Result } from '@/lib/types'
import { getSubscription } from '@/lib/subscription'
import { sendAccountDataExport } from '@/lib/email/sendAccountDataExport'

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

function formatExportDate(value: Date | string | null): string {
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Export requests are always self-service (targetUserId === actor.userId --
// see app/api/account/privacy-request/route.ts, the only caller) and the
// email is always the account's own verified address looked up server-side,
// never client-supplied. That makes automatic fulfillment safe: a user is
// only ever emailed a copy of their own data, at their own address.
// Deletion requests stay manual/reviewed per the schema note above --
// this function does not touch account_deletion_requests at all.
async function fulfillOneExportRequest(requestId: string, userId: string, requestedEmail: string): Promise<boolean> {
  const [userResult, subscriptionResult, createdAtResult, unlocksResult] = await Promise.all([
    query<{ name: string | null; email: string | null }>('SELECT name, email FROM users WHERE id = $1', [userId]),
    getSubscription(userId),
    query<{ created_at: Date }>('SELECT created_at FROM subscriptions WHERE user_id = $1', [userId]),
    query<{ hotel_name: string; city: string; unlocked_at: Date }>(
      `SELECT d.hotel_name, m.city, u.unlocked_at
       FROM deal_unlocks u
       JOIN deals d ON d.id = u.deal_id
       JOIN tracked_markets m ON m.id = d.market_id
       WHERE u.user_id = $1
       ORDER BY u.unlocked_at DESC`,
      [userId],
    ),
  ])

  const email = userResult.rows[0]?.email ?? requestedEmail
  if (!email) return false

  const sub = subscriptionResult
  const sent = await sendAccountDataExport({
    email,
    name: userResult.rows[0]?.name ?? null,
    createdAt: formatExportDate(createdAtResult.rows[0]?.created_at ?? null),
    planStatus: sub?.status ?? 'free',
    plan: sub?.plan ?? null,
    alertPreference: sub?.alertPreference ?? 'daily',
    alertMinDiscount: sub?.alertMinDiscount ?? 40,
    alertTimezone: sub?.alertTimezone ?? 'America/New_York',
    watchlist: sub?.watchlist ?? [],
    unlocks: unlocksResult.rows.map(row => ({
      hotelName: row.hotel_name,
      city: row.city,
      unlockedAt: formatExportDate(row.unlocked_at),
    })),
  })
  if (!sent) return false

  await withTransaction(async client => {
    await client.query(
      `UPDATE account_export_requests SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [requestId],
    )
    await writeAdminAuditLog(client, {
      action: 'export_request_fulfilled',
      // System-initiated fulfillment of a self-service request -- there is
      // no separate system actor identity in this codebase (see
      // app/api/pipeline/run/route.ts, which doesn't audit-log at all), so
      // the target user is recorded as their own actor.
      actorUserId: userId,
      actorEmail: email,
      targetUserId: userId,
      targetEmail: email,
      reason: 'automatic_export_fulfillment',
      after: { id: requestId, status: 'completed' },
    })
  })
  return true
}

export async function fulfillDueExportRequests(): Promise<{ fulfilled: number; failed: number }> {
  const pending = await query<{ id: string; user_id: string | null; requested_email: string }>(
    `SELECT id, user_id, requested_email FROM account_export_requests WHERE status = 'requested' ORDER BY created_at ASC`,
  )
  let fulfilled = 0
  let failed = 0
  for (const row of pending.rows) {
    try {
      const ok = row.user_id ? await fulfillOneExportRequest(row.id, row.user_id, row.requested_email) : false
      if (ok) fulfilled += 1
      else failed += 1
    } catch (err) {
      console.warn('Export request fulfillment failed', row.id, err)
      failed += 1
    }
  }
  return { fulfilled, failed }
}
