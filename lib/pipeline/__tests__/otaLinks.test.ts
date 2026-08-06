import { buildOtaLinks } from '../otaLinks'

const OPTS = {
  hotelName: 'Harbour View Inn',
  city: 'Lisbon',
  checkIn: '2026-08-01',
  checkOut: '2026-08-03',
}

const AFFILIATE_ENV = ['HOTEL_AFFILIATE_ID', 'TP_AFFILIATE_MARKER'] as const

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
  // Confirmed live (2026-08-06) via the actual Travelpayouts dashboard: this
  // account has zero hotel programs subscribed -- trip.com is gated behind
  // Travelpayouts' own review, not a config value. A correctly-attributed
  // link was shipped once and every click landed on a Travelpayouts error
  // page instead of Trip.com. trip must stay undefined regardless of
  // affiliate env vars until REPAIR-TRAVELPAYOUTS-TRS-INVALID-01 resolves.
  it('never builds a trip.com link, even with a configured affiliate marker', () => {
    process.env.HOTEL_AFFILIATE_ID = 'hotel-marker'
    process.env.TP_AFFILIATE_MARKER = '744764'
    const links = buildOtaLinks(OPTS)

    expect(links.trip).toBeUndefined()
    expect(links.expedia).toBeUndefined()
    expect(links.booking).toBeUndefined()
    expect(links.kiwi).toBeUndefined()
  })

  // bookingSearchUrl is a real, working, zero-setup link that doesn't depend
  // on any affiliate credential -- must always be present regardless.
  it('always builds a real, working, unattributed Booking.com search link', () => {
    const links = buildOtaLinks(OPTS)
    expect(links.bookingSearchUrl).toBe(
      'https://www.booking.com/searchresults.html?ss=Harbour%20View%20Inn%20Lisbon&checkin=2026-08-01&checkout=2026-08-03'
    )
    // No occupancy default baked in -- never assert the snapshot's search
    // default (2 adults, 1 room) was the real traveler's party size.
    expect(links.bookingSearchUrl).not.toContain('adults')
    expect(links.bookingSearchUrl).not.toContain('rooms')
  })

  it('is unaffected by affiliate env vars being present or absent', () => {
    const withoutMarker = buildOtaLinks(OPTS)
    process.env.HOTEL_AFFILIATE_ID = 'hotel-marker'
    const withMarker = buildOtaLinks(OPTS)

    expect(withoutMarker).toEqual(withMarker)
  })
})
