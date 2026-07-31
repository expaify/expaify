'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  createHotelTimeFitFixture,
  DISABLED_STANDARD_END_FIXTURE,
  formatLocalTime,
  HOTEL_TIME_FIT_FIXTURE_IDS,
  resolveHotelTimeFit,
  type TimeFitFixture,
  type TimeFitFixtureId,
} from './hotelCheckinTimeFitFixtures'

const RESEARCH_LABEL = 'Research prototype — hotel time fit is not part of ranking or Deal Score.'
const CAPABILITY_BOUNDARY = 'expaify has not selected, sent, acknowledged, or guaranteed a time exception.'

const FIXTURE_LABELS: Record<TimeFitFixtureId, string> = Object.fromEntries(
  HOTEL_TIME_FIT_FIXTURE_IDS.map(id => [id, createHotelTimeFitFixture(id).label]),
) as Record<TimeFitFixtureId, string>

type Hierarchy = 'outcome_first' | 'facts_first'
type FullSurface = 'detail' | 'handoff'

function usableFact(fact: TimeFitFixture['evidence']['arrivalFrom']): boolean {
  return fact.status === 'confirmed' && Boolean(fact.time && fact.sourceLabel) && !fact.stale
}

function sourceDate(value: string | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(parsed)
}

function PublishedFacts({ fixture }: { fixture: TimeFitFixture }) {
  const { evidence, scenario } = fixture
  const relevant = scenario.kind === 'arrival' ? evidence.arrivalFrom : evidence.departureBy
  const hasArrival = usableFact(evidence.arrivalFrom)
  const hasDeparture = usableFact(evidence.departureBy)
  const hasObligation = evidence.lateArrival.status === 'confirmed' && Boolean(evidence.lateArrival.cutoff)
  const hasConflict = Boolean(evidence.conflictingFacts?.length)
  const noUsableFact = !hasArrival && !hasDeparture && !hasObligation && !hasConflict

  return (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3">
      <h4 className="text-small font-bold text-[color:var(--text-1)]">Published standard times</h4>
      {hasConflict ? (
        <ul className="mt-2 space-y-2 text-small text-[color:var(--text-2)]">
          {evidence.conflictingFacts?.map(fact => (
            <li key={`${fact.sourceLabel}-${fact.statement}`} className="break-words">
              <span className="font-semibold text-[color:var(--text-1)]">{fact.sourceLabel}:</span> {fact.statement}
            </li>
          ))}
        </ul>
      ) : null}
      {!hasConflict && hasArrival ? <p className="mt-2 break-words text-small text-[color:var(--text-2)]">Standard room access starts: {formatLocalTime(evidence.arrivalFrom.time as string)}</p> : null}
      {!hasConflict && hasDeparture ? <p className="mt-2 break-words text-small text-[color:var(--text-2)]">Room-vacate deadline: {formatLocalTime(evidence.departureBy.time as string)}</p> : null}
      {hasObligation ? <p className="mt-2 break-words text-small text-[color:var(--text-2)]">Late-arrival instruction: Contact the property before arrival if you arrive after {formatLocalTime(evidence.lateArrival.cutoff as string)}.</p> : null}
      {noUsableFact ? <p className="mt-2 text-small text-[color:var(--text-2)]">No usable published standard time is available for this comparison.</p> : null}
      {relevant.stale ? <p className="mt-2 text-small font-medium text-[color:var(--text-2)]">The published time is out of date and is not used for this comparison.</p> : null}
    </div>
  )
}

function exceptionContent(fixture: TimeFitFixture, outcome: ReturnType<typeof resolveHotelTimeFit>['outcome']) {
  if (fixture.exceptionPath === 'early_request') return {
    heading: 'Exception and next step',
    copy: 'Early check-in is request-only and not guaranteed. Ask the booking partner while booking; expaify does not send it.',
  }
  if (fixture.exceptionPath === 'late_request') return {
    heading: 'Exception and next step',
    copy: 'Late checkout is request-only and not guaranteed. Ask the booking partner while booking; expaify does not send it.',
  }
  if (fixture.exceptionPath === 'contact_obligation') return {
    heading: 'Required next step',
    copy: 'The published instruction requires contacting the property before arrival. This does not show whether your arrival fits the standard check-in period.',
  }
  if (fixture.exceptionPath === 'none_published' && outcome !== 'fits_standard') return {
    heading: 'Exception and next step',
    copy: 'No exception path is published. Verify with the property or booking partner before booking.',
  }
  if (outcome === 'fits_standard') return {
    heading: 'Next step',
    copy: 'No time exception is indicated by this comparison. Confirm current property policies with the booking partner before payment.',
  }
  if (['conflicting_boundary', 'malformed_time', 'evidence_error'].includes(fixture.id)) return {
    heading: 'Next step',
    copy: 'Verify the current times and any exception directly with the property or booking partner before booking.',
  }
  return {
    heading: 'Next step',
    copy: 'The source does not publish an exception path. Verify before booking if this timing affects your stay.',
  }
}

function NextStep({ fixture, outcome, surface }: {
  fixture: TimeFitFixture
  outcome: ReturnType<typeof resolveHotelTimeFit>['outcome']
  surface: FullSurface
}) {
  const content = exceptionContent(fixture, outcome)
  const requestOnly = fixture.exceptionPath === 'early_request' || fixture.exceptionPath === 'late_request'
  return (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3">
      <h4 className="text-small font-bold text-[color:var(--text-1)]">{content.heading}</h4>
      <p className="mt-2 text-small text-[color:var(--text-2)]">{content.copy}</p>
      {surface === 'handoff' && requestOnly ? <p className="mt-2 text-small font-semibold text-[color:var(--text-2)]">See Special requests below for how requests work.</p> : null}
    </div>
  )
}

function SourceMetadata({ fixture }: { fixture: TimeFitFixture }) {
  const { evidence, scenario } = fixture
  if (evidence.conflictingFacts?.length) {
    const sources = evidence.conflictingFacts.map(fact => fact.sourceLabel).join(' and ')
    return <p className="mt-3 break-words text-caption text-[color:var(--text-3)]">Conflicting property information from {sources}. No source was chosen as current.</p>
  }
  const relevant = scenario.kind === 'arrival' ? evidence.arrivalFrom : evidence.departureBy
  const obligationIsRelevant = fixture.exceptionPath === 'contact_obligation'
  const source = relevant.sourceLabel || (obligationIsRelevant ? evidence.lateArrival.sourceLabel : '')
  const observed = relevant.fetchedAt || (obligationIsRelevant ? evidence.lateArrival.fetchedAt : undefined)
  if (!source) return <p className="mt-3 text-caption text-[color:var(--text-3)]">A usable source was not supplied. Check the current policy before booking.</p>
  const checked = sourceDate(observed)
  return <p className="mt-3 break-words text-caption text-[color:var(--text-3)]">Property information from {source} · {checked ? `Checked ${checked}` : 'Check the current policy before booking.'}</p>
}

export function HotelCheckinTimeFitPrototype({
  fixture,
  surface,
  hierarchy = 'outcome_first',
  allowRetry = false,
  announceAsync = true,
}: {
  fixture: TimeFitFixture
  surface: FullSurface
  hierarchy?: Hierarchy
  allowRetry?: boolean
  announceAsync?: boolean
}) {
  const [retryTarget, setRetryTarget] = useState<TimeFitFixtureId | null>(null)
  const retryButtonRef = useRef<HTMLButtonElement>(null)
  const effectiveFixture = retryTarget ? createHotelTimeFitFixture(retryTarget) : fixture
  const presentation = resolveHotelTimeFit(effectiveFixture)
  const titleId = `hotel-time-fit-${surface}-${fixture.id}`
  const loading = presentation.reason === 'evidence_loading'
  const canRetry = allowRetry && Boolean(fixture.deterministicRetryTo)
  const asyncResolved = retryTarget !== null
  const outcomeBlock = (
    <div>
      <p className="text-caption font-semibold uppercase tracking-wide text-[color:var(--text-3)]">Arrival and departure time fit</p>
      <h3 id={titleId} className="mt-1 text-h3 text-[color:var(--text-1)]">{presentation.outcomeCopy}</h3>
      <p
        role={announceAsync && (loading || asyncResolved) ? 'status' : undefined}
        aria-live={announceAsync && (loading || asyncResolved) ? 'polite' : undefined}
        aria-atomic={announceAsync && (loading || asyncResolved) ? 'true' : undefined}
        className={`mt-2 text-body font-medium ${presentation.reason === 'evidence_error' ? 'text-[color:var(--error-text)]' : 'text-[color:var(--text-1)]'}`}
      >
        {presentation.comparisonCopy}
      </p>
    </div>
  )
  const factsBlock = <PublishedFacts fixture={effectiveFixture} />

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={loading || undefined}
      data-fixture-revision={effectiveFixture.evidence.evidenceRevision}
      className={`min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4 ${presentation.outcome === 'fits_standard' ? '' : 'border-l-4 border-l-[color:var(--gold-deep)]'}`}
    >
      {hierarchy === 'facts_first' ? factsBlock : outcomeBlock}
      {loading ? (
        <div aria-hidden="true" className="mt-4 space-y-2">
          <div className="h-4 animate-pulse rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
          <div className="h-4 w-5/6 animate-pulse rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
          <div className="h-4 w-2/3 animate-pulse rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
        </div>
      ) : (
        <>
          {hierarchy === 'facts_first' ? <div className="mt-4">{outcomeBlock}</div> : <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2"><PublishedFacts fixture={effectiveFixture} /><NextStep fixture={effectiveFixture} outcome={presentation.outcome} surface={surface} /></div>}
          {hierarchy === 'facts_first' ? <div className="mt-4"><NextStep fixture={effectiveFixture} outcome={presentation.outcome} surface={surface} /></div> : null}
        </>
      )}
      {loading ? <div className="mt-4"><NextStep fixture={effectiveFixture} outcome={presentation.outcome} surface={surface} /></div> : null}
      {canRetry ? (
        <button
          ref={retryButtonRef}
          type="button"
          className="btn btn-outline mt-4 w-full sm:w-auto"
          disabled={asyncResolved}
          onClick={() => {
            setRetryTarget(fixture.deterministicRetryTo as TimeFitFixtureId)
            window.requestAnimationFrame(() => retryButtonRef.current?.focus())
          }}
        >
          {asyncResolved ? 'Scenario check updated' : 'Retry scenario check'}
        </button>
      ) : null}
      <p className="mt-3 text-caption text-[color:var(--text-3)]">{CAPABILITY_BOUNDARY}</p>
      <SourceMetadata fixture={effectiveFixture} />
      <p className="mt-3 text-caption font-semibold text-[color:var(--text-2)]">{RESEARCH_LABEL}</p>
      <p className="mt-1 text-caption text-[color:var(--text-3)]">Fixture revision: {effectiveFixture.evidence.evidenceRevision}</p>
    </section>
  )
}

function ResultComparison({ fixture }: { fixture: TimeFitFixture }) {
  const presentation = resolveHotelTimeFit(fixture)
  return (
    <div className="min-w-0 text-left">
      <p className="text-small font-bold text-[color:var(--text-1)]">{presentation.outcomeCopy}</p>
      <p className="mt-1 text-small text-[color:var(--text-2)]">{presentation.comparisonCopy}</p>
      <p className="mt-1 text-caption text-[color:var(--text-3)]">Fixture revision: {fixture.evidence.evidenceRevision}</p>
    </div>
  )
}

const ANSWER_QUESTIONS = [
  'What is the fit outcome?',
  'Which published fact matters?',
  'Is an exception guaranteed?',
  'What should the traveler do next?',
] as const

const INFERENCE_FLAGS = [
  'Available',
  'Sent',
  'Acknowledged',
  'Approved',
  'Guaranteed',
  'Refused',
  'Desk closed',
] as const

export function HotelCheckinTimeFitResearchHarness() {
  const [fixtureId, setFixtureId] = useState<TimeFitFixtureId>('early_arrival_request')
  const [hierarchy, setHierarchy] = useState<Hierarchy>('outcome_first')
  const [assignedViewport, setAssignedViewport] = useState<'375' | '1280'>('375')
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [answers, setAnswers] = useState<string[]>(() => ANSWER_QUESTIONS.map(() => ''))
  const [firstChoice, setFirstChoice] = useState('')
  const [finalChoice, setFinalChoice] = useState('')
  const [confidence, setConfidence] = useState('')
  const [inferences, setInferences] = useState<string[]>([])
  const [detailsUsed, setDetailsUsed] = useState(false)
  const [mismatchTimeMs, setMismatchTimeMs] = useState<number | null>(null)
  const scenarioStartedAt = useRef<number | null>(null)
  const generatedSessionId = useId().replaceAll(':', '')
  const fixture = useMemo(() => createHotelTimeFitFixture(fixtureId), [fixtureId])
  const answersComplete = answers.every(Boolean)

  useEffect(() => {
    scenarioStartedAt.current = Date.now()
  }, [])

  const resetCapture = () => {
    setAnswers(ANSWER_QUESTIONS.map(() => ''))
    setFirstChoice('')
    setFinalChoice('')
    setConfidence('')
    setInferences([])
    setDetailsUsed(false)
    setMismatchTimeMs(null)
    scenarioStartedAt.current = Date.now()
    setDetailsOpen(true)
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <p className="mb-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-muted)] px-3 py-2 text-caption font-semibold text-[color:var(--text-2)]">{RESEARCH_LABEL}</p>
        <h1 className="text-h2 text-[color:var(--text-1)]">Hotel arrival and departure time fit</h1>
        <p className="mt-3 text-body text-[color:var(--text-2)]">Synthetic property facts and researcher-assigned intent only. This route does not query providers, change ranking, send a request, or open a booking link.</p>
      </header>

      <section aria-labelledby="research-setup" className="card mt-6 p-4 sm:p-5">
        <h2 id="research-setup" className="text-h3 text-[color:var(--text-1)]">Research setup</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="min-w-0 text-small font-bold text-[color:var(--text-1)]">Scenario fixture
            <select className="field-input mt-1.5 w-full" value={fixtureId} onChange={event => { setFixtureId(event.target.value as TimeFitFixtureId); resetCapture() }}>
              {HOTEL_TIME_FIT_FIXTURE_IDS.map(id => <option key={id} value={id}>{FIXTURE_LABELS[id]}</option>)}
              <option value={DISABLED_STANDARD_END_FIXTURE.id} disabled>{DISABLED_STANDARD_END_FIXTURE.label} · blocked</option>
            </select>
          </label>
          <label className="min-w-0 text-small font-bold text-[color:var(--text-1)]">Hierarchy condition
            <select className="field-input mt-1.5 w-full" value={hierarchy} onChange={event => { setHierarchy(event.target.value as Hierarchy); resetCapture() }}>
              <option value="outcome_first">Outcome first</option>
              <option value="facts_first">Published facts first</option>
            </select>
          </label>
          <label className="min-w-0 text-small font-bold text-[color:var(--text-1)]">Assigned viewport
            <select className="field-input mt-1.5 w-full" value={assignedViewport} onChange={event => setAssignedViewport(event.target.value as '375' | '1280')}>
              <option value="375">375px mobile</option>
              <option value="1280">1280px desktop</option>
            </select>
          </label>
        </div>
        <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3">
          <p className="text-small font-bold text-[color:var(--text-1)]">Assigned traveler scenario</p>
          <p className="mt-1 text-small text-[color:var(--text-2)]">{fixture.prompt}</p>
        </div>
        <p className="mt-3 text-caption text-[color:var(--text-3)]">{DISABLED_STANDARD_END_FIXTURE.reason}</p>
      </section>

      <section aria-labelledby="product-condition" className="card mt-6 min-w-0 overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-caption font-semibold uppercase tracking-wide text-[color:var(--text-3)]">Synthetic hotel result and detail</p>
          <h2 id="product-condition" className="mt-2 text-h3 text-[color:var(--text-1)]">Research Harbor Hotel</h2>
          <div className="mt-4 grid gap-4 border-y border-[color:var(--border)] py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <ResultComparison fixture={fixture} />
            <button type="button" className="btn btn-outline w-full md:w-auto" aria-expanded={detailsOpen} aria-controls="research-hotel-details" onClick={() => { setDetailsUsed(true); setDetailsOpen(value => !value) }}>Details</button>
          </div>
        </div>
        {detailsOpen ? (
          <div id="research-hotel-details" className="min-w-0 space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
            <section aria-labelledby="stay-details" className="rounded-[var(--radius-control)] border border-[color:var(--border)] p-3">
              <h3 id="stay-details" className="text-small font-bold text-[color:var(--text-1)]">Stay details</h3>
              <p className="mt-1 text-small text-[color:var(--text-2)]">Aug 14–17 · 1 room · 2 adults · synthetic scenario</p>
            </section>
            <section aria-labelledby="price-score" className="rounded-[var(--radius-control)] border border-[color:var(--border)] p-3">
              <h3 id="price-score" className="text-small font-bold text-[color:var(--text-1)]">Price and Deal Score</h3>
              <p className="mt-1 text-small text-[color:var(--text-2)]">$184 per night · Typical · synthetic research values</p>
            </section>
            <section aria-labelledby="hotel-fit-heading" className="min-w-0">
              <h3 id="hotel-fit-heading" className="mb-3 text-h3 text-[color:var(--text-1)]">Hotel fit</h3>
              <HotelCheckinTimeFitPrototype fixture={fixture} surface="detail" hierarchy={hierarchy} allowRetry />
            </section>
            <button type="button" className="btn btn-primary w-full">Continue in prototype</button>
            <p className="text-center text-caption text-[color:var(--text-3)]">Records a research choice only. No provider page opens and no exception is sent.</p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="handoff-condition" className="card mt-6 min-w-0 p-4 sm:p-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-[color:var(--text-3)]">Synthetic handoff condition</p>
        <h2 id="handoff-condition" className="mt-2 text-h3 text-[color:var(--text-1)]">Review before continuing</h2>
        <p className="mt-2 text-small text-[color:var(--text-2)]">The same scenario, evidence, and fixture revision are repeated without recalculation.</p>
        <div className="mt-4"><HotelCheckinTimeFitPrototype fixture={fixture} surface="handoff" hierarchy={hierarchy} announceAsync={false} /></div>
        <button type="button" className="btn btn-primary mt-4 w-full">Continue in prototype</button>
      </section>

      <section aria-labelledby="moderator-capture" className="card mt-6 p-4 sm:p-5">
        <h2 id="moderator-capture" className="text-h3 text-[color:var(--text-1)]">Moderator response capture</h2>
        <p className="mt-2 text-small text-[color:var(--text-2)]">Use coded answers only; do not enter traveler or hotel personal data.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {ANSWER_QUESTIONS.map((question, index) => (
            <label key={question} className="min-w-0 text-small font-bold text-[color:var(--text-1)]">{question}
              <select className="field-input mt-1.5 w-full" value={answers[index]} onChange={event => { const next = [...answers]; next[index] = event.target.value; setAnswers(next); setFirstChoice(''); setFinalChoice(''); setConfidence(''); setInferences([]); setMismatchTimeMs(null) }}>
                <option value="" disabled>Select a coded answer</option>
                <option value="correct">Correct</option>
                <option value="incorrect">Incorrect</option>
                <option value="uncertain">Uncertain</option>
              </select>
            </label>
          ))}
        </div>
        {answersComplete ? (
          <div className="mt-5 border-t border-[color:var(--border)] pt-5">
            <fieldset>
              <legend className="text-small font-bold text-[color:var(--text-1)]">Participant decision</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {['Keep', 'Rule out', 'Verify'].map(choice => (
                  <label key={choice} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--border)] px-3 text-small text-[color:var(--text-2)]">
                    <input type="radio" name="time-fit-decision" checked={finalChoice === choice} onChange={() => { if (!firstChoice) { setFirstChoice(choice); setMismatchTimeMs(Date.now() - (scenarioStartedAt.current ?? Date.now())) } setFinalChoice(choice) }} />{choice}
                  </label>
                ))}
              </div>
            </fieldset>
            {finalChoice ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="min-w-0 text-small font-bold text-[color:var(--text-1)]">Confidence
                  <select className="field-input mt-1.5 w-full" value={confidence} onChange={event => setConfidence(event.target.value)}>
                    <option value="" disabled>Select 1–5</option>
                    {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <fieldset className="min-w-0">
                  <legend className="text-small font-bold text-[color:var(--text-1)]">Did the participant infer any of these?</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {INFERENCE_FLAGS.map(flag => <label key={flag} className="flex min-h-11 items-center gap-2 text-small text-[color:var(--text-2)]"><input type="checkbox" checked={inferences.includes(flag)} onChange={event => setInferences(current => event.target.checked ? [...current, flag] : current.filter(value => value !== flag))} />{flag}</label>)}
                  </div>
                </fieldset>
                <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3 text-caption text-[color:var(--text-3)] md:col-span-2">
                  <p>Anonymous session: {generatedSessionId} · Condition: {hierarchy} · Fixture: {fixture.id} · Revision: {fixture.evidence.evidenceRevision} · Viewport: {assignedViewport}px</p>
                  <p className="mt-1">First choice: {firstChoice} · Final choice: {finalChoice} · Mismatch-identification time: {mismatchTimeMs === null ? 'not recorded' : `${Math.round(mismatchTimeMs / 100) / 10}s`} · Details control used: {detailsUsed ? 'yes' : 'no'}</p>
                  <p className="mt-1">Inferences: {inferences.length ? inferences.join(', ') : 'none recorded'} · Early-departure false-mismatch flag: {fixture.id === 'early_departure_control' && finalChoice === 'Rule out' ? 'yes' : 'no'}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
