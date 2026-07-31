import type {
  HotelWifiEvidence,
  WifiConflictStatement,
  WifiCoverageScope,
  WifiMeasuredEvidence,
  WifiMeasurementMetric,
  WifiReviewEvidence,
  WifiSource,
} from './hotelWifiFixtures'

type Props = {
  evidence: HotelWifiEvidence
  idSuffix: string
}

const BOUNDARY = 'These details describe what sources reported for this property or selected stay. They do not guarantee future Wi-Fi performance.'
const CONFIRMATION = 'Confirm Wi-Fi access, charges, and room coverage with the hotel or booking provider before you book.'

const SCOPE_LABELS: Record<WifiCoverageScope, string> = {
  property: 'Property',
  public_areas: 'Public areas',
  guest_rooms: 'Guest rooms',
  room_type: 'Room type',
  rate: 'Selected rate',
  selected_stay: 'Selected stay',
  not_specified: 'Not specified',
  conflict: 'Conflicting sources',
}

const METRIC_LABELS: Record<WifiMeasurementMetric['kind'], string> = {
  download: 'Download',
  upload: 'Upload',
  latency: 'Latency',
  uptime: 'Uptime',
}

const METRIC_ORDER: WifiMeasurementMetric['kind'][] = ['download', 'upload', 'latency', 'uptime']

const BILLING_LABELS = {
  per_stay: 'per stay',
  per_night: 'per night',
  per_device: 'per device',
  per_day: 'per day',
} as const

function formatDate(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function validSource(source?: WifiSource): source is WifiSource {
  return Boolean(source?.sourceId.trim() && source.sourceLabel.trim() && formatDate(source.fetchedAt))
}

function sourceMeta(source: WifiSource, scope: WifiCoverageScope): string | null {
  if (!validSource(source)) return null
  const reported = formatDate(source.observedAt)
  return `Scope: ${SCOPE_LABELS[scope]} · Source: ${source.sourceLabel}${reported ? ` · Reported ${reported}` : ''}`
}

function formatMoney(priceCents: number, currency: string): string | null {
  if (!Number.isSafeInteger(priceCents) || priceCents < 0 || !/^[A-Z]{3}$/.test(currency)) return null
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(priceCents / 100)
  } catch {
    return null
  }
}

function validWindow(window: { start: string; end: string }): boolean {
  const start = Date.parse(window.start)
  const end = Date.parse(window.end)
  return Number.isFinite(start) && Number.isFinite(end) && start <= end
}

function eligibleMeasured(evidence?: WifiMeasuredEvidence): evidence is WifiMeasuredEvidence {
  if (!evidence || evidence.kind !== 'measured' || !validSource(evidence.source) || !formatDate(evidence.source.observedAt)) return false
  if (!evidence.method.trim() || !evidence.locationLabel.trim() || !validWindow(evidence.observationWindow)) return false
  if (!SCOPE_LABELS[evidence.scope] || evidence.scope === 'not_specified' || evidence.scope === 'conflict') return false
  const kinds = new Set<string>()
  const metricsValid = evidence.metrics.length > 0 && evidence.metrics.length <= 4 && evidence.metrics.every(metric => {
    if (kinds.has(metric.kind)) return false
    kinds.add(metric.kind)
    const expectedUnit = metric.kind === 'download' || metric.kind === 'upload'
      ? 'Mbps'
      : metric.kind === 'latency'
        ? 'ms'
        : 'percent'
    return Number.isFinite(metric.value) && metric.value >= 0 && metric.unit === expectedUnit
  })
  const sampleValid = Number.isSafeInteger(evidence.sampleCount) && (evidence.sampleCount ?? 0) > 0
  return metricsValid && (sampleValid || Boolean(evidence.frequency?.trim()))
}

function eligibleReview(evidence?: WifiReviewEvidence): evidence is WifiReviewEvidence {
  return Boolean(
    evidence
    && evidence.kind === 'review_signal'
    && evidence.summary.trim()
    && Number.isSafeInteger(evidence.qualifyingReviewCount)
    && evidence.qualifyingReviewCount > 0
    && validWindow(evidence.reviewWindow)
    && ['consistent', 'mixed', 'conflicting'].includes(evidence.consistency)
    && validSource(evidence.source),
  )
}

function conflictLines(conflicts: WifiConflictStatement[], dimension: WifiConflictStatement['dimension']) {
  const retained = conflicts.filter(item => item.dimension === dimension && item.sourceLabel.trim() && item.statement.trim())
  if (retained.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
      {retained.map((item, index) => <li key={`${dimension}-${index}`}>{item.sourceLabel}: {item.statement}</li>)}
    </ul>
  )
}

function answerRow({ label, answer, meta, children }: { label: string; answer: string; meta?: string | null; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
      <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{label}</dt>
      <dd>
        <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)] [overflow-wrap:anywhere]">{answer}</p>
        {meta ? <p className="mt-1 text-xs leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">{meta}</p> : null}
        {children}
      </dd>
    </div>
  )
}

function measuredFamily(evidence: WifiMeasuredEvidence, idSuffix: string) {
  const start = formatDate(evidence.observationWindow.start)
  const end = formatDate(evidence.observationWindow.end)
  const observed = formatDate(evidence.source.observedAt)
  return (
    <section aria-labelledby={`wifi-measured-title-${idSuffix}`} className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <h3 id={`wifi-measured-title-${idSuffix}`} className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Measured performance</h3>
      <div className="mt-2 space-y-1 text-sm leading-6 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
        {[...evidence.metrics].sort((a, b) => METRIC_ORDER.indexOf(a.kind) - METRIC_ORDER.indexOf(b.kind)).map(metric => <p key={metric.kind}>{METRIC_LABELS[metric.kind]}: {metric.value.toLocaleString('en-US')} {metric.unit}</p>)}
        <p>Method: {evidence.method}.</p>
        <p>Measured at {evidence.locationLabel}; scope: {SCOPE_LABELS[evidence.scope].toLowerCase()}.</p>
        <p>Observed {start}–{end}.</p>
        <p>{evidence.sampleCount ? `Based on ${evidence.sampleCount.toLocaleString('en-US')} measurements.` : `Measurement frequency: ${evidence.frequency}.`}</p>
        <p>Source: {evidence.source.sourceLabel} · Reported {observed}.</p>
        <p>This measurement is time- and location-bound and does not guarantee future performance.</p>
      </div>
    </section>
  )
}

function reviewFamily(evidence: WifiReviewEvidence, idSuffix: string) {
  const consistency = evidence.consistency === 'consistent' ? 'Reports were consistent.' : evidence.consistency === 'mixed' ? 'Reports were mixed.' : 'Reports conflicted.'
  return (
    <section aria-labelledby={`wifi-review-title-${idSuffix}`} className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <h3 id={`wifi-review-title-${idSuffix}`} className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Guest-reported Wi-Fi</h3>
      <div className="mt-2 space-y-1 text-sm leading-6 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
        <p>Guests report {evidence.summary}</p>
        <p>Based on {evidence.qualifyingReviewCount.toLocaleString('en-US')} Wi-Fi-specific reviews from {formatDate(evidence.reviewWindow.start)}–{formatDate(evidence.reviewWindow.end)}.</p>
        <p>{consistency}</p>
        <p>Source: {evidence.source.sourceLabel}.</p>
        <p>Guest reports describe past experiences; they are not a performance measurement or guarantee.</p>
      </div>
    </section>
  )
}

export function WifiEvidenceLedger({ evidence, idSuffix }: Props) {
  const isLoading = evidence.checkState === 'loading'
  const isUnknownState = evidence.checkState === 'not_returned' || evidence.checkState === 'error' || evidence.checkState === 'stale'
  const hasConflict = evidence.conflicts.length > 0 || evidence.access?.status === 'conflict' || evidence.cost?.status === 'conflict' || evidence.coverage === 'conflict'
  const measured = evidence.checkState === 'ready' && eligibleMeasured(evidence.measuredEvidence) ? evidence.measuredEvidence : undefined
  const review = evidence.checkState === 'ready' && eligibleReview(evidence.reviewEvidence) ? evidence.reviewEvidence : undefined
  const unavailable = evidence.checkState === 'ready' && evidence.access?.status === 'unavailable' && evidence.access.scope === 'selected_stay' && validSource(evidence.access.source)
  const staleSources = evidence.checkState === 'stale'
    ? Array.from(new Set([
        evidence.access?.source,
        evidence.cost?.source,
        evidence.measuredEvidence?.source,
        evidence.reviewEvidence?.source,
      ].filter(validSource).map(source => source.sourceLabel)))
    : []

  let status: string | null = null
  let statusTone = 'neutral'
  if (isLoading) status = 'Checking Wi-Fi evidence…'
  if (evidence.checkState === 'not_returned') status = 'Wi-Fi details were not returned by this hotel source.'
  if (evidence.checkState === 'error') { status = 'Wi-Fi details could not be checked.'; statusTone = 'error' }
  if (evidence.checkState === 'stale') { status = 'Wi-Fi information is out of date.'; statusTone = 'stale' }
  if (evidence.checkState === 'ready' && evidence.access?.status === 'unavailable' && validSource(evidence.access.source)) {
    status = evidence.access.scope === 'selected_stay'
      ? 'This source reports Wi-Fi is unavailable for the selected stay.'
      : 'This source reports Wi-Fi is unavailable at the property.'
  }

  const access = isLoading
    ? 'Checking…'
    : isUnknownState || !evidence.access || !validSource(evidence.access.source)
      ? 'Not specified'
      : evidence.access.status === 'conflict'
        ? 'Sources disagree about Wi-Fi access.'
        : evidence.access.status === 'unavailable'
          ? evidence.access.scope === 'selected_stay' ? 'Wi-Fi is reported unavailable for the selected stay.' : 'Wi-Fi is reported unavailable at the property.'
          : evidence.access.status === 'confirmed'
            ? evidence.access.scope === 'public_areas' ? 'Wi-Fi is listed in public areas.'
              : evidence.access.scope === 'guest_rooms' ? 'Wi-Fi is listed in guest rooms.'
                : evidence.access.scope === 'selected_stay' ? 'Wi-Fi is listed for the selected stay.'
                  : evidence.access.scope === 'property' ? 'Wi-Fi is listed for the property.'
                    : 'Not specified'
            : 'Not specified'

  let cost = 'Not specified for this rate.'
  if (isLoading) cost = 'Checking…'
  else if (unavailable) cost = 'Not applicable because Wi-Fi is reported unavailable for the selected stay.'
  else if (!isUnknownState && evidence.cost && validSource(evidence.cost.source)) {
    if (evidence.cost.status === 'conflict') cost = 'Sources disagree about the Wi-Fi charge for this rate.'
    if (evidence.cost.status === 'included' && evidence.cost.scope === 'rate') cost = 'Included in the selected rate.'
    if (evidence.cost.status === 'paid') {
      const money = evidence.cost.money && evidence.cost.billingBasis ? formatMoney(evidence.cost.money.priceCents, evidence.cost.money.currency) : null
      cost = money && evidence.cost.billingBasis
        ? `Extra charge: ${money} ${BILLING_LABELS[evidence.cost.billingBasis]}.`
        : 'An extra charge is reported; the amount was not specified.'
    }
  }

  let coverage = 'Guest-room coverage was not specified.'
  if (isLoading) coverage = 'Checking…'
  else if (unavailable) coverage = 'Selected stay.'
  else if (!isUnknownState) {
    coverage = evidence.coverage === 'property' ? 'Property-level only; guest-room coverage is not confirmed.'
      : evidence.coverage === 'public_areas' ? 'Public areas only; guest-room coverage is not confirmed.'
        : evidence.coverage === 'guest_rooms' ? 'Guest-room Wi-Fi is listed; this does not confirm every room.'
          : evidence.coverage === 'room_type' ? 'Wi-Fi is listed for the selected room type; confirm the selected room.'
            : evidence.coverage === 'rate' ? 'Wi-Fi coverage is documented for this rate; confirm the selected room.'
              : evidence.coverage === 'selected_stay' ? 'Wi-Fi coverage is documented for the selected stay.'
                : evidence.coverage === 'conflict' ? 'Sources disagree about where Wi-Fi is available.'
                  : coverage
  }

  let reliability = 'Not established.'
  if (isLoading) reliability = 'Checking…'
  else if (measured && review) reliability = hasConflict ? 'Measured performance and guest reports conflict.' : 'Measured performance and guest reports are available below.'
  else if (measured) reliability = 'Measured performance is available below.'
  else if (review) reliability = 'Wi-Fi-specific guest reports are available below.'
  else if (evidence.checkState === 'ready' && evidence.access?.status === 'confirmed' && evidence.coverage === 'property' && !evidence.cost) reliability = 'Wi-Fi is listed, but reliability evidence is not available.'

  const guidance = evidence.checkState === 'error' || evidence.checkState === 'stale' || hasConflict || (!unavailable && (access === 'Not specified' || cost === 'Not specified for this rate.' || !['guest_rooms', 'room_type', 'rate', 'selected_stay'].includes(evidence.coverage)))
  const titleId = `wifi-evidence-title-${idSuffix}`

  return (
    <section aria-labelledby={titleId} aria-busy={isLoading} className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
      <h2 id={titleId} className="text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl">Wi-Fi evidence</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-2)]">{BOUNDARY}</p>
      {status ? (
        <div
          role={isLoading ? 'status' : undefined}
          aria-live={isLoading ? 'polite' : undefined}
          className={`mt-4 rounded-[var(--radius-control)] border p-3.5 text-sm leading-6 text-[color:var(--text-1)] ${statusTone === 'error' ? 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)]' : statusTone === 'stale' ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]' : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'}`}
        >
          <p>{status}</p>
          {evidence.checkState === 'stale' && formatDate(evidence.staleAsOf) ? <p className="mt-1 text-xs text-[color:var(--text-2)]">Last reported {formatDate(evidence.staleAsOf)}</p> : null}
          {staleSources.length > 0 ? <p className="mt-1 text-xs text-[color:var(--text-2)] [overflow-wrap:anywhere]">Source: {staleSources.join(' · ')}</p> : null}
        </div>
      ) : null}
      {hasConflict ? <p className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--error-soft)] p-3.5 text-sm leading-6 text-[color:var(--text-1)]">Wi-Fi evidence conflicts — confirm with the hotel.</p> : null}

      <dl className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {answerRow({
          label: 'Access',
          answer: access,
          meta: !isUnknownState && !isLoading && evidence.access && validSource(evidence.access.source) ? sourceMeta(evidence.access.source, evidence.access.scope) : null,
          children: conflictLines(evidence.conflicts, 'access'),
        })}
        {answerRow({
          label: 'Cost for this rate',
          answer: cost,
          meta: !isUnknownState && !isLoading && evidence.cost && validSource(evidence.cost.source) ? `${evidence.cost.scope === 'rate' ? 'Selected rate' : evidence.cost.scope === 'selected_stay' ? 'Selected stay' : 'Scope not specified'} · Source: ${evidence.cost.source.sourceLabel}${formatDate(evidence.cost.source.observedAt) ? ` · Reported ${formatDate(evidence.cost.source.observedAt)}` : ''}` : null,
          children: conflictLines(evidence.conflicts, 'cost'),
        })}
        {answerRow({ label: 'Coverage', answer: coverage, children: conflictLines(evidence.conflicts, 'coverage') })}
        {answerRow({ label: 'Reliability evidence', answer: reliability, children: conflictLines(evidence.conflicts, 'measured_vs_review') })}
      </dl>

      {measured ? measuredFamily(measured, idSuffix) : null}
      {review ? reviewFamily(review, idSuffix) : null}
      {guidance ? <p className="mt-4 text-sm leading-6 text-[color:var(--text-2)]">{CONFIRMATION}</p> : null}
    </section>
  )
}
