import { renderToStaticMarkup } from 'react-dom/server'
import { HotelClimateEvidenceLedger, HotelClimateHandoffCheck } from '../HotelClimateEvidence'
import {
  createHotelClimateFixture,
  HOTEL_CLIMATE_FIXTURE_IDS,
} from '../research/hotelClimateFixtures'
import {
  getHotelClimateResultCue,
  validateHotelClimateEvidence,
} from '@/lib/hotels/climateEvidence'

const expectedCues = {
  selected_room_rate: 'Cooling and room adjustment reported · this room and rate',
  room_category: 'Heating reported · room category',
  property_only: 'Cooling reported · at property',
  explicit_negative: 'Cooling reported absent · room category',
  missing_failed_conflict: 'Room climate details conflict · check cooling, heating, and adjustment',
  unsupported_current_contract: 'Room climate details not supported by this provider',
  stale_refresh_failed: 'Earlier room climate details could not be reconfirmed',
} as const

describe('hotel climate evidence presentation', () => {
  it.each(HOTEL_CLIMATE_FIXTURE_IDS)('derives the exact compact cue for %s', id => {
    expect(getHotelClimateResultCue(createHotelClimateFixture(id))).toBe(expectedCues[id])
  })

  it('renders three ordered, independently explained rows', () => {
    const html = renderToStaticMarkup(<HotelClimateEvidenceLedger evidence={createHotelClimateFixture('selected_room_rate')} />)
    expect(html.indexOf('Cooling')).toBeLessThan(html.indexOf('Heating'))
    expect(html.indexOf('Heating')).toBeLessThan(html.indexOf('Room temperature adjustment'))
    expect(html).toContain('Cooling is reported.')
    expect(html).toContain('For this room and rate.')
    expect(html).toContain('Heating was not provided by this provider.')
    expect(html).toContain('guests can adjust the room temperature')
    expect(html).toContain('Provider-reported equipment and control only')
  })

  it('keeps explicit absence, missing, failed, conflict, stale, and unsupported copy distinct', () => {
    const absent = renderToStaticMarkup(<HotelClimateEvidenceLedger evidence={createHotelClimateFixture('explicit_negative')} />)
    const mixed = renderToStaticMarkup(<HotelClimateEvidenceLedger evidence={createHotelClimateFixture('missing_failed_conflict')} />)
    const stale = renderToStaticMarkup(<HotelClimateEvidenceLedger evidence={createHotelClimateFixture('stale_refresh_failed')} />)
    const unsupported = renderToStaticMarkup(<HotelClimateEvidenceLedger evidence={createHotelClimateFixture('unsupported_current_contract')} />)
    expect(absent).toContain('provider-stated absence, not missing information')
    expect(mixed).toContain('Cooling was not provided')
    expect(mixed).toContain('Heating details could not be checked')
    expect(mixed).toContain('statements do not agree')
    expect(stale).toContain('Earlier provider information could not be reconfirmed')
    expect(unsupported.match(/not supported by this provider connection/g)).toHaveLength(3)
    expect(unsupported).toContain('No check was attempted')
  })

  it('shows continuity failure instead of treating absent legacy context as provider omission', () => {
    const html = renderToStaticMarkup(<HotelClimateEvidenceLedger continuityFailed />)
    expect(html).toContain('Room climate details could not be carried into this review.')
    expect(html).toContain('Check cooling, heating, and room temperature adjustment with the provider.')
    expect(html).not.toContain('was not provided by this provider')
  })

  it('fails malformed scoped evidence closed', () => {
    const fixture = structuredClone(createHotelClimateFixture('room_category'))
    delete fixture.rows[1].statements[0].roomCategoryLabel
    expect(validateHotelClimateEvidence(fixture)).toBeNull()
    const html = renderToStaticMarkup(<HotelClimateEvidenceLedger evidence={fixture} />)
    expect(html).toContain('Returned room climate details could not be verified.')
    expect(html).not.toContain('Heating is reported.')
  })

  it('rejects mismatched selected-room continuity and unsafe or future evidence', () => {
    const selected = createHotelClimateFixture('selected_room_rate')
    expect(validateHotelClimateEvidence(selected, {
      offerId: selected.offerId,
      roomId: 'different-room',
      rateId: 'rate-1',
      checkIn: '2026-09-10',
      checkOut: '2026-09-13',
    })).toBeNull()

    const unsafe = structuredClone(createHotelClimateFixture('property_only'))
    unsafe.rows[0].statements[0].sourceWording = '<script>unsafe</script>'
    expect(validateHotelClimateEvidence(unsafe)).toBeNull()
    const future = structuredClone(createHotelClimateFixture('property_only'))
    future.rows[0].statements[0].observedAt = '2099-01-01T00:00:00.000Z'
    expect(validateHotelClimateEvidence(future)).toBeNull()
  })

  it('bounds conflict statements and preserves unresolved-only handoff guidance', () => {
    const fixture = structuredClone(createHotelClimateFixture('missing_failed_conflict'))
    fixture.rows[2].statements.push(
      { ...fixture.rows[2].statements[0], id: 'third' },
      { ...fixture.rows[2].statements[1], id: 'fourth' },
    )
    const html = renderToStaticMarkup(<HotelClimateEvidenceLedger evidence={fixture} />)
    expect(html).toContain('Additional provider statements were withheld')
    expect(html).not.toContain('fourth')

    const guidance = renderToStaticMarkup(<HotelClimateHandoffCheck evidence={createHotelClimateFixture('selected_room_rate')} />)
    expect(guidance).toContain('Confirm heating for the room and rate you choose.')
    expect(guidance).not.toContain('Confirm cooling')
    expect(guidance).not.toContain('adjust the room temperature yourself')
  })
})

