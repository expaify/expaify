import type { Metadata } from 'next'
import { LandingNav } from '../components/LandingNav'
import { FlightsClient } from './FlightsClient'

export const metadata: Metadata = {
  title: 'Search flights — expaify',
  description: 'Compare live flight fares across providers and see which ones are an honest deal.',
}

export default function FlightsPage() {
  return (
    <>
      <LandingNav />
      <main className="mx-auto max-w-[1140px] px-5 pb-24 pt-10">
        <FlightsClient />
      </main>
    </>
  )
}
