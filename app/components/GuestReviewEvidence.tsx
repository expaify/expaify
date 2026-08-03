import type { HotelReviewContextCue, HotelReviewEvidence, ReviewMonth } from '@/lib/types'

type GuestReviewEvidenceProps = {
  evidence?: HotelReviewEvidence | null
  expectedProviderId?: string
  expectedPropertyId?: string
}

type ValidCore = {
  evidence: HotelReviewEvidence
  score?: { value: number; scaleMax: number }
  sourceLabel?: string
  count?: number
  coverage:
    | { kind: 'provider_declared_aggregate'; startMonth?: ReviewMonth; endMonth: ReviewMonth }
    | { kind: 'returned_sample'; latestMonth: ReviewMonth; sampleSize?: number }
    | { kind: 'none' }
  observedAt?: Date
}

const ALLOWED_CONTEXT_TOPICS = new Set([
  'accessibility', 'bed_comfort', 'cleanliness', 'location', 'quiet_rooms',
  'room_comfort', 'service', 'street_noise',
])

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function parseReviewMonth(value: unknown): { value: ReviewMonth; date: Date } | null {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  const date = new Date(`${value}-01T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime())) return null
  return { value: value as ReviewMonth, date }
}

function isFutureMonth(date: Date): boolean {
  const now = new Date()
  return date.getTime() > Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
}

function parseObservedAt(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.getTime() <= Date.now() ? date : undefined
}

function validateCore(
  evidence: HotelReviewEvidence | null | undefined,
  expectedProviderId?: string,
  expectedPropertyId?: string,
): ValidCore | null {
  if (!evidence || typeof evidence !== 'object' || evidence.schemaVersion !== 1) return null
  if (!evidence.providerId?.trim() || !evidence.providerPropertyId?.trim()) return null
  if (expectedProviderId && evidence.providerId !== expectedProviderId) return null
  if (expectedPropertyId && evidence.providerPropertyId !== expectedPropertyId) return null

  const count = evidence.overallReviewCount
  if (count !== undefined && !isPositiveInteger(count)) return null

  let coverage: ValidCore['coverage']
  if (evidence.coverage?.kind === 'none') {
    coverage = { kind: 'none' }
  } else if (evidence.coverage?.kind === 'provider_declared_aggregate') {
    const end = parseReviewMonth(evidence.coverage.endMonth)
    const start = evidence.coverage.startMonth === undefined ? undefined : parseReviewMonth(evidence.coverage.startMonth)
    if (!end || isFutureMonth(end.date) || (evidence.coverage.startMonth !== undefined && !start)) return null
    if (start && start.date.getTime() > end.date.getTime()) return null
    coverage = { kind: 'provider_declared_aggregate', endMonth: end.value, ...(start ? { startMonth: start.value } : {}) }
  } else if (evidence.coverage?.kind === 'returned_sample') {
    let latest = parseReviewMonth(evidence.coverage.latestStayMonth)
    if (evidence.coverage.latestStayMonth !== undefined && !latest) return null
    if (!latest && evidence.coverage.latestSubmittedAt) {
      const submitted = new Date(evidence.coverage.latestSubmittedAt)
      if (!Number.isFinite(submitted.getTime()) || submitted.getTime() > Date.now()) return null
      latest = parseReviewMonth(`${submitted.getUTCFullYear()}-${String(submitted.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    if (!latest || isFutureMonth(latest.date)) return null
    if (evidence.coverage.sampleSize !== undefined && !isPositiveInteger(evidence.coverage.sampleSize)) return null
    coverage = { kind: 'returned_sample', latestMonth: latest.value, ...(evidence.coverage.sampleSize !== undefined ? { sampleSize: evidence.coverage.sampleSize } : {}) }
  } else {
    return null
  }

  const needsScore = evidence.state === 'ready' && (evidence.provenance === 'verified_guest' || evidence.provenance === 'provider_only')
  const score = evidence.score
  const sourceLabel = evidence.sourceLabel?.trim()
  if (needsScore && (!score || !isPositiveFinite(score.value) || !isPositiveFinite(score.scaleMax) || score.value > score.scaleMax || !sourceLabel)) return null

  return {
    evidence,
    ...(score ? { score } : {}),
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(count !== undefined ? { count } : {}),
    coverage,
    observedAt: parseObservedAt(evidence.ratingObservedAt),
  }
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatMonth(value: ReviewMonth): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00.000Z`))
}

function formatObservation(value: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(value)
}

function validContextCue(cue: HotelReviewContextCue | undefined, coverage: ValidCore['coverage']): HotelReviewContextCue | null {
  if (!cue || cue.licensedForDisplay !== true || !ALLOWED_CONTEXT_TOPICS.has(cue.topic) || !cue.pattern.trim() || !cue.sourceLabel.trim()) return null
  if (cue.scope !== 'property' && cue.scope !== 'returned_sample') return null
  if (cue.supportingReviewCount !== undefined && !isPositiveInteger(cue.supportingReviewCount)) return null
  const start = cue.windowStartMonth === undefined ? undefined : parseReviewMonth(cue.windowStartMonth)
  const end = cue.windowEndMonth === undefined ? undefined : parseReviewMonth(cue.windowEndMonth)
  if ((cue.windowStartMonth !== undefined && !start) || (cue.windowEndMonth !== undefined && !end)) return null
  if ((start && !end) || (!start && end) || (start && end && (start.date > end.date || isFutureMonth(end.date)))) return null
  if (!start && cue.supportingReviewCount === undefined) return null
  if (coverage.kind === 'provider_declared_aggregate' && end && end.value > coverage.endMonth) return null
  if (coverage.kind === 'provider_declared_aggregate' && coverage.startMonth && start && start.value < coverage.startMonth) return null
  return cue
}

export function getGuestReviewScanLine(evidence?: HotelReviewEvidence | null): { visible: string; accessible: string } | null {
  const core = validateCore(evidence)
  if (!core || core.evidence.state !== 'ready' || core.evidence.provenance !== 'verified_guest' || !core.score) return null
  const visible = `${formatDecimal(core.score.value)}/${formatDecimal(core.score.scaleMax)} guest score${core.count ? ` · ${formatCount(core.count)} reviews` : ''}`
  const accessible = `Guest score: ${formatDecimal(core.score.value)} out of ${formatDecimal(core.score.scaleMax)}${core.count ? `, based on ${formatCount(core.count)} reviews` : ''}`
  return { visible, accessible }
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">Checking guest review evidence…</p>
      <div aria-hidden="true" className="mt-3 space-y-3">
        <div className="skeleton h-4 w-full rounded-[var(--radius-pill)] motion-reduce:animate-none" />
        <div className="skeleton h-4 w-5/6 rounded-[var(--radius-pill)] motion-reduce:animate-none" />
        <div className="skeleton h-4 w-2/3 rounded-[var(--radius-pill)] motion-reduce:animate-none" />
      </div>
    </div>
  )
}

export default function GuestReviewEvidence({ evidence, expectedProviderId, expectedPropertyId }: GuestReviewEvidenceProps) {
  const core = validateCore(evidence, expectedProviderId, expectedPropertyId)
  const isEmptyObject = Boolean(evidence && typeof evidence === 'object' && Object.keys(evidence).length === 0)
  const state = core?.evidence.state ?? (evidence && !isEmptyObject ? 'invalid' : 'not_provided')
  const isLoading = state === 'loading'

  let stateCopy: { lead: string; detail: string } | null = null
  if (state === 'not_provided' || (state === 'ready' && core?.evidence.provenance === 'unavailable')) {
    stateCopy = { lead: 'Guest score not provided by this provider.', detail: 'Review count and review dates are not available.' }
  } else if (state === 'error') {
    stateCopy = { lead: 'Guest review evidence could not be checked.', detail: 'You can still check rooms and current terms with the provider.' }
  } else if (state === 'stale') {
    stateCopy = { lead: 'Guest review evidence is unavailable.', detail: 'The saved rating details are too old to verify, so we did not display them.' }
  } else if (state === 'invalid' || !core || (state === 'ready' && core.evidence.provenance === 'inferred')) {
    stateCopy = state === 'ready' && core?.evidence.provenance === 'inferred'
      ? { lead: 'Guest score not provided by this provider.', detail: 'We did not use an inferred or unverified rating.' }
      : { lead: 'Guest review evidence is unavailable.', detail: 'The returned rating details could not be verified, so we did not display them.' }
  }

  const showFacts = Boolean(state === 'ready' && core && !stateCopy && core.score)
  const cue = showFacts && core ? validContextCue(core.evidence.contextCue, core.coverage) : null

  return (
    <section aria-labelledby="guest-review-evidence-title" aria-busy={isLoading || undefined} className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <h3 id="guest-review-evidence-title" className="text-body font-display font-bold leading-snug text-[color:var(--text-1)]">Guest review evidence</h3>
      {isLoading ? <LoadingState /> : null}
      {stateCopy ? (
        <div role={state === 'error' ? 'status' : undefined}>
          <p className="mt-2 break-words text-small font-medium leading-5 text-[color:var(--text-1)]">{stateCopy.lead}</p>
          <p className="mt-1 break-words text-caption leading-5 text-[color:var(--text-2)]">{stateCopy.detail}</p>
        </div>
      ) : null}
      {showFacts && core?.score ? (
        <>
          <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Guest score</dt>
              <dd className="mt-1 break-words text-body font-medium leading-5 tabular-nums text-[color:var(--text-1)]">{core.evidence.provenance === 'provider_only' ? 'Provider rating: ' : ''}{formatDecimal(core.score.value)}/{formatDecimal(core.score.scaleMax)} {core.evidence.provenance === 'provider_only' ? `from ${core.sourceLabel}.` : `guest score from ${core.sourceLabel}.`}</dd>
              {core.evidence.provenance === 'provider_only' ? <p className="mt-1 break-words text-caption leading-5 text-[color:var(--text-2)]">The provider does not identify this as a verified guest score.</p> : null}
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Overall review count</dt>
              <dd className="mt-1 break-words text-small font-medium leading-5 tabular-nums text-[color:var(--text-1)]">{core.count ? `${formatCount(core.count)} reviews` : 'Review count not provided.'}</dd>
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Review dates</dt>
              <dd className="mt-1 break-words text-small font-medium leading-5 text-[color:var(--text-1)]">{core.coverage.kind === 'provider_declared_aggregate' ? `Guest score includes reviews through ${formatMonth(core.coverage.endMonth)}.` : core.coverage.kind === 'returned_sample' ? `Most recent review returned: ${formatMonth(core.coverage.latestMonth)}.` : 'Review dates not provided.'}</dd>
              {core.coverage.kind === 'returned_sample' ? <p className="mt-1 break-words text-caption leading-5 text-[color:var(--text-2)]">This date describes the returned review sample, not the full guest score.</p> : null}
            </div>
          </dl>
          {cue ? <ContextCue cue={cue} /> : null}
          {core.observedAt ? <p className="mt-3 text-caption leading-5 text-[color:var(--text-3)]">Rating data checked {formatObservation(core.observedAt)}.</p> : null}
        </>
      ) : null}
    </section>
  )
}

function ContextCue({ cue }: { cue: HotelReviewContextCue }) {
  const hasWindow = Boolean(cue.windowStartMonth && cue.windowEndMonth)
  const support = cue.supportingReviewCount && hasWindow
    ? `Based on ${formatCount(cue.supportingReviewCount)} reviews from ${formatMonth(cue.windowStartMonth!)}–${formatMonth(cue.windowEndMonth!)}, provided by ${cue.sourceLabel}.`
    : cue.supportingReviewCount
      ? `Based on ${formatCount(cue.supportingReviewCount)} reviews, provided by ${cue.sourceLabel}.`
      : `Feedback from ${formatMonth(cue.windowStartMonth!)}–${formatMonth(cue.windowEndMonth!)}, provided by ${cue.sourceLabel}.`

  return (
    <div className="mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3">
      <h4 className="text-small font-medium text-[color:var(--text-1)]">Traveler feedback</h4>
      <p className="mt-1 break-words text-small leading-5 text-[color:var(--text-2)]">{cue.travelerSegment ? `Guests traveling with ${cue.travelerSegment} mention ${cue.pattern}.` : `Guests mention ${cue.pattern}.`}</p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">{support}</p>
      <p className="mt-1 break-words text-caption leading-5 text-[color:var(--text-3)]">This feedback does not predict a specific room or stay.</p>
    </div>
  )
}
