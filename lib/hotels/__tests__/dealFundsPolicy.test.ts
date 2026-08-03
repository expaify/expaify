import { normalizePersistedDealFundsPolicyBridge } from '../dealFundsPolicy';

const explicitNoneBridge = {
  provider: 'capable-provider',
  capability: { policy: true },
  evidence: {
    state: 'explicit_none',
    obligations: [],
    sourceLabel: 'Provider policy',
    scope: 'selected_stay',
  },
  loadState: 'ready',
};

describe('persisted deal funds-policy bridge', () => {
  it('does not manufacture provider capability for absent or malformed legacy rows', () => {
    expect(normalizePersistedDealFundsPolicyBridge(undefined)).toBeUndefined();
    expect(normalizePersistedDealFundsPolicyBridge(null)).toBeUndefined();
    expect(normalizePersistedDealFundsPolicyBridge('legacy')).toBeUndefined();
  });

  it('preserves a provider-normalized capable bridge through JSON persistence', () => {
    expect(normalizePersistedDealFundsPolicyBridge(
      JSON.parse(JSON.stringify(explicitNoneBridge)),
    )).toEqual(explicitNoneBridge);
  });

  it('degrades a contradictory persisted pair before returning it to a consumer', () => {
    expect(normalizePersistedDealFundsPolicyBridge({
      ...explicitNoneBridge,
      capability: { policy: false },
    })).toEqual({
      provider: 'capable-provider',
      capability: { policy: false },
      evidence: {
        state: 'not_returned',
        obligations: [],
        sourceLabel: 'Provider policy',
        scope: 'not_returned',
      },
      loadState: 'ready',
    });
  });
});
