import {
  createNotReturnedHotelFundsPolicy,
  getHotelFundsAnalyticsDimensions,
  normalizeHotelFundsPolicyEvidence,
} from '../fundsPolicy';
import type { HotelFundsPolicyEvidence } from '@/lib/types';

const completeHold: HotelFundsPolicyEvidence = {
  state: 'complete',
  sourceLabel: 'Provider policy',
  scope: 'selected_stay',
  fetchedAt: '2026-07-22T03:00:00.000Z',
  obligations: [{
    type: 'authorization_hold',
    amount: { kind: 'exact', money: { priceCents: 20000, currency: 'USD' } },
    basis: 'per_stay',
    applicationWording: 'At check-in',
    paymentMethodWording: 'Credit or debit card',
    returnOrRelease: { action: 'release', providerWording: 'after checkout' },
    sourceLabel: 'Provider policy',
    scope: 'selected_stay',
  }],
};

describe('hotel funds policy normalization', () => {
  it('is semantically stable across serialized cache-style replay', () => {
    const live = normalizeHotelFundsPolicyEvidence(completeHold, 'Fallback');
    const replayed = normalizeHotelFundsPolicyEvidence(JSON.parse(JSON.stringify(live)), 'Fallback');

    expect(replayed).toEqual(live);
  });

  it.each([
    ['complete', completeHold],
    ['partial', { ...completeHold, state: 'partial', obligations: [{ ...completeHold.obligations[0], amount: undefined }] }],
    ['explicit_none', { state: 'explicit_none', obligations: [], sourceLabel: 'Provider policy', scope: 'rate' }],
    ['not_returned', createNotReturnedHotelFundsPolicy('Provider policy')],
    ['conflicting', {
      state: 'conflicting', obligations: [], sourceLabel: 'Provider policy', scope: 'property',
      conflictingRecords: [
        completeHold.obligations[0],
        { ...completeHold.obligations[0], amount: { kind: 'exact', money: { priceCents: 30000, currency: 'USD' } } },
      ],
    }],
    ['variable', {
      ...completeHold,
      obligations: [{ ...completeHold.obligations[0], amount: { kind: 'variable', providerWording: 'Based on room type' } }],
    }],
  ] as const)('preserves valid %s evidence through normalization', (label, input) => {
    const normalized = normalizeHotelFundsPolicyEvidence(input, 'Fallback');
    expect(normalizeHotelFundsPolicyEvidence(JSON.parse(JSON.stringify(normalized)), 'Fallback')).toEqual(normalized);
    expect(normalized.state).toBe(label === 'variable' ? 'complete' : label);
  });

  it.each([
    { ...completeHold, obligations: [{ ...completeHold.obligations[0], amount: { kind: 'exact', money: { priceCents: 12.5, currency: 'USD' } } }] },
    { ...completeHold, obligations: [{ ...completeHold.obligations[0], amount: { kind: 'range', min: { priceCents: 20000, currency: 'USD' }, max: { priceCents: 10000, currency: 'USD' } } }] },
    { ...completeHold, obligations: [{ ...completeHold.obligations[0], amount: { kind: 'percentage', percent: 101, appliesTo: 'stay_price' } }] },
  ])('downgrades malformed amount evidence to partial without retaining the invalid value', input => {
    const normalized = normalizeHotelFundsPolicyEvidence(input, 'Provider policy');
    expect(normalized.state).toBe('partial');
    expect(normalized.missingFields).toContain('amount');
    expect(normalized.obligations[0]).not.toHaveProperty('amount');
  });

  it('bounds analytics to normalized enums and never includes policy wording or amounts', () => {
    expect(getHotelFundsAnalyticsDimensions({
      evidence: completeHold,
      provider: 'Provider.COM/raw path',
      surface: 'book_handoff',
    })).toEqual({
      policyState: 'complete',
      obligationTypes: 'authorization_hold',
      scope: 'selected_stay',
      provider: 'provider_com_raw_path',
      surface: 'book_handoff',
    });
  });
});
