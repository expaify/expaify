export interface AdminAuditExecutor {
  query(text: string, params?: unknown[]): Promise<unknown>
}

export type AdminAuditAction =
  | 'account_viewed'
  | 'comp_granted'
  | 'local_access_removed'
  | 'export_request_created'
  | 'deletion_request_created'

export interface AdminAuditEntryInput {
  action: AdminAuditAction
  actorUserId: string
  actorEmail: string
  targetUserId?: string | null
  targetEmail?: string | null
  searchedIdentifierType?: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
}

// Writes one append-only audit row. Callers that perform a mutation must run
// this on the same transaction client as the mutation write (see
// lib/db/client.ts withTransaction) so a failed audit write rolls back the
// mutation instead of leaving an unaudited change.
export async function writeAdminAuditLog(client: AdminAuditExecutor, entry: AdminAuditEntryInput): Promise<void> {
  await client.query(
    `INSERT INTO admin_audit_log
       (action, actor_user_id, actor_email, target_user_id, target_email,
        searched_identifier_type, reason, metadata, before, after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      entry.action,
      entry.actorUserId,
      entry.actorEmail,
      entry.targetUserId ?? null,
      entry.targetEmail ?? null,
      entry.searchedIdentifierType ?? null,
      entry.reason ?? null,
      JSON.stringify(entry.metadata ?? {}),
      entry.before ? JSON.stringify(entry.before) : null,
      entry.after ? JSON.stringify(entry.after) : null,
    ]
  )
}
