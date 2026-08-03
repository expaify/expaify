import type { Metadata } from 'next'
import { HotelEvChargingHarness } from '@/app/components/research/HotelEvChargingHarness'

export const metadata: Metadata = { title: 'Hotel EV-charging research fixture', description: 'Synthetic, non-production comprehension fixtures.', robots: { index: false, follow: false } }

export default function HotelEvChargingResearchPage() { return <HotelEvChargingHarness /> }
