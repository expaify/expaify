import type { Metadata } from 'next'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import { LandingNav } from '../components/LandingNav'
import { DealFeed } from './DealFeed'

export const metadata: Metadata = {
  title: 'Hotel deals today — expaify',
  description: 'We track 20 destinations daily and surface hotel deals 30–50% below their 60-day average price.',
}

export default async function DealsPage() {
  const session = await auth()
  if (session?.user?.id) {
    const sub = await getSubscription(session.user.id).catch(() => null)
    if (!sub?.onboardingDone) redirect('/onboarding')
  }

  return (
    <>
      <LandingNav />
      <main className="mx-auto max-w-[1140px] px-5 pb-24 pt-10">
        <div className="mb-2">
          <h1 className="font-display text-[32px] font-bold leading-tight text-[color:var(--ink)] min-[900px]:text-[40px]">
            Today&apos;s hotel deals
          </h1>
          <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
            Deals across 20 destinations, updated daily
          </p>
        </div>
        <DealFeed />
      </main>
    </>
  )
}
