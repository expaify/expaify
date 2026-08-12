import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import JoinForm from './_form'

export const metadata: Metadata = {
  title: 'Join expaify — never overpay for a hotel again',
  description: 'Get daily hotel deal alerts across 20 destinations, each one 30%+ below its 60-day median price. Start your trial.',
  alternates: { canonical: 'https://expaify.com/join' },
}

type PageProps = {
  searchParams: Promise<{ plan?: string }>
}

export default async function JoinPage({ searchParams }: PageProps) {
  const session = await auth()
  const params = await searchParams
  const plan = params.plan === 'monthly' ? 'monthly' : 'annual'

  // Signed-in free users land here from account/deal upsells. Send them straight
  // to checkout instead of bouncing back to account.
  if (session?.user?.id) redirect(`/api/stripe/checkout?plan=${plan}&redirect=true`)

  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
