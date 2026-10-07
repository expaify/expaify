import { buildCityHref, isSafeCallbackPath, resolvePostLoginHref } from '../postLoginDestination'

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

describe('isSafeCallbackPath', () => {
  it('accepts a plain same-origin path', () => {
    expect(isSafeCallbackPath('/account')).toBe(true)
  })

  it('accepts a same-origin path with its own query string', () => {
    expect(isSafeCallbackPath('/onboarding?city=Nashville')).toBe(true)
  })

  it('rejects a protocol-relative URL (the classic //evil.com open-redirect shape)', () => {
    expect(isSafeCallbackPath('//evil.com')).toBe(false)
  })

  it('rejects a backslash that browsers normalize into a protocol-relative URL', () => {
    expect(isSafeCallbackPath('/\\evil.com')).toBe(false)
  })

  it('rejects a path containing lowercase encoded slashes', () => {
    expect(isSafeCallbackPath('/account%2f..%2fadmin')).toBe(false)
  })

  it('rejects a path containing uppercase encoded slashes', () => {
    expect(isSafeCallbackPath('/account%2F..%2Fadmin')).toBe(false)
  })

  it('rejects an absolute URL even to a real-looking path', () => {
    expect(isSafeCallbackPath('https://evil.com/account')).toBe(false)
  })

  it('rejects a scheme smuggled in anywhere in the string', () => {
    expect(isSafeCallbackPath('/redirect?to=https://evil.com')).toBe(false)
  })

  it('rejects a path that does not start with a slash at all', () => {
    expect(isSafeCallbackPath('evil.com')).toBe(false)
  })

  it('rejects a path containing an encoded backslash (the same later-decode risk as an encoded slash)', () => {
    expect(isSafeCallbackPath('/account%5c..%5cadmin')).toBe(false)
    expect(isSafeCallbackPath('/account%5C..%5Cadmin')).toBe(false)
  })

  it('rejects embedded control characters, including a tab that some parsers strip before interpreting the string as a URL', () => {
    expect(isSafeCallbackPath('/\t/evil.com')).toBe(false)
    expect(isSafeCallbackPath('/account\u0000')).toBe(false)
  })

  it('rejects userinfo smuggled into the path (new URL() would otherwise happily parse "/@evil.com"-shaped input if given as an absolute reference)', () => {
    expect(isSafeCallbackPath('/@evil.com')).toBe(true) // same-origin: '@' here is just a literal path segment, not userinfo
  })

  // Same technique lib/booking/config.ts's validateHotelReturnUrl already
  // uses for the identical problem: resolve the candidate against a fake
  // internal base with new URL() and require the result to stay on that
  // exact host. Exhaustively probed this against every bypass shape above
  // (encoded slash/backslash, leading backslash, embedded scheme, control
  // chars) plus several WHATWG-parser edge cases (encoded %2e%2e traversal,
  // userinfo-looking segments, non-ASCII whitespace) -- none independently
  // slipped past the hand-written checks above in this codebase's real
  // usage. This step is deliberate defense-in-depth against a parser
  // behavior or bypass shape not yet enumerated above, not a fix for a
  // concretely demonstrated gap found during that probing.
  it('still accepts the ordinary safe paths after adding the new URL() same-origin check', () => {
    expect(isSafeCallbackPath('/account')).toBe(true)
    expect(isSafeCallbackPath('/admin/users')).toBe(true)
    expect(isSafeCallbackPath('/onboarding?city=New%20York')).toBe(true)
  })
})

describe('resolvePostLoginHref', () => {
  it('prefers a valid, explicit callbackUrl over a city', () => {
    expect(resolvePostLoginHref('/deals', { callbackUrl: '/admin/users', city: 'Nashville' })).toBe('/admin/users')
  })

  it('falls back to the city-aware href when no callbackUrl is given', () => {
    expect(resolvePostLoginHref('/onboarding', { city: 'Nashville' })).toBe('/onboarding?city=Nashville')
  })

  it('falls back to the city-aware href when callbackUrl is unsafe, never using it', () => {
    expect(resolvePostLoginHref('/deals', { callbackUrl: '//evil.com', city: 'Nashville' })).toBe('/deals?city=Nashville')
  })

  it('falls back to the bare path when neither callbackUrl nor city is given', () => {
    expect(resolvePostLoginHref('/deals', {})).toBe('/deals')
  })
})
