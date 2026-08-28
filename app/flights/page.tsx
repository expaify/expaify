import type { Metadata } from 'next'
import { LandingNav } from '../components/LandingNav'
import { FlightsClient } from './FlightsClient'

export const metadata: Metadata = {
  title: 'Search hotels — expaify',
  description: 'Compare live hotel rates across providers and see which ones are an honest deal.',
  alternates: { canonical: 'https://expaify.com/flights' },
}

export default function FlightsPage() {
  return (
    <>
      <LandingNav />
      <main className="mx-auto max-w-[1140px] px-5 pb-24 pt-10">
        <h1 className="text-h2 mb-4 font-display text-[color:var(--ink)]">Search hotels across providers</h1>
        <FlightsClient />
      </main>
    </>
  )
}
