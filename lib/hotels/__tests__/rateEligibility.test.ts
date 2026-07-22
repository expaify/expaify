import {
  getRateEligibilityAnalytics,
  normalizeHotelRateEligibility,
  presentHotelRateEligibility,
  unknownHotelRateEligibility,
} from '../rateEligibility';

const expected = { offerId: 'rate_123', supplier: 'future_supplier', supplierLabel: 'Future Supplier' };
const fetchedAt = '2026-07-22T03:00:00.000Z';
const provenance = { supplier: expected.supplier, fetchedAt };

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    offerId: expected.offerId,
    supplier: expected.supplier,
    supplierLabel: expected.supplierLabel,
    fetchedAt,
    loadStatus: 'ready',
    membership: { state: 'not_provided' },
    residency: { state: 'not_provided' },
    age: { state: 'not_provided' },
    refundability: { state: 'not_provided' },
    ...overrides,
  };
}

describe('hotel rate eligibility normalization', () => {
  it('keeps independently proven families and derives fixed-order conditions', () => {
    const normalized = normalizeHotelRateEligibility(evidence({
      membership: { state: 'restricted', membershipLabel: 'Rewards Gold', provenance },
      residency: { state: 'restricted', placeLabel: 'Spain', provenance },
      age: { state: 'restricted', minAge: 21, maxAge: 65, provenance },
      refundability: { state: 'restricted', provenance },
    }), expected);

    expect(presentHotelRateEligibility(normalized)).toEqual({
      state: 'restricted',
      conditions: [
        { family: 'residency', label: 'Residents of Spain only' },
        { family: 'age', label: 'Ages 21–65 only' },
        { family: 'membership', label: 'Rewards Gold members only' },
        { family: 'refundability', label: 'Non-refundable' },
      ],
      coverageIncomplete: false,
      fetchedAt,
    });
    expect(getRateEligibilityAnalytics(normalized)).toEqual({
      overallState: 'restricted',
      restrictionTypes: 'membership,residency,age,refundability',
      knownRestrictionCount: 4,
      coverageCount: 4,
      eligibilityLoadStatus: 'ready',
    });
  });

  it('permits all-clear only when every family has matching provenance', () => {
    const normalized = normalizeHotelRateEligibility(evidence({
      membership: { state: 'clear', provenance },
      residency: { state: 'clear', provenance },
      age: { state: 'clear', provenance },
      refundability: { state: 'clear', provenance },
    }), expected);

    expect(presentHotelRateEligibility(normalized)).toEqual({ state: 'clear', fetchedAt });

    const mismatched = normalizeHotelRateEligibility(evidence({
      membership: { state: 'clear', provenance },
      residency: { state: 'clear', provenance },
      age: { state: 'clear', provenance },
      refundability: {
        state: 'clear',
        provenance: { supplier: 'another_supplier', fetchedAt },
      },
    }), expected);
    expect(presentHotelRateEligibility(mismatched).state).toBe('not_provided');
    expect(mismatched.refundability).toEqual({ state: 'not_provided' });
  });

  it.each([
    [{ state: 'restricted', provenance }, 'missing age bounds'],
    [{ state: 'restricted', minAge: -1, provenance }, 'negative age'],
    [{ state: 'restricted', minAge: 66, maxAge: 65, provenance }, 'reversed bounds'],
    [{ state: 'restricted', minAge: 21.5, provenance }, 'fractional age'],
  ] as Array<[Record<string, unknown>, string]>)('degrades malformed age evidence to unknown: %s (%s)', (age) => {
    const normalized = normalizeHotelRateEligibility(evidence({ age }), expected);
    expect(normalized.age).toEqual({ state: 'not_provided' });
    expect(presentHotelRateEligibility(normalized).state).toBe('not_provided');
  });

  it('degrades mismatched offer, supplier, timestamp, and unsafe labels without throwing', () => {
    expect(normalizeHotelRateEligibility(evidence({ offerId: 'other_rate' }), expected)).toEqual(
      unknownHotelRateEligibility(expected.offerId, expected.supplier, expected.supplierLabel),
    );
    expect(normalizeHotelRateEligibility(evidence({ supplier: 'other_supplier' }), expected)).toEqual(
      unknownHotelRateEligibility(expected.offerId, expected.supplier, expected.supplierLabel),
    );
    expect(normalizeHotelRateEligibility(evidence({ fetchedAt: 'not-a-date' }), expected)).toEqual(
      unknownHotelRateEligibility(expected.offerId, expected.supplier, expected.supplierLabel),
    );

    const normalized = normalizeHotelRateEligibility(evidence({
      supplierLabel: '<script>',
      residency: { state: 'restricted', placeLabel: '', provenance },
    }), expected);
    expect(normalized.supplierLabel).toBe('Hotel provider');
    expect(normalized.residency).toEqual({ state: 'not_provided' });
  });

  it('keeps loading and failure non-blocking while reporting semantic state as not provided', () => {
    for (const loadStatus of ['loading', 'error'] as const) {
      const normalized = normalizeHotelRateEligibility(evidence({ loadStatus }), expected);
      expect(presentHotelRateEligibility(normalized).state).toBe(loadStatus);
      expect(getRateEligibilityAnalytics(normalized)).toMatchObject({
        overallState: 'not_provided',
        eligibilityLoadStatus: loadStatus,
      });
    }
  });
});
