import {
  HOTEL_IDENTITY_EVENT_PROPERTIES,
  HOTEL_IDENTITY_RETURN_REASONS,
  validateHotelIdentityAnalytics,
  type HotelIdentityEvent,
} from '../guestIdentityAnalytics'

const state = {
  surface: 'handoff',
  evidence_state: 'not_established',
  affected_party_state: 'not_established',
  identity_document_state: 'not_established',
  payment_name_match_state: 'not_established',
  viewport_group: 'desktop_1280',
  source_class: 'current_provider',
} as const

const propsByEvent: Record<HotelIdentityEvent, Record<string, string | boolean>> = {
  hotel_identity_disclosure_exposed: { ...state },
  hotel_identity_informed_exit: { ...state, exit_action: 'back_to_results' },
  hotel_identity_handoff_continued: { ...state, partner_named: true },
  hotel_identity_handoff_returned: { ...state, away_duration_bucket: 'under_30s' },
  hotel_identity_return_reason_selected: {
    affected_party_state: 'not_established',
    identity_document_state: 'not_established',
    payment_name_match_state: 'not_established',
    reason: 'prefer_not_to_say',
  },
}

const valuesByProperty: Record<string, readonly (string | boolean)[]> = {
  surface: ['result_detail', 'handoff'],
  evidence_state: ['confirmed', 'conditional', 'explicit_negative', 'not_established', 'error', 'conflicting', 'mixed'],
  affected_party_state: ['lead_guest', 'cardholder', 'all_occupants', 'other', 'unspecified', 'not_established', 'conflicting'],
  identity_document_state: ['confirmed', 'conditional', 'not_required', 'not_established', 'conflicting'],
  payment_name_match_state: ['confirmed', 'conditional', 'not_required', 'not_established', 'conflicting'],
  viewport_group: ['mobile_375', 'desktop_1280', 'other'],
  source_class: ['current_provider', 'other_provider', 'unnamed_provider'],
  exit_action: ['back_to_results', 'change_hotel'],
  partner_named: [true, false],
  away_duration_bucket: ['under_30s', '30s_to_2m', '2m_to_10m', 'over_10m'],
  reason: HOTEL_IDENTITY_RETURN_REASONS,
}

describe('hotel guest identity analytics privacy contract', () => {
  it.each(Object.entries(HOTEL_IDENTITY_EVENT_PROPERTIES))(
    'accepts exactly the required properties for %s',
    (event, properties) => {
      const props = propsByEvent[event as HotelIdentityEvent]
      expect(Object.keys(props)).toEqual(properties)
      expect(validateHotelIdentityAnalytics(event, props)).toEqual(props)
    },
  )

  it.each(
    Object.entries(HOTEL_IDENTITY_EVENT_PROPERTIES).flatMap(([event, properties]) => (
      properties.flatMap(property => (
        valuesByProperty[property].map(value => [event, property, value] as const)
      ))
    )),
  )('accepts fixed enum %s.%s=%s', (event, property, value) => {
    const props = { ...propsByEvent[event as HotelIdentityEvent], [property]: value }
    expect(validateHotelIdentityAnalytics(event, props)).toEqual(props)
  })

  it.each([
    ['extra property', { ...state, provider_wording: 'show a passport' }],
    ['free text enum', { ...state, evidence_state: 'guest said it was fine' }],
    ['identity data', { ...state, name: 'A Person' }],
    ['card data', { ...state, card_number: '4111111111111111' }],
    ['document data', { ...state, document_number: 'P1234' }],
    ['provider wording', { ...state, provider_wording: 'ID required' }],
    ['property identifier', { ...state, property_id: 'hotel-123' }],
    ['offer identifier', { ...state, offer_id: 'offer-123' }],
    ['URL', { ...state, url: 'https://provider.test/booking?token=secret' }],
  ])('rejects %s', (_case, props) => {
    expect(validateHotelIdentityAnalytics('hotel_identity_disclosure_exposed', props)).toBeNull()
  })

  it('rejects missing keys, nested data, and unknown events', () => {
    const { surface: _surface, ...missingSurface } = state
    expect(validateHotelIdentityAnalytics('hotel_identity_disclosure_exposed', missingSurface)).toBeNull()
    expect(validateHotelIdentityAnalytics('hotel_identity_disclosure_exposed', { ...state, source_class: { raw: 'provider' } })).toBeNull()
    expect(validateHotelIdentityAnalytics('hotel_identity_arbitrary', state)).toBeNull()
  })
})
