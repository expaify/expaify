import {
  createContinuityFixture,
  parseContinuityFixture,
  RESEARCH_MAX_AGE_DAYS,
} from '../hotelContinuityFixtures'

const NOW = Date.parse('2026-07-22T12:00:00.000Z')
const STAY_START = '2026-07-23T15:00:00.000Z'
const STAY_END = '2026-07-25T11:00:00.000Z'

describe('hotel continuity research fixtures', () => {
  it('defaults unknown researcher input to the absent control', () => {
    expect(parseContinuityFixture('not-a-fixture')).toBe('control')
    expect(createContinuityFixture('control', STAY_START, STAY_END, NOW)).toBeNull()
  })

  it.each(['resolved', 'no-overlap'] as const)('renders no region for %s context', (fixtureId) => {
    expect(createContinuityFixture(fixtureId, STAY_START, STAY_END, NOW)).toBeNull()
  })

  it('keeps context and property loading as separate gated states', () => {
    const contextLoading = createContinuityFixture('context-loading', STAY_START, STAY_END, NOW)
    const propertyLoading = createContinuityFixture('property-loading', STAY_START, STAY_END, NOW)

    expect(contextLoading?.context.state).toBe('loading')
    expect(contextLoading?.facts).toHaveLength(0)
    expect(propertyLoading?.context.state).toBe('eligible')
    expect(propertyLoading?.propertyState).toBe('loading')
  })

  it('provides decision-grade fields for a confirmed backup-power fact', () => {
    const disclosure = createContinuityFixture('confirmed', STAY_START, STAY_END, NOW)
    const fact = disclosure?.facts[0]

    expect(disclosure?.propertyState).toBe('confirmed')
    expect(fact?.scope).toBe('property')
    expect(fact?.supportedServices.length).toBeGreaterThan(0)
    expect(fact?.unsupportedOrUndocumentedServices.length).toBeGreaterThan(0)
    expect(fact?.runtimeOrCapacity).toBeTruthy()
    expect(fact?.verificationMethod).toBeTruthy()
    expect(fact?.sourceUrl).toMatch(/^https:\/\/example\.com\//)
  })

  it('marks backup-power evidence beyond the preserved 180-day window as stale', () => {
    const disclosure = createContinuityFixture('stale', STAY_START, STAY_END, NOW)
    const verifiedAt = Date.parse(disclosure?.facts[0]?.verifiedAt ?? '')
    const ageDays = (NOW - verifiedAt) / 86400000

    expect(RESEARCH_MAX_AGE_DAYS.backup_power).toBe(180)
    expect(ageDays).toBeGreaterThan(RESEARCH_MAX_AGE_DAYS.backup_power)
    expect(disclosure?.propertyState).toBe('stale')
  })

  it('retains both sides of a conflict without selecting a favorable source', () => {
    const disclosure = createContinuityFixture('conflict', STAY_START, STAY_END, NOW)

    expect(disclosure?.propertyState).toBe('conflict')
    expect(disclosure?.facts).toHaveLength(2)
    expect(disclosure?.facts[0].contradictionIds).toContain(disclosure?.facts[1].id)
    expect(disclosure?.facts[1].contradictionIds).toContain(disclosure?.facts[0].id)
  })
})
