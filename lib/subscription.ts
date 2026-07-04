import { query } from './db/client'

export type SubscriptionStatus = 'free' | 'trialing' | 'active' | 'canceled'

export type Subscription = {
  id: string
  userId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  status: SubscriptionStatus
  plan: 'monthly' | 'annual' | null
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  alertPreference: 'instant' | 'daily' | 'off'
  watchlist: string[]
  minDiscountPct: 30 | 40 | 50
  onboardingDone: boolean
}

export function isPremium(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active'
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const result = await query<{
    id: string
    user_id: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    status: string
    plan: string | null
    trial_ends_at: Date | null
    current_period_end: Date | null
    alert_preference: string
    watchlist: string[]
    min_discount_pct: number
    onboarding_done: boolean
  }>(
    `SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status as SubscriptionStatus,
    plan: row.plan as 'monthly' | 'annual' | null,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    alertPreference: row.alert_preference as 'instant' | 'daily' | 'off',
    watchlist: row.watchlist ?? [],
    minDiscountPct: normalizeMinDiscountPct(row.min_discount_pct),
    onboardingDone: row.onboarding_done ?? false,
  }
}

export async function upsertSubscription(
  userId: string,
  patch: Partial<Omit<Subscription, 'id' | 'userId'>>
): Promise<void> {
  await query(
    `INSERT INTO subscriptions (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  )

  const assignments: string[] = []
  const values: unknown[] = [userId]

  function add(column: string, value: unknown) {
    values.push(value)
    assignments.push(`${column} = $${values.length}`)
  }

  if ('stripeCustomerId' in patch) add('stripe_customer_id', patch.stripeCustomerId ?? null)
  if ('stripeSubscriptionId' in patch) add('stripe_subscription_id', patch.stripeSubscriptionId ?? null)
  if ('status' in patch) add('status', patch.status ?? 'free')
  if ('plan' in patch) add('plan', patch.plan ?? null)
  if ('trialEndsAt' in patch) add('trial_ends_at', patch.trialEndsAt ?? null)
  if ('currentPeriodEnd' in patch) add('current_period_end', patch.currentPeriodEnd ?? null)
  if ('alertPreference' in patch) add('alert_preference', patch.alertPreference ?? 'daily')
  if ('watchlist' in patch) add('watchlist', patch.watchlist ?? [])
  if ('minDiscountPct' in patch) add('min_discount_pct', patch.minDiscountPct ?? 40)
  if ('onboardingDone' in patch) add('onboarding_done', patch.onboardingDone ?? false)

  if (assignments.length === 0) return

  await query(
    `UPDATE subscriptions SET ${assignments.join(', ')}, updated_at = NOW() WHERE user_id = $1`,
    values
  )
}

function normalizeMinDiscountPct(value: number): 30 | 40 | 50 {
  if (value === 30 || value === 50) return value
  return 40
}

export async function getSubscriptionByStripeCustomer(
  stripeCustomerId: string
): Promise<Subscription | null> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
    [stripeCustomerId]
  )
  const row = result.rows[0]
  if (!row) return null
  return getSubscription(row.user_id)
}

export async function getSubscriptionByStripeSubscription(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
    [stripeSubscriptionId]
  )
  const row = result.rows[0]
  if (!row) return null
  return getSubscription(row.user_id)
}
