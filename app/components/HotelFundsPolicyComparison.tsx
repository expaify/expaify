'use client'

import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import { normalizeHotelFundsPolicyEvidence } from '@/lib/hotels/fundsPolicy'
import type {
  HotelFundsBasis,
  HotelFundsEvidenceRecord,
  HotelFundsEvidenceScope,
  HotelFundsPolicyCapability,
  HotelFundsPolicyEvidence,
  HotelFundsPolicyLoadState,
  HotelFundsPolicyState,
  Money,
} from '@/lib/types'

export type ApiDealFundsPolicy = {
  provider: string
  capability: HotelFundsPolicyCapability
  evidence: HotelFundsPolicyEvidence
  loadState: HotelFundsPolicyLoadState
}

export type HotelFundsCapabilityState = 'none' | 'mixed' | 'all' | 'error'

export type HotelFundsSetPresentation = {
  capabilityState: HotelFundsCapabilityState
  visibleBookableCount: number
  supportedOfferCount: number
  completeCount: number
  partialCount: number
  conflictingCount: number
  explicitNoneCount: number
  notReturnedCount: number
  invalidPairCount: number
}

type ComparableOffer = {
  locked: boolean
  isMock: boolean
  fundsPolicy?: ApiDealFundsPolicy
}

const QUALIFYING_STATES = new Set<HotelFundsPolicyState>([
  'complete', 'partial', 'conflicting', 'explicit_none',
])
const scopePhrases: Partial<Record<HotelFundsEvidenceScope, string>> = {
  property: 'this property',
  room: 'this room',
  rate: 'this rate',
  selected_stay: 'this selected stay',
}
const mechanismLabels = {
  authorization_hold: 'temporary card hold',
  refundable_deposit: 'refundable deposit',
  other_refundable_obligation: 'other refundable amount',
} as const
const MAX_DEDUPE_KEYS = 1_000
const exposureKeys = new Set<string>()
const diagnosticKeys = new Set<string>()

function rememberBounded(set: Set<string>, key: string) {
  if (set.size >= MAX_DEDUPE_KEYS) {
    const oldest = set.values().next().value
    if (oldest) set.delete(oldest)
  }
  set.add(key)
}

function boundedHash(value: string): string {
  const bounded = value.slice(0, 2_048)
  let hash = 0x811c9dc5
  for (let index = 0; index < bounded.length; index += 1) {
    hash ^= bounded.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${value.length.toString(36)}-${(hash >>> 0).toString(36)}`
}

function safeTrack(event: string, props: Record<string, string | number | boolean>) {
  try {
    track(event, props)
  } catch {
    // Measurement must never block comparison or booking.
  }
}

function hasReturnedEvidence(evidence: HotelFundsPolicyEvidence): boolean {
  return QUALIFYING_STATES.has(evidence.state)
}

function validatedPolicy(policy: ApiDealFundsPolicy): {
  supported: boolean
  invalidPair: boolean
  evidence: HotelFundsPolicyEvidence
} {
  const provider = typeof policy.provider === 'string' && policy.provider.trim()
    ? policy.provider.trim()
    : 'Hotel provider'
  const evidence = normalizeHotelFundsPolicyEvidence(policy.evidence, provider)
  const supported = policy.capability?.policy === true
  const invalidPair = !supported && hasReturnedEvidence(evidence)
  return {
    supported: supported && !invalidPair,
    invalidPair,
    evidence: invalidPair ? normalizeHotelFundsPolicyEvidence(undefined, provider) : evidence,
  }
}

/** Returns null until every visible, bookable offer carries the DEV-owned bridge. */
export function deriveHotelFundsSetPresentation(offers: readonly ComparableOffer[]): HotelFundsSetPresentation | null {
  const visible = offers.filter(offer => !offer.locked && !offer.isMock)
  if (visible.length === 0 || visible.some(offer => !offer.fundsPolicy)) return null

  const policies = visible.map(offer => offer.fundsPolicy!)
  if (policies.some(policy => policy.loadState === 'loading')) return null
  if (policies.some(policy => policy.loadState === 'error')) {
    return {
      capabilityState: 'error',
      visibleBookableCount: visible.length,
      supportedOfferCount: 0,
      completeCount: 0,
      partialCount: 0,
      conflictingCount: 0,
      explicitNoneCount: 0,
      notReturnedCount: 0,
      invalidPairCount: 0,
    }
  }

  const validated = policies.map(validatedPolicy)
  const supported = validated.filter(policy => policy.supported)
  const count = (state: HotelFundsPolicyState) => supported.filter(policy => policy.evidence.state === state).length
  return {
    capabilityState: supported.length === 0 ? 'none' : supported.length === visible.length ? 'all' : 'mixed',
    visibleBookableCount: visible.length,
    supportedOfferCount: supported.length,
    completeCount: count('complete'),
    partialCount: count('partial'),
    conflictingCount: count('conflicting'),
    explicitNoneCount: count('explicit_none'),
    notReturnedCount: count('not_returned'),
    invalidPairCount: validated.filter(policy => policy.invalidPair).length,
  }
}

function formatPolicyMoney(money: Money): string {
  const currency = money.currency.trim().toUpperCase()
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: money.priceCents % 100 === 0 ? 0 : 2,
  }).format(money.priceCents / 100)
  return `${formatted}\u00a0${currency}`
}

function basisPhrase(basis?: HotelFundsBasis): string {
  return {
    per_stay: 'per stay',
    per_night: 'per night',
    per_room: 'per room',
    per_person: 'per person',
    provider_defined: 'Basis not provided',
    not_returned: 'Basis not provided',
  }[basis ?? 'not_returned']
}

function amountAndBasis(record: HotelFundsEvidenceRecord): string {
  const amount = record.amount
  if (!amount || amount.kind === 'not_returned') return 'Amount not provided'
  if (amount.kind === 'exact') return `${formatPolicyMoney(amount.money)} ${basisPhrase(record.basis)}`
  if (amount.kind === 'range') return `${formatPolicyMoney(amount.min)}–${formatPolicyMoney(amount.max)} ${basisPhrase(record.basis)}`
  if (amount.kind === 'percentage') {
    return amount.appliesTo === 'stay_price'
      ? `${amount.percent}% of the provider's stay price`
      : `${amount.percent}% of ${amount.appliesToWording ?? 'the provider-documented basis'}`
  }
  return `Amount varies — ${amount.providerWording}`
}

export function getHotelFundsCardSignal(policy?: ApiDealFundsPolicy): {
  copy: string
  state: Exclude<HotelFundsPolicyState, 'not_returned'>
} | null {
  if (!policy || policy.loadState !== 'ready') return null
  const validated = validatedPolicy(policy)
  if (!validated.supported || !QUALIFYING_STATES.has(validated.evidence.state)) return null
  const evidence = validated.evidence
  if (evidence.state === 'partial') {
    return { state: 'partial', copy: 'Deposit or hold details are incomplete. Confirm the missing information before booking.' }
  }
  if (evidence.state === 'conflicting') {
    return { state: 'conflicting', copy: 'Deposit or hold details conflict. Confirm the amount and timing before booking.' }
  }
  if (evidence.state === 'explicit_none') {
    const scope = scopePhrases[evidence.scope]
    return scope ? { state: 'explicit_none', copy: `The provider reports no deposit or incidental hold for ${scope}.` } : null
  }
  if (evidence.state !== 'complete') return null
  if (evidence.obligations.length === 1) {
    const record = evidence.obligations[0]
    const amount = amountAndBasis(record)
    if (record.type === 'authorization_hold') return { state: 'complete', copy: `Temporary card hold: ${amount}. Not part of the stay price.` }
    if (record.type === 'refundable_deposit') return { state: 'complete', copy: `Refundable deposit: ${amount}. Collected separately from the stay price.` }
    if (record.type === 'other_refundable_obligation') return { state: 'complete', copy: `Other refundable amount: ${amount}. Separate from the stay price.` }
    return null
  }
  if (evidence.obligations.length === 2) {
    const obligations = evidence.obligations.map(record => record.type
      ? `${mechanismLabels[record.type]} ${amountAndBasis(record)}`
      : null)
    if (obligations.some(value => !value)) return null
    return { state: 'complete', copy: `Additional funds reported: ${obligations.join('; ')}.` }
  }
  if (evidence.obligations.length >= 3) {
    return { state: 'complete', copy: `Additional funds reported: ${evidence.obligations.length} separate refundable deposit or hold requirements. Review details before booking.` }
  }
  return null
}

export function DepositHoldCardSignal({ policy }: { policy?: ApiDealFundsPolicy }) {
  const signal = getHotelFundsCardSignal(policy)
  if (!signal) return null
  const caution = signal.state === 'partial' || signal.state === 'conflicting'
  return (
    <p className={`rounded-[var(--radius-control)] border px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-2)] break-words [overflow-wrap:anywhere] ${caution ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]' : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'}`}>
      {signal.copy}
    </p>
  )
}

function transitionAnnouncement(from: HotelFundsCapabilityState, to: HotelFundsCapabilityState): string {
  if (from === 'none' && to === 'mixed') return 'Deposit and hold information is now available for some results.'
  if (to === 'all' && from !== 'all') return 'Deposit and hold information is available across these results; unlabeled policies remain unknown.'
  if (from === 'all' && to === 'mixed') return 'Some newly loaded results do not have provider capability for deposit and hold details.'
  return ''
}

export function DepositHoldSetDisclosure({
  presentation,
  queryKey,
  refreshing = false,
}: {
  presentation: HotelFundsSetPresentation | null
  queryKey: string
  refreshing?: boolean
}) {
  const rootRef = useRef<HTMLElement>(null)
  const previousRef = useRef<{ queryKey: string; state: HotelFundsCapabilityState } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (!presentation || refreshing) return
    const previous = previousRef.current
    setAnnouncement(previous?.queryKey === queryKey
      ? transitionAnnouncement(previous.state, presentation.capabilityState)
      : '')
    previousRef.current = { queryKey, state: presentation.capabilityState }
  }, [presentation, queryKey, refreshing])

  useEffect(() => {
    if (!presentation || refreshing || presentation.invalidPairCount === 0) return
    const key = `${boundedHash(queryKey)}:${presentation.capabilityState}`
    if (diagnosticKeys.has(key)) return
    rememberBounded(diagnosticKeys, key)
    safeTrack('hotel_funds_policy_pair_invalid', {
      invalidPairCount: presentation.invalidPairCount,
      surface: 'deal_feed',
    })
  }, [presentation, queryKey, refreshing])

  useEffect(() => {
    const element = rootRef.current
    if (!element || !presentation || refreshing || typeof IntersectionObserver === 'undefined') return
    const key = `${boundedHash(queryKey)}:${presentation.capabilityState}`
    if (exposureKeys.has(key)) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(entries => {
      const exposed = entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio >= 0.5)
      if (!exposed) {
        if (timer) clearTimeout(timer)
        timer = undefined
        return
      }
      if (timer || exposureKeys.has(key)) return
      timer = setTimeout(() => {
        rememberBounded(exposureKeys, key)
        safeTrack('hotel_funds_policy_set_viewed', {
          capabilityState: presentation.capabilityState,
          visibleBookableCount: presentation.visibleBookableCount,
          supportedOfferCount: presentation.supportedOfferCount,
          completeCount: presentation.completeCount,
          partialCount: presentation.partialCount,
          conflictingCount: presentation.conflictingCount,
          explicitNoneCount: presentation.explicitNoneCount,
          notReturnedCount: presentation.notReturnedCount,
          surface: 'deal_feed',
        })
      }, 1_000)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
    }
  }, [presentation, queryKey, refreshing])

  if (!presentation) return null
  if (refreshing) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="mb-4 flex min-h-11 items-center rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-sm text-[color:var(--text-1)]">
        Checking whether deposit and hold details are available…
      </div>
    )
  }

  const isError = presentation.capabilityState === 'error'
  const isNone = presentation.capabilityState === 'none'
  const heading = isError
    ? "Deposit and hold details couldn't be checked"
    : isNone
      ? 'Deposit and hold details unavailable'
      : 'About deposit and hold details'
  const body = isError
    ? "We couldn't check whether these providers supply deposit and hold details. A property may still require additional available funds. Confirm before booking."
    : isNone
      ? 'The providers in these results do not supply deposit or incidental-hold details. A property may still require additional available funds. Confirm before booking.'
      : 'Deposit and hold details are shown only when a provider returns them. No label means the policy is unknown, not that no deposit applies.'
  const headingId = 'hotel-funds-policy-set-heading'

  return (
    <>
      <aside
        ref={rootRef}
        aria-labelledby={headingId}
        role={isError ? 'status' : undefined}
        aria-live={isError ? 'polite' : undefined}
        aria-atomic={isError ? 'true' : undefined}
        className={`mb-4 rounded-[var(--radius-control)] border bg-[color:var(--bg-raised)] px-4 py-3 text-[color:var(--text-1)] ${isError ? 'border-[color:var(--border-strong)]' : 'border-[color:var(--border)]'}`}
      >
        <h4 id={headingId} className="font-display text-sm font-bold leading-5 text-[color:var(--text-1)]">{heading}</h4>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--text-2)]">{body}</p>
      </aside>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </>
  )
}

export function resetHotelFundsComparisonAnalyticsForTests() {
  exposureKeys.clear()
  diagnosticKeys.clear()
}
