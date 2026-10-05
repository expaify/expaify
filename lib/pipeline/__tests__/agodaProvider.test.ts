import { runSnapshotsForMarket, upgradeAgodaPhotoSize } from '../snapshot'
import { query } from '../../db/client'

jest.mock('../../db/client', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}))

const PAR = { id: 4, city: 'Paris', country: 'FR', iata: 'PAR' }

describe('fetchAgoda (4th rotation provider, separate RAPIDAPI_KEY_3)', () => {
  const originalSharedKey = process.env.RAPIDAPI_KEY
  const originalAgodaKey = process.env.RAPIDAPI_KEY_3

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-shared-key'
    process.env.RAPIDAPI_KEY_3 = 'test-agoda-key'
    global.fetch = jest.fn()
    ;(query as jest.Mock).mockClear()
  })

  afterAll(() => {
    process.env.RAPIDAPI_KEY = originalSharedKey
    process.env.RAPIDAPI_KEY_3 = originalAgodaKey
  })

  it('keeps only usable inclusive-price properties and normalizes protocol-relative photos', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          citySearch: {
            properties: [
              {
                propertyId: 98765,
                propertyResultType: 'Property',
                content: {
                  informationSummary: { localeName: 'Hôtel Exemple Paris', defaultName: 'Example Hotel Paris', rating: 4 },
                  images: { hotelImages: [{ urls: [{ value: '//pix7.agoda.net/hotelImages/98765/main.jpg' }] }] },
                },
                pricing: { offers: [{ roomOffers: [{ room: { pricing: [{ price: {
                  perRoomPerNight: {
                    exclusive: { display: 759.21 },
                    inclusive: { display: 938.48 },
                  },
                } }] } }] }] },
              },
              {
                propertyId: 111,
                propertyResultType: 'SoldOutProperty',
                content: { informationSummary: { localeName: 'Sold Out Paris', rating: 5 } },
              },
              {
                propertyId: 222,
                propertyResultType: 'Property',
                content: { informationSummary: { localeName: 'Teaser Only Hotel', rating: 3 } },
                pricing: { offers: [{ roomOffers: [{ room: { pricing: [{ price: {
                  perRoomPerNight: { exclusive: { display: 80.25 } },
                } }] } }] }] },
              },
            ],
          },
        },
      }),
    })

    // Agoda is index 3, so marketIndex 3 starts the rotation with it.
    const [result] = await runSnapshotsForMarket(PAR, 3)

    expect(result.hotelsProcessed).toBe(1)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('agoda-com.p.rapidapi.com/hotels/search-overnight')
    expect(url).toContain('id=1_15470')
    expect(url).toContain('checkinDate=')
    expect(url).toContain('checkoutDate=')
    expect(options.headers).toMatchObject({
      'X-RapidAPI-Key': 'test-agoda-key',
      'X-RapidAPI-Host': 'agoda-com.p.rapidapi.com',
    })

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    // storeSnapshot's param order: 0=hotel_id,1=hotel_name,2=stars,
    // 3=review_evidence,4=photo_url,5=photo_urls,6=market_id,7=check_in,
    // 8=nights,9=price_cents,10=is_mock -- price_cents moved from index 8 to
    // 9 when photo_urls was added at index 5 (2026-10-02). Also asserts the
    // new photo_urls array itself is real (every distinct hotelImages[]
    // entry's urls[0], protocol-normalized), not just the first photo_url.
    expect(insertCall?.[1]).toMatchObject({
      0: 'ag_98765',
      1: 'Hôtel Exemple Paris',
      2: 4,
      4: 'https://pix7.agoda.net/hotelImages/98765/main.jpg',
      5: ['https://pix7.agoda.net/hotelImages/98765/main.jpg'],
      9: 93848,
    })
  })

  // 2026-10-05: real, user-reported blur bug. Agoda's own response only
  // ever includes a thumbnail-sized photo url -- confirmed live, always
  // either a `s=300x300` query param (pix7.agoda.net) or a `/maxNNN/` path
  // segment (the shared bstatic.com CDN Booking.com also uses). Fixed by
  // requesting a larger size through the SAME real URL, confirmed live to
  // actually return a bigger file (not a capped/ignored parameter).
  it('stores the upgraded, larger photo size for a real agoda-shaped thumbnail URL', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          citySearch: {
            properties: [{
              propertyId: 98765,
              propertyResultType: 'Property',
              content: {
                informationSummary: { localeName: 'Real Shaped Hotel', rating: 4 },
                images: { hotelImages: [
                  { urls: [{ value: '//pix7.agoda.net/hotelImages/98765/photo.jpg?ce=3&s=300x300' }] },
                  { urls: [{ value: '//q-xx.bstatic.com/xdata/images/hotel/max300/555.jpg?k=abc&o=' }] },
                ] },
              },
              pricing: { offers: [{ roomOffers: [{ room: { pricing: [{ price: {
                perRoomPerNight: { inclusive: { display: 200 } },
              } }] } }] }] },
            }],
          },
        },
      }),
    })

    await runSnapshotsForMarket(PAR, 3)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    expect(insertCall?.[1]?.[5]).toEqual([
      'https://pix7.agoda.net/hotelImages/98765/photo.jpg?ce=3&s=1024x768',
      'https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/555.jpg?k=abc&o=',
    ])
  })
})

describe('upgradeAgodaPhotoSize', () => {
  it('upgrades a pix7.agoda.net s=WxH query param to a larger real size', () => {
    expect(upgradeAgodaPhotoSize('https://pix7.agoda.net/hotelImages/1/a.jpg?ce=3&s=300x300'))
      .toBe('https://pix7.agoda.net/hotelImages/1/a.jpg?ce=3&s=1024x768')
  })

  it('upgrades a bstatic.com /maxNNN/ path segment to a larger real size', () => {
    expect(upgradeAgodaPhotoSize('https://q-xx.bstatic.com/xdata/images/hotel/max300/1.jpg?k=abc'))
      .toBe('https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/1.jpg?k=abc')
  })

  it('upgrades a bstatic.com /maxNNNxNNN/ path segment too', () => {
    expect(upgradeAgodaPhotoSize('https://q-xx.bstatic.com/xdata/images/hotel/max300x200/1.jpg'))
      .toBe('https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/1.jpg')
  })

  it('leaves an unrecognized URL shape completely unchanged, never guesses', () => {
    const url = 'https://example.com/some/other/cdn/pattern/photo.jpg'
    expect(upgradeAgodaPhotoSize(url)).toBe(url)
  })
})
