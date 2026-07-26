import { buildDealPage, dedupeByStableId } from '../feedContract'

describe('hotel deal feed contract', () => {
  it('keeps the first occurrence of each stable id', () => {
    expect(dedupeByStableId([
      { id: 'a', value: 1 },
      { id: 'a', value: 2 },
      { id: 'b', value: 3 },
    ])).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 3 },
    ])
  })

  it('derives continuation metadata from the delivered page boundary', () => {
    const result = buildDealPage(
      Array.from({ length: 13 }, (_, index) => ({ id: `deal-${index + 1}` })),
      24,
      12,
    )

    expect(result.items).toHaveLength(12)
    expect(result.page).toEqual({ hasMore: true, nextOffset: 36 })
    expect(result.coverage).toBe('more_available')
  })

  it('returns an explicit terminal page when no lookahead row exists', () => {
    const result = buildDealPage([{ id: 'last-deal' }], 36, 12)

    expect(result.page).toEqual({ hasMore: false, nextOffset: null })
    expect(result.coverage).toBe('confirmed_end')
  })

  it('advances by consumed source rows when a page contains a partial duplicate', () => {
    const result = buildDealPage([
      { id: 'deal-a' },
      { id: 'deal-b' },
      { id: 'deal-b' },
      { id: 'deal-c' },
      { id: 'deal-d' },
    ], 24, 3)

    expect(result.items.map(item => item.id)).toEqual(['deal-a', 'deal-b', 'deal-c'])
    expect(result.page).toEqual({ hasMore: true, nextOffset: 28 })
    expect(result.coverage).toBe('more_available')
  })
})
