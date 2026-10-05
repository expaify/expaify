import { fetchHotelAmenities, isBookingSourcedHotelId } from '../hotelAmenities'

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}))

const { cache } = jest.requireMock('../../cache/redis') as {
  cache: { get: jest.Mock; set: jest.Mock }
}

describe('isBookingSourcedHotelId', () => {
  it('recognizes a real bk_ prefixed id', () => {
    expect(isBookingSourcedHotelId('bk_59421')).toBe(true)
  })
  it('rejects a TripAdvisor-sourced id', () => {
    expect(isBookingSourcedHotelId('ta_123')).toBe(false)
  })
  it('rejects an Agoda-sourced id', () => {
    expect(isBookingSourcedHotelId('ag_456')).toBe(false)
  })
})

describe('fetchHotelAmenities', () => {
  const originalKey = process.env.RAPIDAPI_KEY

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key'
    global.fetch = jest.fn()
    jest.clearAllMocks()
    cache.get.mockResolvedValue(null)
    cache.set.mockResolvedValue(undefined)
  })

  afterAll(() => {
    process.env.RAPIDAPI_KEY = originalKey
  })

  it('returns a real failure, not a crash, for a non-booking id -- no real facilities to fetch', async () => {
    const result = await fetchHotelAmenities('ta_123', '2026-10-15', '2026-10-17')
    expect(result).toEqual({ ok: false, reason: 'not a booking.com-sourced hotel id' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('strips the bk_ prefix and calls the real getHotelDetails endpoint with the raw provider id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { facilities_block: { facilities: [{ name: 'Free WiFi', icon: 'wifi' }] } } }),
    })

    await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('getHotelDetails')
    expect(url).toContain('hotel_id=59421')
    expect(url).not.toContain('hotel_id=bk_59421')
    expect(options.headers).toMatchObject({
      'X-RapidAPI-Key': 'test-key',
      'X-RapidAPI-Host': 'booking-com15.p.rapidapi.com',
    })
  })

  it('returns real amenities with name and icon, never fabricated', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          facilities_block: {
            facilities: [
              { name: '2 swimming pools', icon: 'pool' },
              { name: 'Free WiFi', icon: 'wifi' },
            ],
          },
        },
      }),
    })

    const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

    expect(result).toEqual({
      ok: true,
      data: [
        { name: '2 swimming pools', icon: 'pool' },
        { name: 'Free WiFi', icon: 'wifi' },
      ],
    })
  })

  it('drops a facility with a missing/blank name rather than showing an empty row', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          facilities_block: {
            facilities: [
              { name: 'Free WiFi', icon: 'wifi' },
              { name: '  ', icon: 'blank' },
              { icon: 'missing-name' },
            ],
          },
        },
      }),
    })

    const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

    expect(result).toEqual({ ok: true, data: [{ name: 'Free WiFi', icon: 'wifi' }] })
  })

  it('returns a real failure (never an empty success) when the provider sends no facilities at all', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    })

    const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

    expect(result.ok).toBe(false)
  })

  it('returns a real failure, never throws, on a 429', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })

    const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

    expect(result).toEqual({ ok: false, reason: 'rate limited (429)' })
  })

  it('returns a real failure, never throws, on a network error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNRESET'))

    const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

    expect(result).toEqual({ ok: false, reason: 'ECONNRESET' })
  })

  it('returns a real failure when RAPIDAPI_KEY is not configured', async () => {
    delete process.env.RAPIDAPI_KEY

    const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

    expect(result).toEqual({ ok: false, reason: 'RAPIDAPI_KEY not configured' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  describe('caching (a popular deal page must not re-hit RapidAPI on every visitor)', () => {
    it('serves a cache hit without ever calling fetch', async () => {
      const cachedResult = { ok: true as const, data: [{ name: 'Cached Pool', icon: 'pool' }] }
      cache.get.mockResolvedValueOnce(cachedResult)

      const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

      expect(result).toEqual(cachedResult)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('looks up the cache keyed by hotel id only, independent of stay dates', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { facilities_block: { facilities: [{ name: 'Free WiFi', icon: 'wifi' }] } } }),
      })
      await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')
      expect(cache.get).toHaveBeenCalledWith('hotel-amenities:bk_59421')
    })

    it('caches a real successful result for future requests', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { facilities_block: { facilities: [{ name: 'Free WiFi', icon: 'wifi' }] } } }),
      })

      const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

      expect(cache.set).toHaveBeenCalledWith('hotel-amenities:bk_59421', result, 21_600)
    })

    it('caches the honest "no facilities" outcome, not just a success', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: {} }) })

      const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

      expect(cache.set).toHaveBeenCalledWith('hotel-amenities:bk_59421', result, 21_600)
    })

    it('does not cache a transient 429 -- an outage must self-heal on the next request', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })

      await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

      expect(cache.set).not.toHaveBeenCalled()
    })

    it('does not cache a network error', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNRESET'))

      await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

      expect(cache.set).not.toHaveBeenCalled()
    })

    it('falls through to a real fetch, never throws, when the cache backend itself is unavailable', async () => {
      cache.get.mockRejectedValueOnce(new Error('ECONNREFUSED'))
      cache.set.mockRejectedValueOnce(new Error('ECONNREFUSED'))
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { facilities_block: { facilities: [{ name: 'Free WiFi', icon: 'wifi' }] } } }),
      })

      const result = await fetchHotelAmenities('bk_59421', '2026-10-15', '2026-10-17')

      expect(result).toEqual({ ok: true, data: [{ name: 'Free WiFi', icon: 'wifi' }] })
    })
  })
})
