'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '@/lib/analytics'

export type HotelEvChargingPresentationState = 'confirmed' | 'limited' | 'unknown' | 'explicit_negative'
export type HotelEvChargingLoadState = 'loading' | 'ready' | 'refreshing' | 'error'
export type HotelEvChargingPresence = 'listed_on_property' | 'reported_not_on_property' | 'not_returned' | 'off_site_only' | 'malformed' | 'conflicting' | 'unknown'
export type HotelEvChargingLimitationCategory = 'paid' | 'guest_only' | 'staff_or_valet_only' | 'reservation_required' | 'first_come_or_limited' | 'connector_limited' | 'power_limited' | 'third_party_operator' | 'limited_hours' | 'other_access_condition'
export type HotelEvChargingField = { state: 'reported'; label: string } | { state: 'not_provided' }
export type HotelEvChargingCost =
  | { state: 'included' }
  | { state: 'paid'; amount?: { priceCents: number; currency: string }; basis?: 'per_session' | 'per_hour' | 'per_kwh' | 'per_night' | 'other' }
  | { state: 'unknown' }

export type HotelEvChargingEvidence = {
  loadState: HotelEvChargingLoadState
  presentationState: HotelEvChargingPresentationState
  presence: HotelEvChargingPresence
  scope: 'property' | 'off_site' | 'unknown'
  limitationCategories: readonly HotelEvChargingLimitationCategory[]
  access: HotelEvChargingField
  reservation: HotelEvChargingField
  cost: HotelEvChargingCost
  connector: HotelEvChargingField
  power: HotelEvChargingField
  operator: HotelEvChargingField
  hours: HotelEvChargingField
  accessNote?: string
  source: { provider: string; fetchedAt?: string }
  evidenceRevision: string
  /** Positive states are accepted only by the isolated research harness. */
  researchFixture?: true
  staleRefreshFailed?: boolean
}

const missingField: HotelEvChargingField = { state: 'not_provided' }

export const PRODUCTION_EV_CHARGING_UNKNOWN: HotelEvChargingEvidence = {
  loadState: 'ready',
  presentationState: 'unknown',
  presence: 'not_returned',
  scope: 'unknown',
  limitationCategories: [],
  access: missingField,
  reservation: missingField,
  cost: { state: 'unknown' },
  connector: missingField,
  power: missingField,
  operator: missingField,
  hours: missingField,
  source: { provider: '' },
  evidenceRevision: 'production-provider-evidence-unavailable-v1',
}

const LIMITATION_LABELS: Record<HotelEvChargingLimitationCategory, string> = {
  reservation_required: 'Reservation required',
  staff_or_valet_only: 'Staff or valet access',
  guest_only: 'Guests only',
  first_come_or_limited: 'Limited or first come',
  paid: 'Paid · amount not provided',
  connector_limited: 'Connector restriction',
  power_limited: 'Charging-level restriction',
  limited_hours: 'Limited hours',
  third_party_operator: 'Third-party operator',
  other_access_condition: 'Access condition',
}

const LIMITATION_ORDER: readonly HotelEvChargingLimitationCategory[] = [
  'reservation_required', 'staff_or_valet_only', 'guest_only', 'first_come_or_limited', 'paid',
  'connector_limited', 'power_limited', 'limited_hours', 'third_party_operator', 'other_access_condition',
]

const LIVE_BOUNDARY = 'This is property information, not real-time connector availability. expaify has not checked whether a connector is working, open, compatible, or available for your stay.'
const GENERIC_ERROR = 'EV-charging details could not be checked. Confirm charging location, access, cost, compatibility, and availability with the provider.'
const MISSING = 'Not provided by this provider.'

function safeEvidence(evidence: HotelEvChargingEvidence): HotelEvChargingEvidence {
  if ((evidence.presentationState === 'confirmed' || evidence.presentationState === 'limited') && !evidence.researchFixture) {
    return PRODUCTION_EV_CHARGING_UNKNOWN
  }
  return evidence
}

function providerName(evidence: HotelEvChargingEvidence): string {
  const value = evidence.source.provider.trim().slice(0, 80)
  return value || 'The provider'
}

function orderedLimitations(evidence: HotelEvChargingEvidence) {
  const present = new Set(evidence.limitationCategories)
  return LIMITATION_ORDER.filter(category => present.has(category))
}

function formatCost(cost: HotelEvChargingCost, provider: string): string {
  if (cost.state === 'unknown') return MISSING
  if (cost.state === 'included') return `No charging fee reported by ${provider}`
  const basis = cost.basis ? ({ per_session: 'per session', per_hour: 'per hour', per_kwh: 'per kWh', per_night: 'per night', other: 'other basis' } as const)[cost.basis] : null
  let amount: string | null = null
  if (cost.amount && Number.isInteger(cost.amount.priceCents) && cost.amount.priceCents >= 0 && /^[A-Z]{3}$/.test(cost.amount.currency)) {
    try {
      amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.amount.currency }).format(cost.amount.priceCents / 100)
    } catch { /* Preserve paid state without presenting an invalid amount. */ }
  }
  if (amount && basis) return `Paid · ${amount} ${basis}.`
  if (amount) return `Paid · ${amount}; charging basis not provided.`
  if (basis) return `Paid · amount not provided · ${basis}.`
  return 'Paid · amount or basis not provided.'
}

function compactLimitation(evidence: HotelEvChargingEvidence, category: HotelEvChargingLimitationCategory): string {
  if (category === 'paid') {
    const cost = formatCost(evidence.cost, providerName(evidence))
    if (cost.startsWith('Paid ·') && !cost.includes('amount or basis')) return cost.replace(/\.$/, '')
  }
  return LIMITATION_LABELS[category]
}

export function getHotelEvChargingResultCopy(rawEvidence: HotelEvChargingEvidence) {
  const evidence = safeEvidence(rawEvidence)
  const provider = providerName(evidence)
  const limitations = orderedLimitations(evidence)
  const primary = limitations[0] ? compactLimitation(evidence, limitations[0]) : ''
  const more = Math.max(0, limitations.length - 1)
  if (evidence.loadState === 'loading') return { visible: 'Checking EV-charging details…', accessible: 'EV charging details are loading.' }
  if (evidence.loadState === 'error') return { visible: 'EV-charging details could not be checked', accessible: 'EV charging: Unknown because details could not be checked.' }
  if (evidence.staleRefreshFailed) return { visible: `Previously listed by ${provider} · refresh failed`, accessible: `EV charging: Unknown. Previously listed by ${provider}; the refresh failed.` }
  if (evidence.presentationState === 'confirmed') return { visible: `EV charging listed on property · ${provider}`, accessible: `EV charging: Confirmed, provider-listed on property by ${provider}. Restrictions and live connector availability may not have been provided.` }
  if (evidence.presentationState === 'limited') return {
    visible: `EV charging listed · ${primary}${more ? ` +${more}` : ''}`,
    accessible: more ? `EV charging: Limited. ${primary}, and ${more} more conditions. ${provider} lists on-property charging. Charging availability is not live.` : `EV charging: Limited. ${provider} lists on-property charging with this condition: ${primary}. Charging availability is not live.`,
  }
  if (evidence.presentationState === 'explicit_negative') return { visible: `${provider} reports no EV charging on property`, accessible: `EV charging: No on-property charging. ${provider} explicitly reports no EV charging on the property.` }
  if (evidence.presence === 'off_site_only') return { visible: 'On-property EV charging not confirmed', accessible: 'EV charging: Unknown. The provider lists charging away from the property, not on the property.' }
  if (evidence.presence === 'conflicting' || evidence.presence === 'malformed') return { visible: 'EV charging information unclear', accessible: 'EV charging: Unknown because provider information is conflicting or unclear.' }
  return { visible: 'EV charging details not provided', accessible: 'EV charging: Unknown. This provider did not return usable on-property charging details.' }
}

function analyticsContext(evidence: HotelEvChargingEvidence, surface: string) {
  const returned = [evidence.access, evidence.reservation, evidence.connector, evidence.power, evidence.operator, evidence.hours].filter(field => field.state === 'reported').length + (evidence.cost.state !== 'unknown' ? 1 : 0)
  const completeness = evidence.presentationState === 'explicit_negative' ? 'explicit_negative' : evidence.presentationState === 'unknown' ? 'none' : returned === 0 ? 'presence_only' : returned >= 4 ? 'decision_ready' : 'partial'
  return {
    provider: evidence.source.provider.trim().slice(0, 80) || 'unknown', surface,
    state: evidence.presentationState, completeness_bucket: completeness,
    limitation_categories: orderedLimitations(evidence).join(','), evidence_revision: evidence.evidenceRevision.slice(0, 80),
  }
}

function useBoundedExposure(event: string, offerId: string, surface: string, evidence: HotelEvChargingEvidence, delay: number) {
  const ref = useRef<HTMLElement>(null)
  const sent = useRef(false)
  useEffect(() => {
    // Production currently has no provider evidence. Defer reach analytics until
    // a bounded provider record (or the isolated research fixture) exists.
    if (evidence === PRODUCTION_EV_CHARGING_UNKNOWN || evidence.evidenceRevision === PRODUCTION_EV_CHARGING_UNKNOWN.evidenceRevision) return
    const node = ref.current
    if (!node || sent.current || typeof IntersectionObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)
      if (!visible) { if (timer) clearTimeout(timer); timer = undefined; return }
      if (timer) return
      timer = setTimeout(() => {
        sent.current = true
        const viewport = typeof window === 'undefined' ? 'other' : window.innerWidth <= 480 ? 'mobile_375' : window.innerWidth >= 1024 ? 'desktop_1280' : 'other'
        track(event, { offer_id: offerId, ...analyticsContext(evidence, surface), viewport_group: viewport })
        if (event === 'hotel_ev_charging_section_reached') {
          try { if (typeof window !== 'undefined') window.sessionStorage.setItem(`expaify.ev-reached.${offerId}.${evidence.evidenceRevision}`, '1') } catch { /* Exposure analytics remains optional. */ }
        }
        observer.disconnect()
      }, delay)
    }, { threshold: 0.5 })
    observer.observe(node)
    return () => { if (timer) clearTimeout(timer); observer.disconnect() }
  }, [delay, event, evidence, offerId, surface])
  return ref
}

export function HotelEvChargingResultSignal({ evidence = PRODUCTION_EV_CHARGING_UNKNOWN, offerId }: { evidence?: HotelEvChargingEvidence; offerId: string }) {
  const safe = safeEvidence(evidence)
  const copy = getHotelEvChargingResultCopy(safe)
  return <p data-ev-charging-signal="true" data-ev-charging-offer={offerId} data-ev-charging-revision={safe.evidenceRevision} data-ev-charging-state={safe.presentationState} className="mt-2 flex min-w-0 gap-2 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]"><span aria-hidden="true" className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--text-3)]" /><span>{copy.visible}</span>{safe.loadState === 'refreshing' ? <span className="sr-only" role="status" aria-live="polite">Refreshing EV-charging details…</span> : null}</p>
}

function fieldValue(field: HotelEvChargingField, unavailable: boolean): string {
  if (unavailable) return 'Not applicable because the provider reports no on-property EV charging.'
  return field.state === 'reported' ? field.label : MISSING
}

function checkedCopy(evidence: HotelEvChargingEvidence): string {
  const provider = evidence.source.provider.trim()
  if (!provider) return 'Source details not available.'
  if (!evidence.source.fetchedAt || Number.isNaN(new Date(evidence.source.fetchedAt).getTime())) return `Source: ${provider}. Checked time not provided.`
  const checked = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(evidence.source.fetchedAt))
  return `Source: ${provider}. Checked ${checked}.`
}

function detailPresentation(evidence: HotelEvChargingEvidence) {
  const provider = providerName(evidence)
  const conditions = orderedLimitations(evidence)
  if (evidence.loadState === 'error') return { heading: 'Unknown — check failed', summary: GENERIC_ERROR, body: '', guidance: '' }
  if (evidence.staleRefreshFailed) return { heading: 'Unknown — refresh failed', summary: 'On-property EV charging has not been confirmed.', body: 'Previously listed charging details could not be refreshed safely.', guidance: GENERIC_ERROR }
  if (evidence.presentationState === 'confirmed') return { heading: 'Confirmed — provider-listed on property', summary: `${provider} lists EV charging at this property.`, body: '', guidance: '' }
  if (evidence.presentationState === 'limited') return { heading: 'Limited — provider-listed with conditions', summary: conditions.length === 1 ? `${provider} lists EV charging at this property with this condition: ${compactLimitation(evidence, conditions[0])}.` : `${provider} lists EV charging at this property with ${conditions.length} reported conditions.`, body: '', guidance: '' }
  if (evidence.presentationState === 'explicit_negative') return { heading: 'No on-property charging reported', summary: `${provider} reports no EV charging on property.`, body: '', guidance: "If on-property charging is required, choose another hotel or verify that the provider's information has changed." }
  if (evidence.presence === 'off_site_only') return { heading: 'Unknown — no on-property evidence', summary: 'On-property EV charging has not been confirmed.', body: 'The provider lists charging away from the property, not on the property.', guidance: "Confirm the charger's location and access separately. Nearby charging is not a hotel amenity." }
  if (evidence.presence === 'conflicting') return { heading: 'Unknown — information unclear', summary: 'Charging information is unclear.', body: 'Provider information disagrees about on-property EV charging. expaify is not choosing one statement as current.', guidance: GENERIC_ERROR }
  if (evidence.presence === 'malformed') return { heading: 'Unknown — information unclear', summary: 'Charging information is unclear.', body: 'The charging information returned by the provider could not be used safely.', guidance: GENERIC_ERROR }
  return { heading: 'Unknown', summary: 'On-property EV charging has not been confirmed.', body: 'This provider did not return usable property information about EV charging.', guidance: 'Confirm charging location, access, cost, compatibility, and availability with the provider before relying on it.' }
}

export function HotelEvChargingSection({ evidence = PRODUCTION_EV_CHARGING_UNKNOWN, offerId, headingLevel: Heading = 'h3', onRetry }: { evidence?: HotelEvChargingEvidence; offerId: string; headingLevel?: 'h2' | 'h3' | 'h4'; onRetry?: () => Promise<boolean> }) {
  const safe = safeEvidence(evidence)
  const exposureRef = useBoundedExposure('hotel_ev_charging_section_reached', offerId, 'hotel_fit', safe, 1000)
  const [retryState, setRetryState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const retryRef = useRef<HTMLButtonElement>(null)
  const presentation = detailPresentation(safe)
  const unavailable = safe.presentationState === 'explicit_negative'
  const loading = safe.loadState === 'loading' || retryState === 'loading'
  const checkFailed = safe.loadState === 'error' || safe.staleRefreshFailed
  const factRows = useMemo(() => [
    ['On-property status', checkFailed ? 'Could not be checked.' : unavailable ? `Explicitly reported as not on property by ${providerName(safe)}.` : safe.presentationState === 'confirmed' || safe.presentationState === 'limited' ? `Listed on property by ${providerName(safe)}.` : MISSING],
    ['Access', checkFailed ? 'Could not be checked.' : fieldValue(safe.access, unavailable)], ['Reservation', checkFailed ? 'Could not be checked.' : fieldValue(safe.reservation, unavailable)],
    ['Cost', checkFailed ? 'Could not be checked.' : unavailable ? 'Not applicable because the provider reports no on-property EV charging.' : formatCost(safe.cost, providerName(safe))],
    ['Connector', checkFailed ? 'Could not be checked.' : fieldValue(safe.connector, unavailable)], ['Charging level / power', checkFailed ? 'Could not be checked.' : fieldValue(safe.power, unavailable)],
    ['Operator', checkFailed ? 'Could not be checked.' : fieldValue(safe.operator, unavailable)], ['Hours', checkFailed ? 'Could not be checked.' : fieldValue(safe.hours, unavailable)],
  ], [checkFailed, safe, unavailable])
  const id = `${offerId.replace(/[^a-zA-Z0-9_-]/g, '-')}-ev-charging-title`

  async function retry() {
    if (!onRetry) return
    setRetryState('loading')
    const succeeded = await onRetry()
    setRetryState(succeeded ? 'idle' : 'failed')
    if (!succeeded) window.requestAnimationFrame(() => retryRef.current?.focus())
  }

  return (
    <section ref={exposureRef} aria-labelledby={id} aria-busy={loading || safe.loadState === 'refreshing' || undefined} className="mt-4 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <Heading id={id} className="text-sm font-medium leading-6 text-[color:var(--text-1)]">EV charging</Heading>
      {loading ? <div className="min-h-48" role="status" aria-live="polite" aria-atomic="true"><p className="mt-2 text-sm font-medium text-[color:var(--text-1)]">Checking EV-charging details…</p><p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">Price and booking actions remain available while this property detail loads.</p><div aria-hidden="true" className="mt-4 grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-12 rounded-[var(--radius-control)] motion-safe:animate-pulse" />)}</div></div> : <>
        <div role={safe.loadState === 'error' || retryState === 'failed' ? 'status' : undefined} aria-live={safe.loadState === 'refreshing' ? 'polite' : undefined} aria-atomic={safe.loadState === 'refreshing' ? true : undefined}>
          <p className={`mt-2 text-sm font-medium leading-6 ${safe.loadState === 'error' ? 'text-[color:var(--error-text)]' : 'text-[color:var(--text-1)]'}`}>{retryState === 'failed' ? 'EV-charging details still could not be checked.' : presentation.heading}</p>
          <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)]">{presentation.summary}</p>
          {presentation.body ? <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{presentation.body}</p> : null}
          {safe.loadState === 'refreshing' ? <p className="mt-1 text-xs leading-5 text-[color:var(--text-2)]">Refreshing EV-charging details…</p> : null}
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{factRows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{value}</dd></div>)}</dl>
        {orderedLimitations(safe).length ? <div className="mt-4 border-t border-[color:var(--border)] pt-3"><p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Reported conditions</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-1)]">{orderedLimitations(safe).map(category => <li key={category}>{compactLimitation(safe, category)}</li>)}</ul></div> : null}
        {safe.accessNote ? <p className="mt-3 break-words text-sm leading-6 text-[color:var(--text-2)]"><span className="font-medium text-[color:var(--text-1)]">Reported access note: </span>{safe.accessNote.slice(0, 160)}</p> : null}
        {presentation.guidance ? <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--text-2)]">{presentation.guidance}</p> : null}
        <div className="mt-4 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--text-2)]"><p className="break-words">{checkedCopy(safe)}</p><p className="mt-1">Charging cost is separate from the room rate shown above.</p><p className="mt-1">{unavailable ? 'This is provider-reported property information, not an independent inspection by expaify.' : LIVE_BOUNDARY}</p></div>
        {safe.loadState === 'error' && onRetry ? <button ref={retryRef} type="button" onClick={() => void retry()} className="btn btn-outline mt-3 min-h-11 w-full sm:w-auto">Retry EV-charging check</button> : null}
      </>}
    </section>
  )
}

export function getHotelEvChargingHandoffCopy(rawEvidence: HotelEvChargingEvidence): string {
  const evidence = safeEvidence(rawEvidence)
  const provider = providerName(evidence)
  const limitations = orderedLimitations(evidence)
  if (evidence.loadState === 'error' || evidence.presence === 'conflicting' || evidence.presence === 'malformed') return 'On-property charging has not been confirmed because the information could not be used safely. Check directly with the provider before you pay.'
  if (evidence.presentationState === 'confirmed') return `${provider} lists charging at this property. Connector availability is not live; confirm access and compatibility before you pay.`
  if (evidence.presentationState === 'limited') return `Charging has a documented condition: ${compactLimitation(evidence, limitations[0])}. Complete or confirm the requirement with the provider; expaify has not reserved a connector.`
  if (evidence.presentationState === 'explicit_negative') return `${provider} reports no EV charging on property.`
  return 'On-property charging has not been confirmed. Check location, access, cost, compatibility, and availability with the provider before you pay.'
}

export function HotelEvChargingHandoffNotice({ evidence = PRODUCTION_EV_CHARGING_UNKNOWN, offerId }: { evidence?: HotelEvChargingEvidence; offerId: string }) {
  const safe = safeEvidence(evidence)
  return <section aria-labelledby={`${offerId}-ev-handoff-title`} className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-3.5 sm:p-4"><h3 id={`${offerId}-ev-handoff-title`} className="text-sm font-medium leading-6 text-[color:var(--text-1)]">EV charging before you continue</h3><p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">{getHotelEvChargingHandoffCopy(safe)}</p></section>
}

export function hotelEvChargingActionBoundary(evidence: HotelEvChargingEvidence = PRODUCTION_EV_CHARGING_UNKNOWN): string {
  const safe = safeEvidence(evidence)
  if (safe.presentationState === 'confirmed' || safe.presentationState === 'limited') return 'Charging availability is not live.'
  if (safe.presentationState === 'explicit_negative') return `${providerName(safe)} reports no EV charging on property.`
  return 'On-property charging is not confirmed.'
}

export function trackHotelEvChargingHandoff(offerId: string, evidence: HotelEvChargingEvidence = PRODUCTION_EV_CHARGING_UNKNOWN, provider: string) {
  const safe = safeEvidence(evidence)
  try {
    if (window.sessionStorage.getItem(`expaify.ev-reached.${offerId}.${safe.evidenceRevision}`) !== '1') return
  } catch { return }
  track('hotel_ev_charging_handoff_continued', {
    offer_id: offerId, ...analyticsContext(safe, 'handoff'),
    provider: provider.slice(0, 80), confirmation_task_remaining: safe.presentationState !== 'explicit_negative',
    viewport_group: window.innerWidth <= 480 ? 'mobile_375' : window.innerWidth >= 1024 ? 'desktop_1280' : 'other',
  })
}
