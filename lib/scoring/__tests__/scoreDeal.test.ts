import { scoreDeal } from '../scoreDeal';
import type { NormalizedFare, NormalizedHotelOffer, PricePoint } from '../../types';
import goldenCases from '../../../evals/golden.json';

// ── Types for golden.json entries ──────────────────────────────────────────────
interface GoldenExpected {
  verdict: 'Great' | 'Good' | 'Typical';
  confidence: 'high' | 'low';
  percentileLte: number;
  percentileGte: number;
}

interface GoldenCase {
  description: string;
  fare: NormalizedFare;
  history: PricePoint[];
  expected: GoldenExpected;
}

// ── Golden file driven tests ───────────────────────────────────────────────────
describe('scoreDeal — golden file cases', () => {
  (goldenCases as GoldenCase[]).forEach(({ description, fare, history, expected }) => {
    it(description, () => {
      const result = scoreDeal(fare, history);

      expect(result.verdict).toBe(expected.verdict);
      expect(result.confidence).toBe(expected.confidence);
      expect(result.percentile).toBeGreaterThanOrEqual(expected.percentileGte);
      expect(result.percentile).toBeLessThanOrEqual(expected.percentileLte);
    });
  });
});

// ── Shared fare builder ────────────────────────────────────────────────────────
function makeFare(priceCents: number): NormalizedFare {
  return {
    id: 'test-fare',
    fareType: 'cash',
    origin: 'JFK',
    destination: 'LAX',
    depart: '2026-08-01',
    stops: 0,
    carrier: 'AA',
    price: { priceCents, currency: 'USD' },
    deeplink: 'https://example.com',
    source: 'kayak',
    fetchedAt: '2026-06-29T00:00:00Z',
  };
}

function makeHistory(cents: number[]): PricePoint[] {
  return cents.map((priceCents, i) => ({
    date: `2026-0${(i % 9) + 1}-01`,
    priceCents,
    currency: 'USD',
  }));
}

function makeHistoryInCurrency(cents: number[], currency: string): PricePoint[] {
  return cents.map((priceCents, i) => ({
    date: `2026-0${(i % 9) + 1}-15`,
    priceCents,
    currency,
  }));
}

function makeHotel(priceCents: number): NormalizedHotelOffer {
  return {
    id: 'hotel-1',
    name: 'Test Hotel',
    area: 'New York',
    stars: 4,
    pricePerNight: { priceCents, currency: 'USD' },
    deeplink: 'https://example.com/hotel',
    source: 'hotellook',
  };
}

// ── Inline edge cases ──────────────────────────────────────────────────────────
describe('scoreDeal — edge cases', () => {
  it('empty history returns safe defaults', () => {
    const result = scoreDeal(makeFare(30000), []);
    expect(result.verdict).toBe('Typical');
    expect(result.confidence).toBe('low');
    expect(result.percentile).toBe(50);
    expect(result.pctVsMedian).toBe(0);
    expect(result.medianCents).toBe(0);
    expect(result.currency).toBe('USD');
    expect(result.explanation).toBe('No price history available for this route.');
  });

  it('single data point is low confidence and Typical', () => {
    const result = scoreDeal(makeFare(15000), makeHistory([40000]));
    expect(result.confidence).toBe('low');
    expect(result.verdict).toBe('Typical');
    expect(result.medianCents).toBe(40000);
  });

  it('all history prices equal to current fare yields percentile = 50, pctVsMedian = 0', () => {
    const price = 30000;
    const result = scoreDeal(makeFare(price), makeHistory(Array(15).fill(price)));
    expect(result.percentile).toBe(50);
    expect(result.pctVsMedian).toBe(0);
    expect(result.medianCents).toBe(price);
    expect(result.verdict).toBe('Typical');
    expect(result.confidence).toBe('high');
  });

  it('fare above all history yields percentile = 100 and Typical verdict', () => {
    const history = makeHistory([15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000]);
    const result = scoreDeal(makeFare(80000), history);
    expect(result.percentile).toBe(100);
    expect(result.verdict).toBe('Typical');
    expect(result.confidence).toBe('high');
  });

  it('fare below all history yields percentile = 0', () => {
    const history = makeHistory([30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000]);
    const result = scoreDeal(makeFare(10000), history);
    expect(result.percentile).toBe(0);
    expect(result.verdict).toBe('Great');
    expect(result.confidence).toBe('high');
  });

  it('high confidence threshold: exactly 10 points is high, 9 is low', () => {
    const lowHistory = makeHistory([20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000]);
    const highHistory = makeHistory([20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000]);
    expect(scoreDeal(makeFare(10000), lowHistory).confidence).toBe('low');
    expect(scoreDeal(makeFare(10000), highHistory).confidence).toBe('high');
  });

  it('thin data never emits Great even at percentile 0', () => {
    const result = scoreDeal(makeFare(5000), makeHistory([30000, 35000, 40000, 45000, 50000]));
    expect(result.percentile).toBe(50);
    expect(result.confidence).toBe('low');
    expect(result.verdict).toBe('Typical');
    expect(result.verdict).not.toBe('Great');
    expect(result.verdict).not.toBe('Good');
    expect(result.explanation).toContain('limited price history');
    expect(result.explanation).toContain('treated as a typical price');
  });

  it('even-numbered history uses the midpoint median for pctVsMedian', () => {
    const result = scoreDeal(makeFare(25000), makeHistory([
      10000,
      20000,
      30000,
      40000,
      50000,
      60000,
      70000,
      80000,
      90000,
      100000,
    ]));

    expect(result.medianCents).toBe(55000);
    expect(result.pctVsMedian).toBeCloseTo(-54.55, 2);
    expect(result.verdict).toBe('Good');
  });

  it('verdict boundaries: percentile 15 → Great, 16 → Good, 40 → Good, 41 → Typical', () => {
    // 20 evenly-spaced prices [10, 20, ..., 200] in thousands of cents
    // Each step = 10000, sorted ascending
    // percentile of index k (0-based) using midpoint: (k + 0.5) / 20 * 100
    // k=2 → 12.5% (Great), k=3 → 17.5% (Good), k=7 → 37.5% (Good), k=8 → 42.5% (Typical)
    const history = makeHistory([10000,20000,30000,40000,50000,60000,70000,80000,90000,100000,
                                  110000,120000,130000,140000,150000,160000,170000,180000,190000,200000]);

    // percentile ≤ 15 → Great: pick price in sorted[2] = 30000 → (2 + 0.5)/20*100 = 12.5
    expect(scoreDeal(makeFare(30000), history).verdict).toBe('Great');

    // percentile in (15, 40] → Good: sorted[3] = 40000 → 17.5
    expect(scoreDeal(makeFare(40000), history).verdict).toBe('Good');

    // percentile in (15, 40] → Good: sorted[7] = 80000 → 37.5
    expect(scoreDeal(makeFare(80000), history).verdict).toBe('Good');

    // percentile > 40 → Typical: sorted[8] = 90000 → 42.5
    expect(scoreDeal(makeFare(90000), history).verdict).toBe('Typical');
  });

  it('currency is propagated from the fare', () => {
    const fare: NormalizedFare = { ...makeFare(30000), price: { priceCents: 30000, currency: 'EUR' } };
    const result = scoreDeal(fare, makeHistory([25000, 30000, 35000]));
    expect(result.currency).toBe('EUR');
  });

  it('formats non-USD explanation amounts with their currency code', () => {
    const fare: NormalizedFare = { ...makeFare(28000), price: { priceCents: 28000, currency: 'EUR' } };
    const history = makeHistoryInCurrency(Array(10).fill(40000), 'EUR');
    const result = scoreDeal(fare, history);

    expect(result.explanation).toContain('EUR 280.00');
    expect(result.explanation).toContain('usual EUR 400.00');
  });

  it('currency mismatch returns neutral low confidence instead of claiming a deal', () => {
    const fare: NormalizedFare = { ...makeFare(10000), price: { priceCents: 10000, currency: 'EUR' } };
    const usdHistory = makeHistory(Array(12).fill(40000));
    const result = scoreDeal(fare, usdHistory);

    expect(result.currency).toBe('EUR');
    expect(result.percentile).toBe(50);
    expect(result.pctVsMedian).toBe(0);
    expect(result.medianCents).toBe(0);
    expect(result.confidence).toBe('low');
    expect(result.verdict).toBe('Typical');
    expect(result.explanation).toBe('No comparable EUR price history available for this route.');
  });

  it('mixed-currency history only scores comparable currency points', () => {
    const fare: NormalizedFare = { ...makeFare(10000), price: { priceCents: 10000, currency: 'EUR' } };
    const history = [
      ...makeHistoryInCurrency([30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000], 'EUR'),
      ...makeHistoryInCurrency([1000, 1200, 1400, 1600, 1800], 'USD'),
    ];
    const result = scoreDeal(fare, history);

    expect(result.medianCents).toBe(50000);
    expect(result.percentile).toBe(50);
    expect(result.confidence).toBe('low');
    expect(result.verdict).toBe('Typical');
  });

  it('explanation mentions current price and median price', () => {
    // 10 prices all 40000, current 28000 (30% below median $400)
    const result = scoreDeal(makeFare(28000), makeHistory(Array(10).fill(40000)));
    expect(result.explanation).toContain('$280');
    expect(result.explanation).toContain('$400');
  });

  it('scores hotel offers against price-per-night history', () => {
    const result = scoreDeal(
      makeHotel(12000),
      makeHistory([12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000, 21000]),
    );

    expect(result.percentile).toBe(5);
    expect(result.verdict).toBe('Great');
    expect(result.confidence).toBe('high');
    expect(result.explanation).toContain('for this hotel');
  });

  it('low-confidence hotel history returns a neutral score', () => {
    const result = scoreDeal(makeHotel(9000), makeHistory([15000, 16000, 17000]));

    expect(result.percentile).toBe(50);
    expect(result.verdict).toBe('Typical');
    expect(result.confidence).toBe('low');
  });
});
