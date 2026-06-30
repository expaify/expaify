import type {
  DealScore,
  NormalizedFare,
  NormalizedHotelOffer,
  PricePoint,
} from '../types';

/**
 * Score a flight (or hotel) fare against historical price data.
 *
 * Percentile method: midpoint rank
 *   percentile = ((countBelow + 0.5 * countEqual) / n) * 100
 *
 * This handles three edge cases elegantly:
 *   - All history equal to current fare  → percentile = 50
 *   - Current fare above all history     → percentile = 100
 *   - Current fare below all history     → percentile = 0
 *
 * Only same-currency history is comparable. Multi-currency conversion will be
 * wired in via lib/fx when available.
 */
type ScoreableOffer = NormalizedFare | NormalizedHotelOffer;
type ScoreContext = 'route' | 'hotel';

function getCurrentPrice(offer: ScoreableOffer) {
  if ('pricePerNight' in offer) {
    return {
      currentCents: offer.pricePerNight.priceCents,
      currency: offer.pricePerNight.currency,
      context: 'hotel' as const,
    };
  }

  return {
    currentCents: offer.price.priceCents,
    currency: offer.price.currency,
    context: 'route' as const,
  };
}

function historyLabel(context: ScoreContext) {
  return context === 'hotel' ? 'hotel' : 'route';
}

export function scoreDeal(
  currentFare: NormalizedFare,
  history: PricePoint[],
): DealScore;
export function scoreDeal(
  currentHotel: NormalizedHotelOffer,
  history: PricePoint[],
): DealScore;
export function scoreDeal(
  currentOffer: ScoreableOffer,
  history: PricePoint[],
): DealScore {
  const { currentCents, currency, context } = getCurrentPrice(currentOffer);
  const label = historyLabel(context);

  // NOTE: Award fares score differently (miles vs cash, redemption value, etc.).
  // When fareType === 'award', branch here into scoreAwardDeal() — not yet implemented.

  const comparableHistory = history.filter((h) => h.currency === currency);

  // ── Edge case: no comparable history ───────────────────────────────────────
  if (comparableHistory.length === 0) {
    return {
      percentile: 50,
      pctVsMedian: 0,
      medianCents: 0,
      currency,
      verdict: 'Typical',
      confidence: 'low',
      explanation:
        history.length === 0
          ? `No price history available for this ${label}.`
          : `No comparable ${currency} price history available for this ${label}.`,
    };
  }

  // ── Confidence ─────────────────────────────────────────────────────────────
  const confidence: 'high' | 'low' =
    comparableHistory.length >= 10 ? 'high' : 'low';

  // ── Sort price points ascending ────────────────────────────────────────────
  const sorted = comparableHistory.map((h) => h.priceCents).sort((a, b) => a - b);
  const n = sorted.length;

  // ── Median ─────────────────────────────────────────────────────────────────
  const medianCents =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  // ── Midpoint percentile (handles ties) ────────────────────────────────────
  let countBelow = 0;
  let countEqual = 0;
  for (const p of sorted) {
    if (p < currentCents) countBelow++;
    else if (p === currentCents) countEqual++;
  }
  const rawPercentile = ((countBelow + 0.5 * countEqual) / n) * 100;
  const percentile = confidence === 'low' ? 50 : rawPercentile;

  // ── % vs median ────────────────────────────────────────────────────────────
  const pctVsMedian =
    medianCents === 0
      ? 0
      : ((currentCents - medianCents) / medianCents) * 100;

  // ── Verdict ────────────────────────────────────────────────────────────────
  // Low-confidence scores are capped at 'Typical' to avoid misleading 'Great'
  // labels on thin data (fewer than 10 history points).
  let verdict: DealScore['verdict'];
  if (confidence === 'low') {
    verdict = 'Typical';
  } else if (percentile <= 15) {
    verdict = 'Great';
  } else if (percentile <= 40) {
    verdict = 'Good';
  } else {
    verdict = 'Typical';
  }

  // ── Plain-language explanation ─────────────────────────────────────────────
  const currentDollars = Math.round(currentCents / 100);
  const medianDollars = Math.round(medianCents / 100);
  const absPct = Math.abs(Math.round(pctVsMedian));

  let explanation: string;
  if (confidence === 'low') {
    explanation = `$${currentDollars} — limited price history for this ${label}, so this is treated as a typical price for now.`;
  } else if (pctVsMedian < -0.5) {
    explanation = `$${currentDollars} — about ${absPct}% below the usual $${medianDollars} for this ${label} over the last 90 days.`;
  } else if (pctVsMedian > 0.5) {
    explanation = `$${currentDollars} — about ${absPct}% above the usual $${medianDollars} for this ${label} over the last 90 days.`;
  } else {
    explanation = `$${currentDollars} — right at the typical price of $${medianDollars} for this ${label} over the last 90 days.`;
  }

  return {
    percentile,
    pctVsMedian,
    medianCents,
    currency,
    verdict,
    confidence,
    explanation,
  };
}
