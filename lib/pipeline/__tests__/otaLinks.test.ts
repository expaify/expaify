import { buildOtaLinks } from '../otaLinks'

const OPTS = {
  hotelName: 'Harbour View Inn',
  city: 'Lisbon',
  checkIn: '2026-08-01',
  checkOut: '2026-08-03',
}

const AFFILIATE_ENV = ['HOTEL_AFFILIATE_ID'] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of AFFILIATE_ENV) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of AFFILIATE_ENV) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('buildOtaLinks', () => {
  it('builds an attributed hotel handoff with the deal destination and dates', () => {
    process.env.HOTEL_AFFILIATE_ID = 'hotel-marker'
    const links = buildOtaLinks(OPTS)

    expect(links.expedia).toBeUndefined()
    expect(links.booking).toBeUndefined()
    expect(links.kiwi).toBeUndefined()
    expect(links.trip).toContain('trip.com')
    expect(links.trip).toContain('checkIn%3D2026-08-01')
    expect(links.trip).toContain('checkOut%3D2026-08-03')
    expect(links.trip).toContain(encodeURIComponent('Harbour View Inn Lisbon'))
  })

  it('omits outbound links when affiliate attribution is absent', () => {
    const links = buildOtaLinks(OPTS)
    expect(links).toEqual({ expedia: undefined, booking: undefined, kiwi: undefined, trip: undefined })
  })

  it('uses only the approved hotel affiliate marker and exposes no occupancy default', () => {
    process.env.HOTEL_AFFILIATE_ID = 'hotel-marker'

    const links = buildOtaLinks(OPTS)

    expect(links.trip).toContain('marker=hotel-marker')
    expect(Object.values(links).filter(Boolean).join('')).not.toContain('adults=')
  })
})
