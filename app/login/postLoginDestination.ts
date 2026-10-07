// "Get free alerts for {city}" links (DealDetailProviderHandoff,
// LockedDealCard) pass city through /login's URL so a new user's
// onboarding starts with the city they actually clicked, instead of a
// blank destination grid. Pulled out as a pure function, its own file,
// so testing it doesn't need to load the real next-auth/react module --
// same reasoning as magicLinkOutcome.ts in this directory.
//
// /onboarding itself re-validates this against TRACKED_MARKET_NAMES before
// seeding anything, so an arbitrary/unknown city value here is harmless --
// it just won't match a real tracked market and gets dropped there.
export function buildCityHref(path: string, city?: string): string {
  return city ? `${path}?city=${encodeURIComponent(city)}` : path
}

// A same-origin, path-only relative URL -- rejects anything that could be
// reinterpreted as pointing off-site. The hand-enumerated checks below
// (control characters, a protocol-relative "//", a backslash browsers
// normalize into "//" for HTTP(S) URLs, an explicit scheme, an encoded
// slash or backslash that could change meaning after a later decode) catch
// the known shapes of that bypass; the new URL(...) step after them is the same,
// more general technique lib/booking/config.ts's validateHotelReturnUrl
// already uses for the identical problem -- resolving the candidate
// against a fake internal base and confirming the result is still on that
// exact host lets the real WHATWG URL parser (the same engine that will
// eventually navigate this string) settle what it actually means, instead
// of trusting the hand-enumerated list alone to be exhaustive.
export function isSafeCallbackPath(path: string): boolean {
  if (!path) return false
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(path)) return false
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false
  const lower = path.toLowerCase()
  if (lower.includes('%2f') || lower.includes('%5c')) return false
  // Defense-in-depth beyond what new URL() below checks: a scheme smuggled
  // into the query string (e.g. "/redirect?to=https://evil.com") resolves
  // to a same-origin path+search here -- the embedded "https://evil.com" is
  // just a query VALUE to this parser, not a nested URL -- so it would pass
  // the hostname check. It's only exploitable if some route of ours reads
  // a param like that and redirects to it itself, which nothing here does
  // today, but there is no legitimate reason a real callback destination
  // ever contains "://", so reject it outright rather than rely on every
  // future route to individually stay safe.
  if (path.includes('://')) return false

  let url: URL
  try {
    url = new URL(path, 'https://expaify.internal')
  } catch {
    return false
  }
  return !url.username && !url.password && url.hostname === 'expaify.internal'
}

// Protected pages (app/account/page.tsx, app/admin/users/page.tsx, etc.)
// bounce an unauthenticated visitor to /login?callbackUrl=<path they
// actually wanted>, expecting to land back there after sign-in -- this is
// an existing, already-relied-upon contract (app/admin/users/page.tsx has
// built this URL since before this file existed), just never honored by
// /login itself. An explicit, validated callbackUrl always outranks the
// city-aware destination below it, since it represents a real page the
// user was already trying to reach, not an inferred one.
export function resolvePostLoginHref(fallbackPath: string, opts: { callbackUrl?: string; city?: string }): string {
  if (opts.callbackUrl && isSafeCallbackPath(opts.callbackUrl)) return opts.callbackUrl
  return buildCityHref(fallbackPath, opts.city)
}
