import { renderToStaticMarkup } from 'react-dom/server'
import { HotelDealCriteriaHandoff } from '../HotelDealCriteria'
import type { HotelCriteriaContextStatus, HotelSearchCriteriaV1 } from '@/lib/hotels/searchCriteria'

const links = { expedia: 'https://www.expedia.com/hotel?affcid=marker' }

const matchedCriteria: HotelSearchCriteriaV1 = {
  schemaVersion: 1,
  criteriaVersion: 'v-12345678',
  destination: { state: 'selected', city: 'Paris' },
  dates: { semantic: 'checkin_window', dateFrom: '2026-08-01', dateTo: '2026-08-03' },
  occupancy: { state: 'not_captured' },
  source: 'deals_page',
}

function context(criteria?: HotelSearchCriteriaV1, status: HotelCriteriaContextStatus = 'missing') {
  return { criteria, status, backHref: '/deals' }
}

const deal = { id: 'deal-1', city: 'Paris', checkInDate: '2026-08-01' }

describe('HotelDealCriteriaHandoff saved-deal date boundary copy', () => {
  it('shows the choose-dates sentence when the saved deal has incomplete dates, even with matched search criteria', () => {
    const tree = renderToStaticMarkup(<HotelDealCriteriaHandoff
      context={context(matchedCriteria, 'matched')}
      deal={{ ...deal, checkInDisplay: 'Aug 1, 2026', checkOutDisplay: 'Aug 3, 2026', nights: 2 }}
      links={links}
      datesIncomplete
    />)

    expect(tree).toContain('choose or confirm dates, guests, and rooms')
  })

  it('omits the choose-dates sentence when the saved deal has complete dates and matched search criteria', () => {
    const tree = renderToStaticMarkup(<HotelDealCriteriaHandoff
      context={context(matchedCriteria, 'matched')}
      deal={{ ...deal, checkInDisplay: 'Aug 1, 2026', checkOutDisplay: 'Aug 3, 2026', nights: 2 }}
      links={links}
      datesIncomplete={false}
    />)

    expect(tree).not.toContain('choose or confirm dates, guests, and rooms')
  })

  it('shows the choose-dates sentence when there is no search criteria context at all', () => {
    const tree = renderToStaticMarkup(<HotelDealCriteriaHandoff
      context={context(undefined, 'missing')}
      deal={deal}
      links={links}
    />)

    expect(tree).toContain('choose or confirm dates, guests, and rooms')
  })
})
