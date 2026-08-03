import { renderToStaticMarkup } from 'react-dom/server'
import { HotelDealCriteriaHandoff, roomHandoffVisibilityTransition } from '../HotelDealCriteria'
import type { HotelSearchCriteriaV1 } from '@/lib/hotels/searchCriteria'

const links = { expedia: 'https://www.expedia.com/hotel?affcid=marker' }
const deal = { id: 'deal-1', city: 'Paris', checkInDate: '2026-08-01' }
const matchedCriteria: HotelSearchCriteriaV1 = {
  schemaVersion: 1,
  criteriaVersion: 'v-12345678',
  destination: { state: 'selected', city: 'Paris' },
  dates: { semantic: 'checkin_window', dateFrom: '2026-08-01', dateTo: '2026-08-03' },
  occupancy: { state: 'not_captured' },
  source: 'deals_page',
}

describe('Hotel room inventory confidence', () => {
  it('reveals recovery only after an activated session goes hidden then visible', () => {
    expect(roomHandoffVisibilityTransition('armed', 'visible')).toBe('armed')
    const away = roomHandoffVisibilityTransition('armed', 'hidden')
    expect(away).toBe('away')
    expect(roomHandoffVisibilityTransition(away, 'visible')).toBe('returned')
  })

  it('keeps inventory unconfirmed and exposes missing dates, guests, and rooms', () => {
    const html = renderToStaticMarkup(
      <HotelDealCriteriaHandoff
        context={{ criteria: matchedCriteria, status: 'matched', backHref: '/deals' }}
        deal={deal}
        links={links}
        hotelName="Hotel Lumiere"
        datesIncomplete
      />,
    )

    expect(html).toContain('Room availability not checked by expaify')
    expect(html).toContain('choose or confirm dates, guests, and rooms')
    expect(html).toContain('Stay dates: confirm with provider')
    expect(html).toContain('Guests and rooms: choose with provider')
    expect(html).not.toContain('live availability')
  })

  it('shows complete known property and stay context without claiming room inventory', () => {
    const html = renderToStaticMarkup(
      <HotelDealCriteriaHandoff
        context={{ criteria: matchedCriteria, status: 'matched', backHref: '/deals' }}
        deal={{ ...deal, checkInDisplay: 'Aug 1, 2026', checkOutDisplay: 'Aug 3, 2026', nights: 2 }}
        links={links}
        hotelName="Hotel Lumiere"
        datesIncomplete={false}
      />,
    )

    expect(html).toContain('Hotel Lumiere · Paris')
    expect(html).toContain('Aug 1, 2026 – Aug 3, 2026 · 2 nights')
    expect(html).toContain('The provider will show current rooms and prices for your stay.')
    expect(html).not.toMatch(/Rooms available|Sold out|Only \d+ left/)
  })

  it('uses current deals recovery when prior criteria cannot be restored', () => {
    const html = renderToStaticMarkup(
      <HotelDealCriteriaHandoff
        context={{ status: 'missing', backHref: '/deals' }}
        deal={deal}
        links={{}}
      />,
    )

    expect(html).toContain('Provider link unavailable')
    expect(html).toContain('Your previous hotel search could not be restored. This hotel and any known dates are still shown above.')
    expect(html).toContain('Search current hotel deals')
    expect(html).toContain('href="/deals"')
    expect(html).not.toContain('Sold out')
  })

  it('discloses unrestorable criteria before an otherwise eligible provider handoff', () => {
    const html = renderToStaticMarkup(
      <HotelDealCriteriaHandoff
        context={{ status: 'invalid', backHref: '/deals' }}
        deal={deal}
        links={links}
        hotelName="Hotel Lumiere"
        datesIncomplete
      />,
    )

    const noticeIndex = html.indexOf('Your previous hotel search could not be restored.')
    const actionIndex = html.indexOf('Check rooms at Expedia')
    expect(noticeIndex).toBeGreaterThan(-1)
    expect(actionIndex).toBeGreaterThan(noticeIndex)
  })

  it('preserves the criteria-aware results URL when the saved context matches', () => {
    const html = renderToStaticMarkup(
      <HotelDealCriteriaHandoff
        context={{ criteria: matchedCriteria, status: 'matched', backHref: '/deals?criteriaVersion=v-12345678&city=Paris' }}
        deal={deal}
        links={{}}
      />,
    )

    expect(html).toContain('Back to matching hotels')
    expect(html).toContain('criteriaVersion=v-12345678')
    expect(html).toContain('city=Paris')
  })

  it('blocks provider activation when the restored criteria mismatch the deal', () => {
    const mismatchedCriteria: HotelSearchCriteriaV1 = {
      ...matchedCriteria,
      destination: { state: 'selected', city: 'Miami' },
    }
    const html = renderToStaticMarkup(
      <HotelDealCriteriaHandoff
        context={{ criteria: mismatchedCriteria, status: 'mismatch', backHref: '/deals?city=Miami' }}
        deal={deal}
        links={links}
      />,
    )

    expect(html).toContain('Review the search mismatch before checking rooms.')
    expect(html).not.toContain('data-hotel-provider')
  })
})
