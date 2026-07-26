import { eligibleHotelProviderLinks, isAttributedHotelProviderUrl } from '../ui/CompareRow'

describe('hotel provider handoff eligibility', () => {
  it('allows an attributed HTTPS link without occupancy assumptions', () => {
    expect(isAttributedHotelProviderUrl('trip', 'https://tp.media/r?marker=hotel-marker&u=https%3A%2F%2Fwww.trip.com%2Fhotel')).toBe(true)
  })

  it.each([
    ['kiwi', 'https://www.kiwi.com/hotels?affilid=marker&adults=2'],
    ['booking', 'https://www.booking.com/search?aid=marker&rooms=1'],
    ['trip', 'https://tp.media/r?marker=marker&u=https%3A%2F%2Fexample.test%2Fhotel%3Froom_qty%3D1'],
  ] as const)('rejects %s links that expose hidden occupancy defaults', (provider, href) => {
    expect(isAttributedHotelProviderUrl(provider, href)).toBe(false)
  })

  it('filters malformed, unattributed, and occupancy-bearing legacy links', () => {
    expect(eligibleHotelProviderLinks({
      expedia: 'https://www.expedia.com/hotel',
      booking: 'not-a-url',
      kiwi: 'https://www.kiwi.com/hotels?affilid=marker&adults=2',
      trip: 'https://tp.media/r?marker=hotel-marker&u=https%3A%2F%2Fwww.trip.com%2Fhotel',
    })).toEqual({
      trip: 'https://tp.media/r?marker=hotel-marker&u=https%3A%2F%2Fwww.trip.com%2Fhotel',
    })
  })

  it('rejects attribution-looking parameters on an unrelated host', () => {
    expect(isAttributedHotelProviderUrl('booking', 'https://attacker.test/hotel?aid=marker')).toBe(false)
  })
})
