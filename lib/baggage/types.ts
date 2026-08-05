import type { Money } from '../types';

export type BaggageCabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

export type BaggageFeeInput = {
  carrierCode: string;
  originCountry: string;
  destinationCountry: string;
  cabinClass: BaggageCabinClass;
  checkedBags: number;
  carryOnBags: number;
};

export type BaggageFeeLine = {
  kind: 'carry_on' | 'checked_bag';
  label: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
  included: boolean;
};

export type BaggageFeeEstimate = {
  carrierCode: string;
  includedCarryOnBags: number;
  includedCheckedBags: number;
  estimatedTotal: Money;
  confidence: 'high' | 'medium' | 'low';
  lines: BaggageFeeLine[];
  disclaimer: string;
};

// Unlike lib/money.ts's isValidMoney (which requires priceCents > 0, correct
// for an actual charge), a baggage line legitimately totals exactly $0 when
// it's included/free -- so this allows zero, rejecting only negative,
// non-integer, or malformed values. Shared by every consumer of a baggage
// estimate payload rather than re-implemented per call site.
export function isValidBaggageMoney(value: unknown): value is Money {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Money>;
  return (
    Number.isInteger(candidate.priceCents) &&
    (candidate.priceCents as number) >= 0 &&
    typeof candidate.currency === 'string' &&
    /^[A-Z]{3}$/i.test(candidate.currency.trim())
  );
}
