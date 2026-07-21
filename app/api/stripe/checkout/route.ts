export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
}

// req.nextUrl.origin returns the container's internal address (0.0.0.0:3000) behind Azure's
// reverse proxy. Use the canonical public URL from env instead.
function getOrigin(): string {
  return (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? 'https://expaify.com').replace(/\/$/, '')
}

type BillingPlan = 'monthly' | 'annual'

class CheckoutConfigurationError extends Error {}

function assertConfiguredPrice(priceId: string, plan: string): void {
  if (priceId.includes('placeholder')) {
    throw new CheckoutConfigurationError(`Stripe ${plan} price id is not configured`)
  }
}

function parsePlan(plan: string | null | undefined): BillingPlan {
  return plan === 'monthly' ? 'monthly' : 'annual'
}

function getPriceId(plan: BillingPlan): string {
  return plan === 'monthly'
    ? process.env.STRIPE_PRICE_MONTHLY ?? 'price_monthly_placeholder'
    : process.env.STRIPE_PRICE_ANNUAL ?? 'price_annual_placeholder'
}

async function createCheckoutUrl({
  userId,
  email,
  plan,
  cancelPath,
}: {
  userId: string
  email?: string | null
  plan: BillingPlan
  cancelPath: string
}): Promise<string> {
  const priceId = getPriceId(plan)
  assertConfiguredPrice(priceId, plan)

  const stripe = getStripe()
  const origin = getOrigin()
  const sub = await getSubscription(userId).catch(() => null)
  const existingCustomerId = sub?.stripeCustomerId ?? undefined

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { user_id: userId, plan },
    },
    success_url: `${origin}/account?checkout=success`,
    cancel_url: `${origin}${cancelPath}`,
    metadata: { user_id: userId, plan },
  }

  if (existingCustomerId) {
    params.customer = existingCustomerId
  } else if (email) {
    params.customer_email = email
  }

  const checkoutSession = await stripe.checkout.sessions.create(params)
  if (!checkoutSession.url) {
    throw new Error('Stripe did not return a checkout URL')
  }
  return checkoutSession.url
}

function publicCheckoutError(err: unknown): { message: string; status: number } {
  if (err instanceof CheckoutConfigurationError || (err instanceof Error && err.message === 'STRIPE_SECRET_KEY is not set')) {
    return {
      message: 'Billing is not configured yet. Contact support and we will finish your upgrade.',
      status: 503,
    }
  }

  return {
    message: 'Checkout could not start. Try again in a moment.',
    status: 502,
  }
}

// GET handler: used as the post-auth callback from magic-link sign-in on /join.
// After the user clicks their email link, NextAuth redirects here with ?plan=&redirect=true.
// We create a Stripe checkout session and send them directly to Stripe.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    // Not yet authenticated — bounce back to join to re-enter email
    const plan = req.nextUrl.searchParams.get('plan') ?? 'annual'
    return NextResponse.redirect(new URL(`/join?plan=${plan}`, getOrigin()))
  }

  const plan = req.nextUrl.searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual'

  try {
    const url = await createCheckoutUrl({
      userId: session.user.id,
      email: session.user.email,
      plan,
      cancelPath: '/#pricing',
    })
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/account?checkout=error', getOrigin()))
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { plan?: string }
    const url = await createCheckoutUrl({
      userId: session.user.id,
      email: session.user.email,
      plan: parsePlan(body.plan),
      cancelPath: '/account',
    })
    return NextResponse.json({ url })
  } catch (err) {
    const { message, status } = publicCheckoutError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
