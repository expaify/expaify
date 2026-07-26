import { buildDealPage } from '../feedContract'

describe('hotel deal pagination contract', () => {
  it('uses a lookahead row to expose a stable continuation offset', () => {
    const page = buildDealPage([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 6, 2)

    expect(page).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      coverage: 'more_available',
      page: { hasMore: true, nextOffset: 8 },
    })
  })

  it('confirms the end when no lookahead row exists', () => {
    const page = buildDealPage([{ id: 'a' }], 12, 12)

    expect(page).toEqual({
      items: [{ id: 'a' }],
      coverage: 'confirmed_end',
      page: { hasMore: false, nextOffset: null },
    })
  })
})
