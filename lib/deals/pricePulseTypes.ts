export type PricePulseDirection = 'dropping' | 'rising' | 'stable';

export type PricePulseRouteSample = {
  routeKey: string;
  originIata: string;
  destinationIata: string;
  observedAt: string;
  lowestFareUsd: number;
};

export type PricePulseItem = {
  routeKey: string;
  originIata: string;
  destinationIata: string;
  direction: PricePulseDirection;
  currentLowestFareUsd: number;
  previousMedianFareUsd: number;
  percentChange: number;
  sampleCount: number;
  headline: string;
};

export type PricePulseDigest = {
  generatedAt: string;
  windowDays: number;
  items: PricePulseItem[];
};
