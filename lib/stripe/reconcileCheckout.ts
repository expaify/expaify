import { upsertSubscription } from '@/lib/subscription'
import { getStripe, mapStripeStatus, parseStripePlan, getStripeId, getTrialEnd, getPeriodEnd } from './mapping'

/**
 * Synchronous backstop for the async `checkout.session.completed` /
 * `customer.subscription.created` webhooks. The webhook usually lands within
 * seconds, but there is no guarantee it beats the browser back to the
 * success page — a user who lands on /account?checkout=success before the
 * webhook has processed would otherwise see the free-tier state despite
 * having just paid (DEV-PAYWALL-PREMIUM-NOT-DETECTED-01). Only called when
 * the caller has already determined the DB doesn't yet show premium, so this
 * never runs on the (overwhelmingly common) already-reconciled path.
 *
 * Never throws — a Stripe API hiccup here must not break the account page;
 * the webhook remains the authoritative path and will still land.
 */
export async function reconcileCheckoutSession(sessionId: string, expectedUserId: string): Promise<void> {
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })

    // The session must belong to the user currently viewing the success page —
    // never trust a session_id query param to reconcile a DIFFERENT user's subscription.
    if (session.metadata?.user_id !== expectedUserId) return

    const customerId = getStripeId(session.customer)
    const subscriptionId = getStripeId(session.subscription)
    if (!customerId) return

    const sub = typeof session.subscription === 'object' && session.subscription !== null
      ? session.subscription
      : subscriptionId
        ? await stripe.subscriptions.retrieve(subscriptionId)
        : null

    await upsertSubscription(expectedUserId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: sub ? mapStripeStatus(sub.status) : 'trialing',
      plan: parseStripePlan(session.metadata?.plan) ?? undefined,
      ...(sub ? { trialEndsAt: getTrialEnd(sub), currentPeriodEnd: getPeriodEnd(sub) } : {}),
    })
  } catch {
    // Best-effort only — the webhook is still the source of truth and will
    // reconcile this shortly if this attempt fails for any reason.
  }
}
