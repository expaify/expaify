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
  const seen = new Set<string>()
  const items: T[] = []
  let consumedRows = 0
  let hasMore = false

  for (const row of rowsWithLookahead) {
    if (seen.has(row.id)) {
      if (!hasMore) consumedRows += 1
      continue
    }
    seen.add(row.id)

    if (items.length < limit) {
      items.push(row)
      consumedRows += 1
      continue
    }

    hasMore = true
    break
  }

  return {
    items,
    page: {
      hasMore,
      // Advance past every source row consumed to build this page. Using the
      // post-deduped item count would request a duplicate source row again.
      nextOffset: hasMore ? offset + consumedRows : null,
    },
    coverage: hasMore ? 'more_available' : 'confirmed_end',
  }
}
