import type { Metadata } from 'next'
import { HotelLuggageStorageHarness } from '@/app/components/research/HotelLuggageStorageHarness'

export const metadata: Metadata = {
  title: 'Hotel luggage-storage research prototype',
  description: 'A synthetic, non-production validation prototype.',
  robots: { index: false, follow: false },
}

export default function HotelLuggageStorageResearchPage() {
  return <HotelLuggageStorageHarness />
}
