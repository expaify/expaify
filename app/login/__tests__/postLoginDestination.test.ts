import { buildCityHref } from '../postLoginDestination'

describe('buildCityHref', () => {
  it('appends an encoded city query param when a city is given', () => {
    expect(buildCityHref('/onboarding', 'Nashville')).toBe('/onboarding?city=Nashville')
  })

  it('encodes a city with spaces/special characters', () => {
    expect(buildCityHref('/deals', 'New York')).toBe('/deals?city=New%20York')
  })

  it('returns the bare path when no city is given', () => {
    expect(buildCityHref('/onboarding', undefined)).toBe('/onboarding')
  })

  it('returns the bare path for an empty-string city', () => {
    expect(buildCityHref('/deals', '')).toBe('/deals')
  })
})
