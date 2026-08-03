import { formatMoney } from '../money'
import { hasProviderName, providerDisplayName } from '../providerFreshness'
import type {
  HotelChargeCollection,
  HotelChargeTotalRelationship,
  HotelPriceDisclosureState,
  HotelRequiredChargeCapabilities,
  HotelRequiredChargeCapability,
  HotelRequiredChargeEvidence,
  HotelRequiredChargeRecord,
  HotelRequiredChargeScope,
  HotelRequiredChargeState,
  HotelStayCostState,
  Money,
} from '../types'

const CHARGE_STATES = new Set<HotelRequiredChargeState>([
  'itemized',
  'included_unitemized',
  'applies_amount_unknown',
  'explicit_none',
  'not_returned',
  'conflicting',
])
const RELATIONSHIPS = new Set<HotelChargeTotalRelationship>(['included', 'excluded', 'unknown'])
const COLLECTIONS = new Set<HotelChargeCollection>(['online', 'property', 'split', 'unknown'])
const SCOPES = new Set<HotelRequiredChargeScope>(['stay', 'rate', 'room', 'property', 'not_returned'])
const RECORD_LIMIT = 30

export const NO_REQUIRED_CHARGE_CAPABILITIES: HotelRequiredChargeCapabilities = {
  taxes: { supportedScopes: [], supportsExplicitNone: false },
  mandatoryPropertyCharges: { supportedScopes: [], supportsExplicitNone: false },
}

export function normalizeHotelRequiredChargeCapabilities(value: unknown): HotelRequiredChargeCapabilities {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return NO_REQUIRED_CHARGE_CAPABILITIES
  const input = value as Record<string, unknown>
  const normalize = (candidate: unknown): HotelRequiredChargeCapability => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { supportedScopes: [], supportsExplicitNone: false }
    }
    const record = candidate as Record<string, unknown>
    const supportedScopes = Array.isArray(record.supportedScopes)
      ? [...new Set(record.supportedScopes.filter((scope): scope is Exclude<HotelRequiredChargeScope, 'not_returned'> => (
          scope === 'stay' || scope === 'rate' || scope === 'room' || scope === 'property'
        )))]
      : []
    return { supportedScopes, supportsExplicitNone: record.supportsExplicitNone === true }
  }
  return {
    taxes: normalize(input.taxes),
    mandatoryPropertyCharges: normalize(input.mandatoryPropertyCharges),
  }
}

export type HotelChargeCategory = 'taxes' | 'mandatory_property_charges'

export type HotelPriceComposition = {
  stayCostState: HotelStayCostState
  priceUnavailable: boolean
  taxes: HotelRequiredChargeEvidence
  mandatoryPropertyCharges: HotelRequiredChargeEvidence
  priceDisclosureState: HotelPriceDisclosureState
}

export type HotelChargePresentation = {
  label: 'Taxes' | 'Mandatory property charges'
  scanStatus: string
  stateCopy: string
  relationshipCopy: string | null
  collectionCopy: string | null
  provenanceCopy: string | null
  records: readonly HotelRequiredChargeRecord[]
  conflicting: boolean
}

function cleanToken(value: unknown, maximum = 120): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 && cleaned.length <= maximum && !/[\u0000-\u001f\u007f]/.test(cleaned)
    ? cleaned
    : undefined
}

function safeSourceLabel(value: unknown): string | undefined {
  const cleaned = cleanToken(value, 80)
  if (
    !cleaned
    || /^(?:provider|hotel provider|booking partner|provider unavailable|unknown|n\/?a)$/i.test(cleaned)
    || /(?:https?:\/\/|www\.|[/?#=&])|^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)
  ) return undefined
  return cleaned
}

function validMoney(value: unknown): value is Money {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const money = value as Record<string, unknown>
  return Number.isSafeInteger(money.priceCents) && (money.priceCents as number) >= 0
    && typeof money.currency === 'string' && /^[A-Z]{3}$/.test(money.currency)
}

function normalizeRecord(value: unknown): HotelRequiredChargeRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  // Providers must positively classify records as required. Silence is not enough.
  if (record.required !== true || record.optional === true || record.conditional === true) return null
  const name = cleanToken(record.name, 120)
  if (!name) return null
  if (record.amount !== undefined && !validMoney(record.amount)) return null
  const id = cleanToken(record.id, 100)
  const basis = cleanToken(record.basis, 100)
  const sourceLabel = safeSourceLabel(record.sourceLabel)
  const collection = COLLECTIONS.has(record.collection as HotelChargeCollection)
    ? record.collection as HotelChargeCollection
    : undefined
  const totalRelationship = RELATIONSHIPS.has(record.totalRelationship as HotelChargeTotalRelationship)
    ? record.totalRelationship as HotelChargeTotalRelationship
    : undefined
  return {
    ...(id ? { id } : {}),
    name,
    required: true,
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(record.amount !== undefined ? { amount: record.amount as Money } : {}),
    ...(basis ? { basis } : {}),
    ...(collection ? { collection } : {}),
    ...(totalRelationship ? { totalRelationship } : {}),
  }
}

export function createNotReturnedRequiredCharge(
  offerId: string,
  supplier: string,
  sourceLabel?: string,
): HotelRequiredChargeEvidence {
  const safeLabel = safeSourceLabel(sourceLabel)
  return {
    offerId,
    supplier,
    ...(safeLabel ? { sourceLabel: safeLabel } : {}),
    scope: 'not_returned',
    state: 'not_returned',
    totalRelationship: 'unknown',
    collection: 'unknown',
    records: [],
  }
}

function hasRecordConflict(
  records: readonly HotelRequiredChargeRecord[],
  field: 'collection' | 'totalRelationship',
  categoryValue: HotelChargeCollection | HotelChargeTotalRelationship,
): boolean {
  const values = new Set([
    ...(categoryValue === 'unknown' ? [] : [categoryValue]),
    ...records.map(record => record[field]).filter(value => value && value !== 'unknown'),
  ])
  return values.size > 1
}

/**
 * Accepts untrusted adapter/context data and returns an honest, offer-bound category value.
 * It never throws and never turns missing, stale, or malformed evidence into a positive claim.
 */
export function normalizeHotelRequiredChargeEvidence(input: {
  evidence: unknown
  offerId: string
  supplier: string
  capability?: HotelRequiredChargeCapability
}): HotelRequiredChargeEvidence {
  const fallback = createNotReturnedRequiredCharge(input.offerId, input.supplier)
  if (!input.evidence || typeof input.evidence !== 'object' || Array.isArray(input.evidence)) return fallback
  const value = input.evidence as Record<string, unknown>
  const sourceLabel = safeSourceLabel(value.sourceLabel)
  const degraded = createNotReturnedRequiredCharge(input.offerId, input.supplier, sourceLabel)
  const scope = SCOPES.has(value.scope as HotelRequiredChargeScope)
    ? value.scope as HotelRequiredChargeScope
    : undefined
  const capability = input.capability
  if (
    cleanToken(value.offerId) !== input.offerId
    || cleanToken(value.supplier) !== input.supplier
    || value.isStale === true
    || !scope
    || scope === 'not_returned'
    || !capability?.supportedScopes.includes(scope)
  ) return degraded

  const state = CHARGE_STATES.has(value.state as HotelRequiredChargeState)
    ? value.state as HotelRequiredChargeState
    : 'not_returned'
  if (state === 'not_returned') return degraded
  const totalRelationship = RELATIONSHIPS.has(value.totalRelationship as HotelChargeTotalRelationship)
    ? value.totalRelationship as HotelChargeTotalRelationship
    : 'unknown'
  const collection = COLLECTIONS.has(value.collection as HotelChargeCollection)
    ? value.collection as HotelChargeCollection
    : 'unknown'
  const categoryTotal = validMoney(value.categoryTotal) ? value.categoryTotal : undefined
  const records = Array.isArray(value.records)
    ? value.records.slice(0, RECORD_LIMIT).map(normalizeRecord).filter((record): record is HotelRequiredChargeRecord => record !== null)
    : []
  const fetchedAt = cleanToken(value.fetchedAt)
  const normalizedFetchedAt = fetchedAt && Number.isFinite(new Date(fetchedAt).getTime()) ? fetchedAt : undefined

  const common = {
    offerId: input.offerId,
    supplier: input.supplier,
    ...(sourceLabel ? { sourceLabel } : {}),
    scope,
    ...(normalizedFetchedAt ? { fetchedAt: normalizedFetchedAt } : {}),
    totalRelationship,
    collection,
    records,
  }

  const collectionConflict = hasRecordConflict(records, 'collection', collection)
  const relationshipConflict = hasRecordConflict(records, 'totalRelationship', totalRelationship)
  const existenceConflict = state === 'explicit_none' && (Boolean(categoryTotal) || records.length > 0)
  if (state === 'conflicting' || collectionConflict || relationshipConflict || existenceConflict) {
    return {
      ...common,
      state: 'conflicting',
      ...(collectionConflict || state === 'conflicting' ? { collection: 'unknown' as const } : {}),
      ...(relationshipConflict || existenceConflict || state === 'conflicting'
        ? { totalRelationship: 'unknown' as const }
        : {}),
    }
  }
  if (state === 'explicit_none') {
    return capability.supportsExplicitNone
      ? { ...common, state, totalRelationship: 'unknown', collection: 'unknown', records: [] }
      : degraded
  }
  if (categoryTotal || records.length > 0) {
    return { ...common, state: 'itemized', ...(categoryTotal ? { categoryTotal } : {}) }
  }
  if (state === 'included_unitemized') {
    return totalRelationship === 'included' && !categoryTotal && records.length === 0
      ? { ...common, state }
      : degraded
  }
  if (state === 'applies_amount_unknown') {
    return !categoryTotal
      ? { ...common, state }
      : degraded
  }
  return degraded
}

function isDocumented(evidence: HotelRequiredChargeEvidence): boolean {
  return evidence.state !== 'not_returned'
}

function isFullyResolved(evidence: HotelRequiredChargeEvidence): boolean {
  if (evidence.state === 'explicit_none') return true
  return evidence.state === 'itemized'
    && evidence.totalRelationship !== 'unknown'
    && evidence.collection !== 'unknown'
}

function isIncludedCoverage(evidence: HotelRequiredChargeEvidence): boolean {
  return evidence.state === 'explicit_none'
    || ((evidence.state === 'itemized' || evidence.state === 'included_unitemized')
      && evidence.totalRelationship === 'included')
}

export function deriveHotelPriceDisclosureState(input: {
  stayCostState: HotelStayCostState
  priceUnavailable?: boolean
  taxes: HotelRequiredChargeEvidence
  mandatoryPropertyCharges: HotelRequiredChargeEvidence
}): HotelPriceDisclosureState {
  const { stayCostState, taxes, mandatoryPropertyCharges } = input
  if (stayCostState === 'nightly_only' && input.priceUnavailable === true) return 'unavailable'
  if (stayCostState === 'provider_total' && isFullyResolved(taxes) && isFullyResolved(mandatoryPropertyCharges)) {
    return 'fully_itemized'
  }
  if (stayCostState === 'provider_total') {
    const neitherDocumented = !isDocumented(taxes) && !isDocumented(mandatoryPropertyCharges)
    const allIncluded = isIncludedCoverage(taxes) && isIncludedCoverage(mandatoryPropertyCharges)
    const breakdownMissing = !taxes.categoryTotal || !mandatoryPropertyCharges.categoryTotal
    if (neitherDocumented || (allIncluded && breakdownMissing)) return 'provider_total_breakdown_unknown'
  }
  if (stayCostState === 'partial_total' || isDocumented(taxes) || isDocumented(mandatoryPropertyCharges)) {
    return 'partially_itemized'
  }
  return 'incomplete'
}

export function buildHotelPriceComposition(input: {
  offerId: string
  supplier: string
  stayCostState: HotelStayCostState
  priceUnavailable?: boolean
  taxEvidence?: unknown
  mandatoryPropertyChargeEvidence?: unknown
  capabilities?: HotelRequiredChargeCapabilities
}): HotelPriceComposition {
  const capabilities = normalizeHotelRequiredChargeCapabilities(input.capabilities)
  const taxes = normalizeHotelRequiredChargeEvidence({
    evidence: input.taxEvidence,
    offerId: input.offerId,
    supplier: input.supplier,
    capability: capabilities.taxes,
  })
  const mandatoryPropertyCharges = normalizeHotelRequiredChargeEvidence({
    evidence: input.mandatoryPropertyChargeEvidence,
    offerId: input.offerId,
    supplier: input.supplier,
    capability: capabilities.mandatoryPropertyCharges,
  })
  const priceUnavailable = input.priceUnavailable === true
  return {
    stayCostState: input.stayCostState,
    priceUnavailable,
    taxes,
    mandatoryPropertyCharges,
    priceDisclosureState: deriveHotelPriceDisclosureState({
      stayCostState: input.stayCostState,
      priceUnavailable,
      taxes,
      mandatoryPropertyCharges,
    }),
  }
}

function providerName(evidence: HotelRequiredChargeEvidence): string | null {
  return evidence.sourceLabel && hasProviderName(evidence.sourceLabel)
    ? providerDisplayName(evidence.sourceLabel)
    : null
}

function formatCheckedDate(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function scopeLabel(scope: HotelRequiredChargeScope): string {
  if (scope === 'stay') return 'Selected stay'
  if (scope === 'rate') return 'Selected rate'
  if (scope === 'room') return 'Selected room'
  if (scope === 'property') return 'Property'
  return 'Scope not provided'
}

function scanStatus(evidence: HotelRequiredChargeEvidence, stayCostState: HotelStayCostState): string {
  const canDescribeRelationship = stayCostState === 'provider_total' || stayCostState === 'partial_total'
  if (evidence.state === 'itemized') {
    if (!evidence.categoryTotal) return 'itemized'
    const amount = formatMoney(evidence.categoryTotal)
    if (!canDescribeRelationship || evidence.totalRelationship === 'unknown') return `${amount}; inclusion not confirmed`
    return `${amount} ${evidence.totalRelationship}`
  }
  if (evidence.state === 'included_unitemized') {
    return canDescribeRelationship ? 'included; amount not itemized' : 'amount not itemized'
  }
  if (evidence.state === 'applies_amount_unknown') return 'applies; amount unknown'
  if (evidence.state === 'explicit_none') return `none reported by ${providerName(evidence) ?? 'provider'}`
  if (evidence.state === 'conflicting') return 'details conflict'
  return 'not confirmed'
}

function relationshipCopy(evidence: HotelRequiredChargeEvidence, stayCostState: HotelStayCostState): string | null {
  if (evidence.state === 'explicit_none' || evidence.state === 'included_unitemized') return null
  if (stayCostState !== 'provider_total' && stayCostState !== 'partial_total') {
    return 'No provider total is available to confirm inclusion.'
  }
  if (evidence.totalRelationship === 'included') return 'Included in provider total.'
  if (evidence.totalRelationship === 'excluded') return 'Not included in provider total.'
  return 'Inclusion not confirmed.'
}

function collectionCopy(evidence: HotelRequiredChargeEvidence): string | null {
  if (evidence.state === 'explicit_none') return null
  if (evidence.collection === 'online') return 'Collected online.'
  if (evidence.collection === 'property') return 'Pay at property.'
  if (evidence.collection === 'split') return 'Split between online and property.'
  return 'Payment timing not confirmed.'
}

function stateCopy(evidence: HotelRequiredChargeEvidence, category: HotelChargeCategory): string {
  const categoryNoun = category === 'taxes' ? 'taxes' : 'mandatory property charges'
  if (evidence.state === 'itemized') {
    return evidence.categoryTotal
      ? `${formatMoney(evidence.categoryTotal)}.`
      : 'Itemized by the provider; no category total was provided.'
  }
  if (evidence.state === 'included_unitemized') return 'Included in the provider total; separate amount not provided.'
  if (evidence.state === 'applies_amount_unknown') return 'Applies; amount not available. The price shown is not a complete payable total.'
  if (evidence.state === 'explicit_none') {
    const name = providerName(evidence)
    return `${name ?? 'The provider'} reports no ${categoryNoun} for this selected offer.`
  }
  if (evidence.state === 'conflicting') return 'Provider details conflict. Confirm the amount and terms before booking.'
  return 'Not confirmed for this selected offer.'
}

function provenanceCopy(evidence: HotelRequiredChargeEvidence): string | null {
  const name = providerName(evidence)
  if (!name) return null
  if (evidence.state === 'conflicting') return null
  if (evidence.state === 'not_returned') return `Source checked: ${name} · Scope not provided`
  const checked = formatCheckedDate(evidence.fetchedAt)
  return `Source: ${name} · ${scopeLabel(evidence.scope)}${checked ? ` · Checked ${checked}` : ''}`
}

export function getHotelChargePresentation(
  category: HotelChargeCategory,
  evidence: HotelRequiredChargeEvidence,
  stayCostState: HotelStayCostState,
): HotelChargePresentation {
  return {
    label: category === 'taxes' ? 'Taxes' : 'Mandatory property charges',
    scanStatus: scanStatus(evidence, stayCostState),
    stateCopy: stateCopy(evidence, category),
    relationshipCopy: relationshipCopy(evidence, stayCostState),
    collectionCopy: collectionCopy(evidence),
    provenanceCopy: provenanceCopy(evidence),
    records: evidence.records,
    conflicting: evidence.state === 'conflicting',
  }
}

export function getHotelPriceCompositionPresentation(composition: HotelPriceComposition) {
  const taxes = getHotelChargePresentation('taxes', composition.taxes, composition.stayCostState)
  const mandatoryPropertyCharges = getHotelChargePresentation(
    'mandatory_property_charges',
    composition.mandatoryPropertyCharges,
    composition.stayCostState,
  )
  return {
    taxes,
    mandatoryPropertyCharges,
    scanCopy: `Taxes: ${taxes.scanStatus} · Mandatory property charges: ${mandatoryPropertyCharges.scanStatus}`,
    ariaLabel: `Taxes: ${taxes.scanStatus}. Mandatory property charges: ${mandatoryPropertyCharges.scanStatus}.`,
  }
}
