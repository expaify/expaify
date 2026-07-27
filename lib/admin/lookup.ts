import { query } from '@/lib/db/client'
import type { Result } from '@/lib/types'

export type AdminIdentifierType = 'email' | 'user_id' | 'stripe_customer_id' | 'stripe_subscription_id'

export interface AdminAccountSummary {
  userId: string
  name: string | null
  email: string | null
  status: string
  entitlementSource: string
}

export interface AdminPublicAlertSummary {
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

export interface AdminLookupResult {
  identifierType: AdminIdentifierType
  account: AdminAccountSummary | null
  publicAlerts: AdminPublicAlertSummary[]
}

function detectIdentifierType(q: string): AdminIdentifierType {
  if (q.startsWith('cus_')) return 'stripe_customer_id'
  if (q.startsWith('sub_')) return 'stripe_subscription_id'
  if (q.includes('@')) return 'email'
  return 'user_id'
}

export async function lookupAdminAccount(rawQuery: string): Promise<Result<AdminLookupResult>> {
  const q = rawQuery.trim()
  if (!q) {
    return { ok: false, reason: 'Query must not be empty' }
  }

  const identifierType = detectIdentifierType(q)

  try {
    type UserRow = { id: string; name: string | null; email: string | null }
    let userRow: UserRow | undefined

    if (identifierType === 'email') {
      const r = await query<UserRow>('SELECT id, name, email FROM users WHERE email = $1 LIMIT 1', [q])
      userRow = r.rows[0]
    } else if (identifierType === 'user_id') {
      const r = await query<UserRow>('SELECT id, name, email FROM users WHERE id = $1 LIMIT 1', [q])
      userRow = r.rows[0]
    } else {
      const column = identifierType === 'stripe_customer_id' ? 'stripe_customer_id' : 'stripe_subscription_id'
      const r = await query<UserRow>(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN subscriptions s ON s.user_id = u.id
         WHERE s.${column} = $1 LIMIT 1`,
        [q]
      )
      userRow = r.rows[0]
    }

    let account: AdminAccountSummary | null = null
    if (userRow) {
      const subResult = await query<{ status: string; entitlement_source: string }>(
        'SELECT status, entitlement_source FROM subscriptions WHERE user_id = $1 LIMIT 1',
        [userRow.id]
      )
      const sub = subResult.rows[0]
      account = {
        userId: userRow.id,
        name: userRow.name,
        email: userRow.email,
        status: sub?.status ?? 'free',
        entitlementSource: sub?.entitlement_source ?? 'none',
      }
    }

    const emailForAlerts = identifierType === 'email' ? q : userRow?.email ?? null
    let publicAlerts: AdminPublicAlertSummary[] = []
    if (emailForAlerts) {
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
        [emailForAlerts]
      )
      publicAlerts = r.rows.map((row) => ({
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

    return { ok: true, data: { identifierType, account, publicAlerts } }
  } catch {
    return { ok: false, reason: 'Lookup failed' }
  }
}
