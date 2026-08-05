import Stripe from 'stripe'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
}

export function mapStripeStatus(status: Stripe.Subscription.Status): 'free' | 'trialing' | 'active' | 'canceled' {
  switch (status) {
    case 'trialing': return 'trialing'
    // past_due means Stripe is still retrying a failed payment on an
    // otherwise-active subscription — not a cancellation. Access is retained
    // through the retry/dunning window; only unpaid/canceled (retries
    // exhausted or subscription actually ended) revoke it.
    case 'active':
    case 'past_due': return 'active'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired': return 'canceled'
    default: return 'free'
  }
}

export function parseStripePlan(plan: string | null | undefined): 'monthly' | 'annual' | null {
  if (plan === 'monthly' || plan === 'annual') return plan
  return null
}

export function getStripeId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === 'string') return value
  return value?.id ?? null
}

export function getTrialEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.trial_end
  return ts ? new Date(ts * 1000) : null
}

export function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  // In newer Stripe API versions the billing cycle anchor is used; fall back gracefully
  const items = sub.items?.data?.[0]
  const ts = items?.current_period_end ?? null
  if (typeof ts === 'number') return new Date(ts * 1000)
  return null
}
