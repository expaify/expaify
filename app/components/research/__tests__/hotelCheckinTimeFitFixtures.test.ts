import {
  createHotelTimeFitFixture,
  DISABLED_STANDARD_END_FIXTURE,
  HOTEL_TIME_FIT_FIXTURE_IDS,
  resolveHotelTimeFit,
  type TimeFitFixture,
  type TimeFitFixtureId,
} from '../hotelCheckinTimeFitFixtures'

const EXPECTED: Record<TimeFitFixtureId, [string, string]> = {
  early_arrival_request: ['outside_standard', 'arrival_before_start'],
  early_arrival_no_request: ['outside_standard', 'arrival_before_start'],
  late_obligation_only: ['cannot_assess', 'missing_standard_end_contract'],
  post_checkout_request: ['outside_standard', 'departure_after_deadline'],
  early_departure_control: ['fits_standard', 'departure_at_or_before_deadline'],
  missing_arrival_intent: ['cannot_assess', 'missing_scenario_time'],
  missing_departure_boundary: ['cannot_assess', 'missing_relevant_boundary'],
  conflicting_boundary: ['cannot_assess', 'conflicting_evidence'],
  arrival_at_start: ['fits_standard', 'arrival_at_or_after_start'],
  departure_at_deadline: ['fits_standard', 'departure_at_or_before_deadline'],
  ambiguous_local_day: ['cannot_assess', 'ambiguous_local_day'],
  malformed_time: ['cannot_assess', 'malformed_time'],
  stale_boundary: ['cannot_assess', 'missing_relevant_boundary'],
  missing_source: ['cannot_assess', 'missing_relevant_boundary'],
  evidence_loading: ['cannot_assess', 'evidence_loading'],
  evidence_error: ['cannot_assess', 'evidence_error'],
}

describe('hotel check-in time-fit research resolver', () => {
  it.each(HOTEL_TIME_FIT_FIXTURE_IDS)('resolves %s in the exhaustive safe order', id => {
    const presentation = resolveHotelTimeFit(createHotelTimeFitFixture(id))
    expect([presentation.outcome, presentation.reason]).toEqual(EXPECTED[id])
  })

  it('keeps requestability outside the fit calculation', () => {
    const requestEvidenced = resolveHotelTimeFit(createHotelTimeFitFixture('early_arrival_request'))
    const requestMissing = resolveHotelTimeFit(createHotelTimeFitFixture('early_arrival_no_request'))

    expect(requestEvidenced).toEqual(requestMissing)
    expect(requestEvidenced.outcomeCopy).toBe('Outside standard times')
  })

  it('never treats a late-arrival obligation cutoff as a fit boundary', () => {
    const fixture = createHotelTimeFitFixture('late_obligation_only')
    expect(resolveHotelTimeFit(fixture)).toEqual(expect.objectContaining({
      outcome: 'cannot_assess',
      reason: 'missing_standard_end_contract',
      comparisonCopy: 'The property publishes a late-arrival instruction, but the standard check-in end is not represented separately.',
    }))

    const beforeCutoff: TimeFitFixture = {
      ...fixture,
      scenario: { ...fixture.scenario, localTime: '16:00' },
    }
    expect(resolveHotelTimeFit(beforeCutoff).outcome).toBe('cannot_assess')
  })

  it('treats represented start and departure boundaries as inclusive', () => {
    expect(resolveHotelTimeFit(createHotelTimeFitFixture('arrival_at_start')).outcome).toBe('fits_standard')
    expect(resolveHotelTimeFit(createHotelTimeFitFixture('departure_at_deadline')).outcome).toBe('fits_standard')
  })

  it('rejects malformed scenario time, ambiguous DST association, and irrelevant valid facts', () => {
    const base = createHotelTimeFitFixture('arrival_at_start')
    expect(resolveHotelTimeFit({ ...base, scenario: { ...base.scenario, localTime: '25:00' } }).reason).toBe('malformed_time')
    expect(resolveHotelTimeFit({ ...base, scenario: { ...base.scenario, dstAssociation: 'ambiguous' } }).reason).toBe('ambiguous_local_day')

    const missingArrival = createHotelTimeFitFixture('missing_departure_boundary')
    const arrivalScenario: TimeFitFixture = {
      ...missingArrival,
      scenario: { kind: 'arrival', localTime: '12:00', localDate: '2026-08-14', stayDate: '2026-08-14', dayAssociation: 'unambiguous' },
    }
    expect(resolveHotelTimeFit(arrivalScenario).reason).toBe('missing_relevant_boundary')
  })

  it('keeps the standard-end fixture disabled and absent from selectable fixtures', () => {
    expect(DISABLED_STANDARD_END_FIXTURE.enabled).toBe(false)
    expect(DISABLED_STANDARD_END_FIXTURE.reason).toBe('Blocked: published standard check-in end and local-day association are not represented by the upstream logistics contract.')
    expect(HOTEL_TIME_FIT_FIXTURE_IDS).not.toContain(DISABLED_STANDARD_END_FIXTURE.id)
    for (const id of HOTEL_TIME_FIT_FIXTURE_IDS) {
      expect(createHotelTimeFitFixture(id).evidence).not.toHaveProperty('standardEnd')
      expect(createHotelTimeFitFixture(id).evidence).not.toHaveProperty('arrivalUntil')
    }
  })

  it('keeps one immutable revision across result, detail, and handoff consumers', () => {
    for (const id of HOTEL_TIME_FIT_FIXTURE_IDS) {
      const fixture = createHotelTimeFitFixture(id)
      expect(createHotelTimeFitFixture(id).evidence.evidenceRevision).toBe(fixture.evidence.evidenceRevision)
      expect(resolveHotelTimeFit(createHotelTimeFitFixture(id))).toEqual(resolveHotelTimeFit(fixture))
    }
  })
})
