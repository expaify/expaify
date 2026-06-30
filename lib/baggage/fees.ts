import type {
  BaggageCabinClass,
  BaggageFeeEstimate,
  BaggageFeeInput,
  BaggageFeeLine,
} from './types';

type CarrierFeeRule = {
  includedCarryOnBags: number;
  includedCheckedBags: number;
  carryOnFeeUsd: number;
  checkedBagFeeUsd: number;
};

const DEFAULT_RULE: CarrierFeeRule = {
  includedCarryOnBags: 1,
  includedCheckedBags: 0,
  carryOnFeeUsd: 45,
  checkedBagFeeUsd: 40,
};

const CARRIER_RULES: Record<string, CarrierFeeRule> = {
  AA: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeUsd: 40, checkedBagFeeUsd: 40 },
  DL: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeUsd: 40, checkedBagFeeUsd: 35 },
  UA: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeUsd: 40, checkedBagFeeUsd: 40 },
  B6: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeUsd: 45, checkedBagFeeUsd: 35 },
  AS: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeUsd: 40, checkedBagFeeUsd: 35 },
  WN: { includedCarryOnBags: 1, includedCheckedBags: 2, carryOnFeeUsd: 0, checkedBagFeeUsd: 0 },
  BA: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeUsd: 50, checkedBagFeeUsd: 75 },
  LH: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeUsd: 50, checkedBagFeeUsd: 75 },
  AF: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeUsd: 50, checkedBagFeeUsd: 70 },
  KL: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeUsd: 50, checkedBagFeeUsd: 70 },
  IB: { includedCarryOnBags: 1, includedCheckedBags: 1, carryOnFeeUsd: 50, checkedBagFeeUsd: 75 },
  AC: { includedCarryOnBags: 1, includedCheckedBags: 0, carryOnFeeUsd: 45, checkedBagFeeUsd: 35 },
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

function buildLine(
  kind: BaggageFeeLine['kind'],
  label: string,
  quantity: number,
  unitPriceUsd: number,
  included: boolean,
): BaggageFeeLine {
  return {
    kind,
    label,
    quantity,
    unitPriceUsd,
    totalUsd: included ? 0 : quantity * unitPriceUsd,
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
    lines.push(buildLine('carry_on', 'Additional carry-on estimate', paidCarryOnBags, rule.carryOnFeeUsd, false));
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
    lines.push(buildLine('checked_bag', 'Checked bag estimate', paidCheckedBags, rule.checkedBagFeeUsd, false));
  }

  const estimatedTotalUsd = lines.reduce((sum, line) => sum + line.totalUsd, 0);
  const confidence = carrierRule ? (international ? 'medium' : 'high') : 'low';

  return {
    carrierCode,
    includedCarryOnBags,
    includedCheckedBags,
    estimatedTotalUsd,
    confidence,
    lines,
    disclaimer: 'Baggage fees are estimates in USD and can vary by fare brand, route, loyalty status, and booking channel.',
  };
}
