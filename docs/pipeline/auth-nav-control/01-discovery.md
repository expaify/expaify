---
id: UXD-AUTH-NAV-CONTROL-001
stage: UXD
---

# Discovery: No Authenticated User Controls in Nav

## Problem Statement
After signing in, the user sees the same nav as an anonymous visitor — "Login" and "Join the club" — with no account link, no sign-out, and no visual confirmation they are signed in.

## Who is affected
Every signed-in user on every page that uses `LandingNav` (`/deals`, and the deals detail page nav). This is the entire authenticated session.

## Measurable signals
- `LandingNav` is a static client component with zero session awareness
- A signed-in user on `/deals` sees a "Login" link — implies the system does not recognise them
- No link to `/account` in the nav from any deal-browsing surface
- No sign-out control anywhere except if the user discovers `/account` directly
- After Google OAuth succeeds and the user lands on `/deals`, the nav says "Login" — functionally indistinguishable from "your login failed"

## Constraints
1. Brand: nav must stay minimal — no heavy avatar dropdowns; a single account chip is sufficient
2. Performance: session check must not delay nav paint; use client-side `useSession` with a loading state
3. The nav is used on both marketing pages (homepage) and app pages (deals) — unauthenticated links like `#pricing` are irrelevant on app pages

## Success statement
This is solved when a signed-in user on `/deals` can see their account status in the nav, reach `/account` in one click, and sign out — without visiting the homepage or knowing the URL.
