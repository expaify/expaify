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
  alertMinDiscount: number
  alertTimezone: string
  alertUnsubscribeToken: string
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
    alert_min_discount: number
    alert_timezone: string
    alert_unsubscribe_token: string
    onboarding_done: boolean
  }>(
    `SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  const row = result.rows[0]
  if (!row) return null
  const minDiscount = (row.alert_min_discount ?? 40) as 30 | 40 | 50
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
    alertMinDiscount: row.alert_min_discount ?? 40,
    alertTimezone: row.alert_timezone ?? 'America/New_York',
    alertUnsubscribeToken: String(row.alert_unsubscribe_token),
    minDiscountPct: minDiscount,
    onboardingDone: Boolean(row.onboarding_done),
  }
}

export async function upsertSubscription(
  userId: string,
  patch: Partial<Omit<Subscription, 'id' | 'userId'>>
): Promise<void> {
  const minDiscount = patch.minDiscountPct ?? patch.alertMinDiscount ?? null
  await query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, plan, trial_ends_at, current_period_end, alert_preference, watchlist, alert_min_discount, alert_timezone, onboarding_done, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::SMALLINT, 40), COALESCE($11::TEXT, 'America/New_York'), COALESCE($12::BOOLEAN, false), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id     = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       status                 = COALESCE(EXCLUDED.status, subscriptions.status),
       plan                   = COALESCE(EXCLUDED.plan, subscriptions.plan),
       trial_ends_at          = COALESCE(EXCLUDED.trial_ends_at, subscriptions.trial_ends_at),
       current_period_end     = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
       alert_preference       = COALESCE(EXCLUDED.alert_preference, subscriptions.alert_preference),
       watchlist              = COALESCE(EXCLUDED.watchlist, subscriptions.watchlist),
       alert_min_discount     = COALESCE($10::SMALLINT, subscriptions.alert_min_discount),
       alert_timezone         = COALESCE($11::TEXT, subscriptions.alert_timezone),
       onboarding_done        = CASE WHEN $12::BOOLEAN IS TRUE THEN TRUE ELSE subscriptions.onboarding_done END,
       updated_at             = NOW()`,
    [
      userId,
      patch.stripeCustomerId ?? null,
      patch.stripeSubscriptionId ?? null,
      patch.status ?? 'free',
      patch.plan ?? null,
      patch.trialEndsAt ?? null,
      patch.currentPeriodEnd ?? null,
      patch.alertPreference ?? 'daily',
      patch.watchlist ?? [],
      minDiscount,
      patch.alertTimezone ?? null,
      patch.onboardingDone ?? null,
    ]
  )
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
