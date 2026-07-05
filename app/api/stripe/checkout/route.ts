export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
}

// Price IDs are set in env; fall back to test placeholders so the app boots without Stripe configured
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? 'price_monthly_placeholder',
  annual: process.env.STRIPE_PRICE_ANNUAL ?? 'price_annual_placeholder',
} as const

// GET handler: used as the post-auth callback from magic-link sign-in on /join.
// After the user clicks their email link, NextAuth redirects here with ?plan=&redirect=true.
// We create a Stripe checkout session and send them directly to Stripe.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    // Not yet authenticated — bounce back to join to re-enter email
    const plan = req.nextUrl.searchParams.get('plan') ?? 'annual'
    return NextResponse.redirect(new URL(`/join?plan=${plan}`, req.nextUrl.origin))
  }

  const plan = req.nextUrl.searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual'
  const priceId = PRICE_IDS[plan]
  const origin = req.nextUrl.origin

  try {
    const stripe = getStripe()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: session.user.id, plan },
      },
      customer_email: session.user.email ?? undefined,
      consent_collection: { terms_of_service: 'required' },
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/#pricing`,
      metadata: { user_id: session.user.id, plan },
    })
    if (!checkoutSession.url) throw new Error('No checkout URL')
    return NextResponse.redirect(checkoutSession.url)
  } catch {
    // Stripe failed — send them to deals so at least auth succeeded
    return NextResponse.redirect(new URL('/deals', origin))
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { plan?: string }
  const plan = body.plan === 'monthly' ? 'monthly' : 'annual'
  const priceId = PRICE_IDS[plan]

  const stripe = getStripe()
  const origin = req.nextUrl.origin

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { user_id: session.user.id, plan },
    },
    customer_email: session.user.email ?? undefined,
    consent_collection: { terms_of_service: 'required' },
    success_url: `${origin}/account?checkout=success`,
    cancel_url: `${origin}/#pricing`,
    metadata: { user_id: session.user.id, plan },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
