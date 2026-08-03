'use client'

import { useState } from 'react'
import { DealCard } from '@/app/components/ui/DealCard'
import { HotelEvChargingHandoffNotice, HotelEvChargingSection, hotelEvChargingActionBoundary } from '@/app/components/HotelEvCharging'
import { createHotelEvChargingFixture, HOTEL_EV_CHARGING_FIXTURE_IDS, type HotelEvChargingFixtureId } from './hotelEvChargingFixtures'

const LABELS: Record<HotelEvChargingFixtureId, string> = {
  confirmed_presence_only: 'Confirmed · presence only', limited_paid_unknown_amount: 'Limited · paid, amount unknown',
  limited_reservation: 'Limited · reservation required', limited_multi: 'Limited · four conditions',
  unknown_not_returned: 'Unknown · not returned', unknown_off_site: 'Unknown · off-site only',
  unknown_conflict: 'Unknown · conflicting', unknown_malformed: 'Unknown · malformed', explicit_negative: 'Explicit negative',
  included_cost: 'No charging fee reported', exact_cost: 'Exact cost · $25/session', connector_label: 'Connector label · J1772',
  initial_loading: 'Initial loading', refresh_known: 'Refresh with known evidence', error_empty: 'Error and retry',
  property_mismatch: 'Property mismatch',
}

export function HotelEvChargingHarness() {
  const [fixtureId, setFixtureId] = useState<HotelEvChargingFixtureId>('confirmed_presence_only')
  const evidence = createHotelEvChargingFixture(fixtureId)
  return <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
    <header className="max-w-3xl"><p className="text-caption font-medium uppercase tracking-wide text-[color:var(--error-text)]">Research fixture — not live hotel information</p><h1 className="mt-2 text-h2 text-[color:var(--text-1)]">Hotel EV-charging confidence</h1><p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">Synthetic records only. This route does not query a provider, change ranking or Deal Score, reserve a connector, or assert live availability.</p></header>
    <section aria-labelledby="ev-fixture-controls" className="card mt-6 p-4 sm:p-5"><h2 id="ev-fixture-controls" className="text-h3 text-[color:var(--text-1)]">Comprehension fixture</h2><label className="mt-4 block max-w-xl text-sm font-medium text-[color:var(--text-1)]">Evidence state<select className="field-input mt-1.5 w-full" value={fixtureId} onChange={event => setFixtureId(event.target.value as HotelEvChargingFixtureId)}>{HOTEL_EV_CHARGING_FIXTURE_IDS.map(id => <option key={id} value={id}>{LABELS[id]}</option>)}</select></label></section>
    <div className="mt-6 grid min-w-0 gap-6 min-[1000px]:grid-cols-2 min-[1000px]:items-start">
      <section aria-labelledby="ev-result-preview" className="min-w-0"><h2 id="ev-result-preview" className="sr-only">Result-card preview</h2><p className="mb-2 text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Active result pattern</p><DealCard deal={{ id: 'research-ev-hotel', hotelName: 'Research Harbor Hotel', city: 'Portland', stars: 4, dealPrice: { priceCents: 18400, currency: 'USD' }, medianPrice: { priceCents: 23500, currency: 'USD' }, discountPct: 22, checkInWindow: 'Sep 14–16', snapshotCount: 18, links: {}, isMock: true }} evChargingEvidence={evidence} /></section>
      <section aria-labelledby="ev-detail-preview" className="card min-w-0 p-4 sm:p-6"><p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Hotel fit and handoff</p><h2 id="ev-detail-preview" className="mt-2 text-xl font-medium text-[color:var(--text-1)]">Hotel fit</h2><HotelEvChargingSection evidence={evidence} offerId="research-ev-hotel" onRetry={fixtureId === 'error_empty' ? async () => false : undefined} /><div className="mt-5"><HotelEvChargingHandoffNotice evidence={evidence} offerId="research-ev-hotel" /></div><a href="#ev-fixture-controls" aria-label={`Check rooms at Research Rooms for Research Harbor Hotel. Opens in a new tab. ${hotelEvChargingActionBoundary(evidence)}`} className="btn-primary mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-4 text-center text-sm font-medium">Check rooms at Research Rooms</a><p className="mt-2 text-center text-xs leading-5 text-[color:var(--text-3)]">Synthetic action only. No provider navigation occurs.</p></section>
    </div>
  </main>
}
