import type { ApiDealFundsPolicy } from '../HotelFundsPolicyComparison'
import type { HotelFundsPolicyEvidence } from '@/lib/types'

export type FundsPolicyFixtureOffer = {
  locked: boolean
  isMock: boolean
  fundsPolicy?: ApiDealFundsPolicy
}

const complete: HotelFundsPolicyEvidence = {
  state: 'complete',
  sourceLabel: 'Fixture provider',
  scope: 'selected_stay',
  obligations: [{
    type: 'authorization_hold',
    amount: { kind: 'exact', money: { priceCents: 20_000, currency: 'USD' } },
    basis: 'per_stay',
    applicationWording: 'At check-in',
    paymentMethodWording: 'Credit card',
    returnOrRelease: { action: 'release', providerWording: 'after checkout' },
    sourceLabel: 'Fixture provider',
    scope: 'selected_stay',
  }],
}

const partial: HotelFundsPolicyEvidence = {
  state: 'partial',
  sourceLabel: 'Fixture provider',
  scope: 'rate',
  obligations: [{
    type: 'refundable_deposit',
    applicationWording: 'At arrival',
    sourceLabel: 'Fixture provider',
    scope: 'rate',
  }],
}

const conflicting: HotelFundsPolicyEvidence = {
  state: 'conflicting',
  sourceLabel: 'Fixture provider',
  scope: 'rate',
  obligations: [],
  conflictingRecords: [
    { type: 'authorization_hold', amount: { kind: 'exact', money: { priceCents: 10_000, currency: 'USD' } }, sourceLabel: 'Fixture provider', scope: 'rate' },
    { type: 'authorization_hold', amount: { kind: 'exact', money: { priceCents: 30_000, currency: 'USD' } }, sourceLabel: 'Fixture provider', scope: 'rate' },
  ],
}

const explicitNone: HotelFundsPolicyEvidence = {
  state: 'explicit_none',
  sourceLabel: 'Fixture provider',
  scope: 'selected_stay',
  obligations: [],
}

const notReturned: HotelFundsPolicyEvidence = {
  state: 'not_returned',
  sourceLabel: 'Fixture provider',
  scope: 'not_returned',
  obligations: [],
}

export const policies = {
  unsupported: { provider: 'fixture', capability: { policy: false }, evidence: notReturned, loadState: 'ready' },
  unsupportedWithComplete: { provider: 'fixture', capability: { policy: false }, evidence: complete, loadState: 'ready' },
  complete: { provider: 'fixture', capability: { policy: true }, evidence: complete, loadState: 'ready' },
  partial: { provider: 'fixture', capability: { policy: true }, evidence: partial, loadState: 'ready' },
  conflicting: { provider: 'fixture', capability: { policy: true }, evidence: conflicting, loadState: 'ready' },
  explicitNone: { provider: 'fixture', capability: { policy: true }, evidence: explicitNone, loadState: 'ready' },
  notReturned: { provider: 'fixture', capability: { policy: true }, evidence: notReturned, loadState: 'ready' },
  error: { provider: 'fixture', capability: { policy: true }, evidence: notReturned, loadState: 'error' },
} as const satisfies Record<string, ApiDealFundsPolicy>

export function offer(fundsPolicy?: ApiDealFundsPolicy): FundsPolicyFixtureOffer {
  return { locked: false, isMock: false, fundsPolicy }
}

export const hotelFundsPolicyFixtures = {
  allUnsupported20: Array.from({ length: 20 }, () => offer(policies.unsupported)),
  mixed: [offer(policies.complete), offer(policies.explicitNone), offer(policies.notReturned), offer(policies.unsupported)],
  allCapableReturned: [offer(policies.complete), offer(policies.partial), offer(policies.conflicting), offer(policies.explicitNone)],
  allCapableUnknown: [offer(policies.notReturned), offer(policies.notReturned)],
  malformedPair: [offer(policies.unsupportedWithComplete)],
  bridgeMissing: [offer()],
  error: [offer(policies.error)],
  empty: [],
  lockedAndSampleOnly: [
    { locked: true, isMock: false, fundsPolicy: policies.complete },
    { locked: false, isMock: true, fundsPolicy: policies.complete },
  ],
} satisfies Record<string, readonly FundsPolicyFixtureOffer[]>
