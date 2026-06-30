import type {
  PricePulseDigest,
  PricePulseDirection,
  PricePulseItem,
  PricePulseRouteSample,
} from './pricePulseTypes';

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_LIMIT = 8;
const CURRENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type ParsedSample = PricePulseRouteSample & {
  observedTime: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint];
  }

  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function getDirection(percentChange: number): PricePulseDirection {
  if (percentChange <= -8) return 'dropping';
  if (percentChange >= 8) return 'rising';
  return 'stable';
}

function buildHeadline(
  originIata: string,
  destinationIata: string,
  direction: PricePulseDirection,
  percentChange: number,
): string {
  const route = `${originIata} to ${destinationIata}`;

  if (direction === 'dropping') {
    return `${route} is down ${Math.abs(percentChange)}%`;
  }

  if (direction === 'rising') {
    return `${route} is up ${percentChange}%`;
  }

  return `${route} is holding steady`;
}

export function buildPricePulseDigest(
  samples: PricePulseRouteSample[],
  options?: { now?: Date; windowDays?: number; limit?: number },
): PricePulseDigest {
  const now = options?.now ?? new Date();
  const generatedAt = now.toISOString();
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const windowStartTime = now.getTime() - windowDays * DAY_MS;
  const currentStartTime = now.getTime() - CURRENT_WINDOW_MS;
  const grouped = new Map<string, ParsedSample[]>();

  for (const sample of samples) {
    const observedTime = new Date(sample.observedAt).getTime();
    if (!Number.isFinite(observedTime)) continue;
    if (observedTime < windowStartTime || observedTime > now.getTime()) continue;

    const group = grouped.get(sample.routeKey) ?? [];
    group.push({ ...sample, observedTime });
    grouped.set(sample.routeKey, group);
  }

  const items: PricePulseItem[] = [];

  for (const [routeKey, group] of grouped) {
    if (group.length < 4) continue;

    const currentSamples = group.filter((sample) => sample.observedTime >= currentStartTime);
    const previousSamples = group.filter((sample) => sample.observedTime < currentStartTime);
    if (currentSamples.length === 0 || previousSamples.length === 0) continue;

    const currentLowestFareUsd = Math.min(
      ...currentSamples.map((sample) => sample.lowestFareUsd),
    );
    const previousMedianFareUsd = median(
      previousSamples.map((sample) => sample.lowestFareUsd),
    );
    if (previousMedianFareUsd <= 0) continue;

    const percentChange = Math.round(
      ((currentLowestFareUsd - previousMedianFareUsd) / previousMedianFareUsd) * 100,
    );
    const direction = getDirection(percentChange);
    const newestSample = group.reduce((latest, sample) =>
      sample.observedTime > latest.observedTime ? sample : latest,
    );

    items.push({
      routeKey,
      originIata: newestSample.originIata,
      destinationIata: newestSample.destinationIata,
      direction,
      currentLowestFareUsd,
      previousMedianFareUsd,
      percentChange,
      sampleCount: group.length,
      headline: buildHeadline(
        newestSample.originIata,
        newestSample.destinationIata,
        direction,
        percentChange,
      ),
    });
  }

  items.sort((a, b) => {
    const movementDelta = Math.abs(b.percentChange) - Math.abs(a.percentChange);
    if (movementDelta !== 0) return movementDelta;
    return a.currentLowestFareUsd - b.currentLowestFareUsd;
  });

  return {
    generatedAt,
    windowDays,
    items: items.slice(0, Math.max(0, limit)),
  };
}
