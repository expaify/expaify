import {
  formatHotelCriteriaDates,
  hotelCriteriaFromDraft,
  hotelCriteriaToDraft,
  isValidHotelDate,
  buildHotelResultsUrl,
  buildHotelBackUrl,
  buildHotelDestinationUrl,
  hotelCriteriaContextStatus,
  resolveHotelResultsView,
  resolveHotelSearchCriteria,
} from '../searchCriteria'

describe('HotelSearchCriteriaV1', () => {
  it('formats check-in windows without implying an exact stay', () => {
    expect(formatHotelCriteriaDates({ semantic: 'checkin_window', dateFrom: '2026-09-10', dateTo: '2026-09-13' })).toBe('Check in Sep 10–13')
    expect(formatHotelCriteriaDates({ semantic: 'checkin_window', dateFrom: '2026-09-28', dateTo: '2026-10-03' })).toBe('Check in Sep 28–Oct 3')
    expect(formatHotelCriteriaDates({ semantic: 'checkin_window', dateFrom: '2026-12-28', dateTo: '2027-01-03' })).toBe('Check in Dec 28, 2026–Jan 3, 2027')
  })

  it('formats missing and one-sided bounds truthfully', () => {
    expect(formatHotelCriteriaDates({ semantic: 'missing' })).toBe('Any check-in date')
    expect(formatHotelCriteriaDates({ semantic: 'checkin_window', dateFrom: '2026-09-10' })).toBe('Check in on or after Sep 10')
    expect(formatHotelCriteriaDates({ semantic: 'checkin_window', dateTo: '2026-09-13' })).toBe('Check in by Sep 13')
  })

  it('never inserts acquisition occupancy defaults', () => {
    const criteria = hotelCriteriaFromDraft({ city: 'Paris', dateFrom: '', dateTo: '' }, 'v1')
    expect(criteria.occupancy).toEqual({ state: 'not_captured' })
    expect(hotelCriteriaToDraft(criteria)).toEqual({ city: 'Paris', dateFrom: '', dateTo: '' })
  })

  it('rejects impossible calendar dates', () => {
    expect(isValidHotelDate('2026-02-29')).toBe(false)
    expect(isValidHotelDate('2026-02-28')).toBe(true)
    expect(isValidHotelDate('')).toBe(true)
  })

  it('round-trips bounded canonical URL criteria without occupancy defaults', () => {
    const criteria = hotelCriteriaFromDraft(
      { city: 'Paris', dateFrom: '2026-09-10', dateTo: '2026-09-13' },
      '785d80de-8954-46c7-90f7-a4a04f719e5f',
      'edit',
    )
    const url = buildHotelResultsUrl(criteria, { minDiscount: 30, maxPriceCents: 20_000, minStars: 4, sort: 'price' })
    const params = new URL(url, 'https://expaify.test').searchParams

    expect(resolveHotelSearchCriteria(params)).toEqual({ status: 'valid', criteria })
    expect(resolveHotelResultsView(params)).toEqual({ minDiscount: 30, maxPriceCents: 20_000, minStars: 4, sort: 'price' })
    expect(params.has('adults')).toBe(false)
    expect(params.has('rooms')).toBe(false)
  })

  it.each([
    'criteriaSchema=2&criteriaVersion=785d80de-8954-46c7-90f7-a4a04f719e5f',
    'criteriaSchema=1&criteriaVersion=short',
    'criteriaSchema=1&criteriaVersion=785d80de-8954-46c7-90f7-a4a04f719e5f&city=Atlantis',
    'criteriaSchema=1&criteriaVersion=785d80de-8954-46c7-90f7-a4a04f719e5f&date_from=2026-09-14&date_to=2026-09-13',
    'criteriaSchema=1&criteriaVersion=785d80de-8954-46c7-90f7-a4a04f719e5f&adults=2',
    'criteriaSchema=1&criteriaVersion=785d80de-8954-46c7-90f7-a4a04f719e5f&market_id=7',
    'criteriaSchema=1&criteriaVersion=785d80de-8954-46c7-90f7-a4a04f719e5f&criteriaVersion=8ba2a25d-a48d-46f5-a434-86bd9039321f',
  ])('rejects malformed or occupancy-bearing context: %s', query => {
    expect(resolveHotelSearchCriteria(new URLSearchParams(query))).toEqual({ status: 'invalid' })
  })

  it.each(['criteriaSource', 'city', 'date_from', 'date_to'])(
    'rejects duplicate %s values from Next.js server search params',
    key => {
      expect(resolveHotelSearchCriteria({
        criteriaSchema: '1',
        criteriaVersion: '785d80de-8954-46c7-90f7-a4a04f719e5f',
        [key]: ['Paris', 'Rome'],
      })).toEqual({ status: 'invalid' })
    },
  )

  it('classifies destination and check-in matches without comparing checkout', () => {
    const criteria = hotelCriteriaFromDraft(
      { city: 'Paris', dateFrom: '2026-09-10', dateTo: '2026-09-13' },
      '785d80de-8954-46c7-90f7-a4a04f719e5f',
    )
    expect(hotelCriteriaContextStatus(criteria, { city: 'Paris', checkInDate: '2026-09-13' })).toBe('matched')
    expect(hotelCriteriaContextStatus(criteria, { city: 'Rome', checkInDate: '2026-09-13' })).toBe('mismatch')
    expect(hotelCriteriaContextStatus(criteria, { city: 'Paris', checkInDate: '2026-09-14' })).toBe('mismatch')
  })

  it('preserves a validated destination-page origin through detail and Back', () => {
    const criteria = hotelCriteriaFromDraft(
      { city: 'New York', dateFrom: '2026-09-10', dateTo: '' },
      '785d80de-8954-46c7-90f7-a4a04f719e5f',
      'destination_page',
    )
    const view = { minDiscount: 30, maxPriceCents: null, minStars: 4, sort: 'price' as const }
    const destinationUrl = buildHotelDestinationUrl(criteria, view)
    const params = new URL(destinationUrl, 'https://expaify.test').searchParams

    expect(destinationUrl).toContain('/destinations/new-york?')
    expect(params.get('criteriaReturn')).toBe('destination')
    expect(buildHotelBackUrl(criteria, view, params)).toBe(destinationUrl)
  })

  it('rejects ambiguous duplicate results-view parameters', () => {
    expect(resolveHotelResultsView(new URLSearchParams('sort=price&sort=newest'))).toBeNull()
    expect(resolveHotelResultsView({ sort: ['price', 'newest'] })).toBeNull()
  })
})
