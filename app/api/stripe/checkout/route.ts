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
    success_url: `${origin}/account?checkout=success`,
    cancel_url: `${origin}/#pricing`,
    metadata: { user_id: session.user.id, plan },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
