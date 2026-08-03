import { createHousekeepingFixture, HOUSEKEEPING_FIXTURE_IDS, resolveHousekeepingPresentation } from '../hotelHousekeepingFixtures'

describe('hotel housekeeping-frequency research fixtures', () => {
  it('defines all nine evidence scenarios with isolated revisions', () => {
    expect(HOUSEKEEPING_FIXTURE_IDS).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'])
    expect(new Set(HOUSEKEEPING_FIXTURE_IDS.map(id => createHousekeepingFixture(id).evidenceRevision)).size).toBe(9)
  })

  it('keeps cleaning, towel, and linen meanings independent', () => {
    const f3 = resolveHousekeepingPresentation(createHousekeepingFixture('F3'))
    expect(f3.primary).toBe('Room cleaning: every 2 nights.')
    expect(f3.towels).toBe('Available when requested.')
    expect(f3.bedLinen).toBe('Changed every 4 nights.')
    expect(f3.scope).toBe('selected_stay')

    const f4 = resolveHousekeepingPresentation(createHousekeepingFixture('F4'))
    expect(f4.primary).toBe('No stayover room cleaning is reported for this policy.')
    expect(f4.towels).toBe('Available when requested.')
    expect(f4.bedLinen).toBe('Schedule not provided.')
  })

  it('distinguishes missing, ambiguous, conflicting, and retrieval failure', () => {
    expect(createHousekeepingFixture('F5').primary).toBe('Schedule unclear')
    expect(createHousekeepingFixture('F6').primary).toBe('Housekeeping information conflicts')
    expect(createHousekeepingFixture('F7').primary).toBe('Schedule not returned')
    expect(createHousekeepingFixture('F8').primary).toBe('Could not check schedule')
  })

  it('fails closed when claim provenance or property identity is invalid', () => {
    const missingSource = createHousekeepingFixture('F1')
    missingSource.statements = [{ ...missingSource.statements[0], sourceLabel: '' }]
    const wrongProperty = createHousekeepingFixture('F2')
    wrongProperty.propertyId = 'different-property'

    for (const fixture of [missingSource, wrongProperty]) {
      const result = resolveHousekeepingPresentation(fixture)
      expect(result.primary).toBe('Schedule unclear')
      expect(result.action).toBeUndefined()
      expect(result.towels).toBe('Schedule not provided.')
      expect(result.statements).toEqual([])
    }
  })
})
