# AUDIT-AFFILIATE-LINK-DISCLOSURE-01: Affiliate Link Disclosure Trust

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Strict audit only. No provider adapters or feature code changed.

## Executive Decision

Not ready for full affiliate-handoff trust.

Flight and hotel cards generally avoid locked-price or completed-booking claims, and unavailable states are present. The main functional defect is that flight cards make any non-empty deeplink clickable without validating scheme or destination safety. The main trust-copy defect is that hotel cards label the external affiliate handoff "Book hotel", which can imply booking starts or completes on expaify even though it opens HotelLook/Travelpayouts in a new tab.

## Files Inspected

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/book/page.tsx`
- `app/book/BookingFlow.tsx`
- `app/api/search/route.ts`
- `lib/booking/config.ts`
- `lib/providers/travelpayouts.ts`
- `lib/providers/duffel.ts`
- `lib/providers/amadeus.ts`
- `lib/providers/kiwi.ts`
- `lib/providers/hotellook.ts`
- `lib/types.ts`

Requested file not present in this worktree:

- `app/components/BookingReview.tsx`

Equivalent booking review surface audited instead:

- `app/book/BookingFlow.tsx`

Next.js local docs read before route assumptions: `node_modules/next/dist/docs/01-app/index.md` and App Router docs index listing.

## Outbound Link Surface Inventory

| Surface | Current label | Destination source | target / rel | Disabled or error behavior | Trust risk |
| --- | --- | --- | --- | --- | --- |
| Flight card, Duffel/internal booking | `Review paused booking` | `/book?...` from `buildBookingHref(fare)` in `lib/booking/config.ts:140` to `lib/booking/config.ts:157`, assigned by `lib/providers/duffel.ts:217` | No `target`, no `rel` in `app/components/FlightCard.tsx:286` to `app/components/FlightCard.tsx:301` | If deeplink empty or `#`, disabled button says `Provider link unavailable` at `app/components/FlightCard.tsx:302` to `app/components/FlightCard.tsx:310` | Passing for disclosure. Copy says review is paused and in-app booking is review-only. |
| Flight card, external provider | `Check with {fare.source}` | `fare.deeplink` from Travelpayouts, Amadeus, Kiwi, or cached provider data | `target="_blank"` and `rel="noopener noreferrer sponsored"` at `app/components/FlightCard.tsx:286` to `app/components/FlightCard.tsx:301` | Empty/`#` disables CTA; malformed/non-http schemes are still clickable | Functional defect: no URL scheme validation before rendering active external link. |
| Hotel card, external affiliate | `Book hotel` with note `via HotelLook` | `hotel.deeplink` from HotelLook adapter, `tp.media/r?...&u=https://hotellook.com/hotels/{id}` at `lib/providers/hotellook.ts:54` to `lib/providers/hotellook.ts:55` | `target="_blank"` and `rel="noopener noreferrer sponsored"` at `app/components/HotelCard.tsx:274` to `app/components/HotelCard.tsx:285` | Invalid URL or invalid price disables with `Booking unavailable` and explicit reason at `app/components/HotelCard.tsx:290` to `app/components/HotelCard.tsx:303` | Trust-copy defect: label says `Book hotel`, but checkout occurs off-site and availability/price can change. |
| Booking review back links | `Back to search`, `Search more flights`, `Review details again` | Internal `/` or local state reset in `app/book/BookingFlow.tsx` | No external target/rel | Invalid context blocks booking and links back to search | Passing recovery behavior, but not an affiliate/outbound surface. |
| Footer trust copy | `Outbound provider links may include affiliate markers...` | No outbound link; disclosure copy in `app/page.tsx:270` to `app/page.tsx:279` | N/A | Always visible at page footer | Helpful but too low in hierarchy to repair card-level ambiguity. |

## Findings

### P1 Functional: Flight card activates unsafe or malformed external deeplinks

Evidence:

- `FlightCard` only checks `fare.deeplink.trim().length > 0 && fare.deeplink !== '#'` before rendering an active anchor at `app/components/FlightCard.tsx:189` to `app/components/FlightCard.tsx:190`.
- That active anchor uses the raw `href={fare.deeplink}` at `app/components/FlightCard.tsx:286` to `app/components/FlightCard.tsx:288`.
- `KiwiProvider.buildAttributedDeeplink()` accepts any `new URL(deeplink)` result and does not restrict to `https:` or `http:` at `lib/providers/kiwi.ts:91` to `lib/providers/kiwi.ts:101`.
- Cached provider results are trusted if present; providers return `NormalizedFare[]` from cache before rebuilding links, for example `lib/providers/kiwi.ts:126` to `lib/providers/kiwi.ts:128`, `lib/providers/travelpayouts.ts:143` to `lib/providers/travelpayouts.ts:145`, and `lib/providers/duffel.ts:136` to `lib/providers/duffel.ts:138`.

Repro:

1. Render `FlightCard` with a fare whose `deeplink` is `javascript:alert(1)`, `mailto:test@example.com`, or a malformed-but-non-empty relative value like `not-a-url`.
2. Keep `fare.source` as a non-Duffel provider.
3. Observe the CTA renders as an active external-style anchor instead of the unavailable state.

Expected: Non-internal booking links should be active only when they parse as `https:` provider/affiliate URLs from allowlisted or at least explicitly valid origins. Unsafe schemes and malformed links should render the existing disabled `Provider link unavailable` state.

Actual: Any non-empty non-`#` string becomes an active click target.

Impact: Users can be sent to a dead end or unsafe browser action from a result card. This is a destination-safety failure, not just disclosure copy.

Narrow repair: Add a `FlightCard` URL guard similar to `HotelCard.isValidBookingUrl`, but stricter for external flight links. Treat `/book?...` as internal. Treat external links as valid only for `https:` or explicitly approved provider domains. Add Jest coverage for missing, malformed, unsafe-scheme, valid external, and `/book` links.

### P1 Trust Copy: Hotel CTA implies booking instead of external availability check

Evidence:

- Active hotel CTA text is `Book hotel` at `app/components/HotelCard.tsx:274` to `app/components/HotelCard.tsx:285`.
- The small note only says `via HotelLook` at `app/components/HotelCard.tsx:286` to `app/components/HotelCard.tsx:288`.
- The link opens a Travelpayouts tracking URL wrapping HotelLook, not an expaify checkout surface, from `lib/providers/hotellook.ts:54` to `lib/providers/hotellook.ts:55`.
- Page footer says final price and availability are set by the provider, and outbound links may include affiliate markers, at `app/page.tsx:270` to `app/page.tsx:279`; this is not adjacent to the hotel CTA.

Repro:

1. Render a `HotelCard` with a valid price and valid HotelLook deeplink.
2. Observe the primary action says `Book hotel`.
3. Click it and observe a new tab opens to an affiliate/provider path, not an expaify booking flow.

Expected: CTA should say something like `Check on HotelLook` or `Open HotelLook`, with adjacent note that it opens a partner/affiliate site and prices/availability can change.

Actual: CTA says `Book hotel`, which overstates the action.

Impact: Legal/trust risk. It can imply availability or booking completion support that the product does not provide.

Narrow repair: In `app/components/HotelCard.tsx`, change the active CTA label and aria-label to an availability-check/open-provider action. Add one adjacent sentence matching flight card specificity: `Opens HotelLook. Price and availability can change.`

### P2 Legal/Disclosure: Affiliate disclosure is present, but not attached to every handoff

Evidence:

- Footer-level disclosure exists in `app/page.tsx:270` to `app/page.tsx:279`.
- Flight external CTA note says `Opens provider search. Price and availability can change.` at `app/components/FlightCard.tsx:196` to `app/components/FlightCard.tsx:200`.
- Hotel card note says only `via HotelLook` at `app/components/HotelCard.tsx:286` to `app/components/HotelCard.tsx:288`.
- Hotel links use `rel="noopener noreferrer sponsored"` at `app/components/HotelCard.tsx:274` to `app/components/HotelCard.tsx:278`, so the machine-readable sponsored hint exists.

Repro:

1. Start from a visible hotel card without scrolling to the footer.
2. Review the CTA area only.
3. Observe the link does not state affiliate/partner handoff or price-change risk adjacent to the action.

Expected: Every outbound affiliate handoff should disclose partner/affiliate or provider handoff at the point of action.

Actual: Disclosure exists globally but is not attached to the hotel CTA.

Impact: Trust/legal copy issue. It is less severe than the `Book hotel` label, but the two issues compound.

Narrow repair: Keep `rel="sponsored"` and add concise adjacent hotel-card copy. Do not add new partners or commission logic.

### P2 Contract Conflict: Travelpayouts affiliate marker env var is outside the stated env contract

Evidence:

- The ticket briefing lists env secrets as `TP_TOKEN`, `AMADEUS_ID`, `AMADEUS_SECRET`, `DUFFEL_KEY`, and `HOTEL_AFFILIATE_ID`.
- `TravelpayoutsProvider` requires `TP_AFFILIATE_MARKER` for flight deeplinks at `lib/providers/travelpayouts.ts:74` to `lib/providers/travelpayouts.ts:82` and blocks search if missing at `lib/providers/travelpayouts.ts:137` to `lib/providers/travelpayouts.ts:138`.
- `HotellookProvider` uses `HOTEL_AFFILIATE_ID` with fallback to `TP_AFFILIATE_MARKER` at `lib/providers/hotellook.ts:50` to `lib/providers/hotellook.ts:55`.

Repro:

1. Configure only the briefing-listed `TP_TOKEN` and omit `TP_AFFILIATE_MARKER`.
2. Call Travelpayouts fare search.
3. Observe `{ ok: false, reason: 'TP_AFFILIATE_MARKER not configured' }`.

Expected: Env contract and provider requirements should agree.

Actual: Flight affiliate marker requirement is not in the current briefing's allowed env list.

Impact: Environment blocker/contract ambiguity. This audit did not change provider adapters because that is out of scope.

Narrow repair: Product/engineering should either add `TP_AFFILIATE_MARKER` to the formal env contract or update the Travelpayouts adapter to use an approved env var. Do not guess in this ticket.

## Passing Checks

- Flight external links open in a new tab with `noopener noreferrer sponsored` at `app/components/FlightCard.tsx:286` to `app/components/FlightCard.tsx:301`.
- Duffel review links stay internal and are labeled `Review paused booking`, not `Book now`, at `app/components/FlightCard.tsx:189` to `app/components/FlightCard.tsx:200`.
- Missing flight deeplink renders a disabled button with `Provider link unavailable` and explanatory copy at `app/components/FlightCard.tsx:302` to `app/components/FlightCard.tsx:311`.
- Hotel missing link, malformed link, missing price, or non-positive price renders `Booking unavailable` with a specific reason at `app/components/HotelCard.tsx:188` to `app/components/HotelCard.tsx:201` and `app/components/HotelCard.tsx:290` to `app/components/HotelCard.tsx:303`.
- Hotel active links require URL parsing and `http:` or `https:` at `app/components/HotelCard.tsx:188` to `app/components/HotelCard.tsx:195`.
- Hotel provider failures do not produce fake cards; `/api/search` emits `hotel-status: unavailable` at `app/api/search/route.ts:233` to `app/api/search/route.ts:242`, and the page shows unavailable/skipped/empty copy at `app/page.tsx:806` to `app/page.tsx:824` and `app/page.tsx:1236` to `app/page.tsx:1240`.
- Flight provider failures stream notices at `app/api/search/route.ts:144` to `app/api/search/route.ts:153`; `FlightResults` shows them in a warning panel at `components/flights/FlightResults.tsx:148` to `components/flights/FlightResults.tsx:170`.
- Loading states use skeletons and status copy, not fake prices or fake hotel inventory, at `components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:247` and `app/page.tsx:1272` to `app/page.tsx:1286`.
- Empty states are coherent for missing dates, filtered-out results, no supply, hotel skipped, and provider unavailable at `components/flights/FlightResults.tsx:124` to `components/flights/FlightResults.tsx:145` and `app/page.tsx:806` to `app/page.tsx:824`.
- No inspected link text claims guaranteed availability, locked price, or completed booking. The risk is `Book hotel` implying the start/completion of booking, not a locked rate.

## Manual Verification Flow

Live provider/browser verification was blocked by environment constraints and missing live credentials. Source-level/manual state verification covered the required cases:

1. Flight result:
   - Trace a Travelpayouts, Amadeus, Kiwi, or Duffel `NormalizedFare` from `/api/search` streaming at `app/api/search/route.ts:139` to `app/api/search/route.ts:141`.
   - Confirm the result renders through `FlightResults` and `FlightCard` at `components/flights/FlightResults.tsx:261` to `components/flights/FlightResults.tsx:269`.
   - Confirm external flights use `Check with {source}` and internal Duffel uses `Review paused booking`.

2. Hotel result:
   - Trace a HotelLook `HotelOffer` from `/api/search` hotel streaming at `app/api/search/route.ts:225` to `app/api/search/route.ts:242`.
   - Confirm `HotelCard` renders an active outbound link only when price and URL validate.
   - Trust defect observed: active label is `Book hotel` even though the URL leaves expaify.

3. Missing provider link:
   - Flight: empty or `#` deeplink renders disabled `Provider link unavailable`.
   - Hotel: empty or malformed deeplink renders `Booking unavailable` and the reason `No valid booking link was returned.`

4. External navigation attempt:
   - Flight external anchors open in a new tab and include `noopener noreferrer sponsored`.
   - Hotel anchors open in a new tab and include `noopener noreferrer sponsored`.
   - Functional gap: flight external anchors do not validate scheme before enabling navigation.

5. Recovery behavior:
   - Invalid or missing `/book` fare context renders `We can't identify this fare` and `Back to search` in `app/book/BookingFlow.tsx:224` to `app/book/BookingFlow.tsx:263`.
   - Booking-disabled Duffel context renders `In-app booking is paused` and does not collect payment or traveler details in `app/book/BookingFlow.tsx:338` to `app/book/BookingFlow.tsx:347`.
   - Provider booking POST error renders `Booking request stopped`, `Review details again`, and `Back to search` in `app/book/BookingFlow.tsx:363` to `app/book/BookingFlow.tsx:383`.

## Mobile 375px and Desktop Review

Live viewport confirmation was not performed because no local browser/server run was required for this audit and live provider data is unavailable in this environment. Source-level responsive review:

- Flight result grid is one column on mobile and expands at `sm`/`lg` breakpoints in `components/flights/FlightResults.tsx:242` and `components/flights/FlightResults.tsx:261`.
- Flight card CTA is full width with `min-h-12`, so the primary action is not hidden at 375px in `app/components/FlightCard.tsx:291` to `app/components/FlightCard.tsx:307`.
- Hotel result grid is one column on mobile and expands at `sm`/`lg` breakpoints in `app/page.tsx:1273` and `app/page.tsx:1297`.
- Hotel CTA/price stack vertically on mobile and switch to row alignment on larger screens at `app/components/HotelCard.tsx:265` to `app/components/HotelCard.tsx:305`.
- Booking review stacks before `lg` and moves to a two-column layout on desktop at `app/book/BookingFlow.tsx:166` to `app/book/BookingFlow.tsx:184`.
- No source-level evidence of overlapping primary CTAs or hidden primary actions was found.

## Recommended Repairs

1. `app/components/FlightCard.tsx`: Add URL validation before rendering active external anchors. Keep `/book` internal. Disable unsafe/malformed/non-provider schemes with the existing unavailable state.
2. `app/components/FlightCard.tsx`: Add focused tests for `javascript:`, `mailto:`, relative malformed strings, valid `https:` provider links, empty links, and `/book` links.
3. `app/components/HotelCard.tsx`: Change `Book hotel` to `Check on HotelLook` or `Open HotelLook`, and update `aria-label` accordingly.
4. `app/components/HotelCard.tsx`: Replace `via HotelLook` with adjacent disclosure that it opens a partner/affiliate provider and price/availability can change.
5. Env contract follow-up: Resolve `TP_AFFILIATE_MARKER` versus the ticket's env contract before changing provider logic.

## Verification Commands

- `npx tsc --noEmit --incremental false` - passed.
- `npx jest --runInBand` - passed. 19 suites passed, 153 tests passed.
- `npm test -- --passWithNoTests` - passed. 19 suites passed, 153 tests passed.

## Required Return Note

- What changed and why: Added this focused QA audit report for outbound flight/hotel link disclosure, destination safety, and recovery behavior.
- Files changed: `docs/audits/2026-06-30-audit-affiliate-link-disclosure-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx jest --runInBand` passed with 19 suites and 153 tests; `npm test -- --passWithNoTests` passed with 19 suites and 153 tests.
- Out-of-scope findings or blockers: `app/components/BookingReview.tsx` is not present; `app/book/BookingFlow.tsx` was audited as the current booking review surface. Provider adapter changes and env contract changes are out of scope for this audit.
