'use client'

import { useState } from 'react'
import { HotelBookingOwnershipDisclosure } from '@/app/components/HotelBookingOwnership'
import { HotelLoyaltyEligibilityDisclosure } from '@/app/components/HotelLoyaltyEligibility'
import { HotelLuggageStoragePrototype } from './HotelLuggageStoragePrototype'
import {
  evidenceForSurface,
  LUGGAGE_STORAGE_FIXTURE_IDS,
  type LuggageStorageFixtureId,
} from './hotelLuggageStorageFixtures'

const FIXTURE_LABELS: Record<LuggageStorageFixtureId, string> = {
  'complete-included': 'Complete · no charge reported',
  'complete-paid': 'Complete · paid per bag',
  'partial-before': 'Partial · after checkout unknown',
  'partial-after': 'Partial · before check-in unknown',
  'before-unavailable': 'Before check-in unavailable',
  'after-unavailable': 'After checkout unavailable',
  'service-unavailable': 'Service unavailable',
  'conflicting-timing': 'Conflicting timing',
  'not-returned': 'Not returned',
  loading: 'Loading',
  error: 'Error and retry',
  'revision-mismatch': 'Revision mismatch at handoff',
}

const SCENARIOS = {
  early: 'You arrive at 8:00 AM. Hotel check-in begins at 3:00 PM. You need somewhere to leave your bags before check-in.',
  late: 'You check out at 11:00 AM and leave for the airport at 8:00 PM. You need somewhere to leave your bags after checkout.',
} as const

const FACT_QUESTIONS = [
  { label: 'Does the property report luggage storage?', options: ['Yes', 'No', 'Not provided', 'Conflicting', 'Could not be checked'] },
  { label: 'Does it apply before check-in?', options: ['Yes', 'No', 'Not specified', 'Conflicting', 'Could not be checked'] },
  { label: 'Does it apply after checkout?', options: ['Yes', 'No', 'Not specified', 'Conflicting', 'Could not be checked'] },
  { label: 'What is the charge state?', options: ['No charge reported', 'Paid', 'Unknown', 'Not applicable', 'Could not be checked'] },
  { label: 'Does this guarantee storage for this stay?', options: ['Yes', 'No', 'Not sure'] },
] as const

function ContextPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3"><h4 className="text-sm font-medium text-[color:var(--text-1)]">{title}</h4><p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{children}</p></section>
}

export function HotelLuggageStorageHarness() {
  const [fixtureId, setFixtureId] = useState<LuggageStorageFixtureId>('complete-included')
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>('early')
  const [factAnswers, setFactAnswers] = useState<string[]>(() => FACT_QUESTIONS.map(() => ''))
  const [decision, setDecision] = useState('')
  const detailEvidence = evidenceForSurface(fixtureId, 'detail')
  const handoffEvidence = evidenceForSurface(fixtureId, 'handoff')

  const resetStudyAnswers = () => {
    setFactAnswers(FACT_QUESTIONS.map(() => ''))
    setDecision('')
  }
  const factsComplete = factAnswers.every(Boolean)

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--error-text)]">Deferred validation prototype · not production</p>
        <h1 className="mt-2 text-h2 text-[color:var(--text-1)]">Hotel luggage-storage confidence</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">Synthetic evidence only. This route does not query a provider, alter hotel ranking, reserve storage, contact a property, or send a luggage request.</p>
      </header>

      <section aria-labelledby="study-controls" className="card mt-6 p-4 sm:p-5">
        <h2 id="study-controls" className="text-h3 text-[color:var(--text-1)]">Research setup</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-[color:var(--text-1)]">Evidence fixture
            <select className="field-input mt-1.5 w-full" value={fixtureId} onChange={event => { setFixtureId(event.target.value as LuggageStorageFixtureId); resetStudyAnswers() }}>
              {LUGGAGE_STORAGE_FIXTURE_IDS.map(id => <option key={id} value={id}>{FIXTURE_LABELS[id]}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-[color:var(--text-1)]">Traveler scenario
            <select className="field-input mt-1.5 w-full" value={scenario} onChange={event => { setScenario(event.target.value as keyof typeof SCENARIOS); resetStudyAnswers() }}>
              <option value="early">Early arrival</option>
              <option value="late">Late departure</option>
            </select>
          </label>
        </div>
        <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-muted)] px-3.5 py-3">
          <p className="text-sm font-medium text-[color:var(--text-1)]">Scenario prompt</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{SCENARIOS[scenario]}</p>
        </div>
      </section>

      <div className="mt-6 grid min-w-0 gap-6 min-[1000px]:grid-cols-2 min-[1000px]:items-start">
        <section aria-labelledby="detail-preview-title" className="card min-w-0 overflow-hidden">
          <div className="p-4 sm:p-5">
            <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Expanded hotel detail</p>
            <h2 id="detail-preview-title" className="mt-2 text-h3 break-words text-[color:var(--text-1)]">Research Harbor Hotel</h2>
            <p className="mt-2 text-sm text-[color:var(--text-2)]">Synthetic property · 14 Research Way</p>
          </div>
          <div className="space-y-3 border-t border-[color:var(--border)] p-4 sm:p-5">
            <ContextPanel title="Access & room requests">Access features and room requests must be confirmed with the booking provider.</ContextPanel>
            <HotelLuggageStoragePrototype evidence={detailEvidence} hotelId="research-harbor" surface="detail" />
            <ContextPanel title="Price scope">$184.00 per night before taxes and fees. Synthetic research rate.</ContextPanel>
          </div>
          <a href="#outbound-review" className="btn btn-primary m-4 mt-0 w-[calc(100%-2rem)] sm:m-5 sm:mt-0 sm:w-[calc(100%-2.5rem)]">Review hotel</a>
        </section>

        <section id="outbound-review" aria-labelledby="handoff-preview-title" className="card min-w-0 p-4 sm:p-6">
          <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Outbound hotel review</p>
          <h2 id="handoff-preview-title" className="mt-2 text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl">Check rooms with provider</h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.</p>
          <HotelBookingOwnershipDisclosure partner={{ label: 'Research Rooms', named: true }} />
          <HotelLoyaltyEligibilityDisclosure partner={{ label: 'Research Rooms', named: true }} />
          <div className="mt-5"><HotelLuggageStoragePrototype evidence={handoffEvidence} hotelId="research-harbor" surface="handoff" /></div>
          <div className="mt-5 flex flex-col gap-3">
            <a href="https://example.com/research/rooms?aff_id=research-prototype" target="_blank" rel="noopener noreferrer sponsored" className="btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-4 text-center text-sm font-medium">Check rooms at Research Rooms<span className="sr-only"> (opens in a new tab)</span></a>
            <p className="text-center text-xs leading-5 text-[color:var(--text-3)]">Opens the synthetic research provider in a new tab. No storage request is sent.</p>
          </div>
        </section>
      </div>

      <section aria-labelledby="response-title" className="card mt-6 p-4 sm:p-6">
        <h2 id="response-title" className="text-h3 text-[color:var(--text-1)]">Moderator response capture</h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Record all five factual answers before the decision and confidence controls appear.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{FACT_QUESTIONS.map((question, index) => <label key={question.label} className="min-w-0 text-sm font-medium text-[color:var(--text-1)]">{question.label}<select value={factAnswers[index]} onChange={event => { const next = [...factAnswers]; next[index] = event.target.value; setFactAnswers(next); setDecision('') }} className="field-input mt-1.5 w-full"><option value="" disabled>Select an answer</option>{question.options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}</div>
        {factsComplete ? <div className="mt-4 border-t border-[color:var(--border)] pt-4"><fieldset><legend className="text-sm font-medium text-[color:var(--text-1)]">Would you keep, rule out, or verify this hotel?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{['Keep', 'Rule out', 'Verify'].map(value => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--border)] px-3 text-sm text-[color:var(--text-2)]"><input type="radio" name="storage-decision" value={value} checked={decision === value} onChange={() => setDecision(value)} />{value}</label>)}</div></fieldset>{decision ? <label className="mt-4 block text-sm font-medium text-[color:var(--text-1)]">How confident are you? <select defaultValue="" className="field-input mt-1.5 w-full sm:max-w-xs"><option value="" disabled>Select 1–5</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}</select></label> : null}</div> : null}
      </section>
    </main>
  )
}
