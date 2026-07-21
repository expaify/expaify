# UXR-PRICE-ACCURACY-FEEDBACK-01: Price Accuracy Feedback (Hotels) Research Brief

**Stage:** UX Research (UXR)
**Date:** 2026-07-21
**Feature slug:** `price-accuracy-feedback`

## Source Inputs

- Discovery: `docs/pipeline/price-accuracy-feedback/01-discovery.md`
- Pre-handoff hotel result card: `app/components/HotelCard.tsx`
- Post-handoff review screen: `app/book/BookingFlow.tsx` → `HotelHandoffReview` (`app/book/BookingFlow.tsx:481-522`)
- Deal-feed terminal hotel screen: `app/deals/[dealId]/page.tsx`
- Analytics sink: `lib/analytics.ts`, `app/components/TrackOnMount.tsx`
- Shared contracts: `lib/types.ts` (`Money`, `HotelOffer`, `DealScore`, `PricePoint`)
- Handoff context contract: `lib/booking/config.ts` (`BookingHotelContext`, `buildHotelBookingHref`)
- Scoring + exposure surfaces: `lib/scoring/scoreDeal.ts`, `lib/pipeline/dealDetection.ts`, `scripts/snapshot-job.ts`

## Research Summary

The Deal Score is the product's entire claim, and it rests on one number: the nightly rate expaify shows for a hotel. Today that number is a dead end for the user — three separate hotel surfaces (`HotelCard`, `HotelHandoffReview`, deal detail) each display the rate and each concede it might be stale, but none of them give the user a way to say "the number was wrong." There is no report control anywhere in the hotel flow, no data shape to hold a report, no persistence path (the only telemetry sink is a dev-only `console.debug`), and no return-from-partner detection to hang a prompt on. The reference surfaces (Booking.com, Google Hotels) converge on the same interaction pattern: a small, secondary, category-first report affordance placed next to the price/handoff, never gating the primary CTA, that captures a structured reason plus an optional note. expaify should adopt that pattern at two persistent attach points (the price block on the card and the post-handoff review screen) rather than betting on fragile browser return-detection, and the captured report must reduce the flagged listing's exposure in scoring/snapshot pending re-verification.

## Current Implementation Audit

### Attach point A — pre-handoff card (`app/components/HotelCard.tsx`)

- The price block (`Price`, `app/components/HotelCard.tsx:34-50`) renders the nightly rate, provider name, and the standing caveat `Last-checked time unavailable` (`app/components/HotelCard.tsx:46`). The UI already concedes staleness on every rate but offers no channel to flag it.
- The primary CTA is `Review hotel` (`app/components/HotelCard.tsx:490-500`), gated on `canBook = hasBookingUrl && hasValidPrice` (`app/components/HotelCard.tsx:405`). This is the last on-card moment before the user commits to the handoff path.
- The expandable details drawer already contains a `Price scope` / `Rate check` panel (`app/components/HotelCard.tsx:571-579`) whose copy is `Rate from {providerName}. Last-checked time unavailable.` (`rateCheckCopy`, `app/components/HotelCard.tsx:416`). This is the natural home for a secondary "report a price problem" affordance — it is already the "how do we know this price" region.
- The card holds every field a report needs in scope: `hotel.id`, `hotel.source`, and `hotel.pricePerNight` (`Money`) — no new data plumbing required to attach a report here.
- **Gap:** zero report affordance. `grep -ri "report"` across `app/` and `lib/` returns no price/data-reporting UI or API.

### Attach point B — post-handoff review (`app/book/BookingFlow.tsx` → `HotelHandoffReview`)

- `HotelHandoffReview` (`app/book/BookingFlow.tsx:481-522`) is the last expaify-controlled screen before the provider. It already sets the expectation that price can change: `hotelTermsCopy` (`app/book/BookingFlow.tsx:18`) and the "Before you continue" panel (`app/book/BookingFlow.tsx:498-504`) tell the user to compare rate, currency, and price basis on the provider page.
- The `Continue to provider` link opens the partner in a new tab with `target="_blank" rel="noopener noreferrer sponsored"` (`app/book/BookingFlow.tsx:506-514`). After this click expaify has **no knowledge the user ever came back** — there is no `visibilitychange`, `focus`, or referrer handling anywhere in `app/` or `lib/` (confirmed by grep). Any return-triggered prompt would have to be built from nothing and would be fragile across tab/window behavior.
- This screen carries a fully-typed `BookingHotelContext` (`lib/booking/config.ts:18-29`): `offerId`, `provider`, `priceCents`, `currency`, `priceBasis`, `name`, `providerUrl`. That is a superset of the minimum report shape — the report can be populated here with no additional context passing.
- **Gap:** the disclaimer is one-directional. It tells the user the price may change; it has no control to record that it was wrong. The `actionStackCls` block (`app/book/BookingFlow.tsx:505-518`) has room for a tertiary report entry below the two existing actions without touching the CTA.

### Attach point C — deal-feed detail (`app/deals/[dealId]/page.tsx`)

- This is a server component. Its outbound action is `CompareRow` (`app/deals/[dealId]/page.tsx:347-353`), whose caveat is `Opens the provider site. Prices and availability can change.` It sends clicks to partner **search** pages, not a specific rate (per discovery), so it is a distinct, upstream source of "the price I saw isn't the price I found."
- It already has a staleness-signal precedent: the "Price may be out of date" banner (`app/deals/[dealId]/page.tsx:254-262`) and an analytics beacon `TrackOnMount event="deal_stale_banner_viewed"` (`app/deals/[dealId]/page.tsx:256`). A report control here would need a small client island (the page is otherwise server-rendered); `deal.id` and `{ priceCents: deal.deal_price_cents, currency: 'USD' }` are in scope to seed it.
- **Scope call:** attach points A and B are the primary hotels-first targets (they carry the live `HotelOffer`/`BookingHotelContext` and the CTA the discovery centers on). Attach point C is a **secondary/stretch** target — the report shape below is designed to accept it (`source: 'expaify'`, deal id as `offerId`) but design should not block on it.

### Persistence + telemetry reality

- `lib/analytics.ts` `track()` is a no-op outside `NODE_ENV === 'development'` — it only `console.debug`s (`lib/analytics.ts:3-7`). `TrackOnMount` (`app/components/TrackOnMount.tsx`) is the only wrapper and inherits that dead end. **A report wired to `track()` would reach no one and persist nothing.** A report therefore requires a real write path (DEV-stage API route + table), not an analytics event.
- No report/mismatch concept exists in the type system: `lib/types.ts` has `Money`, `HotelOffer`, `DealScore`, `PricePoint` but no report shape. `scripts/snapshot-job.ts` writes `hotel_snapshots`; `lib/pipeline/dealDetection.ts` reads `price_snapshots` — neither has any user-signal input.

## Reference Pattern Comparison

Comparing at the **interaction-pattern** level (placement, category-first vs. free-text, pre/post handoff, gating), not visual style.

### Google Hotels — per-price feedback

- Each price row a partner supplies carries a lightweight, secondary "feedback / report a problem" affordance adjacent to the price, distinct from the primary "Visit site" action.
- The report is **category-first**: the user picks a structured reason (e.g., price is different, dates/room don't match, link broken) before any free text; a comment field is optional, not required.
- It is **post-consideration and non-blocking**: reporting never gates the outbound link, and the outbound link never requires reporting.

### Booking.com — structured property/price issue reporting

- Reporting an issue with a property or its listed information is a structured chooser (pick the issue type) rather than an open free-text ticket, with an optional detail field.
- The affordance is visually secondary to the book/reserve action and lives near the information it concerns (the rate/room block), not in a separate support destination.

### Distilled pattern (applies to expaify)

1. **Placement:** report entry sits next to the price/handoff, styled as tertiary/secondary — never competing with the primary CTA.
2. **Category-first:** user taps a reason from a small fixed set before any typing; free text is optional.
3. **Non-blocking, no-booking-required:** available whether or not the user completes handoff; submitting is independent of the CTA.
4. **Low commitment:** a couple of taps, one optional line, immediate confirmation — completable in well under 15 seconds.
5. **Persistent, not return-triggered:** the affordance is always present on the surface; it does not depend on detecting a return from the partner tab.

**Delta in expaify:** expaify has none of the affordance and none of the persistence, but already has the two ideal anchor regions (the card's `Rate check` panel and the review screen's action stack) and the identifiers to populate a structured report.

## Mismatch-Category Taxonomy (Testable Hypotheses)

Each category is a fixed, tappable chip. `category` is the primary aggregation field. Each maps to a downstream exposure signal (see next section). These are hypotheses to validate in design/QA, not final law — but the set must stay small enough to fit as chips on 375px.

| Chip label (working copy) | `category` enum value | What it claims | Populates / drives |
|---|---|---|---|
| Price was higher | `price_higher` | Partner rate exceeded the rate expaify showed | Strongest exposure signal — inflates a false "Great"/"Good"; counts toward suppression |
| Price was lower | `price_lower` | Partner rate was cheaper than shown | Accuracy signal; low trust-harm but flags stale-high data; lighter weight |
| Rate/room not available | `rate_unavailable` | The shown rate/room could not be booked | Availability signal; counts toward suppression (listing not actionable) |
| Wrong hotel/listing | `wrong_listing` | Handoff landed on a different property | Integrity signal; high weight — listing should be pulled pending re-verification |
| Wrong dates | `wrong_dates` | Partner showed different check-in/out than expected | Integrity signal; medium weight |
| Something else | `other` | Requires the optional note to be meaningful | Triage bucket; note is effectively required for this chip |

Design directive for taxonomy: `price_higher`, `rate_unavailable`, and `wrong_listing` are the trust-critical trio (they produce a *falsely favorable or unbookable* deal) and should be weighted more heavily in the exposure calculation than `price_lower`/`wrong_dates`. `other` must not be the default and should visually invite the note.

## Minimum Report Data Shape (Requirement)

The report is a **user claim to aggregate**, never an authoritative price correction. It must not mutate any displayed price. Money uses the existing `Money` contract (`lib/types.ts:1`) — never a bare number. Proposed shape (final typing is a DEV-stage decision; this is the requirement):

```ts
type PriceReportCategory =
  | 'price_higher'
  | 'price_lower'
  | 'rate_unavailable'
  | 'wrong_listing'
  | 'wrong_dates'
  | 'other';

type PriceReportSurface = 'hotel_card' | 'handoff_review' | 'deal_detail';

interface HotelPriceReport {
  offerId: string;            // HotelOffer.id / BookingHotelContext.offerId / deal.id
  source: string;             // HotelOffer.source / BookingHotelContext.provider — ties reports to a partner
  surface: PriceReportSurface;// where it was reported (attach point A/B/C)
  category: PriceReportCategory;
  shownPrice: Money;          // the nightly rate expaify displayed — { priceCents; currency }, never a float
  note?: string;              // optional, single line, length-capped (e.g. ≤240 chars), never required except intent for 'other'
  createdAt: string;          // ISO timestamp, server-assigned
}
```

Notes / constraints:

- **No "corrected price" field.** Capturing a user-asserted actual price is explicitly out of scope for MVP — it invites a fabricated authoritative number and a second money-handling path. If added later it must be a separate optional `Money` clearly labeled as an unverified claim, never fed into scoring as truth. Keeping the report to `category` + optional note honors the discovery's "never fabricate a corrected price as fact" constraint.
- `shownPrice` is the price expaify displayed at report time, copied from `HotelOffer.pricePerNight` / `BookingHotelContext` — it anchors the report to what the user actually saw, surviving later re-pricing.
- `source` is mandatory: it is the only field that answers "do mismatches cluster on one partner" (discovery signal #3). `HotelOffer.source` / `BookingHotelContext.provider` already carry it.
- Aggregation keys the product team needs: by `offerId`, by `source`, by `category` → report rate, repeat-offender partners, and per-listing suppression candidates.
- The write path is a DEV-stage POST route (e.g. `app/api/hotel-price-report`) returning `Result<T>` and a table; it must **not** reuse `lib/analytics.ts` (no-op) and must validate `shownPrice` with the existing money guard (`isValidMoney`), rejecting non-integer/negative cents.

## Reduced-Exposure Follow-up Workflow (Requirement for UXDES → DEV)

"Reduced exposure" means: once a listing accumulates enough credible mismatch reports, expaify stops presenting it as a confident deal until it is re-verified. This is a requirement, not an implementation.

- **Threshold, weighted by category:** define a suppression threshold over a rolling window (e.g. last N days) where trust-critical categories (`price_higher`, `rate_unavailable`, `wrong_listing`) count more than `price_lower`/`wrong_dates`. Exact N and weights are a DEV/product decision; the requirement is that a listing flagged repeatedly must cross into a "pending re-verification" state.
- **Effect on `scoreDeal.ts` output:** `scoreDeal` is a pure function (`lib/scoring/scoreDeal.ts`) and must stay pure — it should not query reports itself. Instead, callers must degrade a flagged listing: when a listing is `pending re-verification`, either suppress the verdict entirely or cap it at low-confidence `Typical` (mirroring the existing thin-data cap at `lib/scoring/scoreDeal.ts:113,125`), never surfacing `Great`/`Good`. The report signal is an **input to the caller**, applied before/around `scoreDeal`, not a change to the scoring math.
- **Effect on nightly snapshot / deal detection:** a `pending re-verification` listing should be excluded from (or marked in) `insertHotelSnapshots` inclusion (`scripts/snapshot-job.ts:47-68`) and from deal promotion in `detectDealsForMarket` (`lib/pipeline/dealDetection.ts`) until re-verified, so a contested rate stops feeding both the baseline it is scored against and the deal feed.
- **Re-verification clears the flag:** the suppression is temporary and self-healing — a fresh confirming snapshot (or manual clear) returns the listing to normal scoring. The report data persists for partner-level aggregation even after clear.
- **Never destructive:** a report reduces *exposure/confidence*, it never deletes a listing, rewrites a stored price, or asserts the user's number is correct.

## Design Directives (Specific, Testable)

1. **Two persistent attach points, no return-detection dependency.** Place a tertiary "Report a price problem" affordance (a) inside the card's `Rate check` region (`app/components/HotelCard.tsx:571-579`) and (b) below the action stack in `HotelHandoffReview` (`app/book/BookingFlow.tsx:505-518`). It must be always-present, visually subordinate to `Review hotel` / `Continue to provider`, and must not alter or gate those CTAs. Do **not** build `visibilitychange`/`focus` return-from-partner prompting for MVP (no infrastructure exists; it is fragile) — persistent affordances cover both "still on partner" and "returned to expaify" cases.
2. **Category-first, chip-based, one optional line.** Opening the affordance reveals the fixed chip set from the taxonomy above (single-select), plus one optional single-line note (length-capped) and a submit. No multi-field form, no required free text except the implicit expectation for `other`. Full path (open → tap chip → submit) must be completable in under 15 seconds and in ≤3 interactions.
3. **Every state specified.** Design must cover: default (collapsed affordance), open/selecting, submitting (in-flight), success (inline confirmation, e.g. "Thanks — we'll re-check this rate"), error (submit failed, retry, CTA still usable), and the disabled/unavailable-price case (if `!hasValidPrice`, the report affordance may still allow `rate_unavailable`/`wrong_listing`/`other`). Specify 375px and 1280px layouts — chips must wrap without horizontal scroll or overlapping text at 375px.
4. **Accessibility parity with existing controls.** The trigger and chips must be keyboard reachable with a visible focus ring matching existing tokens (`--border-focus`, cf. `app/components/HotelCard.tsx:517`), each chip labeled for assistive tech, submission status announced via `aria-live` (mirror the `role="status"`/`aria-live` pattern already in `StatusPanel`, `app/book/BookingFlow.tsx:216-217`). Uses design-system tokens only — no new colors/sizes.
5. **Report carries the exact shown price and source.** On submit, the report must send `shownPrice` as `Money` copied from the live `HotelOffer.pricePerNight` / `BookingHotelContext`, plus `source`/`provider` and `offerId`, to a real DEV-stage endpoint returning `Result<T>` — never through `track()`. Design copy must frame it as a claim expaify will re-check ("we'll re-verify this rate"), never as an instant price correction, honoring the "never fabricate a corrected price" constraint.

## Open Questions / Handoff Notes for UXDES

- **Rolling window + threshold values** for suppression (N reports, day window, per-category weights) are deferred to DEV/product; UXDES should spec the *user-facing* states and the report interaction, and note the exposure behavior as a DEV requirement.
- **Attach point C (deal detail)** requires a small client island in an otherwise server-rendered page; treat as secondary. If cut for MVP, the data shape (`surface: 'deal_detail'`, `source: 'expaify'`) already accommodates adding it later without a schema change.
- **Duplicate/abuse guarding** (one user spamming reports) is a DEV concern; UXR flags it so the endpoint design accounts for it (e.g., soft per-session throttle) without adding UI friction.
- **No support inbox**: confirmed out of scope — output is queryable structured data, not a two-way conversation.

## Handoff

Next stage: **UXDES-PRICE-ACCURACY-FEEDBACK-01** — produce the implementation-ready design spec (all states, final copy, Tailwind token patterns) for the two-attach-point, chip-based report affordance and its confirmation/error states, plus the report data-shape and exposure requirements above for the downstream UI/DEV stages.
