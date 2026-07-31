# UXR-HOTEL-BOOKING-HANDOFF-TRUST-01: Hotel Booking Handoff Trust — Research Brief

**Stage:** UX Research (UXR)
**Date:** 2026-07-31
**Upstream:** `docs/pipeline/hotel-booking-handoff-trust/01-discovery.md`
**Surfaces audited:** `app/book/BookingFlow.tsx`, `lib/booking/config.ts`, `app/components/HotelCard.tsx`, `app/api/search/route.ts`, `lib/hotels/searchCriteria.ts`, `app/deals/[dealId]/page.tsx`, `app/components/HotelDealCriteria.tsx`, `app/api/analytics/route.ts`, `lib/booking/hotelContextStore.ts`, `lib/types.ts`

---

## 1. Discovery defects: all four confirmed in source

| # | Discovery claim | Verdict | Evidence |
|---|---|---|---|
| 1 | `BookingHotelContinuity` never passed | **Confirmed** | `buildHotelBookingHref` (`config.ts:1059`) takes only `hotel`. Both call sites (`HotelCard.tsx:753`, `:812`) are single-argument. Repo-wide grep for `buildBookingHotelContext(` returns no second argument outside tests. |
| 2 | `HotelDecisionSummary` hardcodes "not provided" | **Confirmed** | `BookingFlow.tsx:339-341`, `:356`, `:373`, `:376-378`. `DealScorePanel` receives `hotelContext.dealScore ?? null` (`:359`) — always `null`. |
| 3 | `hotelSupplement` accepted and dropped | **Confirmed** | Declared `:508`, typed `:518`; the hotel branch (`:511-523`) renders `HotelDecisionSummary`, `{status}`, `{children}` only. |
| 4 | Back affordances hardcode `/` | **Confirmed** | `:514` (hotel), `:528` (flight). `validateHotelReturnUrl` (`config.ts:211`) is exported but has no non-test caller. |

Discovery is accurate. The three "verify first" questions all resolved, and two of them change the shape of the fix. Everything below is the delta discovery could not see.

---

## 2. Verification results

### (a) Where the stay dates actually live — and why the obvious wiring would be a lie

Discovery asked whether `HotelOffer` or the search page holds check-in/check-out. Answer: **there are two different date concepts in this repo and they are not interchangeable.**

**A true stay span exists, server-side, at the moment hotel offers are produced.** `app/api/search/route.ts:397-404` gates hotel search on `destIATA && depart && ret` and calls `hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret })`. The provider prices the nightly rate *for that span* (`hotellook.ts:445-478`, `&checkIn=…&checkOut=…`, and the span is part of the 6h cache key). So the nightly rate on the card is genuinely a rate for a specific stay.

That span is then discarded. `HotelOffer` (`lib/types.ts:474-496`) has no date fields, and the NDJSON `hotels` message (`route.ts:409`) sends `{ type, source, data: offers, page }` — no range. The validated stay the provider was queried with never leaves the route handler.

**The `/deals` surface has dates, but they are a check-in *window*, not a stay.** `HotelSearchCriteriaV1.dates` is `{ semantic: 'checkin_window'; dateFrom?; dateTo? }` (`searchCriteria.ts:8-10`), and `formatHotelCriteriaDates` renders it as `"Check in Sep 14–18"` (`:79-94`) — earliest and latest acceptable *arrival*, with no departure and no night count. `hotelCriteriaContextStatus` (`:286-297`) confirms the semantic: it tests `checkIn < dateFrom` / `checkIn > dateTo` as a range containment.

`BookingHotelContinuity.checkIn/checkOut/nightCount` models the opposite thing — a stay span. `validateHotelStayContinuity` (`config.ts:523-544`) rejects `checkOut <= checkIn` and derives `nightCount` as the day difference.

> **The trap:** mapping `criteria.dates.dateFrom → checkIn` and `dateTo → checkOut` compiles, validates, and is wrong. A traveler who asked "check in any time Sep 14–18" would be shown **"Sep 14 – Sep 18 · 4 nights"** on the last screen before handoff. That converts a missing-data problem into a fabricated-data problem — a worse trust failure than the one this ticket exists to fix, and a direct violation of Constraint 1.

**`hotelClass` and `guestRating` need no threading at all.** Both are already fields on `HotelOffer` (`lib/types.ts:487-488`) with full `HotelRatingEvidence` provenance, and `HotelCard` reads them directly (`HotelCard.tsx:741-743`) to render the class chip and rating chip. `buildBookingHotelContext` simply does not copy them onto the context — it copies `location`, `fundsPolicy`, `smokingPolicy`, `rateEligibility` and stops. Two of the five "not provided" contradictions are fixable inside `config.ts` alone, with zero parent-component work.

**`dealScore` is genuinely parent-owned.** `HotelCard` takes `score?: DealScore | null` as a prop (`HotelCard.tsx:36`); it is not on the offer. This is the one field that must be threaded from whatever mounts the card.

**`priceCheckedAt` has no source anywhere.** No provider, route, or type produces it. Discovery correctly assigns sourcing to `hotel-price-freshness`. It stays absent — see §4, D2.

### (b) URL vs. hotel-context store — measured, not estimated

I measured the inline href on a deliberately heavy realistic offer (long property name, full street address, verified anchor + distance, complete funds-policy obligation, affiliate deeplink) using the throwaway fixture already sitting in the tree:

| Payload | Length |
|---|---|
| Current inline href, no continuity | **1,716** |
| Full continuity params (`checkIn`, `checkOut`, `nightCount`, `entrySource`, a 150-char `returnUrl`, `priceCheckedAt`, `dealScore` JSON, `hotelClass` JSON, `guestRating` JSON) | **+994** |
| Total | **2,711** vs. `MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH` = 4,096 |

**Conclusion: the URL carries continuity.** No new transport is needed and no store-first redesign is justified. Continuity costs ~1KB, leaving ~1.4KB of headroom on a heavy offer.

The overflow path is already built and automatic: `buildHotelBookingHref` (`config.ts:1059-1063`) falls back to `?hotelContextRef=required`, `HotelCard.handleReviewClick` (`:800-825`) POSTs the structured context to `/api/book/hotel-context`, and `persistBookingHotelContext` round-trips it through `validateStructuredBookingHotelContext` — which reads `checkIn`, `dealScore`, `hotelClass`, `guestRating` as live objects (`config.ts:875-908` → `validateBookingHotelContext`). **Both transports already support every continuity field.** The only cost of the +994 bytes is that offers with 4 document-conflict statements plus a full smoking-statement set will cross 4,096 slightly more often and take the (already-shipped, already-tested) store path, which adds one round trip and a "Preparing review…" button state.

Do not move to a store-first design. The URL path is synchronous, shareable, and needs no Redis availability at click time.

### (c) Where `hotelSupplement` belongs

`hotelSupplement` currently bundles two things with different jobs and different timing (`BookingFlow.tsx:1040-1089`):

1. `TrackedSmokingPolicyPanel` — decision evidence, read *before* leaving. Belongs with hotel fit, above the handoff panel.
2. The `showReturnPrompt` mismatch prompt — appears only *after* the traveler comes back (`:919`). It is a post-return interruption.

They are also wrongly coupled: the whole node is gated on `policy ? … : undefined`, so the return prompt's existence depends on a smoking policy existing. (In practice `buildBookingHotelContext` always sets `smokingPolicy`, defaulting to `unavailableHotelSmokingPolicy()` — so the gate is currently vacuous, but it is a latent trap the moment anyone constructs a context without it.)

**Recommendation: split the prop.** One node for evidence, rendered after `HotelDecisionSummary`; one node for the return prompt, rendered immediately above the handoff panel (`children`) so a returning traveler meets it before they can click out a second time. See D4.

---

## 3. Reality check: this surface has no mounted entry point

Repo-wide grep: **`HotelCard` is not rendered by any route.** The only non-test references are its own definition and its own imports. The `/api/search` NDJSON stream has no client consumer either — the only file that touches `/api/search*` is `app/components/ui/SearchBar.tsx`, and it calls `/api/search/parse` for natural-language parsing, not the results stream.

The live hotel path today is `/deals` → `DealFeed` → `DealCard` → `/deals/[dealId]` → `CompareRow` (direct partner links). It never reaches `/book?kind=hotel`. The review screen is currently reachable only by a hand-constructed URL.

This does not invalidate the ticket — the defects are real and every one of them will ship broken the moment `HotelCard` is mounted — but it changes two things for UXDES:

- **Do not design around a specific parent.** Define the continuity contract at the `HotelCard` props boundary and at `buildBookingHotelContext`, so it is correct for whatever mounts the card. Threading `stay` and `score` from a parent that does not exist yet is a contract to specify, not a component to build.
- **The immediately shippable, independently testable value is on the review screen itself:** D2, D3, D4 and D5 below all improve behaviour with today's code and today's entry path, because they change how `/book` *reads* context rather than how a card *builds* it.

Mounting the hotel results surface is out of scope for this ticket and should not be smuggled in. Flag it for the backlog.

---

## 4. Reference patterns and the exact delta

Two references, compared at interaction level only.

**Booking.com — property page and room table.** A persistent stay bar sits directly above the room list: dates, night count, occupancy, plus an inline "Change dates" control. It never disappears; scrolling the room table keeps it pinned. When dates are unset the bar is a **date picker prompt**, not a label — absence is rendered as an available action, never as a dead statement about missing data. Every rate in the table is captioned with what it covers ("Price for 4 nights").

**Google Hotels — partner handoff row.** Each outbound partner row restates the stay and the total *for those dates* beside the partner name, and the price-assessment badge ("Great deal — $32 less than usual") sits adjacent to the outbound link rather than only on the prior results screen. The assessment is present at the decision moment, not just at the browsing moment.

**expaify's own `/deals` detail page already follows both patterns** and is the internal precedent that makes the review screen's behaviour indefensible:

- `HotelSearchCriteriaSummary` renders the search context on the detail page with an inline edit affordance (`HotelDealCriteria.tsx:87`).
- The handoff copy is **conditional**: `{!criteria || datesIncomplete ? ' Choose or confirm your dates there before comparing room options.' : null}` (`HotelDealCriteria.tsx:146`). The sentence appears only when dates are genuinely absent.
- The back link goes to the parameterized result set via `buildHotelBackUrl(criteria, resultsView, researchParams)` (`[dealId]/page.tsx:252`), preserving destination-page origin through `criteriaReturn`.
- On a criteria/deal mismatch the handoff is **withheld**, not silently proceeded through (`HotelDealCriteria.tsx:129-137`).

| Facet | Current `/book` hotel review | Reference (incl. expaify `/deals` detail) | Delta |
|---|---|---|---|
| Stay context | Fixed "Stay dates not provided" (`:339`) | Persistent stay summary; absence rendered as an action | Screen must read context; unconditional string must go |
| "Confirm your dates there" | Unconditional (`:1096`) | Conditional on dates actually being absent | Same product, two contradictory rules, one of them already shipped correctly |
| Deal Score | Always the unavailable state (`:359`) | Assessment adjacent to the outbound link | Score must survive the click |
| Class / rating | "not provided" + a false provider claim (`:373-378`) | Neutral absence; provenance preserved | Data is on `HotelOffer` and simply not copied |
| Return | `href="/"` (`:514`) | Parameterized results URL | `validateHotelReturnUrl` + `buildHotelBackUrl` both exist, unused together |
| Mismatch on return | Prompt never rendered (`:511-523`) | Mismatch blocks/interrupts the handoff | Prop dropped |

---

## 5. Design directives

Testable. Each states the required behaviour, the absence behaviour, and the failing condition.

### D1 — Carry the stay span from the search that priced the rate. Never synthesize one from a check-in window.

- `checkIn`/`checkOut`/`nightCount` may be populated **only** from a true stay span: the `{ checkin, checkout }` range `/api/search` passed to `hotellook.searchHotels` (`route.ts:402`). Attach it to the `hotels` NDJSON message and accept it at `HotelCard` as an optional `stay?: { checkIn: string; checkOut: string }` prop, forwarded into `BookingHotelContinuity`.
- `HotelSearchCriteriaV1.dates` (`semantic: 'checkin_window'`) **must never** be mapped to `checkIn`/`checkOut`. If a future entry point only has criteria dates, it passes no stay continuity.
- Rendered stay block, when present: `"Check in {date} · Check out {date} · {n} nights"`, night count from `nightCount` only (never recomputed in the view).
- Absence state (no stay carried) is honest and actionable, matching the shipped `/deals` rule: **"Stay dates not selected"** / **"Choose your dates with {partner} before comparing room options."** — never "not provided," which reads as data loss.
- The unconditional sentence at `BookingFlow.tsx:1095-1096` becomes conditional on the same test, mirroring `HotelDealCriteria.tsx:146`.
- **Fails if:** a review screen entered from a check-in-window search renders any night count or check-out date; or a dated search renders the absence state.

### D2 — Render class, rating, freshness and score from context, with provenance intact and no claims about the provider.

- `buildBookingHotelContext` reads `hotel.hotelClass` and `hotel.guestRating` off the offer directly (`lib/types.ts:487-488`), with an optional `continuity` override. No parent threading required for these two.
- `HotelDecisionSummary` renders each field only when the context carries it, preserving the verified vs. `provider_only` distinction already enforced on the card (`HotelCard.tsx:459-470`), with `reviewCount` and `sourceLabel` when present. The distinction must not be colour-only — carry it in text ("Verified guest reviews" vs. "Provider-reported").
- **Delete the false claim.** `"This provider did not return guest-rating evidence."` (`:378`) is untrue whenever the card showed a rating and is unverifiable in general. Replace with neutral absence: **"Guest rating not available for this property."**
- Deal Score: pass `hotelContext.dealScore` through to `DealScorePanel` unchanged. `confidence: 'low'` must still render the limited-history treatment (`DealScorePanel.tsx:25`, `:159`), never a bare verdict — thin data stays thin data.
- Freshness: `priceCheckedAt` has no source in the repo today, so the absence line stays. Align its wording with the card's — the card says `"Last-checked time unavailable."` (`HotelCard.tsx:745`), the review says `"Last-checked time not provided."` (`:356`). Use the card's wording on both. Render an actual timestamp only when `priceCheckedAt` is present; do not soften absence into an implied freshness guarantee.
- **Fails if:** the review screen shows an absence line for a field the originating card displayed; or a `confidence: 'low'` score renders as a plain verdict; or any copy asserts what the provider did or did not return.

### D3 — Continuity must degrade to "not shown." It must never nullify the booking context.

Today `validateBookingHotelContext` (`config.ts:713-729`) fails the **entire** context to `null` when any of `stayContinuity`, `hotelClass`, `guestRating`, `dealScore` is invalid. `parseBookingHotelContext` returning `null` sets `invalidHotelSelection` (`app/book/page.tsx:56`) and the traveler loses the whole review screen and the handoff.

These gates are dormant only because the fields are always absent. **Populating them arms four new whole-page failure modes** — including a subtle one: `validateHotelDealScore` requires `currency === observedCurrency` (`config.ts:596`), so a score computed against a differently-denominated baseline destroys the page rather than hiding a badge.

- Invalid or tampered `checkIn`/`checkOut`/`nightCount`/`dealScore`/`hotelClass`/`guestRating` must drop that field to `undefined` and leave the rest of the context valid.
- Follow the precedent already written into this file for `rateEligibility` (`config.ts:709-711`): *"Invalid/tampered eligibility context degrades to 'not provided' at read time; it must never block an otherwise-valid hotel context or the review/handoff gate."* `returnUrl` already behaves this way (`validateHotelReturnUrl` returns `undefined`, `config.ts:211`). Stay, score and rating are the outliers.
- Dropped fields render their D1/D2 absence states.
- **Fails if:** `/book?kind=hotel&…&checkIn=banana` (or a currency-mismatched `dealScore`) renders the invalid-selection screen instead of a working review screen with the stay block absent.

### D4 — Render the supplement. Split evidence from the return prompt.

- Replace the single `hotelSupplement` prop with two: `hotelEvidence` (the smoking-policy panel), rendered in the hotel branch of `ReviewShell` after `HotelDecisionSummary` and before `{status}`; and `hotelReturnPrompt`, rendered immediately above `{children}` (the handoff panel), so a returning traveler meets it before they can click out again.
- Neither may be gated on the other. Remove the `policy ? … : undefined` wrapper (`:1040`) from the return prompt's construction — the mismatch prompt must render whenever `showReturnPrompt` is true, regardless of smoking-policy availability.
- The prompt carries `role="status"` and must not steal focus on appearance; the existing focus return to `feedbackTriggerRef` on cancel (`:1078`) is retained.
- **Fails if:** the smoking-policy panel is absent from a rendered hotel review; or `showReturnPrompt === true` produces no visible prompt; or the prompt appears below the outbound CTA.

### D5 — Return to the search that produced the offer.

- Populate `continuity.returnUrl` with the originating results URL at href-build time. Reuse the shipped helpers rather than inventing a format: `buildHotelResultsUrl` / `buildHotelDestinationUrl` / `buildHotelBackUrl` (`searchCriteria.ts:188-234`), including the `criteriaReturn=destination` origin marker.
- `validateHotelReturnUrl` (`config.ts:211-231`) already allows exactly `/`, `/deals*`, `/destinations/<slug>*` and rejects protocol-relative, scheme-prefixed, credentialed and control-character input. No new validation is needed; the allowlist already covers every legitimate origin.
- Both back affordances (`:514`, `:528`) use `hotelContext.returnUrl ?? '/'`. Label mirrors the destination: **"← Back to results"** when a `returnUrl` is present, **"← Back to search"** when it falls back to `/`. Keep `handleBack`'s `hotel_handoff_back_clicked` emission on the same element.
- `entrySource` is set alongside (`'search'` from results, `'saved'` from a saved deal, `'direct'` otherwise) so return behaviour is attributable.
- **Fails if:** returning from a dated `/deals?city=…&date_from=…` search lands on an empty form; or a crafted `returnUrl` reaches an off-allowlist path.

---

## 6. Blocker for the measurement plan: every `hotel_handoff_*` event is being rejected

This is not a design directive; it is a prerequisite. **The ticket's MEASURE line currently reads zero on every metric**, and it will keep reading zero after this ticket ships unless it is fixed.

`/api/analytics` `parseBody` (`route.ts:230-240`) rejects the **entire event** with HTTP 400 if any submitted prop is absent from that event's allowlist. `BookingFlow` submits props that are not on any allowlist:

| Event | Props emitted | Allowlisted (`route.ts:37-40`) | Result |
|---|---|---|---|
| `hotel_handoff_viewed` | `analyticsProps` incl. `policyState`, `obligationTypes` (`:717-726`) | no `policyState`, no `obligationTypes` | **400, dropped** |
| `hotel_handoff_continue_clicked` | + `invoiceNeeded`, `invoiceReadinessStatus`, `helpViewed`, `loyaltyDisclosureViewed` (`:936-943`) | none of the four | **400, dropped** |
| `hotel_handoff_returned` | + `policyState`, `obligationTypes` (`:912-918`) | neither | **400, dropped** |
| `hotel_handoff_back_clicked` | + `policyState`, `obligationTypes` (`:1014-1019`) | neither | **400, dropped** |
| `hotel_handoff_return_reason_selected` | `reason`, `offerId`, `provider`, `partnerHost`, `handoffSessionId` (`:960-966`) | **event absent from `EVENT_PROPERTIES` entirely** | **400, dropped** |

`emitAnalytics` swallows everything (`:154-160`, *"Analytics must never block or alter the booking handoff"*) — correct for the handoff, but it means this has been failing silently.

So `hotel_handoff_continue_clicked ÷ hotel_handoff_viewed` is 0÷0, the `awayDurationBucket` distribution is empty, and `hotel_handoff_return_reason_selected` is unreachable **twice over** — once because the UI never renders (D4) and once because the endpoint would reject it.

Register on `EVENT_PROPERTIES` and add `validPropertyValue` branches for: `policyState`, `obligationTypes`, `invoiceNeeded`, `invoiceReadinessStatus`, `helpViewed`, `loyaltyDisclosureViewed`, and the whole `hotel_handoff_return_reason_selected` event (`reason` constrained to `HOTEL_RETURN_REASONS`, `offerId`/`handoffSessionId` as `OPAQUE_VALUE`). Note `handoffSessionId` is a `crypto.randomUUID()` with a `handoff-${Date.now()}` fallback (`:865-867`) — the fallback contains a `-` and digits and passes `OPAQUE_VALUE`, but the UUID form does not match the stricter `ID` pattern used for `eventId`, so it must be validated as an opaque value, not as an ID.

Once continuity lands, add continuity-state dimensions to `hotel_handoff_viewed` so the fix is attributable: `stayState` (`carried` | `absent`), `scoreState` (mirroring the existing `score_state` vocabulary), `classState`, `ratingState`.

---

## 7. Out-of-scope findings (do not fix in this ticket)

1. **`HotelCard` and the `/api/search` results stream are not mounted by any route** (§3). Worth its own ticket; it is the reason none of these defects have been reported by users.
2. **`lib/booking/__tests__/zz-tmp-hrefLen.test.ts`** is a committed scratch fixture from a prior run (commit `ae340e87`). It cannot even resolve its own imports (`../../lib/booking/config` from inside `lib/booking/__tests__`), so it fails the suite as a "test suite failed to run". I left it in place — deleting it is outside this ticket — but DEV should remove it. I copied it to a temp path to take the §2(b) measurement and deleted the copy.
3. **`priceCheckedAt` has no producer** anywhere in the repo. Owned by `hotel-price-freshness`, as discovery states.
4. **`app/book/__tests__/BookingFlow.test.tsx:198`, `:204`** assert the exact hardcoded strings `'Stay dates not provided'` and `'Last-checked time not provided.'`. They must be rewritten against context-driven behaviour, not deleted.

---

## 8. Handoff

Next ticket: `UXDES-HOTEL-BOOKING-HANDOFF-TRUST-01`. The design spec must cover, for every one of D1–D5: default (all continuity present), partial (stay absent but score present, and the inverse), fully absent, tampered/degraded (D3), 375px and 1280px, focus order into the outbound link, and the post-return prompt state.
