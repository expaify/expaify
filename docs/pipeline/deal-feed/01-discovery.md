# UXD: Deal Feed — Discovery

## User pain point
A premium subscriber who logs in after signup has no page to actually browse hotel deals — the landing page shows 3 blurred teasers but there is no `/deals` route with a real browsable feed, so the core value proposition is invisible after sign-up.

## Who is affected and where
Premium and free users immediately after auth, directed from the CTA "See today's deals" on the landing page. The step that breaks: clicking any deal CTA lands on a missing page (no `/deals` route exists yet, only `/deals/[dealId]`).

## Measurable signal
- HTTP 404 on `/deals` for all users post-auth
- Free users cannot see the paywall in action (blurred cards beyond 3)
- Premium users have no proof of what they paid for

## Constraints
1. **Brand**: ivory bg, Space Grotesk headlines, teal primary, coral CTAs only, gold on discount chips only — no new colors
2. **Performance**: initial deals server-rendered; filter changes fetch from `/api/deals` client-side; no full-page reload
3. **Paywall integrity**: free users see exactly 3 unlocked cards; cards 4+ are `LockedDealCard` — never expose price/name beyond limit via the API

## Success statement
This is solved when a first-time premium user can land on `/deals`, see a grid of hotel deals with discount chips and OTA links, filter by destination or discount %, and click through to a booking site — without encountering a blank page, 404, or broken card state.
