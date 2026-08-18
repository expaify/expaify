import type { Metadata } from 'next'
import { HotelHousekeepingResearchHarness } from '@/app/components/research/HotelHousekeepingResearchHarness'

export const metadata: Metadata = {
  title: 'Hotel housekeeping-frequency research prototype — expaify',
  description: 'A fictional, fixture-backed room-cleaning policy comprehension prototype.',
  robots: { index: false, follow: false },
}

export default function HotelHousekeepingFrequencyResearchPage() {
  return <HotelHousekeepingResearchHarness />
}
