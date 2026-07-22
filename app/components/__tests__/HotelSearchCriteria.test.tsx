import { renderToStaticMarkup } from 'react-dom/server'
import {
  HotelCriteriaContextCard,
  HotelSearchCriteriaEditor,
  HotelSearchCriteriaSummary,
} from '../HotelSearchCriteria'
import type { HotelSearchCriteriaV1 } from '@/lib/hotels/searchCriteria'

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const criteria: HotelSearchCriteriaV1 = {
  schemaVersion: 1,
  criteriaVersion: 'criteria-test',
  destination: { state: 'selected', city: 'Paris' },
  dates: { semantic: 'checkin_window', dateFrom: '2026-09-10', dateTo: '2026-09-13' },
  occupancy: { state: 'not_captured' },
  source: 'restored',
}

describe('HotelSearchCriteria UI', () => {
  it('presents truthful check-in and occupancy context without hidden acquisition defaults', () => {
    const html = renderToStaticMarkup(
      <HotelSearchCriteriaSummary criteria={criteria} surface="results" onEdit={() => undefined} />,
    )

    expect(html).toContain('Your search')
    expect(html).toContain('Paris')
    expect(html).toContain('Check in Sep 10–13')
    expect(html).toContain('Guests &amp; rooms not captured')
    expect(html).toContain('aria-label="Guests and rooms not captured."')
    expect(html).toContain('aria-label="Edit hotel search"')
    expect(html).not.toMatch(/2 adults|1 room|Matches your party/)
  })

  it('keeps occupancy read-only in the atomic editor', () => {
    const html = renderToStaticMarkup(
      <HotelSearchCriteriaEditor
        open
        criteria={criteria}
        cities={['Paris', 'Rome']}
        surface="results"
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('Check-in window')
    expect(html).toContain('Guests &amp; rooms')
    expect(html).toContain('Not captured')
    expect(html).toContain('Update results')
    expect(html).not.toMatch(/Adults|Children|Rooms/)
  })

  it('repeats missing context immediately before provider handoff', () => {
    const html = renderToStaticMarkup(<HotelCriteriaContextCard status="missing" handoff />)

    expect(html).toContain('Search criteria unavailable')
    expect(html).toContain('confirm the price and room fit with the provider')
    expect(html).not.toContain('Search hotel deals')
  })
})
