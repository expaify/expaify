import {
  createLuggageStorageFixture,
  evidenceForSurface,
  LUGGAGE_STORAGE_FIXTURE_IDS,
} from '../hotelLuggageStorageFixtures'

describe('hotel luggage-storage research fixtures', () => {
  it('defines every required validation state', () => {
    expect(LUGGAGE_STORAGE_FIXTURE_IDS).toHaveLength(12)
    expect(LUGGAGE_STORAGE_FIXTURE_IDS).toEqual(expect.arrayContaining([
      'complete-included', 'partial-before', 'partial-after', 'service-unavailable',
      'conflicting-timing', 'not-returned', 'loading', 'error', 'revision-mismatch',
    ]))
  })

  it('keeps timing periods and unknown charge independent', () => {
    const fixture = createLuggageStorageFixture('partial-before')
    expect(fixture.beforeCheckin).toBe('reported_available')
    expect(fixture.afterCheckout).toBe('not_specified')
    expect(fixture.charge.state).toBe('unknown')
  })

  it('uses integer minor units for paid research evidence', () => {
    const fixture = createLuggageStorageFixture('complete-paid')
    expect(fixture.charge).toEqual({ state: 'paid', amount: { priceCents: 1200, currency: 'USD' }, basis: 'per_bag' })
  })

  it('preserves the same revision except for the deliberate mismatch fixture', () => {
    for (const id of LUGGAGE_STORAGE_FIXTURE_IDS) {
      const detail = evidenceForSurface(id, 'detail')
      const handoff = evidenceForSurface(id, 'handoff')
      if (id === 'revision-mismatch') {
        expect(handoff.state).toBe('error')
        expect(handoff.evidenceRevision).not.toBe(detail.evidenceRevision)
      } else {
        expect(handoff.evidenceRevision).toBe(detail.evidenceRevision)
      }
    }
  })
})
