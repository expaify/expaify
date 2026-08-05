import {
  CONNECTING_ROOMS_FACT_ID,
  getConnectingRoomsConfirmedCopy,
  getConnectingRoomsMetadata,
  resolveConnectingRoomsEvidence,
} from '../connectingRoomsEvidence'
import type { HotelAmenityEvidence } from '../../types'

function fact(overrides: Partial<HotelAmenityEvidence> = {}): HotelAmenityEvidence {
  return {
    id: CONNECTING_ROOMS_FACT_ID,
    label: 'Connecting rooms',
    status: 'confirmed',
    scope: 'selected_stay',
    sourceLabel: 'Hotellook',
    certainty: 'guaranteed',
    fetchedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolveConnectingRoomsEvidence', () => {
  it('resolves to not_returned when the array is undefined', () => {
    expect(resolveConnectingRoomsEvidence(undefined)).toEqual({ status: 'not_returned', sourceLabel: 'Hotel provider' })
  })

  it('resolves to not_returned when the fact is absent from the array', () => {
    expect(resolveConnectingRoomsEvidence([fact({ id: 'elevator' })])).toEqual({ status: 'not_returned', sourceLabel: 'Hotel provider' })
  })

  it('resolves a guaranteed selected_stay fact to confirmed/guaranteed', () => {
    const result = resolveConnectingRoomsEvidence([fact({ scope: 'selected_stay', certainty: 'guaranteed' })])
    expect(result).toMatchObject({ status: 'confirmed', certainty: 'guaranteed', sourceLabel: 'Hotellook' })
  })

  it('resolves a requestable room-scope fact to confirmed/requestable', () => {
    const result = resolveConnectingRoomsEvidence([fact({ scope: 'room', certainty: 'requestable' })])
    expect(result).toMatchObject({ status: 'confirmed', certainty: 'requestable' })
  })

  it('does not treat a property-scope guarantee as valid (this fact is room-scoped only)', () => {
    const result = resolveConnectingRoomsEvidence([fact({ scope: 'property', certainty: 'guaranteed' })])
    expect(result.status).toBe('unknown')
  })

  it('downgrades a confirmed fact with no source label to unknown', () => {
    const result = resolveConnectingRoomsEvidence([fact({ sourceLabel: '' })])
    expect(result.status).toBe('unknown')
  })

  it('keeps a well-formed unavailable fact as unavailable', () => {
    const result = resolveConnectingRoomsEvidence([fact({ status: 'unavailable', scope: 'room', certainty: undefined })])
    expect(result.status).toBe('unavailable')
  })

  it('downgrades an unavailable fact with invalid scope to unknown', () => {
    const result = resolveConnectingRoomsEvidence([fact({ status: 'unavailable', scope: 'property', certainty: undefined })])
    expect(result.status).toBe('unknown')
  })

  it('downgrades an unavailable fact with no source label to unknown', () => {
    const result = resolveConnectingRoomsEvidence([fact({ status: 'unavailable', scope: 'room', sourceLabel: '', certainty: undefined })])
    expect(result.status).toBe('unknown')
  })

  it('passes through a well-formed not_returned fact unchanged', () => {
    const result = resolveConnectingRoomsEvidence([fact({ status: 'not_returned', certainty: undefined })])
    expect(result.status).toBe('not_returned')
  })

  // Regression test for the precedence bug found during review: comparing RAW
  // statuses (confirmed=3 loses to not_returned=2) before normalizing would
  // incorrectly prefer showing "not_returned" here, even though HotelCard's
  // own normalizeAccessEvidence would downgrade the invalid "confirmed" item
  // to "unknown" — a fact that should win over silence, not lose to it.
  it('picks the most conservative NORMALIZED status among duplicates, not the raw one', () => {
    const invalidConfirmed = fact({ status: 'confirmed', scope: 'property', certainty: 'guaranteed' }) // normalizes to 'unknown'
    const plainNotReturned = fact({ status: 'not_returned', certainty: undefined })
    const result = resolveConnectingRoomsEvidence([invalidConfirmed, plainNotReturned])
    expect(result.status).toBe('unknown')
  })

  it('prefers unavailable over confirmed when both are present and valid', () => {
    const confirmed = fact({ status: 'confirmed', scope: 'selected_stay', certainty: 'guaranteed' })
    const unavailable = fact({ status: 'unavailable', scope: 'room', certainty: undefined, sourceLabel: 'Booking.com' })
    const result = resolveConnectingRoomsEvidence([confirmed, unavailable])
    expect(result.status).toBe('unavailable')
  })
})

describe('getConnectingRoomsConfirmedCopy', () => {
  it('uses the non-guarantee clause for requestable evidence', () => {
    const copy = getConnectingRoomsConfirmedCopy({ status: 'confirmed', certainty: 'requestable', sourceLabel: 'Hotellook' })
    expect(copy.visible).toContain('You can request connecting rooms.')
    expect(copy.visible).toContain('not guaranteed until the provider confirms')
  })

  it('states a guarantee for guaranteed evidence, naming the provider in the aria label', () => {
    const copy = getConnectingRoomsConfirmedCopy({ status: 'confirmed', certainty: 'guaranteed', sourceLabel: 'Hotellook' })
    expect(copy.visible).toBe('The provider guarantees connecting rooms for this selected stay.')
    expect(copy.aria).toContain('Hotellook')
  })
})

describe('getConnectingRoomsMetadata', () => {
  it('includes a source line for confirmed evidence', () => {
    const metadata = getConnectingRoomsMetadata({ status: 'confirmed', certainty: 'guaranteed', sourceLabel: 'Hotellook', fetchedAt: '2026-08-01T00:00:00.000Z' })
    expect(metadata.join(' ')).toContain('Source: Hotellook')
  })

  it('produces no metadata for not_returned', () => {
    expect(getConnectingRoomsMetadata({ status: 'not_returned', sourceLabel: 'Hotel provider' })).toEqual([])
  })
})
