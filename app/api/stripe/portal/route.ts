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

function getOrigin(): string {
  return (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? 'https://expaify.com').replace(/\/$/, '')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sub = await getSubscription(session.user.id)
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing record found' }, { status: 404 })
  }

  const stripe = getStripe()
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${getOrigin()}/account`,
  })

  return NextResponse.json({ url: portal.url })
}
