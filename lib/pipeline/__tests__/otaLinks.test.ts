import { buildOtaLinks } from '../otaLinks'

const OPTS = {
  hotelName: 'Harbour View Inn',
  city: 'Lisbon',
  checkIn: '2026-08-01',
  checkOut: '2026-08-03',
}

const AFFILIATE_ENV = ['EXPEDIA_AFFILIATE_ID', 'BOOKING_AFFILIATE_ID', 'KIWI_AFFILIATE_ID', 'TP_AFFILIATE_MARKER'] as const

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
  it('builds attributed OTA links with the deal destination and dates', () => {
    process.env.EXPEDIA_AFFILIATE_ID = 'exp-123'
    process.env.BOOKING_AFFILIATE_ID = 'bk-456'
    process.env.KIWI_AFFILIATE_ID = 'kw-789'
    process.env.TP_AFFILIATE_MARKER = 'tp-marker'
    const links = buildOtaLinks(OPTS)

    expect(links.expedia).toContain('expedia.com')
    expect(links.booking).toContain('booking.com')
    expect(links.kiwi).toContain('kiwi.com')
    expect(links.trip).toContain('trip.com')

    expect(links.expedia).toContain('startDate=2026-08-01')
    expect(links.expedia).toContain('endDate=2026-08-03')
    expect(links.booking).toContain('checkin=2026-08-01')
    expect(links.booking).toContain('checkout=2026-08-03')
    expect(links.expedia).toContain(encodeURIComponent('Harbour View Inn Lisbon'))
  })

  it('omits outbound links when affiliate attribution is absent', () => {
    const links = buildOtaLinks(OPTS)
    expect(links).toEqual({ expedia: undefined, booking: undefined, kiwi: undefined, trip: undefined })
  })

  it('appends affiliate params when env placeholders are present', () => {
    process.env.EXPEDIA_AFFILIATE_ID = 'exp-123'
    process.env.BOOKING_AFFILIATE_ID = 'bk-456'
    process.env.KIWI_AFFILIATE_ID = 'kw-789'
    process.env.TP_AFFILIATE_MARKER = 'tp-marker'

    const links = buildOtaLinks(OPTS)

    expect(links.expedia).toContain('affcid=exp-123')
    expect(links.booking).toContain('aid=bk-456')
    expect(links.kiwi).toContain('affilid=kw-789')
    expect(links.trip).toContain('marker=tp-marker')
    expect(links.kiwi).not.toContain('adults=')
  })
})
