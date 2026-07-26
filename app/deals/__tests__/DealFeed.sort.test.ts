import { HOTEL_SORT_OPTIONS } from '../DealFeed'

describe('hotel sort control options', () => {
  it('offers the three supported server sort values with final customer copy', () => {
    expect(HOTEL_SORT_OPTIONS.map(option => [option.key, option.label])).toEqual([
      ['newest', 'Recently found'],
      ['discount', 'Biggest discount'],
      ['price', 'Lowest nightly price'],
    ])
  })

  it('uses stable analytics values rather than presentation labels', () => {
    expect(HOTEL_SORT_OPTIONS.map(option => option.analyticsValue)).toEqual([
      'recently_found',
      'biggest_discount',
      'lowest_nightly_price',
    ])
  })
})
