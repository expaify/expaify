import { auth } from '@/auth'
import { getSubscription, isPremium } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import { OnboardingClient } from './OnboardingClient'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const sub = await getSubscription(session.user.id).catch(() => null)
  if (sub?.onboardingDone) redirect('/deals')

  return (
    <main className="min-h-screen bg-[color:var(--bg)]">
      <OnboardingClient premium={sub ? isPremium(sub.status) : false} />
    </main>
  )
}
