import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSubscription, isPremium } from '@/lib/subscription'
import JoinForm from './_form'

export const metadata: Metadata = {
  title: 'Join expaify — never overpay for a hotel again',
  description: 'Get daily hotel deal alerts across 26 destinations, each one 30%+ below its 60-day median price. Start your trial.',
  alternates: { canonical: 'https://expaify.com/join' },
}

type PageProps = {
  searchParams: Promise<{ plan?: string }>
}

export default async function JoinPage({ searchParams }: PageProps) {
  const session = await auth()
  const params = await searchParams
  const plan = params.plan === 'monthly' ? 'monthly' : 'annual'

  // Signed-in users land here from account/deal upsells, a stale bookmark, or the
  // canonical/indexed URL itself. Already-premium users have nothing to buy here —
  // send them to /account. Free users get an expaify-owned confirm step before the
  // real Stripe handoff, instead of an instant, unannounced redirect.
  if (session?.user?.id) {
    const sub = await getSubscription(session.user.id)

    if (isPremium(sub?.status ?? 'free')) {
      redirect('/account')
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-5">
        <div className="w-full max-w-[440px]">
          <a
            href="/"
            className="mb-10 flex items-center gap-0.5 font-display text-xl font-bold text-[color:var(--ink)] no-underline"
          >
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>

          <h1 className="mb-2 font-display text-2xl font-bold text-[color:var(--ink)]">
            Confirm your plan
          </h1>
          <p className="mb-6 text-base text-[color:var(--ink-soft)]">
            7 days free. Cancel before day 7 and you pay nothing.
          </p>

          <div className="mb-5 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-5">
            <p className="mb-2 text-sm font-medium text-[color:var(--ink-soft)]">
              {plan === 'annual' ? 'Annual plan' : 'Monthly plan'}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl font-bold text-[color:var(--ink)]">
                {plan === 'annual' ? '$8' : '$12'}
              </span>
              <span className="text-sm text-[color:var(--ink-faint)]">
                {plan === 'annual' ? '/ month, billed $96/year' : '/ month'}
              </span>
            </div>
            <p className="mt-1 text-sm text-[color:var(--ink-faint)]">
              7-day free trial — no charge until day 8
            </p>
          </div>

          <a
            href={`/api/stripe/checkout?plan=${plan}&redirect=true`}
            className="btn btn-conversion w-full justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
          >
            Continue to secure checkout
          </a>

          <p className="mt-4 text-center text-xs text-[color:var(--ink-faint)]">
            Secure checkout via Stripe · cancel anytime
          </p>
        </div>
      </div>
    )
  }

  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
