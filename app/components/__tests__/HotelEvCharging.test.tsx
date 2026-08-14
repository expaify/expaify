import {
  PRODUCTION_EV_CHARGING_UNKNOWN,
  getHotelEvChargingHandoffCopy,
  getHotelEvChargingResultCopy,
  hotelEvChargingActionBoundary,
} from '../HotelEvCharging'
import {
  createHotelEvChargingFixture,
  HOTEL_EV_CHARGING_FIXTURE_IDS,
} from '../research/hotelEvChargingFixtures'

describe('hotel EV-charging presentation', () => {
  it('keeps the production fallback unknown and avoids negative or positive inference', () => {
    const result = getHotelEvChargingResultCopy(PRODUCTION_EV_CHARGING_UNKNOWN)
    expect(result.visible).toBe('EV charging details not provided')
    expect(result.accessible).toContain('Unknown')
    expect(getHotelEvChargingHandoffCopy(PRODUCTION_EV_CHARGING_UNKNOWN)).toContain('has not been confirmed')
    expect(hotelEvChargingActionBoundary(PRODUCTION_EV_CHARGING_UNKNOWN)).toBe('On-property charging is not confirmed.')
  })

  it('blocks positive rendering when the research-only gate is absent', () => {
    const unapproved = { ...createHotelEvChargingFixture('confirmed_presence_only'), researchFixture: undefined }
    expect(getHotelEvChargingResultCopy(unapproved).visible).toBe('EV charging details not provided')
  })

  it.each([
    ['confirmed_presence_only', 'EV charging listed on property'],
    ['limited_reservation', 'Reservation required'],
    ['limited_multi', 'Reservation required +3'],
    ['unknown_not_returned', 'EV charging details not provided'],
    ['unknown_off_site', 'On-property EV charging not confirmed'],
    ['unknown_conflict', 'EV charging information unclear'],
    ['unknown_malformed', 'EV charging information unclear'],
    ['explicit_negative', 'reports no EV charging on property'],
    ['initial_loading', 'Checking EV-charging details…'],
    ['error_empty', 'EV-charging details could not be checked'],
  ] as const)('renders distinct result copy for %s', (id, expected) => {
    expect(getHotelEvChargingResultCopy(createHotelEvChargingFixture(id)).visible).toContain(expected)
  })

  it('formats integer-minor-unit charging cost without folding it into room price', () => {
    const result = getHotelEvChargingResultCopy(createHotelEvChargingFixture('exact_cost'))
    expect(result.visible).toContain('$25.00 per session')
    expect(result.visible).not.toContain('nightly')
  })

  it('uses the required no-fee language and never says free', () => {
    const evidence = createHotelEvChargingFixture('included_cost')
    expect(getHotelEvChargingHandoffCopy(evidence)).not.toMatch(/\bfree\b/i)
    expect(JSON.stringify(evidence)).not.toMatch(/\bfree\b/i)
  })

  it('defines every comprehension fixture from the design spec', () => {
    expect(HOTEL_EV_CHARGING_FIXTURE_IDS).toHaveLength(16)
    expect(HOTEL_EV_CHARGING_FIXTURE_IDS).toEqual(expect.arrayContaining([
      'confirmed_presence_only', 'limited_paid_unknown_amount', 'limited_reservation', 'limited_multi',
      'unknown_not_returned', 'unknown_off_site', 'unknown_conflict', 'unknown_malformed',
      'explicit_negative', 'included_cost', 'exact_cost', 'connector_label', 'initial_loading',
      'refresh_known', 'error_empty', 'property_mismatch',
    ]))
  })

  it('preserves known limited evidence during refresh', () => {
    const result = getHotelEvChargingResultCopy(createHotelEvChargingFixture('refresh_known'))
    expect(result.visible).toContain('Reservation required')
    expect(result.visible).not.toContain('Checking EV-charging details')
  })
})
