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
// reinterpreted as pointing off-site: a bare '/' prefix is required (not an
// absolute URL), '//' is rejected (a protocol-relative URL -- some browsers
// and redirect libraries treat "//evil.com" as scheme-relative to evil.com,
// not as a path), and '://' anywhere in the string is rejected too (catches
// a scheme smuggled in after encoding/whitespace tricks, e.g. "/\t/evil.com"
// normalized by some parsers, or "/.//evil.com"-style traversal attempts).
// Backslashes are rejected because browsers normalize them to slashes in
// HTTP(S) URLs, allowing an off-site redirect. Encoded slashes are rejected
// to prevent later decoding from changing the path; our callbacks never need them.
export function isSafeCallbackPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
    && !path.includes('\\') && !path.toLowerCase().includes('%2f')
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
