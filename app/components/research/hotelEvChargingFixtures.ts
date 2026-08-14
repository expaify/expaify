import type { HotelEvChargingEvidence, HotelEvChargingField } from '@/app/components/HotelEvCharging'

export const HOTEL_EV_CHARGING_FIXTURE_IDS = [
  'confirmed_presence_only', 'limited_paid_unknown_amount', 'limited_reservation', 'limited_multi',
  'unknown_not_returned', 'unknown_off_site', 'unknown_conflict', 'unknown_malformed',
  'explicit_negative', 'included_cost', 'exact_cost', 'connector_label', 'initial_loading',
  'refresh_known', 'error_empty', 'property_mismatch',
] as const

export type HotelEvChargingFixtureId = typeof HOTEL_EV_CHARGING_FIXTURE_IDS[number]

const missing: HotelEvChargingField = { state: 'not_provided' }
const source = { provider: 'Research Mobility Provider', fetchedAt: '2026-08-01T14:30:00.000Z' }

function base(overrides: Partial<HotelEvChargingEvidence> = {}): HotelEvChargingEvidence {
  return {
    loadState: 'ready', presentationState: 'confirmed', presence: 'listed_on_property', scope: 'property',
    limitationCategories: [], access: missing, reservation: missing, cost: { state: 'unknown' },
    connector: missing, power: missing, operator: missing, hours: missing, source,
    evidenceRevision: 'research-ev-charging-r1', researchFixture: true, ...overrides,
  }
}

export function createHotelEvChargingFixture(id: HotelEvChargingFixtureId): HotelEvChargingEvidence {
  switch (id) {
    case 'confirmed_presence_only': return base()
    case 'limited_paid_unknown_amount': return base({ presentationState: 'limited', limitationCategories: ['paid'], cost: { state: 'paid' } })
    case 'limited_reservation': return base({ presentationState: 'limited', limitationCategories: ['reservation_required'], reservation: { state: 'reported', label: 'Reservation required' } })
    case 'limited_multi': return base({ presentationState: 'limited', limitationCategories: ['paid', 'guest_only', 'limited_hours', 'reservation_required'], access: { state: 'reported', label: 'Registered guests only' }, reservation: { state: 'reported', label: 'Reservation required' }, cost: { state: 'paid' }, hours: { state: 'reported', label: '6:00 AM–10:00 PM property time' } })
    case 'unknown_not_returned': return base({ presentationState: 'unknown', presence: 'not_returned', scope: 'unknown', source: { provider: '' } })
    case 'unknown_off_site': return base({ presentationState: 'unknown', presence: 'off_site_only', scope: 'off_site' })
    case 'unknown_conflict': return base({ presentationState: 'unknown', presence: 'conflicting', scope: 'unknown' })
    case 'unknown_malformed': return base({ presentationState: 'unknown', presence: 'malformed', scope: 'unknown', source: { provider: '' }, evidenceRevision: 'research-malformed-safe-fallback-r1' })
    case 'explicit_negative': return base({ presentationState: 'explicit_negative', presence: 'reported_not_on_property' })
    case 'included_cost': return base({ cost: { state: 'included' } })
    case 'exact_cost': return base({ presentationState: 'limited', limitationCategories: ['paid'], cost: { state: 'paid', amount: { priceCents: 2500, currency: 'USD' }, basis: 'per_session' } })
    case 'connector_label': return base({ presentationState: 'limited', limitationCategories: ['connector_limited'], connector: { state: 'reported', label: 'J1772; vehicle compatibility not confirmed' } })
    case 'initial_loading': return base({ loadState: 'loading', presentationState: 'unknown', presence: 'unknown', scope: 'unknown' })
    case 'refresh_known': return base({ loadState: 'refreshing', presentationState: 'limited', limitationCategories: ['reservation_required'], reservation: { state: 'reported', label: 'Reservation required' } })
    case 'error_empty': return base({ loadState: 'error', presentationState: 'unknown', presence: 'unknown', scope: 'unknown', source: { provider: '' } })
    case 'property_mismatch': return base({ presentationState: 'unknown', presence: 'malformed', scope: 'unknown', source: { provider: '' }, evidenceRevision: 'research-property-mismatch-discarded-r1' })
  }
}
