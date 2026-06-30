import { buildPricePulseDigest } from '../pricePulse';
import type { PricePulseRouteSample } from '../pricePulseTypes';

const now = new Date('2026-06-30T12:00:00.000Z');

function sample(
  routeKey: string,
  originIata: string,
  destinationIata: string,
  daysAgo: number,
  lowestFareUsd: number,
): PricePulseRouteSample {
  return {
    routeKey,
    originIata,
    destinationIata,
    observedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    lowestFareUsd,
  };
}

describe('buildPricePulseDigest', () => {
  it('detects a dropping route at -8% or lower', () => {
    const digest = buildPricePulseDigest(
      [
        sample('NYC-LIS', 'NYC', 'LIS', 6, 500),
        sample('NYC-LIS', 'NYC', 'LIS', 5, 500),
        sample('NYC-LIS', 'NYC', 'LIS', 4, 500),
        sample('NYC-LIS', 'NYC', 'LIS', 1, 460),
      ],
      { now },
    );

    expect(digest.items).toHaveLength(1);
    expect(digest.items[0]).toMatchObject({
      direction: 'dropping',
      currentLowestFareUsd: 460,
      previousMedianFareUsd: 500,
      percentChange: -8,
      headline: 'NYC to LIS is down 8%',
    });
  });

  it('detects a rising route at +8% or higher', () => {
    const digest = buildPricePulseDigest(
      [
        sample('SFO-NRT', 'SFO', 'NRT', 8, 1000),
        sample('SFO-NRT', 'SFO', 'NRT', 7, 1000),
        sample('SFO-NRT', 'SFO', 'NRT', 6, 1000),
        sample('SFO-NRT', 'SFO', 'NRT', 0.5, 1080),
      ],
      { now },
    );

    expect(digest.items).toHaveLength(1);
    expect(digest.items[0]).toMatchObject({
      direction: 'rising',
      currentLowestFareUsd: 1080,
      previousMedianFareUsd: 1000,
      percentChange: 8,
      headline: 'SFO to NRT is up 8%',
    });
  });

  it("uses 'holding steady' for stable headlines", () => {
    const digest = buildPricePulseDigest(
      [
        sample('BOS-CDG', 'BOS', 'CDG', 8, 700),
        sample('BOS-CDG', 'BOS', 'CDG', 7, 700),
        sample('BOS-CDG', 'BOS', 'CDG', 6, 700),
        sample('BOS-CDG', 'BOS', 'CDG', 0.5, 735),
      ],
      { now },
    );

    expect(digest.items).toHaveLength(1);
    expect(digest.items[0]).toMatchObject({
      direction: 'stable',
      percentChange: 5,
      headline: 'BOS to CDG is holding steady',
    });
  });

  it('excludes groups with fewer than 4 samples', () => {
    const digest = buildPricePulseDigest(
      [
        sample('LAX-HND', 'LAX', 'HND', 5, 900),
        sample('LAX-HND', 'LAX', 'HND', 4, 900),
        sample('LAX-HND', 'LAX', 'HND', 0.25, 800),
      ],
      { now },
    );

    expect(digest.items).toHaveLength(0);
  });

  it('caps returned items with the limit option', () => {
    const digest = buildPricePulseDigest(
      [
        sample('NYC-LIS', 'NYC', 'LIS', 6, 500),
        sample('NYC-LIS', 'NYC', 'LIS', 5, 500),
        sample('NYC-LIS', 'NYC', 'LIS', 4, 500),
        sample('NYC-LIS', 'NYC', 'LIS', 1, 400),
        sample('SFO-NRT', 'SFO', 'NRT', 6, 1000),
        sample('SFO-NRT', 'SFO', 'NRT', 5, 1000),
        sample('SFO-NRT', 'SFO', 'NRT', 4, 1000),
        sample('SFO-NRT', 'SFO', 'NRT', 1, 1100),
      ],
      { now, limit: 1 },
    );

    expect(digest.items).toHaveLength(1);
    expect(digest.items[0].routeKey).toBe('NYC-LIS');
  });
});
