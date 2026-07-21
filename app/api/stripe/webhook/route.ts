export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { upsertSubscription, getSubscriptionByStripeCustomer } from '@/lib/subscription'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const plan = parseStripePlan(session.metadata?.plan) ?? 'monthly'
      const customerId = getStripeId(session.customer)
      const subscriptionId = getStripeId(session.subscription)
      if (!userId || !customerId) break
      await upsertSubscription(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'trialing',
        plan,
      })
      // Fetch full subscription details to get trial/period dates
      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          await upsertSubscription(userId, {
            status: mapStripeStatus(sub.status),
            trialEndsAt: getTrialEnd(sub),
            currentPeriodEnd: getPeriodEnd(sub),
          })
        } catch {
          // Non-fatal: dates will be updated via subscription.updated webhook
        }
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = getStripeId(sub.customer)
      if (!customerId) break
      const existing = await getSubscriptionByStripeCustomer(customerId)
      const userId = existing?.userId ?? sub.metadata?.user_id
      if (!userId) break
      await upsertSubscription(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        status: mapStripeStatus(sub.status),
        plan: parseStripePlan(sub.metadata?.plan) ?? existing?.plan,
        trialEndsAt: getTrialEnd(sub),
        currentPeriodEnd: getPeriodEnd(sub),
      })
      break
    }

    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const obj = event.data.object as { customer?: string | Stripe.Customer }
      const customerId = getStripeId(obj.customer)
      if (!customerId) break
      const existing = await getSubscriptionByStripeCustomer(customerId)
      if (!existing) break
      await upsertSubscription(existing.userId, { status: 'canceled' })
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}

function mapStripeStatus(status: Stripe.Subscription.Status): 'free' | 'trialing' | 'active' | 'canceled' {
  switch (status) {
    case 'trialing': return 'trialing'
    case 'active': return 'active'
    case 'canceled':
    case 'unpaid':
    case 'past_due':
    case 'incomplete_expired': return 'canceled'
    default: return 'free'
  }
}

function parseStripePlan(plan: string | null | undefined): 'monthly' | 'annual' | null {
  if (plan === 'monthly' || plan === 'annual') return plan
  return null
}

function getStripeId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === 'string') return value
  return value?.id ?? null
}

function getTrialEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.trial_end
  return ts ? new Date(ts * 1000) : null
}

function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  // In newer Stripe API versions the billing cycle anchor is used; fall back gracefully
  const items = sub.items?.data?.[0]
  const ts = items?.current_period_end ?? null
  if (typeof ts === 'number') return new Date(ts * 1000)
  return null
}
