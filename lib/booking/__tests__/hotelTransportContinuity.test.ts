import {
  buildBookingHotelContext,
  buildHotelBookingHref,
  parseBookingHotelContext,
  validateStructuredBookingHotelContext,
} from '../config'
import type { HotelOffer, HotelTransportEvidence } from '../../types'

const transportEvidence: HotelTransportEvidence = {
  state: 'ready',
  facilityStatus: 'confirmed',
  serviceKind: 'airport_transfer',
  endpointName: 'JFK',
  direction: 'round_trip',
  operator: 'third_party',
  cost: {
    state: 'paid',
    amount: { priceCents: 4500, currency: 'USD' },
    chargeBasis: 'per_vehicle',
    tripBasis: 'each_way',
  },
  hours: { mode: 'on_request' },
  action: { kind: 'contact_property' },
  sourceLabel: 'Future Hotel Provider',
  fetchedAt: '2020-07-20T12:00:00.000Z',
  evidenceRevision: 'immutable-transport-v7',
}

const hotel: HotelOffer = {
  id: 'transport-hotel',
  name: 'Transport Test Hotel',
  area: 'Airport district',
  stars: 4,
  pricePerNight: { priceCents: 18_900, currency: 'USD' },
  deeplink: 'https://tp.media/r?marker=affiliate',
  source: 'future-provider',
  documentReadiness: {
    status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {},
    billingDetailsStep: 'unknown',
    taxIdentifierEligibility: { state: 'not_provided', entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Future Hotel Provider', scope: 'rate' } },
    documentNameEligibility: { state: 'not_provided', allowedAddresseeTypes: [], relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' }, entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Future Hotel Provider', scope: 'rate' } },
    source: { label: 'Future Hotel Provider' },
  },
  fundsPolicy: {
    state: 'not_returned', obligations: [], sourceLabel: 'Future Hotel Provider', scope: 'not_returned',
  },
  transportEvidence,
}

const paidWithoutDocumentedDetails = {
  ...transportEvidence,
  cost: { state: 'paid' },
} as HotelTransportEvidence

const normalizedIncompletePaidCost = {
  state: 'paid',
  chargeBasis: 'unknown',
  tripBasis: 'unknown',
}

describe('hotel transport booking continuity', () => {
  it('round-trips the selected evidence revision through inline and stored context validation', () => {
    const context = buildBookingHotelContext(hotel)
    const structured = validateStructuredBookingHotelContext(JSON.parse(JSON.stringify(context)))
    const href = buildHotelBookingHref(hotel)
    const params = Object.fromEntries(new URL(href, 'https://expaify.test').searchParams.entries())
    const inline = parseBookingHotelContext(params)

    expect(context.transportEvidence).toEqual(transportEvidence)
    expect(structured?.transportEvidence).toEqual(transportEvidence)
    expect(inline?.transportEvidence).toEqual(transportEvidence)
    expect(inline?.providerUrl).toBe(hotel.deeplink)
  })

  it('preserves paid transport with undocumented details through inline context validation', () => {
    const href = buildHotelBookingHref({
      ...hotel,
      transportEvidence: paidWithoutDocumentedDetails,
    })
    const params = Object.fromEntries(new URL(href, 'https://expaify.test').searchParams.entries())
    const inline = parseBookingHotelContext(params)

    expect(inline?.transportEvidence?.cost).toEqual(normalizedIncompletePaidCost)
    expect(inline?.providerUrl).toBe(hotel.deeplink)
  })

  it('preserves paid transport with undocumented details through stored context validation', () => {
    const context = buildBookingHotelContext({
      ...hotel,
      transportEvidence: paidWithoutDocumentedDetails,
    })
    const stored = validateStructuredBookingHotelContext(JSON.parse(JSON.stringify(context)))

    expect(stored?.transportEvidence?.cost).toEqual(normalizedIncompletePaidCost)
    expect(stored?.providerUrl).toBe(hotel.deeplink)
  })

  it('degrades rejected evidence to unclear without blocking the affiliate handoff', () => {
    const context = buildBookingHotelContext(hotel) as unknown as Record<string, unknown>
    context.transportEvidence = { state: 'ready', facilityStatus: 'confirmed' }
    const validated = validateStructuredBookingHotelContext(context)

    expect(validated).not.toBeNull()
    expect(validated?.transportEvidence).toEqual({
      state: 'ready',
      facilityStatus: 'unknown',
      evidenceRevision: 'invalid-booking-context',
    })
    expect(validated?.providerUrl).toBe(hotel.deeplink)
  })
})
