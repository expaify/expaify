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

  it('omits attributed outbound links when affiliate attribution is absent, but keeps the real unattributed fallback', () => {
    const links = buildOtaLinks(OPTS)
    expect(links.expedia).toBeUndefined()
    expect(links.booking).toBeUndefined()
    expect(links.kiwi).toBeUndefined()
    expect(links.trip).toBeUndefined()
    expect(links.bookingSearchUrl).toContain('booking.com/searchresults.html')
  })

  // Confirmed live (2026-08-06): this account has no hotel programs approved
  // by Travelpayouts at all, so `trip` 404s/errors regardless of marker.
  // bookingSearchUrl is a real, working, zero-setup link that doesn't depend
  // on any affiliate credential -- must always be present.
  it('always builds a real, working, unattributed Booking.com search link regardless of affiliate config', () => {
    const links = buildOtaLinks(OPTS)
    expect(links.bookingSearchUrl).toBe(
      'https://www.booking.com/searchresults.html?ss=Harbour%20View%20Inn%20Lisbon&checkin=2026-08-01&checkout=2026-08-03'
    )
    // No occupancy default baked in -- same honesty rule as the attributed trip link.
    expect(links.bookingSearchUrl).not.toContain('adults')
    expect(links.bookingSearchUrl).not.toContain('rooms')
  })

  // deploy.yml only ever provisions TP_AFFILIATE_MARKER as a secret --
  // HOTEL_AFFILIATE_ID has never been set in any real deployment. Without
  // this fallback every real deal's booking link silently never rendered.
  it('falls back to TP_AFFILIATE_MARKER when HOTEL_AFFILIATE_ID is unset', () => {
    process.env.TP_AFFILIATE_MARKER = '744764'
    const links = buildOtaLinks(OPTS)

    expect(links.trip).toContain('marker=744764')
    expect(links.trip).toContain('trip.com')
  })

  it('prefers HOTEL_AFFILIATE_ID over TP_AFFILIATE_MARKER when both are set', () => {
    process.env.HOTEL_AFFILIATE_ID = 'hotel-marker'
    process.env.TP_AFFILIATE_MARKER = '744764'
    const links = buildOtaLinks(OPTS)

    expect(links.trip).toContain('marker=hotel-marker')
    expect(links.trip).not.toContain('marker=744764')
  })

  it('uses only the approved hotel affiliate marker and exposes no occupancy default', () => {
    process.env.HOTEL_AFFILIATE_ID = 'hotel-marker'

    const links = buildOtaLinks(OPTS)

    expect(links.trip).toContain('marker=hotel-marker')
    expect(Object.values(links).filter(Boolean).join('')).not.toContain('adults=')
  })
})
