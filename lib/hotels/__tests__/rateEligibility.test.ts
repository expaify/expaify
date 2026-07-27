import { deriveRateEligibilityPresentation, HOTEL_RATE_ELIGIBILITY_UNSUPPORTED } from '../rateEligibility';
import type { HotelRateEligibilityCapability, HotelRateEligibilityEvidence } from '../../types';

const CLEAR_CAPABILITY: HotelRateEligibilityCapability = {
  membership: true,
  residency: true,
  age: true,
  refundability: true,
};

function evidence(overrides: Partial<HotelRateEligibilityEvidence> = {}): HotelRateEligibilityEvidence {
  return {
    offerId: 'offer-1',
    supplier: 'demo',
    membership: { state: 'not_provided' },
    residency: { state: 'not_provided' },
    age: { state: 'not_provided' },
    refundability: { state: 'not_provided' },
    ...overrides,
  };
}

describe('deriveRateEligibilityPresentation', () => {
  it('returns not_provided when no evidence is attached (current Hotellook)', () => {
    expect(deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'hotellook',
      capability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED,
    })).toEqual({ state: 'not_provided' });
  });

  it('degrades to not_provided when offerId does not match the displayed offer', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-2',
      supplier: 'demo',
      evidence: evidence(),
    });
    expect(result).toEqual({ state: 'not_provided' });
  });

  it('degrades to not_provided when supplier does not match the displayed offer', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'other',
      evidence: evidence(),
    });
    expect(result).toEqual({ state: 'not_provided' });
  });

  it('member-only with other families unknown', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ membership: { state: 'restricted', membershipLabel: 'Genius' } }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'membership', label: 'Genius members only' }],
      coverageIncomplete: true,
    });
  });

  it('falls back to "Members only" when no safe label is supplied', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ membership: { state: 'restricted' } }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'membership', label: 'Members only' }],
      coverageIncomplete: true,
    });
  });

  it('residence-only preserves the supplier place label', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ residency: { state: 'restricted', residencyPlace: 'Germany' } }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'residency', label: 'Residents of Germany only' }],
      coverageIncomplete: true,
    });
  });

  it('minimum age only', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ age: { state: 'restricted', minAge: 21 } }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'age', label: 'Ages 21+ only' }],
      coverageIncomplete: true,
    });
  });

  it('non-refundable only', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ refundability: { state: 'restricted' } }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'refundability', label: 'Non-refundable' }],
      coverageIncomplete: true,
    });
  });

  it('all four restricted render in hard-eligibility-first order with no unknown-details line', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({
        residency: { state: 'restricted', residencyPlace: 'Germany' },
        age: { state: 'restricted', minAge: 18, maxAge: 65 },
        membership: { state: 'restricted', membershipLabel: 'Genius' },
        refundability: { state: 'restricted' },
      }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [
        { family: 'residency', label: 'Residents of Germany only' },
        { family: 'age', label: 'Ages 18–65 only' },
        { family: 'membership', label: 'Genius members only' },
        { family: 'refundability', label: 'Non-refundable' },
      ],
    });
  });

  it('all four explicitly clear only when capability declares clear support for every family', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({
        membership: { state: 'clear' },
        residency: { state: 'clear' },
        age: { state: 'clear' },
        refundability: { state: 'clear' },
      }),
      capability: CLEAR_CAPABILITY,
    });
    expect(result).toEqual({ state: 'clear' });
  });

  it('never reports all-clear without a capability declaration, even if every family says clear', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({
        membership: { state: 'clear' },
        residency: { state: 'clear' },
        age: { state: 'clear' },
        refundability: { state: 'clear' },
      }),
    });
    expect(result).toEqual({ state: 'not_provided' });
  });

  it('refundability clear but the other three not provided remains not_provided, never all-clear', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ refundability: { state: 'clear' } }),
      capability: CLEAR_CAPABILITY,
    });
    expect(result).toEqual({ state: 'not_provided' });
  });

  it('malformed age bounds (min > max) degrade that family to not_provided', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ age: { state: 'restricted', minAge: 40, maxAge: 20 } }),
    });
    expect(result).toEqual({ state: 'not_provided' });
  });

  it('a negative age bound degrades that family to not_provided', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ age: { state: 'restricted', minAge: -1 } }),
    });
    expect(result).toEqual({ state: 'not_provided' });
  });

  it('a restricted residency without a place label degrades to not_provided', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ residency: { state: 'restricted' } }),
    });
    expect(result).toEqual({ state: 'not_provided' });
  });

  it('known restriction plus unknown families keeps the restriction and flags incomplete coverage', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ refundability: { state: 'restricted' }, membership: { state: 'clear' } }),
      capability: CLEAR_CAPABILITY,
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'refundability', label: 'Non-refundable' }],
      coverageIncomplete: true,
    });
  });

  it('converts an all-caps membership label to readable title case without changing words', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ membership: { state: 'restricted', membershipLabel: 'GENIUS LOYALTY' } }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'membership', label: 'Genius Loyalty members only' }],
      coverageIncomplete: true,
    });
  });

  it('preserves a valid fetchedAt through derivation', () => {
    const result = deriveRateEligibilityPresentation({
      offerId: 'offer-1',
      supplier: 'demo',
      evidence: evidence({ refundability: { state: 'restricted' }, fetchedAt: '2026-07-22T10:00:00.000Z' }),
    });
    expect(result).toEqual({
      state: 'restricted',
      conditions: [{ family: 'refundability', label: 'Non-refundable' }],
      coverageIncomplete: true,
      fetchedAt: '2026-07-22T10:00:00.000Z',
    });
  });
});
