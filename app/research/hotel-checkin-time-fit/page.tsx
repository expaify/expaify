import type { Metadata } from 'next'
import { HotelCheckinTimeFitResearchHarness } from '@/app/components/research/HotelCheckinTimeFitPrototype'

export const metadata: Metadata = {
  title: 'Hotel time-fit research prototype',
  description: 'A synthetic, non-production hotel arrival and departure time-fit prototype.',
  robots: { index: false, follow: false },
}

export default function HotelCheckinTimeFitResearchPage() {
  return <HotelCheckinTimeFitResearchHarness />
}
