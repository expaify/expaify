'use client'

import { useMemo, useState } from 'react'
import { HotelHousekeepingPolicyPanel, type HousekeepingSurface, type HousekeepingVariant } from './HotelHousekeepingPolicyPanel'
import { createHousekeepingFixture, HOUSEKEEPING_FIXTURE_IDS, HOUSEKEEPING_FIXTURE_LABELS, resolveHousekeepingPresentation, type HousekeepingFixtureId } from './hotelHousekeepingFixtures'

const SURFACES: Record<HousekeepingSurface, string> = {
  saved_detail: 'Saved-deal detail',
  saved_handoff: 'Saved-deal handoff',
  offer_detail: 'HotelCard details',
  review_handoff: 'Hotel review handoff',
}

function PreviewFrame({ surface, children, ctaLabel }: { surface: HousekeepingSurface; children: React.ReactNode; ctaLabel: string }) {
  const handoff = surface === 'saved_handoff' || surface === 'review_handoff'
  return (
    <article className="min-w-0 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
      <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Research Harbor Hotel</p>
      <h2 className="mt-1 text-h3 text-[color:var(--text-1)]">{handoff ? 'Check rooms with provider' : 'Hotel fit'}</h2>
      {handoff ? <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Confirm the room, rate, and current property terms on the provider’s site before booking.</p> : <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><div><dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Hotel class</dt><dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">4-star hotel class from a booking partner</dd></div><div><dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Guest rating</dt><dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">8.7 out of 10</dd></div></dl>}
      <div className="mt-5">{children}</div>
      {handoff ? <button type="button" aria-label={ctaLabel} className="btn btn-primary mt-4 w-full">Check rooms at Prototype Hotel Partner</button> : null}
    </article>
  )
}

export function HotelHousekeepingResearchHarness() {
  const [fixtureId, setFixtureId] = useState<HousekeepingFixtureId>('F1')
  const [surface, setSurface] = useState<HousekeepingSurface>('saved_detail')
  const [variant, setVariant] = useState<HousekeepingVariant>('summary_first')
  const [viewport, setViewport] = useState<'375' | '1280'>('375')
  const [retryOutcome, setRetryOutcome] = useState<'success' | 'failure'>('success')
  const [resetKey, setResetKey] = useState(0)
  const fixture = useMemo(() => createHousekeepingFixture(fixtureId), [fixtureId, resetKey])
  const presentation = resolveHousekeepingPresentation(fixture)
  const ctaLabel = `${presentation.primary}${presentation.action ? ` ${presentation.action}` : ''} Confirm the cleaning, towel, and bed-linen terms with the provider.`

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <p className="rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-muted)] px-3 py-2 text-caption font-semibold text-[color:var(--text-2)]">Research prototype — policies shown here are fictional</p>
        <h1 className="mt-4 text-h2 text-[color:var(--text-1)]">Room-cleaning policy comprehension</h1>
        <p className="mt-3 text-body text-[color:var(--text-2)]">Fixture-backed study surface only. It does not query providers, change rankings, send service requests, open booking links, or emit production analytics.</p>
      </header>

      <section aria-labelledby="housekeeping-research-controls" className="card mt-6 p-4 sm:p-5">
        <h2 id="housekeeping-research-controls" className="text-h3 text-[color:var(--text-1)]">Research setup</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-[color:var(--text-1)]">Evidence scenario
            <select value={fixtureId} onChange={event => setFixtureId(event.target.value as HousekeepingFixtureId)} className="input mt-2 w-full">
              {HOUSEKEEPING_FIXTURE_IDS.map(id => <option key={id} value={id}>{HOUSEKEEPING_FIXTURE_LABELS[id]}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-[color:var(--text-1)]">Surface
            <select value={surface} onChange={event => setSurface(event.target.value as HousekeepingSurface)} className="input mt-2 w-full">
              {Object.entries(SURFACES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-[color:var(--text-1)]">Presentation variant
            <select value={variant} onChange={event => setVariant(event.target.value as HousekeepingVariant)} className="input mt-2 w-full">
              <option value="summary_first">A — summarized dimensions</option>
              <option value="wording_first">B — provider wording first</option>
            </select>
          </label>
          <label className="text-sm font-medium text-[color:var(--text-1)]">Assigned viewport
            <select value={viewport} onChange={event => setViewport(event.target.value as '375' | '1280')} className="input mt-2 w-full">
              <option value="375">375px mobile</option>
              <option value="1280">1280px desktop</option>
            </select>
          </label>
        </div>
        {fixtureId === 'F8' ? <fieldset className="mt-4"><legend className="text-sm font-medium text-[color:var(--text-1)]">Deterministic retry result</legend><div className="mt-2 flex flex-wrap gap-4"><label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="retry-result" value="success" checked={retryOutcome === 'success'} onChange={() => setRetryOutcome('success')} />Resolve to F1</label><label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="retry-result" value="failure" checked={retryOutcome === 'failure'} onChange={() => setRetryOutcome('failure')} />Keep F8</label></div></fieldset> : null}
        <button type="button" onClick={() => setResetKey(value => value + 1)} className="btn btn-outline mt-4 w-full sm:w-auto">Reset scenario</button>
      </section>

      <section aria-labelledby="participant-preview-title" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="participant-preview-title" className="text-h3 text-[color:var(--text-1)]">Participant stimulus preview</h2><p className="text-caption text-[color:var(--text-3)]">{viewport}px assignment · revision {fixture.evidenceRevision}</p></div>
        <div className="mt-4 min-w-0 pb-2">
          <div style={{ maxWidth: viewport === '375' ? '375px' : '1180px' }} className="mx-auto min-w-0">
            <PreviewFrame surface={surface} ctaLabel={ctaLabel}>
              <HotelHousekeepingPolicyPanel key={`${fixtureId}-${surface}-${variant}-${retryOutcome}-${resetKey}`} fixture={fixture} surface={surface} variant={variant} retryOutcome={retryOutcome} />
            </PreviewFrame>
          </div>
        </div>
      </section>
    </main>
  )
}
