import { query } from '@/lib/db/client'
import { writeAdminAuditLog } from '@/lib/admin/audit'
import type { AdminActor } from '@/lib/admin/role'
import type { Result } from '@/lib/types'

export interface AdminIdentity {
  userId: string
  name: string | null
  email: string | null
  emailVerified: string | null
  authProviders: string[]
}

export interface AdminSubscriptionView {
  status: string
  entitlementSource: string
  plan: string | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  compReason: string | null
  compGrantedBy: string | null
  compGrantedAt: string | null
  compExpiresAt: string | null
  updatedAt: string | null
}

export interface AdminAlertsView {
  alertPreference: string
  alertMinDiscount: number
  alertTimezone: string
  watchlist: string[]
  lastAlertedAt: string | null
  recentDeliveries: Array<{ dealId: string; deliveryType: string; deliveredAt: string }>
}

export interface AdminPublicAlertRow {
  id: string
  origin: string | null
  destination: string | null
  hotelId: string | null
  targetCents: number
  currency: string
  active: boolean
  createdAt: string
  lastCheckedAt: string | null
  triggeredAt: string | null
}

export interface AdminPrivacyRequestRow {
  id: string
  status: string
  source: string | null
  actorUserId: string
  createdAt: string
  updatedAt: string
}

export interface AdminAuditLogRow {
  id: string
  action: string
  actorEmail: string
  reason: string | null
  before: unknown
  after: unknown
  createdAt: string
}

export interface AdminDossier {
  identity: AdminIdentity
  subscription: AdminSubscriptionView | null
  alerts: AdminAlertsView | null
  publicPriceAlerts: AdminPublicAlertRow[]
  exportRequests: AdminPrivacyRequestRow[]
  deletionRequests: AdminPrivacyRequestRow[]
  auditLog: AdminAuditLogRow[]
}

export async function getAdminDossier(targetUserId: string, actor: AdminActor): Promise<Result<AdminDossier>> {
  // Never select OAuth access/refresh/id tokens or the alert unsubscribe
  // token — only whitelisted, non-secret columns below.
  const userResult = await query<{
    id: string
    name: string | null
    email: string | null
    emailVerified: Date | null
  }>('SELECT id, name, email, "emailVerified" FROM users WHERE id = $1 LIMIT 1', [targetUserId])
  const userRow = userResult.rows[0]
  if (!userRow) {
    return { ok: false, reason: 'User not found' }
  }

  const providersResult = await query<{ provider: string }>(
    'SELECT DISTINCT provider FROM accounts WHERE "userId" = $1',
    [targetUserId]
  )

  const subResult = await query<{
    status: string
    entitlement_source: string
    plan: string | null
    trial_ends_at: Date | null
    current_period_end: Date | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    comp_reason: string | null
    comp_granted_by: string | null
    comp_granted_at: Date | null
    comp_expires_at: Date | null
    updated_at: Date | null
    alert_preference: string
    alert_min_discount: number
    alert_timezone: string
    watchlist: string[]
    last_alerted_at: Date | null
  }>(
    `SELECT status, entitlement_source, plan, trial_ends_at, current_period_end,
            stripe_customer_id, stripe_subscription_id, comp_reason, comp_granted_by,
            comp_granted_at, comp_expires_at, updated_at, alert_preference,
            alert_min_discount, alert_timezone, watchlist, last_alerted_at
     FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [targetUserId]
  )
  const subRow = subResult.rows[0]

  let alerts: AdminAlertsView | null = null
  let subscription: AdminSubscriptionView | null = null
  if (subRow) {
    subscription = {
      status: subRow.status,
      entitlementSource: subRow.entitlement_source,
      plan: subRow.plan,
      trialEndsAt: subRow.trial_ends_at ? subRow.trial_ends_at.toISOString() : null,
      currentPeriodEnd: subRow.current_period_end ? subRow.current_period_end.toISOString() : null,
      stripeCustomerId: subRow.stripe_customer_id,
      stripeSubscriptionId: subRow.stripe_subscription_id,
      compReason: subRow.comp_reason,
      compGrantedBy: subRow.comp_granted_by,
      compGrantedAt: subRow.comp_granted_at ? subRow.comp_granted_at.toISOString() : null,
      compExpiresAt: subRow.comp_expires_at ? subRow.comp_expires_at.toISOString() : null,
      updatedAt: subRow.updated_at ? subRow.updated_at.toISOString() : null,
    }

    const deliveriesResult = await query<{ deal_id: string; delivery_type: string; delivered_at: Date }>(
      `SELECT deal_id, delivery_type, delivered_at FROM deal_alert_deliveries
       WHERE user_id = $1 ORDER BY delivered_at DESC LIMIT 10`,
      [targetUserId]
    )

    alerts = {
      alertPreference: subRow.alert_preference,
      alertMinDiscount: subRow.alert_min_discount,
      alertTimezone: subRow.alert_timezone,
      watchlist: subRow.watchlist ?? [],
      lastAlertedAt: subRow.last_alerted_at ? subRow.last_alerted_at.toISOString() : null,
      recentDeliveries: deliveriesResult.rows.map((row) => ({
        dealId: row.deal_id,
        deliveryType: row.delivery_type,
        deliveredAt: row.delivered_at.toISOString(),
      })),
    }
  }

  let publicPriceAlerts: AdminPublicAlertRow[] = []
  if (userRow.email) {
    const r = await query<{
      id: string
      origin: string | null
      destination: string | null
      hotel_id: string | null
      target_cents: number
      currency: string
      active: boolean
      created_at: Date
      last_checked_at: Date | null
      triggered_at: Date | null
    }>(
      `SELECT id, origin, destination, hotel_id, target_cents, currency, active,
              created_at, last_checked_at, triggered_at
       FROM price_alerts WHERE email = $1 ORDER BY created_at DESC`,
      [userRow.email]
    )
    publicPriceAlerts = r.rows.map((row) => ({
      id: row.id,
      origin: row.origin,
      destination: row.destination,
      hotelId: row.hotel_id,
      targetCents: row.target_cents,
      currency: row.currency,
      active: row.active,
      createdAt: row.created_at.toISOString(),
      lastCheckedAt: row.last_checked_at ? row.last_checked_at.toISOString() : null,
      triggeredAt: row.triggered_at ? row.triggered_at.toISOString() : null,
    }))
  }

  const [exportRequests, deletionRequests] = await Promise.all([
    fetchPrivacyRequests('account_export_requests', targetUserId),
    fetchPrivacyRequests('account_deletion_requests', targetUserId),
  ])

  const auditResult = await query<{
    id: string
    action: string
    actor_email: string
    reason: string | null
    before: unknown
    after: unknown
    created_at: Date
  }>(
    `SELECT id, action, actor_email, reason, before, after, created_at
     FROM admin_audit_log WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 25`,
    [targetUserId]
  )
  const auditLog: AdminAuditLogRow[] = auditResult.rows.map((row) => ({
    id: String(row.id),
    action: row.action,
    actorEmail: row.actor_email,
    reason: row.reason,
    before: row.before,
    after: row.after,
    createdAt: row.created_at.toISOString(),
  }))

  // Best-effort: viewing the dossier is not a data mutation, so we do not
  // block or fail the read if this insert fails — support still needs to
  // see the account during an incident even if audit logging hiccups.
  try {
    await writeAdminAuditLog(
      { query: (text: string, params?: unknown[]) => query(text, params) },
      {
        action: 'account_viewed',
        actorUserId: actor.userId,
        actorEmail: actor.email,
        targetUserId,
        targetEmail: userRow.email,
      }
    )
  } catch {
    // swallow — see comment above
  }

  return {
    ok: true,
    data: {
      identity: {
        userId: userRow.id,
        name: userRow.name,
        email: userRow.email,
        emailVerified: userRow.emailVerified ? userRow.emailVerified.toISOString() : null,
        authProviders: providersResult.rows.map((row) => row.provider),
      },
      subscription,
      alerts,
      publicPriceAlerts,
      exportRequests,
      deletionRequests,
      auditLog,
    },
  }
}

async function fetchPrivacyRequests(table: 'account_export_requests' | 'account_deletion_requests', userId: string): Promise<AdminPrivacyRequestRow[]> {
  const r = await query<{
    id: string
    status: string
    source: string | null
    actor_user_id: string
    created_at: Date
    updated_at: Date
  }>(
    `SELECT id, status, source, actor_user_id, created_at, updated_at
     FROM ${table} WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )
  return r.rows.map((row) => ({
    id: row.id,
    status: row.status,
    source: row.source,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }))
}
