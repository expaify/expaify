export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'

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

// Price IDs are set in env; fall back to test placeholders so the app boots without Stripe configured
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? 'price_monthly_placeholder',
  annual: process.env.STRIPE_PRICE_ANNUAL ?? 'price_annual_placeholder',
} as const

function assertConfiguredPrice(priceId: string, plan: string): void {
  if (priceId.includes('placeholder')) {
    throw new Error(`Stripe ${plan} price id is not configured`)
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
  const priceId = PRICE_IDS[plan]
  const origin = getOrigin()

  try {
    assertConfiguredPrice(priceId, plan)
    const stripe = getStripe()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: session.user.id, plan },
      },
      customer_email: session.user.email ?? undefined,
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/#pricing`,
      metadata: { user_id: session.user.id, plan },
    })
    if (!checkoutSession.url) throw new Error('No checkout URL')
    return NextResponse.redirect(checkoutSession.url)
  } catch {
    return NextResponse.redirect(new URL('/account?checkout=error', origin))
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { plan?: string }
    const plan = body.plan === 'monthly' ? 'monthly' : 'annual'
    const priceId = PRICE_IDS[plan]
    assertConfiguredPrice(priceId, plan)

    const stripe = getStripe()
    const origin = getOrigin()

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: session.user.id, plan },
      },
      customer_email: session.user.email ?? undefined,
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/account`,
      metadata: { user_id: session.user.id, plan },
    })

    if (!checkoutSession.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 })
    }
    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout could not start'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
