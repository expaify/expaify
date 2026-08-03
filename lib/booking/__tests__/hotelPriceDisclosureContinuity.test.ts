import {
  buildBookingHotelContext,
  buildHotelBookingHref,
  parseBookingHotelContext,
  validateStructuredBookingHotelContext,
} from '../config'
import type { HotelOffer } from '../../types'

const hotel: HotelOffer = {
  id: 'priced-hotel',
  name: 'Price Evidence Hotel',
  area: 'Center',
  stars: 4,
  pricePerNight: { priceCents: 20_000, currency: 'USD' },
  deeplink: 'https://tp.media/r?marker=affiliate',
  source: 'future-provider',
  documentReadiness: {
    status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {},
    billingDetailsStep: 'unknown', source: { label: 'Future Provider' },
  },
  fundsPolicy: {
    state: 'not_returned', obligations: [], sourceLabel: 'Future Provider', scope: 'not_returned',
  },
  requiredChargeCapabilities: {
    taxes: { supportedScopes: ['stay'], supportsExplicitNone: true },
    mandatoryPropertyCharges: { supportedScopes: ['stay'], supportsExplicitNone: true },
  },
  taxEvidence: {
    offerId: 'priced-hotel', supplier: 'future-provider', sourceLabel: 'Future Provider', scope: 'stay',
    state: 'itemized', totalRelationship: 'included', collection: 'online',
    categoryTotal: { priceCents: 4200, currency: 'USD' }, records: [],
  },
  mandatoryPropertyChargeEvidence: {
    offerId: 'priced-hotel', supplier: 'future-provider', sourceLabel: 'Future Provider', scope: 'stay',
    state: 'itemized', totalRelationship: 'excluded', collection: 'property',
    categoryTotal: { priceCents: 3000, currency: 'USD' },
    records: [{
      id: 'resort-1', name: 'Destination charge', required: true,
      amount: { priceCents: 3000, currency: 'USD' }, basis: 'per stay', collection: 'property',
    }],
  },
}

describe('hotel tax and mandatory-charge booking continuity', () => {
  it('round-trips separate normalized evidence through inline and stored contexts', () => {
    const context = buildBookingHotelContext(hotel)
    const href = buildHotelBookingHref(hotel)
    const params = Object.fromEntries(new URL(href, 'https://expaify.test').searchParams.entries())
    const inline = parseBookingHotelContext(params)
    const stored = validateStructuredBookingHotelContext(JSON.parse(JSON.stringify(context)))

    expect(inline?.taxEvidence).toEqual(context.taxEvidence)
    expect(inline?.mandatoryPropertyChargeEvidence).toEqual(context.mandatoryPropertyChargeEvidence)
    expect(inline?.requiredChargeCapabilities).toEqual(context.requiredChargeCapabilities)
    expect(stored?.taxEvidence).toEqual(context.taxEvidence)
    expect(stored?.mandatoryPropertyChargeEvidence).toEqual(context.mandatoryPropertyChargeEvidence)
    expect(context.priceDisclosureState).toBe('partially_itemized')
  })

  it('degrades mismatched evidence without blocking the affiliate handoff', () => {
    const context = buildBookingHotelContext(hotel) as unknown as Record<string, unknown>
    context.taxEvidence = { ...hotel.taxEvidence, offerId: 'different-offer' }
    const stored = validateStructuredBookingHotelContext(context)

    expect(stored).not.toBeNull()
    expect(stored?.taxEvidence?.state).toBe('not_returned')
    expect(stored?.mandatoryPropertyChargeEvidence?.state).toBe('itemized')
    expect(stored?.providerUrl).toBe(hotel.deeplink)
  })
})
