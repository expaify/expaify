import {
  createNotReturnedHotelFundsPolicy,
  createUnsupportedHotelFundsPolicyBridge,
  getHotelFundsAnalyticsDimensions,
  normalizeHotelFundsPolicyBridge,
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

const completeDeposit: HotelFundsPolicyEvidence = {
  ...completeHold,
  obligations: [{
    type: 'refundable_deposit',
    amount: { kind: 'range', min: { priceCents: 10_000, currency: 'USD' }, max: { priceCents: 20_000, currency: 'USD' } },
    basis: 'per_room',
    applicationWording: 'Collected at check-in',
    paymentMethodWording: 'Credit or debit card',
    returnOrRelease: { action: 'refund', providerWording: 'after the room inspection' },
    sourceLabel: 'Provider policy',
    scope: 'selected_stay',
  }],
};

const mixedObligations: HotelFundsPolicyEvidence = {
  ...completeHold,
  obligations: [completeHold.obligations[0], completeDeposit.obligations[0]],
};

describe('hotel funds policy normalization', () => {
  it('normalizes the full capability, evidence, and load-state bridge across cache replay', () => {
    const bridge = normalizeHotelFundsPolicyBridge({
      provider: 'Capable provider',
      capability: { policy: true },
      evidence: completeHold,
      loadState: 'ready',
    });

    expect(normalizeHotelFundsPolicyBridge(JSON.parse(JSON.stringify(bridge)))).toEqual(bridge);
    expect(normalizeHotelFundsPolicyBridge({
      provider: 'Legacy provider',
      capability: { policy: 'yes' },
      evidence: completeHold,
      loadState: 'stale',
    })).toEqual({
      provider: 'Legacy provider',
      capability: { policy: false },
      evidence: createNotReturnedHotelFundsPolicy('Provider policy'),
      loadState: 'ready',
    });
    expect(createUnsupportedHotelFundsPolicyBridge('hotellook', 'Hotellook')).toEqual({
      provider: 'hotellook',
      capability: { policy: false },
      evidence: createNotReturnedHotelFundsPolicy('Hotellook'),
      loadState: 'ready',
    });
  });

  it.each(['complete', 'partial', 'conflicting', 'explicit_none'] as const)(
    'degrades policy:false plus %s evidence before consumers receive the bridge',
    state => {
      const evidence = state === 'explicit_none'
        ? { state, obligations: [], sourceLabel: 'Provider policy', scope: 'selected_stay' }
        : state === 'conflicting'
          ? {
            state,
            obligations: [],
            sourceLabel: 'Provider policy',
            scope: 'selected_stay',
            conflictingRecords: [
              completeHold.obligations[0],
              { ...completeHold.obligations[0], amount: { kind: 'exact', money: { priceCents: 30_000, currency: 'USD' } } },
            ],
          }
          : { ...completeHold, state };

      expect(normalizeHotelFundsPolicyBridge({
        provider: 'provider',
        capability: { policy: false },
        evidence,
        loadState: 'ready',
      }).evidence).toEqual(createNotReturnedHotelFundsPolicy('Provider policy'));
    },
  );

  it('uses pair-aware normalization for analytics dimensions', () => {
    expect(getHotelFundsAnalyticsDimensions({
      evidence: completeHold,
      capability: { policy: false },
      provider: 'provider',
      surface: 'hotel_card',
    })).toMatchObject({ policyState: 'not_returned', obligationTypes: 'unknown' });
  });

  it('is semantically stable across serialized cache-style replay', () => {
    const live = normalizeHotelFundsPolicyEvidence(completeHold, 'Fallback');
    const replayed = normalizeHotelFundsPolicyEvidence(JSON.parse(JSON.stringify(live)), 'Fallback');

    expect(replayed).toEqual(live);
  });

  it.each([
    ['complete hold', completeHold, 'complete'],
    ['complete deposit', completeDeposit, 'complete'],
    ['mixed obligations', mixedObligations, 'complete'],
    ['partial', { ...completeHold, state: 'partial', obligations: [{ ...completeHold.obligations[0], amount: undefined }] }, 'partial'],
    ['explicit none', { state: 'explicit_none', obligations: [], sourceLabel: 'Provider policy', scope: 'rate' }, 'explicit_none'],
    ['not returned', createNotReturnedHotelFundsPolicy('Provider policy'), 'not_returned'],
    ['conflicting', {
      state: 'conflicting', obligations: [], sourceLabel: 'Provider policy', scope: 'property',
      conflictingRecords: [
        completeHold.obligations[0],
        { ...completeHold.obligations[0], amount: { kind: 'exact', money: { priceCents: 30000, currency: 'USD' } } },
      ],
    }, 'conflicting'],
    ['variable', {
      ...completeHold,
      obligations: [{ ...completeHold.obligations[0], amount: { kind: 'variable', providerWording: 'Based on room type' } }],
    }, 'complete'],
  ] as const)('preserves valid %s evidence through normalization and cache replay', (_label, input, expectedState) => {
    const normalized = normalizeHotelFundsPolicyEvidence(input, 'Fallback');
    expect(normalizeHotelFundsPolicyEvidence(JSON.parse(JSON.stringify(normalized)), 'Fallback')).toEqual(normalized);
    expect(normalized.state).toBe(expectedState);
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

  it('derives bounded obligation types from conflicting records', () => {
    expect(getHotelFundsAnalyticsDimensions({
      evidence: {
        state: 'conflicting',
        obligations: [],
        sourceLabel: 'Provider policy',
        scope: 'property',
        conflictingRecords: [
          completeHold.obligations[0],
          {
            ...completeHold.obligations[0],
            type: 'refundable_deposit',
            returnOrRelease: { action: 'refund', providerWording: 'after inspection' },
          },
        ],
      },
      provider: 'provider',
      surface: 'hotel_card',
    })).toMatchObject({
      policyState: 'conflicting',
      obligationTypes: 'authorization_hold,refundable_deposit',
    });
  });

  it('does not accept duplicate records as conflicting evidence', () => {
    const normalized = normalizeHotelFundsPolicyEvidence({
      state: 'conflicting',
      obligations: [],
      sourceLabel: 'Provider policy',
      scope: 'selected_stay',
      conflictingRecords: [completeHold.obligations[0], completeHold.obligations[0]],
    }, 'Fallback');

    expect(normalized.state).not.toBe('conflicting');
    expect(normalized.conflictingRecords).toBeUndefined();
  });

  it.each([
    ['source', { sourceLabel: 'Source B' }],
    ['scope', { scope: 'rate' }],
  ])('does not treat a %s-only difference as incompatible policy evidence', (_field, difference) => {
    const normalized = normalizeHotelFundsPolicyEvidence({
      state: 'conflicting',
      obligations: [],
      sourceLabel: 'Provider policy',
      scope: 'selected_stay',
      conflictingRecords: [
        completeHold.obligations[0],
        { ...completeHold.obligations[0], ...difference },
      ],
    }, 'Fallback');

    expect(normalized.state).toBe('complete');
    expect(normalized.conflictingRecords).toBeUndefined();
    expect(normalized.obligations).toHaveLength(2);
    expect(normalized.obligations[1]).toMatchObject(difference);
  });

  it('preserves compatible partial records without manufacturing a conflict', () => {
    const { amount: _amount, ...withoutAmount } = completeHold.obligations[0];
    const { applicationWording: _timing, ...withoutTiming } = completeHold.obligations[0];
    const normalized = normalizeHotelFundsPolicyEvidence({
      state: 'conflicting',
      obligations: [],
      sourceLabel: 'Provider policy',
      scope: 'selected_stay',
      conflictingRecords: [
        { ...withoutAmount, sourceLabel: 'Source A', scope: 'rate' },
        { ...withoutTiming, sourceLabel: 'Source B', scope: 'selected_stay' },
      ],
    }, 'Fallback');

    expect(normalized).toMatchObject({
      state: 'partial',
      missingFields: ['amount', 'application_timing'],
    });
    expect(normalized.conflictingRecords).toBeUndefined();
    expect(normalized.obligations).toHaveLength(2);
    expect(normalized.obligations.map(record => record.sourceLabel)).toEqual(['Source A', 'Source B']);
    expect(normalized.obligations.map(record => record.scope)).toEqual(['rate', 'selected_stay']);
  });

  it.each([
    ['amount', {
      amount: { kind: 'exact', money: { priceCents: 30000, currency: 'USD' } },
    }],
    ['mechanism', {
      type: 'refundable_deposit',
      returnOrRelease: { action: 'refund', providerWording: 'after inspection' },
    }],
    ['application timing', {
      applicationWording: 'Three days before check-in',
    }],
  ] as const)('accepts genuinely incompatible %s facts as conflicting evidence', (_fact, difference) => {
    const normalized = normalizeHotelFundsPolicyEvidence({
      state: 'conflicting',
      obligations: [],
      sourceLabel: 'Provider policy',
      scope: 'selected_stay',
      conflictingRecords: [
        completeHold.obligations[0],
        { ...completeHold.obligations[0], ...difference, sourceLabel: 'Source B' },
      ],
    }, 'Fallback');

    expect(normalized.state).toBe('conflicting');
    expect(normalized.conflictingRecords).toHaveLength(2);
  });

  it('rejects malformed explicit-none obligations and upgrades fully documented partial input', () => {
    expect(normalizeHotelFundsPolicyEvidence({
      state: 'explicit_none',
      obligations: [null],
      sourceLabel: 'Provider policy',
      scope: 'rate',
    }, 'Fallback')).toEqual(createNotReturnedHotelFundsPolicy('Fallback'));

    const completeRecordTaggedPartial = normalizeHotelFundsPolicyEvidence({
      ...completeHold,
      state: 'partial',
    }, 'Fallback');
    expect(completeRecordTaggedPartial.state).toBe('complete');
    expect(completeRecordTaggedPartial.missingFields).toBeUndefined();
  });
});
