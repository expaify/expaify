import { renderToStaticMarkup } from 'react-dom/server'
import { DealCard } from '../ui/DealCard'
import {
  HotelPoolEvidenceLedger,
  getHotelPoolCardSummary,
  hotelPoolAnalyticsContext,
  hotelPoolDetailAnalyticsContext,
  hotelPoolViewportGroup,
} from '../ui/HotelPoolEvidenceLedger'
import {
  HOTEL_POOL_FIXTURE_IDS,
  createHotelPoolFixture,
  parseHotelPoolFixture,
} from '../research/hotelPoolFixtures'

const checkIn = '2026-08-10'
const checkOut = '2026-08-14'

describe('hotel pool operating-status research prototype', () => {
  it.each([
    ['indoor_year_round_heated_full', 'Indoor pool schedule covers your stay'],
    ['outdoor_seasonal_full', 'Outdoor pool schedule covers your stay'],
    ['seasonal_partial', 'Pool schedule covers part of your stay'],
    ['seasonal_none', 'Pool schedule does not cover your full stay'],
    ['seasonal_dates_missing', 'Seasonal outdoor pool · dates not provided'],
    ['multiple_mixed', 'Indoor pool schedule covers your stay · 2 pools disclosed'],
    ['temporary_closure_overlap', 'Pool details need confirmation'],
    ['stale', 'Pool details need confirmation'],
    ['conflicting', 'Pool details need confirmation'],
  ] as const)('maps %s to deterministic card copy', (id, copy) => {
    expect(getHotelPoolCardSummary(createHotelPoolFixture(id, checkIn, checkOut))?.copy).toBe(copy)
  })

  it.each(['not_returned', 'check_failed'] as const)('suppresses the %s state on cards', id => {
    expect(getHotelPoolCardSummary(createHotelPoolFixture(id, checkIn, checkOut))).toBeNull()
  })

  it('preserves per-pool identity, semantic order, source attribution, and the live-status boundary', () => {
    const html = renderToStaticMarkup(<HotelPoolEvidenceLedger evidence={createHotelPoolFixture('multiple_mixed', checkIn, checkOut)} />)

    expect(html).toContain('aria-label="Provider-disclosed pools"')
    expect(html).toContain('Indoor pool</h4>')
    expect(html).toContain('Terrace pool</h4>')
    expect(html.indexOf('Indoor pool</h4>')).toBeLessThan(html.indexOf('Terrace pool</h4>'))
    expect(html).toContain('Disclosed by Research booking provider')
    expect(html).toContain('does not confirm day-of-stay opening')
    expect(html).not.toMatch(/Open now|Available for your stay|Guaranteed/)
  })

  it('places a temporary closure before ordinary schedule evidence without calling the pool closed generally', () => {
    const html = renderToStaticMarkup(<HotelPoolEvidenceLedger evidence={createHotelPoolFixture('temporary_closure_overlap', checkIn, checkOut)} />)
    expect(html.indexOf('Provider reports this pool closed')).toBeLessThan(html.indexOf('stay is within the disclosed'))
    expect(html).toContain('Research fixture')
  })

  it('renders loading, missing, failed, malformed, conflict, and stale states without removing the boundary', () => {
    for (const id of ['not_returned', 'check_failed', 'malformed_interval', 'conflicting', 'stale'] as const) {
      const html = renderToStaticMarkup(<HotelPoolEvidenceLedger evidence={createHotelPoolFixture(id, checkIn, checkOut)} />)
      expect(html).toContain('Confirm current conditions with the property or booking provider.')
    }
    const loading = { ...createHotelPoolFixture('not_returned', checkIn, checkOut), state: 'loading' as const }
    const loadingHtml = renderToStaticMarkup(<HotelPoolEvidenceLedger evidence={loading} />)
    expect(loadingHtml).toContain('aria-busy="true"')
    expect(loadingHtml).toContain('aria-live="polite"')
    expect(loadingHtml.match(/skeleton/g)?.length).toBe(6)
  })

  it('keeps missing heat distinct from not heated and omits a live claim', () => {
    const html = renderToStaticMarkup(<HotelPoolEvidenceLedger evidence={createHotelPoolFixture('indoor_heat_unknown', checkIn, checkOut)} />)
    expect(html).toContain('Heated status not provided')
    expect(html).not.toContain('Not heated')
    expect(html).not.toMatch(/Open|Available/)
  })

  it('adds the exact pool cue once to the full-card accessible name without a nested control', () => {
    const html = renderToStaticMarkup(<DealCard
      href="/deals/deal-1"
      poolEvidence={createHotelPoolFixture('multiple_mixed', checkIn, checkOut)}
      deal={{
        id: 'deal-1', hotelName: 'Harbor Hotel', city: 'Miami', stars: 4,
        dealPrice: { priceCents: 12500, currency: 'USD' }, medianPrice: { priceCents: 18000, currency: 'USD' },
        discountPct: 31, checkInWindow: 'Aug 10–14', snapshotCount: 20, links: {}, updatedAt: '2026-08-03T12:00:00Z',
      }}
    />)
    expect(html).toContain('Pool detail: Indoor pool schedule covers your stay · 2 pools disclosed.')
    expect(html.match(/<a(?: |>)/g)?.length).toBe(1)
    expect(html).not.toContain('<button')
  })

  it('accepts only the typed fixture enum and buckets analytics without raw ids, dates, or revisions', () => {
    expect(HOTEL_POOL_FIXTURE_IDS).toHaveLength(16)
    expect(parseHotelPoolFixture('multiple_mixed')).toBe('multiple_mixed')
    expect(parseHotelPoolFixture('<script>')).toBeNull()
    const context = hotelPoolAnalyticsContext(createHotelPoolFixture('multiple_mixed', checkIn, checkOut))
    expect(context).toEqual({ evidence_state: 'ready', stay_relation: 'mixed', pool_count_bucket: '2', evidence_revision: 'saved' })
    expect(JSON.stringify(context)).not.toMatch(/pool-fixture|2026-08|indoor-main/)
    expect(hotelPoolDetailAnalyticsContext(createHotelPoolFixture('multiple_mixed', checkIn, checkOut), Date.parse('2026-08-03T20:00:00Z'))?.source_freshness_bucket).toBe('under_24h')
    expect(hotelPoolViewportGroup(375)).toBe('mobile_375')
    expect(hotelPoolViewportGroup(1280)).toBe('desktop_1280')
    expect(hotelPoolAnalyticsContext({ ...createHotelPoolFixture('not_returned', checkIn, checkOut), state: 'loading' })).toBeNull()
  })
})
