export type HotelDealSort = 'newest' | 'discount' | 'price'

export const HOTEL_DEAL_PAGE_SIZE = 12

export type DealCoverage = 'more_available' | 'confirmed_end'

export type DealPageMetadata = {
  nextOffset: number | null
  hasMore: boolean
}

export function dedupeByStableId<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

/**
 * Builds offset metadata from a one-row lookahead. The deals table guarantees
 * stable, unique ids; deduplication is still applied defensively at the API
 * boundary so every consumer receives the same visible set.
 */
export function buildDealPage<T extends { id: string }>(
  rowsWithLookahead: readonly T[],
  offset: number,
  limit: number,
): { items: T[]; page: DealPageMetadata; coverage: DealCoverage } {
  const consumedRows = rowsWithLookahead.slice(0, limit)
  const items = dedupeByStableId(consumedRows)
  const hasMore = rowsWithLookahead.length > limit

  return {
    items,
    page: {
      hasMore,
      // The continuation boundary tracks rows consumed by the server query,
      // not items left after stable-id deduplication. Otherwise a partially
      // duplicated page repeats already-consumed rows on the next request.
      nextOffset: hasMore ? offset + consumedRows.length : null,
    },
    coverage: hasMore ? 'more_available' : 'confirmed_end',
  }
}
