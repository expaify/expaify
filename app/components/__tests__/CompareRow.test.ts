import { eligibleHotelProviderLinks, isAttributedHotelProviderUrl } from '../ui/CompareRow'

describe('hotel provider handoff eligibility', () => {
  it('allows an attributed HTTPS link without occupancy assumptions', () => {
    expect(isAttributedHotelProviderUrl('trip', 'https://tp.media/r?marker=hotel-marker&u=https%3A%2F%2Fwww.trip.com%2Fhotel')).toBe(true)
  })

  it.each([
    ['kiwi', 'https://www.kiwi.com/hotels?affilid=marker&adults=2'],
    ['booking', 'https://www.booking.com/search?aid=marker&rooms=1'],
    ['booking', 'https://www.booking.com/search?aid=marker&child_ages%5B%5D=4'],
    ['booking', 'https://www.booking.com/search?aid=marker&roomQty=1'],
    ['kiwi', 'https://www.kiwi.com/hotels?affilid=marker&guests=2'],
    ['kiwi', 'https://www.kiwi.com/hotels?affilid=marker&CHILD_AGES=4%2C7'],
    ['trip', 'https://tp.media/r?marker=marker&u=https%3A%2F%2Fexample.test%2Fhotel%3Froom_qty%3D1'],
  ] as const)('rejects %s links that expose hidden occupancy defaults', (provider, href) => {
    expect(isAttributedHotelProviderUrl(provider, href)).toBe(false)
  })

  it.each([
    'https://tp.media/r?marker=marker&u=https%3A%2F%2Fwww.trip.com%2Fhotel%3Fchild_ages%255B%255D%3D4',
    'https://tp.media/r?marker=marker&U=https%3A%2F%2Fwww.trip.com%2Fhotel%3FroomQty%3D1',
    'https://www.booking.com/search?aid=marker&redirect_url=https%3A%2F%2Fwww.booking.com%2Fhotel%3Fguests%3D2',
    'https://www.kiwi.com/hotels?affilid=marker&target=https%3A%2F%2Fwww.kiwi.com%2Fhotel%3Fchildren%3D1',
  ])('rejects occupancy aliases inside nested provider URLs: %s', href => {
    const provider = href.includes('tp.media') ? 'trip' : href.includes('booking.com') ? 'booking' : 'kiwi'
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
