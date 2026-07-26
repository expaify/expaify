import { renderToStaticMarkup } from 'react-dom/server'
import {
  HotelCriteriaContextCard,
  HotelCriteriaMismatchAlert,
  HotelCriteriaSummarySkeleton,
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
    expect(html).toContain('Paris. Check in Sep 10–13. Guests and rooms not captured.')
    expect(html).toContain('aria-label="Edit hotel search"')
    expect(html).not.toMatch(/2 adults|1 room|Matches your party/)
  })

  it('keeps the last applied summary visible and disables Edit while updating', () => {
    const html = renderToStaticMarkup(
      <HotelSearchCriteriaSummary criteria={criteria} surface="results" status="updating" onEdit={() => undefined} />,
    )

    expect(html).toContain('Paris. Check in Sep 10–13. Guests and rooms not captured.')
    expect(html).toContain('Updating results…')
    expect(html).toContain('aria-atomic="true"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Edit hotel search"/)
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

  it('does not partially restore invalid detail context', () => {
    const html = renderToStaticMarkup(<HotelCriteriaContextCard status="invalid" />)

    expect(html).toContain('Search criteria couldn&#x27;t be restored')
    expect(html).toContain('Start a new search')
    expect(html).not.toContain('Paris')
  })

  it('blocks provider continuation for a known criteria mismatch', () => {
    const html = renderToStaticMarkup(
      <HotelCriteriaMismatchAlert onEdit={() => undefined} backHref="/deals?criteria=criteria-test" />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('This deal doesn&#x27;t match your search.')
    expect(html).toContain('Back to matching results')
    expect(html).toContain('Provider options are unavailable until you review the mismatch.')
  })

  it('announces criteria restoration without exposing skeleton decoration', () => {
    const html = renderToStaticMarkup(<HotelCriteriaSummarySkeleton />)

    expect(html).toContain('role="status"')
    expect(html).toContain('Restoring your search…')
    expect(html).toContain('aria-hidden="true"')
  })
})
