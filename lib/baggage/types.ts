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
  unitPriceUsd: number;
  totalUsd: number;
  included: boolean;
};

export type BaggageFeeEstimate = {
  carrierCode: string;
  includedCarryOnBags: number;
  includedCheckedBags: number;
  estimatedTotalUsd: number;
  confidence: 'high' | 'medium' | 'low';
  lines: BaggageFeeLine[];
  disclaimer: string;
};
