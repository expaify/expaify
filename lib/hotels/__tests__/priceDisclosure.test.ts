import type {
  HotelRequiredChargeEvidence,
  HotelRequiredChargeState,
  HotelStayCostState,
} from '../../types'
import {
  buildHotelPriceComposition,
  deriveHotelPriceDisclosureState,
  getHotelPriceCompositionPresentation,
  normalizeHotelRequiredChargeEvidence,
} from '../priceDisclosure'

const states: HotelRequiredChargeState[] = [
  'itemized', 'included_unitemized', 'applies_amount_unknown',
  'explicit_none', 'not_returned', 'conflicting',
]
const outerStates: HotelStayCostState[] = [
  'provider_total', 'partial_total', 'expaify_estimate', 'nightly_only',
]

function evidence(state: HotelRequiredChargeState): HotelRequiredChargeEvidence {
  return {
    offerId: 'offer-1',
    supplier: 'future-provider',
    sourceLabel: 'Future Provider',
    scope: state === 'not_returned' ? 'not_returned' : 'stay',
    state,
    totalRelationship: state === 'itemized' || state === 'included_unitemized' ? 'included' : 'unknown',
    collection: state === 'itemized' ? 'online' : state === 'included_unitemized' ? 'property' : 'unknown',
    ...(state === 'itemized' ? { categoryTotal: { priceCents: 4200, currency: 'USD' } } : {}),
    records: [],
  }
}

function expectedState(
  outer: HotelStayCostState,
  taxState: HotelRequiredChargeState,
  chargeState: HotelRequiredChargeState,
) {
  const documented = (state: HotelRequiredChargeState) => state !== 'not_returned'
  const resolved = (state: HotelRequiredChargeState) => state === 'itemized' || state === 'explicit_none'
  const included = (state: HotelRequiredChargeState) => ['itemized', 'included_unitemized', 'explicit_none'].includes(state)
  if (outer === 'provider_total' && resolved(taxState) && resolved(chargeState)) return 'fully_itemized'
  if (outer === 'provider_total' && (
    (!documented(taxState) && !documented(chargeState))
    || (included(taxState) && included(chargeState) && (taxState !== 'itemized' || chargeState !== 'itemized'))
  )) return 'provider_total_breakdown_unknown'
  if (outer === 'partial_total' || documented(taxState) || documented(chargeState)) return 'partially_itemized'
  return 'incomplete'
}

describe('hotel required-charge evidence', () => {
  it.each(outerStates.flatMap(outer => states.flatMap(taxState => states.map(chargeState => [
    outer, taxState, chargeState,
  ] as const))))('derives %s × tax=%s × mandatory=%s', (outer, taxState, chargeState) => {
    expect(deriveHotelPriceDisclosureState({
      stayCostState: outer,
      taxes: evidence(taxState),
      mandatoryPropertyCharges: evidence(chargeState),
    })).toBe(expectedState(outer, taxState, chargeState))
  })

  it('gives price-unavailable precedence even when independent charge evidence exists', () => {
    expect(deriveHotelPriceDisclosureState({
      stayCostState: 'nightly_only',
      priceUnavailable: true,
      taxes: evidence('itemized'),
      mandatoryPropertyCharges: evidence('not_returned'),
    })).toBe('unavailable')
  })

  it('normalizes only matching, supported, required, integer-minor-unit evidence', () => {
    const normalized = normalizeHotelRequiredChargeEvidence({
      offerId: 'offer-1',
      supplier: 'future-provider',
      capability: { supportedScopes: ['stay'], supportsExplicitNone: true },
      evidence: {
        ...evidence('itemized'),
        categoryTotal: { priceCents: 7250, currency: 'USD' },
        records: [
          { id: 'tax-1', name: ' State tax ', required: true, amount: { priceCents: 7250, currency: 'USD' } },
          { id: 'optional-1', name: 'Breakfast', required: false, amount: { priceCents: 2500, currency: 'USD' } },
          { id: 'bad-1', name: 'Bad amount', required: true, amount: { priceCents: 10.5, currency: 'USD' } },
        ],
      },
    })

    expect(normalized.state).toBe('itemized')
    expect(normalized.categoryTotal).toEqual({ priceCents: 7250, currency: 'USD' })
    expect(normalized.records).toEqual([{
      id: 'tax-1', name: 'State tax', required: true, amount: { priceCents: 7250, currency: 'USD' },
    }])
  })

  it.each([
    ['mismatched offer', { offerId: 'another-offer' }, undefined],
    ['mismatched supplier', { supplier: 'another-provider' }, undefined],
    ['stale evidence', { isStale: true }, undefined],
    ['unsupported scope', { scope: 'property' }, undefined],
    ['unsupported explicit negative', { state: 'explicit_none', categoryTotal: undefined, records: [] }, { supportedScopes: ['stay'], supportsExplicitNone: false }],
  ])('degrades %s to not_returned', (_label, patch, capability) => {
    expect(normalizeHotelRequiredChargeEvidence({
      offerId: 'offer-1',
      supplier: 'future-provider',
      capability: capability
        ? { supportedScopes: capability.supportedScopes.filter((scope): scope is 'stay' => scope === 'stay'), supportsExplicitNone: capability.supportsExplicitNone }
        : { supportedScopes: ['stay'], supportsExplicitNone: true },
      evidence: { ...evidence('itemized'), ...patch },
    }).state).toBe('not_returned')
  })

  it('retains records and marks disagreement about inclusion as conflicting', () => {
    const normalized = normalizeHotelRequiredChargeEvidence({
      offerId: 'offer-1',
      supplier: 'future-provider',
      capability: { supportedScopes: ['stay'], supportsExplicitNone: true },
      evidence: {
        ...evidence('itemized'),
        records: [
          { name: 'Tax A', required: true, amount: { priceCents: 1000, currency: 'USD' }, totalRelationship: 'included' },
          { name: 'Tax B', required: true, amount: { priceCents: 500, currency: 'USD' }, totalRelationship: 'excluded' },
        ],
      },
    })
    expect(normalized.state).toBe('conflicting')
    expect(normalized.records).toHaveLength(2)
    expect(normalized.totalRelationship).toBe('unknown')
  })

  it('treats an explicit negative retained alongside a required charge as conflicting', () => {
    const normalized = normalizeHotelRequiredChargeEvidence({
      offerId: 'offer-1',
      supplier: 'future-provider',
      capability: { supportedScopes: ['stay'], supportsExplicitNone: true },
      evidence: {
        ...evidence('explicit_none'),
        records: [{ name: 'Required tax', required: true, amount: { priceCents: 500, currency: 'USD' } }],
      },
    })
    expect(normalized.state).toBe('conflicting')
    expect(normalized.records).toHaveLength(1)
  })

  it('keeps relationship and collection independent in shared presentation copy', () => {
    const composition = buildHotelPriceComposition({
      offerId: 'offer-1',
      supplier: 'future-provider',
      stayCostState: 'provider_total',
      capabilities: {
        taxes: { supportedScopes: ['stay'], supportsExplicitNone: true },
        mandatoryPropertyCharges: { supportedScopes: ['stay'], supportsExplicitNone: true },
      },
      taxEvidence: { ...evidence('itemized'), collection: 'online' },
      mandatoryPropertyChargeEvidence: {
        ...evidence('itemized'),
        categoryTotal: { priceCents: 3000, currency: 'USD' },
        collection: 'property',
      },
    })
    const presentation = getHotelPriceCompositionPresentation(composition)
    expect(composition.priceDisclosureState).toBe('fully_itemized')
    expect(presentation.taxes.relationshipCopy).toBe('Included in provider total.')
    expect(presentation.taxes.collectionCopy).toBe('Collected online.')
    expect(presentation.mandatoryPropertyCharges.relationshipCopy).toBe('Included in provider total.')
    expect(presentation.mandatoryPropertyCharges.collectionCopy).toBe('Pay at property.')
  })
})
