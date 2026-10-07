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
