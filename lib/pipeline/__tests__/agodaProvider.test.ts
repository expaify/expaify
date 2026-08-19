import { runSnapshotsForMarket } from '../snapshot'
import { query } from '../../db/client'

jest.mock('../../db/client', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}))

const PAR = { id: 4, city: 'Paris', country: 'FR', iata: 'PAR' }

describe('fetchAgoda (5th rotation provider, separate RAPIDAPI_KEY_3)', () => {
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

    // Agoda is index 4, so marketIndex 4 starts the rotation with it.
    const [result] = await runSnapshotsForMarket(PAR, 4)

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
    expect(insertCall?.[1]).toMatchObject({
      0: 'ag_98765',
      1: 'Hôtel Exemple Paris',
      2: 4,
      4: 'https://pix7.agoda.net/hotelImages/98765/main.jpg',
      8: 93848,
    })
  })
})
