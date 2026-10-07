import { auth } from '@/auth'
import { getSubscription, isPremium } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import { OnboardingClient } from './OnboardingClient'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set up your account — expaify',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ city?: string }>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const sub = await getSubscription(session.user.id).catch(() => null)
  if (sub?.onboardingDone) redirect('/deals')

  const { city } = await searchParams
  const initialCity = city && TRACKED_MARKET_NAMES.includes(city) ? city : undefined

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[color:var(--bg)]">
      <OnboardingClient premium={sub ? isPremium(sub.status) : false} initialCity={initialCity} />
    </main>
  )
}

