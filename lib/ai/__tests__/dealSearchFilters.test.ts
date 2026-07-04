import { validateDealSearchFilters } from '../dealSearchFilters'

describe('validateDealSearchFilters', () => {
  it('accepts only the strict premium search schema', () => {
    expect(validateDealSearchFilters({
      destination_type: 'hotel',
      city: 'Miami',
      max_price: 150,
      min_stars: 4,
      min_discount: 30,
      date_from: '2026-09-01',
      date_to: '2026-09-07',
    })).toEqual({
      ok: true,
      filters: {
        destination_type: 'hotel',
        city: 'Miami',
        max_price: 150,
        min_stars: 4,
        min_discount: 30,
        date_from: '2026-09-01',
        date_to: '2026-09-07',
      },
    })
  })

  it('rejects unknown keys and unsupported cities before filters are used', () => {
    expect(validateDealSearchFilters({ city: 'Atlantis' })).toEqual({
      ok: false,
      reason: 'unsupported city',
    })
    expect(validateDealSearchFilters({ hotel_name: 'Injected Hotel' })).toEqual({
      ok: false,
      reason: 'unknown key: hotel_name',
    })
  })

  it('rejects malformed and reversed dates', () => {
    expect(validateDealSearchFilters({ date_from: '09/01/2026' })).toEqual({
      ok: false,
      reason: 'date_from must be YYYY-MM-DD',
    })
    expect(validateDealSearchFilters({ date_from: '2026-09-07', date_to: '2026-09-01' })).toEqual({
      ok: false,
      reason: 'date_to must be on or after date_from',
    })
  })
})
