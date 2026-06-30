import type { DealScore, NormalizedFare } from '@/lib/types';
import { sortFlights } from '../sortFlights';

function makeFare(id: string, priceCents: number, depart = '2026-09-01T09:00:00.000Z'): NormalizedFare {
  return {
    id,
    fareType: 'cash',
    origin: 'JFK',
    destination: 'LAX',
    depart,
    return: '2026-09-08T16:00:00.000Z',
    cabin: 'economy',
    stops: 0,
    carrier: 'AA',
    price: { priceCents, currency: 'USD' },
    deeplink: `https://example.com/${id}`,
    source: 'travelpayouts',
    fetchedAt: '2026-06-30T00:00:00.000Z',
  };
}

function makeScore(verdict: DealScore['verdict'], percentile: number, confidence: DealScore['confidence'] = 'high'): DealScore {
  return {
    verdict,
    percentile,
    confidence,
    pctVsMedian: -10,
    medianCents: 30000,
    currency: 'USD',
    explanation: 'Test score.',
  };
}

describe('sortFlights', () => {
  it('orders Best deal by high-confidence deal quality before price', () => {
    const fares = [
      makeFare('typical-cheap', 12000),
      makeFare('good-mid', 18000),
      makeFare('great-expensive', 24000),
    ];

    const sorted = sortFlights(fares, 'deal', {
      'typical-cheap': makeScore('Typical', 55),
      'good-mid': makeScore('Good', 28),
      'great-expensive': makeScore('Great', 12),
    });

    expect(sorted.map(fare => fare.id)).toEqual(['great-expensive', 'good-mid', 'typical-cheap']);
  });

  it('keeps a deterministic price fallback while scores are missing', () => {
    const fares = [
      makeFare('expensive', 24000),
      makeFare('cheap-late', 12000, '2026-09-01T12:00:00.000Z'),
      makeFare('cheap-early', 12000, '2026-09-01T08:00:00.000Z'),
    ];

    const sorted = sortFlights(fares, 'deal', {});

    expect(sorted.map(fare => fare.id)).toEqual(['cheap-early', 'cheap-late', 'expensive']);
  });

  it('keeps fallback ordering when only some deal scores have settled', () => {
    const fares = [
      makeFare('cheap-pending', 12000),
      makeFare('expensive-great', 24000),
      makeFare('mid-pending', 18000),
    ];

    const sorted = sortFlights(fares, 'deal', {
      'expensive-great': makeScore('Great', 8),
    });

    expect(sorted.map(fare => fare.id)).toEqual(['cheap-pending', 'mid-pending', 'expensive-great']);
  });

  it('keeps fallback ordering when deal ranking is deferred after scores settle', () => {
    const fares = [
      makeFare('cheap-typical', 12000),
      makeFare('expensive-great', 24000),
    ];

    const sorted = sortFlights(
      fares,
      'deal',
      {
        'cheap-typical': makeScore('Typical', 60),
        'expensive-great': makeScore('Great', 8),
      },
      { deferDealSort: true }
    );

    expect(sorted.map(fare => fare.id)).toEqual(['cheap-typical', 'expensive-great']);
  });

  it('does not promote low-confidence scores above high-confidence deals', () => {
    const fares = [
      makeFare('low-great', 12000),
      makeFare('high-good', 18000),
    ];

    const sorted = sortFlights(fares, 'deal', {
      'low-great': makeScore('Great', 10, 'low'),
      'high-good': makeScore('Good', 30, 'high'),
    });

    expect(sorted.map(fare => fare.id)).toEqual(['high-good', 'low-great']);
  });
});
