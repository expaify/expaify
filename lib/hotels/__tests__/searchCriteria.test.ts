import {
  formatHotelCriteriaDates,
  hotelCriteriaFromDraft,
  hotelCriteriaToDraft,
  isValidHotelDate,
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
})
