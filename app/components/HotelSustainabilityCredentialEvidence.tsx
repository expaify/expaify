export type HotelCredentialState =
  | 'current_issuer_linked'
  | 'current_provider_reported'
  | 'expired'
  | 'incomplete'
  | 'conflicting'
  | 'not_returned'
  | 'not_checked'
  | 'check_failed'

export type HotelCredentialConflictDimension = 'status' | 'property_match' | 'validity' | 'level'
export type HotelCredentialMissingField = 'scheme' | 'issuer' | 'property_match' | 'scope' | 'status' | 'validity' | 'source'

export type HotelCredentialRecord = {
  id: string
  schemeName?: string
  issuerName?: string
  sourceClass?: 'issuer_linked' | 'provider_reported'
  sourceLabel?: string
  scope?: 'property'
  statusLabel?: string
  levelLabel?: string
  validFrom?: string
  validThrough?: string
  observedAt?: string
  evidenceUrl?: string
  evidenceUrlDisplayPermitted?: boolean
  propertyMatch?: 'stable_id' | 'approved_crosswalk' | 'strict_composite'
  displayRightsConfirmed?: boolean
  freshnessPolicyPassed?: boolean
  missingFields?: HotelCredentialMissingField[]
  conflictDimension?: HotelCredentialConflictDimension
}

export type HotelCredentialEvidence = {
  loadState: 'loading' | 'ready' | 'refreshing'
  state: HotelCredentialState
  records: HotelCredentialRecord[]
  evidenceRevision: string
  retryable?: boolean
}

export const NOT_CHECKED_HOTEL_CREDENTIAL_EVIDENCE: HotelCredentialEvidence = {
  loadState: 'ready',
  state: 'not_checked',
  records: [],
  evidenceRevision: 'production-not-checked',
}

const LIMITATION = 'A credential reports participation in that scheme. It is not an environmental impact score or a comparison with other schemes.'
const missingLabels: Record<HotelCredentialMissingField, string> = {
  property_match: 'property match',
  scheme: 'scheme name',
  issuer: 'issuing organization',
  scope: 'property scope',
  status: 'credential status',
  validity: 'validity',
  source: 'evidence source',
}
const missingOrder: HotelCredentialMissingField[] = ['property_match', 'scheme', 'issuer', 'scope', 'status', 'validity', 'source']
// Credential links are not general web links. Production normalization must add
// approved issuer/provider hosts here before exposing their records.
const evidenceUrlAllowedHosts = new Set(['credentials.expaify.test'])

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim()
  return cleaned ? cleaned : undefined
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.+)?$/.exec(value)
  if (!match) return undefined
  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : undefined
}

function hasUnsafeDate(record: HotelCredentialRecord): boolean {
  const dates = [record.validFrom, record.validThrough, record.observedAt]
  if (dates.some(value => value !== undefined && !parseDate(value))) return true
  const validFrom = parseDate(record.validFrom)
  const validThrough = parseDate(record.validThrough)
  return Boolean(validFrom && validThrough && validFrom > validThrough)
}

function formatDate(value: unknown, compact = false): string | undefined {
  const date = parseDate(value)
  if (!date) return undefined
  return new Intl.DateTimeFormat('en-US', compact
    ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatList(values: string[]): string {
  if (values.length < 2) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

function safeEvidenceUrl(record: HotelCredentialRecord): string | undefined {
  if (!record.evidenceUrlDisplayPermitted || !record.evidenceUrl) return undefined
  try {
    const url = new URL(record.evidenceUrl)
    return url.protocol === 'https:' && evidenceUrlAllowedHosts.has(url.hostname) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function Fact({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{label}</dt>
      <dd className="mt-1 min-w-0 [overflow-wrap:anywhere] text-sm leading-6 text-[color:var(--text-2)]">{value}</dd>
    </div>
  )
}

function RecordCard({ record, state, invalidValidity = false }: { record: HotelCredentialRecord; state: HotelCredentialState; invalidValidity?: boolean }) {
  const scheme = cleanText(record.schemeName)
  const issuer = cleanText(record.issuerName)
  const source = cleanText(record.sourceLabel)
  const status = cleanText(record.statusLabel)
  const level = cleanText(record.levelLabel)
  const validFrom = formatDate(record.validFrom)
  const validThrough = formatDate(record.validThrough)
  const observedAt = formatDate(record.observedAt)
  const evidenceUrl = safeEvidenceUrl(record)
  const conflict = state === 'conflicting' ? record.conflictDimension : undefined
  const missing = missingOrder.filter(field => record.missingFields?.includes(field) || (invalidValidity && field === 'validity')).map(field => missingLabels[field])
  const sourceValue = source
    ? record.sourceClass === 'issuer_linked'
      ? `Issuer-linked record from ${source}`
      : `Reported by ${source}; not confirmed through the issuer`
    : undefined

  return (
    <li className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <h4 className="min-w-0 [overflow-wrap:anywhere] text-sm font-medium leading-6 text-[color:var(--text-1)]">{scheme ?? 'Credential record'}</h4>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {issuer && conflict !== 'property_match' ? <Fact label="Issuer" value={issuer} /> : null}
        {!issuer && state === 'incomplete' && record.missingFields?.includes('issuer') ? <Fact label="Issuer" value="Issuer not provided" /> : null}
        {sourceValue ? <Fact label="Evidence source" value={sourceValue} full /> : null}
        {record.scope === 'property' && conflict !== 'property_match' ? <Fact label="Scope" value="This property" /> : null}
        {status && conflict !== 'status' ? <Fact label="Status" value={status} /> : null}
        {level && conflict !== 'level' ? <Fact label="Level" value={`${level} (scheme wording)`} /> : null}
        {validFrom && conflict !== 'validity' ? <Fact label="Valid from" value={validFrom} /> : null}
        {validThrough && conflict !== 'validity' ? <Fact label="Valid through" value={validThrough} /> : null}
        {!validThrough && state === 'current_provider_reported' ? <Fact label="Valid through" value="Validity date not provided" /> : null}
        {observedAt ? <Fact label="Evidence checked" value={observedAt} /> : null}
      </dl>
      {missing.length ? <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--warning)]">Missing evidence: {formatList(missing)}.</p> : null}
      {evidenceUrl && scheme && source ? (
        <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${scheme} credential evidence from ${source} (opens in a new tab)`} className="mt-3 inline-flex min-h-11 max-w-full items-center rounded-[var(--radius-control)] text-sm font-medium leading-6 text-[color:var(--brand)] underline decoration-1 underline-offset-4 hover:text-[color:var(--brand-hover)] focus-visible:shadow-[var(--focus-ring)]">
          <span className="[overflow-wrap:anywhere]">View {scheme} credential evidence</span>
        </a>
      ) : null}
    </li>
  )
}

function stateCopy(evidence: HotelCredentialEvidence): { lead: string; support?: string; tone?: string } {
  if (evidence.loadState === 'loading' || evidence.loadState === 'refreshing') return { lead: 'Checking sustainability credential evidence…' }
  switch (evidence.state) {
    case 'current_issuer_linked': return { lead: 'Current credential evidence was found for this property.' }
    case 'current_provider_reported': return { lead: 'A booking provider reports credential evidence for this property.' }
    case 'expired': {
      const expiry = evidence.records.length === 1 ? formatDate(evidence.records[0]?.validThrough, true) : undefined
      return { lead: expiry ? `This credential record expired ${expiry}.` : 'This credential record has expired.', tone: 'text-[color:var(--warning)]' }
    }
    case 'incomplete': return { lead: 'We could not verify this credential record.', tone: 'text-[color:var(--warning)]' }
    case 'conflicting': {
      const dimensions = new Set(evidence.records.map(record => record.conflictDimension).filter(Boolean))
      const dimension = dimensions.size === 1 ? [...dimensions][0] : undefined
      const label = dimension === 'property_match' ? 'property match' : dimension
      return { lead: label ? `Sources disagree about this credential's ${label}.` : 'Sources disagree about this credential record.', tone: 'text-[color:var(--warning)]' }
    }
    case 'not_returned': return { lead: 'No verifiable credential evidence was returned for this property.', support: 'That does not mean the hotel has no credential or performs poorly.' }
    case 'check_failed': return { lead: "We couldn't check sustainability credential evidence right now.", support: 'You can still check rooms and current terms with the provider.', tone: 'text-[color:var(--error-text)]' }
    case 'not_checked': return { lead: 'Sustainability credential evidence has not been checked for this property.' }
  }
}

export function HotelSustainabilityCredentialEvidence({
  evidence,
  onRetry,
  retrying = false,
  announcement = '',
  titleId = 'hotel-sustainability-credential-title',
}: {
  evidence?: HotelCredentialEvidence
  onRetry?: () => void
  retrying?: boolean
  announcement?: string
  titleId?: string
}) {
  const current = evidence ?? NOT_CHECKED_HOTEL_CREDENTIAL_EVIDENCE
  const invalidValidity = current.records.some(hasUnsafeDate)
  const effectiveState: HotelCredentialState = invalidValidity && ['current_issuer_linked', 'current_provider_reported', 'expired'].includes(current.state)
    ? 'incomplete'
    : current.state
  const effectiveEvidence = effectiveState === current.state ? current : { ...current, state: effectiveState }
  const loading = current.loadState === 'loading' || current.loadState === 'refreshing'
  const copy = stateCopy(effectiveEvidence)
  const returnedRecords = loading || ['not_checked', 'not_returned', 'check_failed'].includes(effectiveState)
    ? []
    : [...current.records].sort((a, b) => (cleanText(a.schemeName) ?? '').localeCompare(cleanText(b.schemeName) ?? '', 'en-US'))

  return (
    <section aria-labelledby={titleId} className="mt-5 border-t border-[color:var(--border)] pt-5">
      <h3 id={titleId} className="text-h3 text-[color:var(--text-1)]">Sustainability credential evidence</h3>
      <div role="status" aria-live="polite" aria-atomic="true" aria-busy={loading || undefined}>
        <p className={`mt-3 text-sm font-medium leading-6 ${copy.tone ?? 'text-[color:var(--text-1)]'}`}>{copy.lead}</p>
        {copy.support ? <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{copy.support}</p> : null}
        {loading ? (
          <div className="mt-4 grid gap-3" aria-hidden="true">
            <span className="h-5 w-2/3 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
            <span className="h-5 w-full rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
            <span className="h-5 w-4/5 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]" />
          </div>
        ) : null}
      </div>
      {returnedRecords.length ? (
        <ul role="list" className="mt-4 grid list-none gap-3 p-0">
          {returnedRecords.map(record => <RecordCard key={record.id} record={record} state={effectiveState} invalidValidity={invalidValidity} />)}
        </ul>
      ) : null}
      {returnedRecords.length ? <p className="mt-4 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3.5 py-3 text-sm leading-6 text-[color:var(--text-2)]">{LIMITATION}</p> : null}
      {(current.state === 'check_failed' && current.retryable && onRetry) || retrying ? (
        <button type="button" onClick={onRetry} disabled={retrying} className="btn btn-outline mt-4 min-h-11 w-full sm:w-auto">{retrying ? 'Checking…' : 'Try again'}</button>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  )
}
