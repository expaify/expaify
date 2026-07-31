import { renderToStaticMarkup } from 'react-dom/server'
import type { HotelTransportEvidence } from '@/lib/types'
import {
  getAirportDistanceTransportCaveat,
  getHotelTransportHandoffGuidance,
  HotelTransportSection,
  HotelTransportSummary,
} from '../HotelTransport'

const confirmed: HotelTransportEvidence = {
  state: 'ready',
  facilityStatus: 'confirmed',
  serviceKind: 'airport_shuttle',
  endpointName: 'John F. Kennedy International Airport',
  direction: 'round_trip',
  operator: 'property',
  cost: {
    state: 'included',
    chargeBasis: 'unknown',
    tripBasis: 'unknown',
  },
  hours: {
    mode: 'scheduled',
    windows: [{ startLocal: '06:00', endLocal: '23:30', days: 'Daily' }],
    timezone: 'America/New_York',
  },
  action: {
    kind: 'reserve_before_arrival',
    advanceDeadline: 'At least 24 hours before arrival',
  },
  sourceLabel: 'Future Hotel Provider',
  fetchedAt: '2020-07-20T12:00:00.000Z',
  evidenceRevision: 'transport-v1',
}

function summary(evidence?: HotelTransportEvidence): string {
  return renderToStaticMarkup(<HotelTransportSummary evidence={evidence} />)
}

function details(evidence?: HotelTransportEvidence): string {
  return renderToStaticMarkup(<HotelTransportSection hotelId="hotel-1" evidence={evidence} />)
}

describe('hotel airport-transfer presentation', () => {
  it('renders a sourced complimentary service with canonical facts and no distance inference', () => {
    const summaryMarkup = summary(confirmed)
    const detailMarkup = details(confirmed)

    expect(summaryMarkup).toContain('Complimentary airport transfer')
    expect(summaryMarkup).toContain('reported by Future Hotel Provider')
    expect(detailMarkup).toContain('Airport shuttle between John F. Kennedy International Airport and the property · Round trip · Property operated')
    expect(detailMarkup).toContain('Complimentary.')
    expect(detailMarkup).toContain('Daily 06:00–23:30 America/New_York. Your arrival-time fit was not checked.')
    expect(detailMarkup).toContain('Reserve before arrival. At least 24 hours before arrival.')
    expect(detailMarkup).toContain('Source: Future Hotel Provider. Updated Jul 20, 2020.')
    expect(detailMarkup.indexOf('Service')).toBeLessThan(detailMarkup.indexOf('Cost'))
    expect(detailMarkup.indexOf('Cost')).toBeLessThan(detailMarkup.indexOf('Hours'))
    expect(detailMarkup.indexOf('Hours')).toBeLessThan(detailMarkup.indexOf('Before arrival'))
  })

  it('keeps paid visible when amount is absent or invalid', () => {
    const paidWithoutAmount: HotelTransportEvidence = {
      ...confirmed,
      cost: { state: 'paid', chargeBasis: 'per_vehicle', tripBasis: 'each_way' },
    }
    const paidWithInvalidAmount: HotelTransportEvidence = {
      ...confirmed,
      cost: {
        state: 'paid',
        amount: { priceCents: 0, currency: 'USD' },
        chargeBasis: 'per_vehicle',
        tripBasis: 'each_way',
      },
    }

    for (const evidence of [paidWithoutAmount, paidWithInvalidAmount]) {
      expect(summary(evidence)).toContain('Paid; amount not documented')
      expect(details(evidence)).toContain('Paid; amount not documented. Separate from the displayed nightly room rate.')
      expect(details(evidence)).not.toContain('Complimentary')
    }
  })

  it('keeps omission, failure, unavailable, loading, and unclear states distinct', () => {
    const notReturned: HotelTransportEvidence = {
      state: 'ready', facilityStatus: 'not_returned', evidenceRevision: 'omitted-v1',
    }
    const unavailable: HotelTransportEvidence = {
      state: 'ready', facilityStatus: 'unavailable', sourceLabel: 'Future Hotel Provider',
      fetchedAt: '2020-07-20T12:00:00.000Z', evidenceRevision: 'negative-v1',
    }
    const missingProvenance: HotelTransportEvidence = {
      ...confirmed, sourceLabel: undefined,
    }
    const retiredProviderClaim: HotelTransportEvidence = {
      ...confirmed, sourceLabel: 'Hotellook',
    }
    const loading: HotelTransportEvidence = {
      state: 'loading', facilityStatus: 'unknown', evidenceRevision: 'loading-v1',
    }

    expect(summary()).toContain('could not be checked')
    expect(details()).toContain('could not be checked. Confirm directly')
    expect(summary(notReturned)).toContain('not documented')
    expect(details(notReturned)).toContain('did not document an airport transfer')
    expect(summary(unavailable)).toContain('No airport transfer reported')
    expect(details(unavailable)).toContain('Unavailable')
    expect(summary(missingProvenance)).toContain('details are unclear')
    expect(details(missingProvenance)).not.toContain('Complimentary')
    expect(summary(retiredProviderClaim)).toContain('details are unclear')
    expect(details(retiredProviderClaim)).not.toContain('Complimentary')
    expect(summary(loading)).toContain('Checking airport transfer…')
    expect(details(loading)).toContain('role="status"')
    expect(details(loading)).toContain('aria-live="polite"')
  })

  it('uses evidence state—not airport distance—to choose the anti-inference caveat and handoff task', () => {
    const omitted: HotelTransportEvidence = {
      state: 'ready', facilityStatus: 'not_returned', evidenceRevision: 'omitted-v1',
    }
    const paid: HotelTransportEvidence = {
      ...confirmed,
      cost: { state: 'paid', chargeBasis: 'per_vehicle', tripBasis: 'each_way' },
      hours: { mode: 'unknown' },
    }

    expect(getAirportDistanceTransportCaveat()).toBe('Straight-line distance only. Airport transfer details could not be checked.')
    expect(getAirportDistanceTransportCaveat(omitted)).toBe('Straight-line distance only. Airport transfer not documented.')
    expect(getAirportDistanceTransportCaveat(confirmed)).toBe('Straight-line distance only. See Airport transfer for service details.')
    expect(getHotelTransportHandoffGuidance(paid)).toBe(
      'Confirm airport-transfer cost, hours, and required advance action with the provider before arrival. The transport charge is separate from the displayed nightly room rate.'
    )
  })
})
