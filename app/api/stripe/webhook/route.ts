export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createOpinlyClient } from '@opinly/backend'
import { upsertSubscription, getSubscriptionByStripeCustomer } from '@/lib/subscription'
import { getStripe, mapStripeStatus, parseStripePlan, getStripeId, getTrialEnd, getPeriodEnd } from '@/lib/stripe/mapping'

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
      try {
        const opinly = createOpinlyClient({ apiKey: process.env.OPINLY_API_KEY })
        // Trial checkouts may have no immediate charge, so preserve Stripe's
        // authoritative zero/null amount instead of inventing future revenue.
        const value = (session.amount_total ?? 0) / 100
        await opinly.track(
          'purchase',
          {
            value,
            currency: 'USD',
            ...(session.metadata?.utm_source ? { utm_source: session.metadata.utm_source } : {}),
            ...(session.metadata?.utm_medium ? { utm_medium: session.metadata.utm_medium } : {}),
            ...(session.metadata?.utm_campaign ? { utm_campaign: session.metadata.utm_campaign } : {}),
            ...(session.metadata?.utm_content ? { utm_content: session.metadata.utm_content } : {}),
            ...(session.metadata?.utm_term ? { utm_term: session.metadata.utm_term } : {}),
          },
          {
            externalEventId: session.id,
            anonId: session.metadata?.opinly_anon_id,
            email: session.customer_email ?? undefined,
          },
        )
      } catch (err) {
        // Analytics is non-critical and must never trigger Stripe webhook retries.
        console.warn('Opinly purchase tracking failed', err)
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

    // Only an actual Stripe cancellation hard-revokes access here. A single
    // invoice.payment_failed is not authoritative — Stripe retries failed
    // payments automatically (Smart Retries) and the subscription itself
    // stays active/past_due throughout, often recovering without ever being
    // canceled. The subscription's real status is synced separately via
    // customer.subscription.updated, which Stripe fires on every actual
    // status transition (including the eventual cancel if all retries fail).
    case 'customer.subscription.deleted': {
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
