import type { DealScore, NormalizedFare } from '@/lib/types'

type SortBy = 'price' | 'deal'
type SortOptions = {
  deferDealSort?: boolean
}

const verdictRank: Record<DealScore['verdict'], number> = {
  Great: 0,
  Good: 1,
  Typical: 2,
}

function compareFallback(a: NormalizedFare, b: NormalizedFare): number {
  return (
    a.price.currency.localeCompare(b.price.currency) ||
    a.price.priceCents - b.price.priceCents ||
    a.stops - b.stops ||
    a.depart.localeCompare(b.depart) ||
    a.carrier.localeCompare(b.carrier) ||
    a.id.localeCompare(b.id)
  )
}

function scoreRank(score: DealScore | null | undefined): number {
  if (!score) return 10
  return score.confidence === 'high' ? verdictRank[score.verdict] : 6 + verdictRank[score.verdict]
}

function compareDealScore(
  a: NormalizedFare,
  b: NormalizedFare,
  scores: Record<string, DealScore | null>
): number {
  const aScore = scores[a.id]
  const bScore = scores[b.id]

  return (
    scoreRank(aScore) - scoreRank(bScore) ||
    (aScore?.percentile ?? Number.POSITIVE_INFINITY) - (bScore?.percentile ?? Number.POSITIVE_INFINITY) ||
    (aScore?.pctVsMedian ?? Number.POSITIVE_INFINITY) - (bScore?.pctVsMedian ?? Number.POSITIVE_INFINITY) ||
    compareFallback(a, b)
  )
}

function hasSettledScore(scores: Record<string, DealScore | null>, fareId: string): boolean {
  return Object.prototype.hasOwnProperty.call(scores, fareId)
}

export function sortFlights(
  fares: NormalizedFare[],
  sortBy: SortBy,
  scores: Record<string, DealScore | null>,
  options: SortOptions = {}
): NormalizedFare[] {
  const shouldUseFallback =
    sortBy === 'price' ||
    options.deferDealSort ||
    !fares.every(fare => hasSettledScore(scores, fare.id))

  return [...fares].sort((a, b) => {
    if (shouldUseFallback) return compareFallback(a, b)
    return compareDealScore(a, b, scores)
  })
}
