import type {
  BaggageCabinClass,
  BaggageFeeEstimate,
  BaggageFeeInput,
  BaggageFeeLine,
} from './types';
import type { Money } from '../types';

const BAGGAGE_CURRENCY = 'USD';

type CarrierFeeRule = {
  includedCarryOnBags: number;
  includedCheckedBags: number;
  carryOnFeeCents: number;
  checkedBagFeeCents: number;
};

const DEFAULT_RULE: CarrierFeeRule = {
  includedCarryOnBags: 1,
  includedCheckedBags: 0,
  carryOnFeeCents: 4500,
  checkedBagFeeCents: 4000,
};

const CARRIER_RULES: Record<string, CarrierFeeRule> = {
  AA: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeCents: 4000, checkedBagFeeCents: 4000 },
  DL: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeCents: 4000, checkedBagFeeCents: 3500 },
  UA: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeCents: 4000, checkedBagFeeCents: 4000 },
  B6: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeCents: 4500, checkedBagFeeCents: 3500 },
  AS: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeCents: 4000, checkedBagFeeCents: 3500 },
  WN: { includedCarryOnBags: 1, includedCheckedBags: 2, carryOnFeeCents: 0, checkedBagFeeCents: 0 },
  BA: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeCents: 5000, checkedBagFeeCents: 7500 },
  LH: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeCents: 5000, checkedBagFeeCents: 7500 },
  AF: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeCents: 5000, checkedBagFeeCents: 7000 },
  KL: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeCents: 5000, checkedBagFeeCents: 7000 },
  IB: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeCents: 5000, checkedBagFeeCents: 7500 },
  AC: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeCents: 4500, checkedBagFeeCents: 3500 },
};

function clampBagCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(4, Math.max(0, Math.trunc(value)));
}

function normalizeCarrierCode(value: string): string {
  return value.trim().toUpperCase();
}

function isPremiumCabin(cabinClass: BaggageCabinClass): boolean {
  return cabinClass === 'BUSINESS' || cabinClass === 'FIRST';
}

function money(priceCents: number): Money {
  return { priceCents, currency: BAGGAGE_CURRENCY };
}

// All arithmetic here is integer cents -- quantity * unitPriceCents is exact,
// with no floating-point dollar multiplication anywhere in this module.
function buildLine(
  kind: BaggageFeeLine['kind'],
  label: string,
  quantity: number,
  unitPriceCents: number,
  included: boolean,
): BaggageFeeLine {
  const totalCents = included ? 0 : quantity * unitPriceCents;
  return {
    kind,
    label,
    quantity,
    unitPrice: money(unitPriceCents),
    total: money(totalCents),
    included,
  };
}

export function estimateBaggageFees(input: BaggageFeeInput): BaggageFeeEstimate {
  const carrierCode = normalizeCarrierCode(input.carrierCode);
  const checkedBags = clampBagCount(input.checkedBags);
  const carryOnBags = clampBagCount(input.carryOnBags);
  const carrierRule = CARRIER_RULES[carrierCode];
  const rule = carrierRule ?? DEFAULT_RULE;
  const international = input.originCountry.trim().toUpperCase() !== input.destinationCountry.trim().toUpperCase();

  const includedCheckedBags = isPremiumCabin(input.cabinClass)
    ? Math.max(rule.includedCheckedBags, 2)
    : rule.includedCheckedBags;
  const includedCarryOnBags = rule.includedCarryOnBags;
  const paidCarryOnBags = Math.max(0, carryOnBags - includedCarryOnBags);
  const paidCheckedBags = Math.max(0, checkedBags - includedCheckedBags);
  const lines: BaggageFeeLine[] = [];

  const includedCarryOnQuantity = Math.min(carryOnBags, includedCarryOnBags);
  const includedCheckedQuantity = Math.min(checkedBags, includedCheckedBags);

  if (includedCarryOnQuantity > 0) {
    lines.push(buildLine(
      'carry_on',
      `${includedCarryOnQuantity} carry-on included`,
      includedCarryOnQuantity,
      0,
      true,
    ));
  }

  if (paidCarryOnBags > 0) {
    lines.push(buildLine('carry_on', 'Additional carry-on estimate', paidCarryOnBags, rule.carryOnFeeCents, false));
  }

  if (includedCheckedQuantity > 0) {
    lines.push(buildLine(
      'checked_bag',
      `${includedCheckedQuantity} checked bag${includedCheckedQuantity === 1 ? '' : 's'} included`,
      includedCheckedQuantity,
      0,
      true,
    ));
  }

  if (paidCheckedBags > 0) {
    lines.push(buildLine('checked_bag', 'Checked bag estimate', paidCheckedBags, rule.checkedBagFeeCents, false));
  }

  const estimatedTotalCents = lines.reduce((sum, line) => sum + line.total.priceCents, 0);
  const confidence = carrierRule ? (international ? 'medium' : 'high') : 'low';

  return {
    carrierCode,
    includedCarryOnBags,
    includedCheckedBags,
    estimatedTotal: money(estimatedTotalCents),
    confidence,
    lines,
    disclaimer: 'Baggage fees are estimates in USD and can vary by fare brand, route, loyalty status, and booking channel.',
  };
}
