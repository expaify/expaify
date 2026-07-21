# UXR-TOTAL-STAY-COST-01: Total Stay Cost Transparency Research

Date: 2026-07-21
Stage: UX Research
Persona: Senior UX Researcher

## Source Inputs

- Discovery report: `docs/pipeline/total-stay-cost/01-discovery.md`
- Prior research being extended, not repeated: `docs/pipeline/hotel-price-visibility/02-research.md` (2026-07-02, stalled before `03-design.md`, scoped only to `HotelCard` stay-length)
- Current implementation audited:
  - `lib/types.ts` (`HotelOffer`, `Result`)
  - `lib/booking/config.ts` (`BookingHotelContext`, `buildHotelBookingHref`, `parseBookingHotelContext`)
  - `lib/pipeline/dealDetection.ts` (`DealRow`, `formatWindow`)
  - `app/api/deals/route.ts` (`ApiDeal`, `toApiDeal`, `mockToApiDeal`)
  - `app/components/ui/DealCard.tsx`
  - `app/deals/DealFeed.tsx`
  - `app/deals/[dealId]/page.tsx`
  - `app/components/ui/PriceBlock.tsx`
  - `app/components/ui/CompareRow.tsx`
  - `app/components/HotelCard.tsx`
  - `app/book/BookingFlow.tsx`, `app/book/page.tsx`
  - `app/page.tsx` (current landing page — audited to check the discovery's claim that it renders `HotelCard`)
  - `lib/analytics.ts`
  - `lib/money.ts`, `lib/scoring/scoreDeal.ts`
- Reference patterns checked:
  - Booking.com Demand API pricing/display guidance (already reviewed by prior research; re-applied here, not re-fetched)
  - Google Hotel Prices tax/fee policy (already reviewed by prior research; re-applied here)
  - FTC "Rule on Unfair or Deceptive Fees" (short-term lodging), finalized Dec 2024, effective ~May 2025: [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2024/12/federal-trade-commission-announces-bipartisan-rule-banning-junk-ticket-hotel-fees), [FAQ](https://www.ftc.gov/business-guidance/resources/rule-unfair-or-deceptive-fees-frequently-asked-questions), [Hotel Dive summary](https://www.hoteldive.com/news/ftc-junk-fees-rule-takes-effect-hotels/747738/)
  - Industry resort-fee benchmark data: [The Points Guy](https://thepointsguy.com/glossary/what-is-a-resort-fee/), [Autopilot](https://withautopilot.com/blog/hotel-resort-fee)

## Research Summary

The discovery report's premise — that a nightly rate with no stay multiplier and no fee context appears at four live steps (deals feed, deal detail, live search `HotelCard`, and `BookingFlow` handoff) — is only **half true today**. Code audit confirms the deals feed (`DealCard`) and the deal detail page genuinely are live, reachable surfaces with exactly the gap described. But `app/page.tsx` no longer contains a search form or live hotel-search result rendering; it is now a marketing landing page that only renders `DealCard` (via `getActiveDeals`). Nothing in `app/` calls `/api/search`, and nothing in `app/` links to `buildHotelBookingHref`'s `/book?kind=hotel...` output except `HotelCard.tsx` itself, which is not imported by any route (`app/page.tsx`, `app/deals/**`) — only by a test file. `HotelCard` and the `BookingFlow` hotel path are real, working code, but **currently unreachable from any live user journey**. This matters for design/dev prioritization: the deals feed and deal detail page are the actual daily user path and should be fixed first and with more confidence; `HotelCard`/`BookingFlow` fixes are correctness-for-when-reachable-again work, not active-traffic fixes.

Where the surfaces are live, the specific defect is sharper than "missing a field": `nights` is not lost anywhere upstream. It is present in `price_snapshots`/`deals` (DB), in `DealRow`, in the `/api/deals` response (`ApiDeal.nights`), and in the client-side `ApiDeal` type in `DealFeed.tsx`. It is dropped at exactly one point: `DealFeed.tsx:695-711`, where the object literal passed into `<DealCard deal={...}>` omits `nights`, and `DealCardDeal` (`DealCard.tsx:14-30`) has no field to receive it even if it were passed. The deal detail page has the number in scope server-side (`deal.nights`) and renders it, but as an isolated `Fact` 300+ lines below the price block, never combined with it. Neither surface, nor `HotelCard`, nor `BookingFlow` has ever had a taxes/resort-fee/pay-at-property field to draw from — no hotel provider adapter returns one.

## Current Implementation Findings

### 1. `DealCard` / `DealFeed` — the live feed drops `nights` at hand-off, not upstream

- `DealRow.nights` exists in the DB row shape (`lib/pipeline/dealDetection.ts:166`) and is selected in every query that builds a `DealRow` (`lib/pipeline/dealDetection.ts:188`, `:282`).
- `/api/deals` carries it through unmodified into `ApiDeal.nights` for both the unlocked and mock paths (`app/api/deals/route.ts:22`, `:46`, `:68`, `:92`).
- `DealFeed.tsx`'s own client-side `ApiDeal` type also declares `nights: number` (`app/deals/DealFeed.tsx:53`) — the data arrives in the browser.
- It is discarded only when `DealFeed.tsx` constructs the prop object for `DealCard` (`app/deals/DealFeed.tsx:695-711`): the object literal lists `id`, `hotelName`, `city`, `stars`, `photoUrl`, `dealPrice`, `medianPrice`, `discountPct`, `checkInWindow`, `snapshotCount`, `links`, `headline`, `isMock`, `firstSeen`, `updatedAt` — no `nights`.
- `DealCardDeal` (`app/components/ui/DealCard.tsx:14-30`) has no `nights` field to receive it even if passed, and the price block (`app/components/ui/DealCard.tsx:133-149`) renders only `{formatMoney(deal.dealPrice)} / night` plus the strikethrough median — no stay length, no subtotal, no fee copy anywhere in the component.
- `app/page.tsx` (the landing page) uses the *same* `DealCard` component with its own separately-declared `DealCardDeal` type (`app/page.tsx:14-30`), which also omits `nights`, and its own `rowToCard` mapper (`app/page.tsx:32-56`) also drops it — same gap, same component, second call site.

Impact: this is a one-hop wiring fix at the `DealCard` prop contract and its two call sites, not a data-availability problem. `nights` is sitting in memory in the browser (`DealFeed.tsx`) unused.

### 2. Deal detail page — `nights` and price are both in scope but never reconciled

- `PriceBlock` renders `dealPrice`/`medianPrice` only, with `perNight` defaulting true (`app/components/ui/PriceBlock.tsx:11-32`); it has no prop for nights or a computed subtotal.
- The detail page's price section states "Nightly rate before taxes and fees. Taxes, fees, cancellation policy, and final total are confirmed by the provider." (`app/deals/[dealId]/page.tsx:331-333`) immediately above the primary CTA zone — this is the last expaify-controlled moment before the user clicks an OTA link, and it still shows no number besides the nightly rate.
- `deal.nights` is rendered 70+ lines later, inside a `Stay details` `dl` grid, as one of eight isolated facts (`Fact label="Nights"`, `app/deals/[dealId]/page.tsx:411`), below price, CTA, price history, and Deal Score.
- The page already computes `checkOutDisplay` from `checkInDisplay` + `nights` via `addNights()` (`app/deals/[dealId]/page.tsx:44-48`, `:234`), so nights-aware date math already exists in this file — it is a formatting/placement problem, not a missing capability.

Impact: same conclusion as the prior research reached for `HotelCard` — the number needed to compute a stay-aware estimate is already server-side and already partially used (for the checkout date), just never surfaced beside price.

### 3. `HotelCard` and `BookingFlow` hotel path — real code, currently unreachable

- `grep -rn "HotelCard"` across `app/` returns only `app/components/HotelCard.tsx` itself and `app/components/__tests__/scorePresentation.test.tsx`. No page imports or renders it.
- `app/page.tsx` is 486 lines of static marketing sections (hero, logo strip, "how it works", pricing, FAQ) built from `getActiveDeals()` → `DealCard`. It performs no search, calls no `/api/search`, and has no results grid. The discovery report's citation of `app/page.tsx:2076`/`:2157` describes an earlier version of this file that no longer exists in this worktree.
- `grep -rn "/api/search"` across `app/` (excluding the route's own folder and its tests) returns nothing — no client code fetches it.
- `buildHotelBookingHref(hotel)` (`lib/booking/config.ts:360`), the only producer of a hotel `/book?kind=hotel...` URL, is called only from `HotelCard.tsx:412`. Since `HotelCard` renders nowhere, this URL is never generated by the live app; `/book?kind=hotel...` is reachable only by hand-constructing the query string.
- `BookingHotelContext` (`lib/booking/config.ts:18-29`) has no `nights` field at all — `kind`, `offerId`, `provider`, `name`, `area`, `location`, `priceCents`, `currency`, `priceBasis`, `providerUrl`. Even if this path became reachable again today, it structurally cannot show stay length; that would require a new query param and a new context field, not just a UI change.
- Both `HotelHandoffReview` (`app/book/BookingFlow.tsx:481-521`, "Back to search" link at `:515` points to `/`) and the hotel summary panel (`app/book/BookingFlow.tsx:159-197`) repeat "per night before taxes and fees" (`getHotelPriceBasisLabel`, `:81-84`) with the same generic `hotelTermsCopy` disclosure (`:18`) used nowhere else verbatim.

Impact: `HotelCard`'s stay-length gap (already directed by the prior research brief) and this ticket's fee-transparency gap both still need fixing for correctness and for whenever this surface is reconnected, but neither is currently in front of a user. Treat as lower urgency than items 1 and 2, and flag the `BookingHotelContext` type gap as a DEV dependency distinct from the `HotelOffer` gap already flagged by prior research.

### 4. No fee data anywhere — confirmed unchanged since discovery

- `HotelOffer` (`lib/types.ts:137-151`) still has only `pricePerNight: Money` and `priceBasis?: 'per_night_before_taxes_fees'`. No `taxes`, `resortFee`, `payAtProperty`, or `totalPriceCents` field exists anywhere in `lib/types.ts`.
- `lib/providers/hotellook.ts` was not re-audited line-by-line here (already covered by prior research); its shape has not changed — it normalizes `priceFrom` into `pricePerNight` only. `amadeus`/`kiwi` hotel paths remain stubbed.
- Confirms discovery: this is a DEV provider-adapter dependency for real fee data, not something UXDES/UI can source today.

### 5. Instrumentation — confirmed still a no-op, all four surfaces

- `lib/analytics.ts` is unchanged: a two-line `console.debug`-only stub gated on `NODE_ENV === 'development'`, no event pipeline (`lib/analytics.ts:3-7`).
- `CompareRow.tsx` (`app/components/ui/CompareRow.tsx:32-59`) renders raw `<a href target="_blank">` elements with no `onClick`, no `track()` call, at either card size (`compact` or `primary`). `DealFeed.tsx` does call `track()` elsewhere (filter/empty-state events, e.g. `:340`, `:347`, `:416`, `:422`) — so the app's `track()` call pattern exists and is a known idiom, it is simply never wired to `CompareRow`.
- No support/report surface exists anywhere in `app/` or `lib/` (confirmed by repeating discovery's search; nothing found).

Impact: the ticket's originally proposed success signals (fee-related support/report events, CTA hesitation, outbound click drop-off after price expansion) remain unobservable. This is a measurement gap to flag to TEST/UXDES, not a metric to design against.

## Reference Pattern Comparison

### Booking.com / Google Hotels (carried forward from prior research, still applicable)

No new delta beyond what the prior research already established: prefer showing total when known, always state whether taxes/fees are included/excluded/unknown, never invent a total or a charge category. This ticket's new question is what to do when a *computed* (not provider-confirmed) subtotal is available — neither reference pattern documents a public API for "estimated total" the way expaify would need to originate it, because both Booking.com and Google source their totals from the property/OTA, not by client-side multiplication.

### FTC Rule on Unfair or Deceptive Fees (new to this research — directly relevant to research question (a))

Effective ~May 2025, the FTC requires any business that offers, displays, or advertises a price for short-term lodging to disclose the **true total price inclusive of all mandatory fees**, and to display that total more prominently than other pricing information, before checkout. This rule binds the seller/advertiser of the room (the hotel or OTA), not a third-party comparison site that only links out — but it is strong external validation that (a) total-price-first is now the regulatory baseline for this industry, not just a UX nicety, and (b) a "per night before taxes and fees" headline number, standing alone, is exactly the pattern regulators moved against. It does **not** license expaify to publish its own estimated total as if it were a compliant total-price disclosure — expaify is not the seller and has no fee data to make that total accurate. The correct reading is: lean harder into visibly labeling the nightly number as partial, and treat the OTA's page (where the FTC rule applies directly) as the actual source of the compliant total, which the design should say explicitly.

### Resort-fee benchmark data (new — for research question (c))

Industry sources (The Points Guy, Autopilot) put U.S. resort fees, where charged, in roughly the $10–$50/night range, averaging ~$33–42/night, sometimes described as ~11% of room rate on average — but this varies enormously by market and property (Las Vegas Strip properties commonly $45–55/night; many U.S. hotels charge $0). There is no single defensible "typical range" narrow enough to attach to an individual hotel card without a real risk of being wrong in either direction by 2–5x.

## Exact Gap

Current code does this:

- Deals feed and deal detail page: hold `nights` in scope (DB → API → client) but never render it next to price; `DealCard`'s type/props don't carry it at all.
- `HotelCard`/`BookingFlow`: same nightly-only pattern, plus these two surfaces are not currently reachable from any live route, and `BookingHotelContext` has no field to carry nights even if reconnected.
- All four surfaces: identical "before taxes and fees" / "Provider confirms final total, taxes, fees..." disclaimer language, independently written in each component, with no shared copy source and no numeric estimate anywhere.
- No surface computes `pricePerNight × nights` for display, anywhere.
- `CompareRow` (used by both `DealCard` and the deal detail page) fires zero analytics events on outbound click.

Reference/regulatory patterns do this:

- Booking.com / Google: identify the price's basis explicitly (total vs. base rate vs. itemized); never blur or invent.
- FTC rule (binds the seller, not expaify): total price, inclusive of mandatory fees, must be the most prominent number the *seller* shows before checkout.
- Neither reference source publishes a formula for a third party to safely originate a computed "estimated total" it did not price itself.

The delta: expaify needs (1) a stay-length fact wired onto every hotel price surface using data that already exists, (2) a computed, clearly-labeled-as-estimate subtotal (`pricePerNight × nights`) that is visually and semantically distinct from a provider total, (3) one shared fallback-copy pattern for "fees not returned by provider," reused verbatim across all four surfaces instead of four independently-drifting disclaimer strings, and (4) an explicit decision to *not* publish a generic resort-fee range, because no defensible per-hotel estimate exists.

## Design Directives For UXDES

1. **Wire `nights` onto `DealCard` first — it is a one-hop fix, not a data problem.**
   Add `nights: number` to `DealCardDeal` (`app/components/ui/DealCard.tsx`) and pass it from both call sites that already have it in scope: `DealFeed.tsx:695-711` (add `nights: deal.nights`) and `app/page.tsx`'s `rowToCard`/`DealCardDeal` (`app/page.tsx:14-56`). Render it beside price as `{nights}-night stay` / `1-night stay`, not only in `checkInWindow`.

2. **Show a computed subtotal on `DealCard` and deal detail, labeled unambiguously as an estimate, never as a total.**
   Where `nights` and `dealPrice` are both valid, compute `dealPrice.priceCents * nights` and display it as `Est. {formatMoney(subtotal)} for {nights} nights · before taxes & fees` — visually subordinate to the nightly headline price (smaller weight/size), never replacing it, never styled to look like a provider-confirmed total (no strikethrough-median treatment, no bold financial emphasis matching the primary price). Do not attach a currency-per-fee estimate (see directive 6) — this is nightly × nights only.

3. **On the deal detail page, move the reconciliation up, not just add a number.**
   Relocate a `{nights}-night stay` fact and the computed subtotal from directive 2 into the price section (`app/deals/[dealId]/page.tsx:314-334`), immediately below the existing "Nightly rate before taxes and fees..." sentence, before the CTA zone. The `Stay details` `Fact` grid (`:404-416`) keeps its full breakdown (`Nights`, check-in/out) for completeness, but the feed/detail moment that precedes the outbound click must not be the only place a user has to scroll past four sections to find nights.

4. **Standardize one fallback-copy component/string, used verbatim on all four surfaces.**
   Today each of `DealCard`, deal detail, `HotelCard`, and `BookingFlow` writes its own "before taxes and fees" / "Provider confirms final total..." sentence independently. Define one shared copy source (e.g., a constant or small shared component) with exactly these states, and require all four call sites to consume it rather than inline strings:
   - Nightly rate shown, nights known, no fee data: `"Est. {subtotal} for {n} nights, before taxes & fees. {Provider} confirms the final total."`
   - Nightly rate shown, nights unknown/invalid: `"{nightly rate} per night, before taxes & fees. Nights unavailable — {Provider} confirms the final total."`
   - Nightly rate unavailable: keep existing `Price unavailable` copy (`HotelCard.tsx:58-60`) unchanged; this ticket does not touch that state.

5. **Do not disclose a generic resort-fee range.** Industry data (Points Guy, Autopilot) shows a $10–$50+/night spread with no reliable per-hotel default — publishing a market-wide "typical fee" figure on a specific hotel card risks being off by 2–5x and would read as expaify's own (wrong) claim, not a disclosed estimate. Fee disclosure stays qualitative ("before taxes & fees") until a provider adapter returns real per-hotel fee data (DEV dependency, tracked separately, same conclusion as discovery's constraint 2).

6. **Do not let the FTC total-price standard become expaify's implied claim.** Because the FTC rule requires the *seller* (OTA/hotel) to show the compliant total before checkout, the design should say so explicitly near the CTA — e.g., "Provider confirms the final total before you pay" — framing the OTA page as the authoritative total-price moment, not expaify's estimate. This keeps expaify's estimate honest about its own limits and sets the correct expectation for what happens after the click.

7. **`HotelCard`/`BookingFlow`: apply directives 1, 2, 4 for correctness, but do not prioritize ahead of items 1–3.** Since neither surface is reachable today, UXDES should still spec the fix (props/type changes needed: `HotelOffer` needs `checkin`/`checkout`/`nights` per prior research directive 1, and `BookingHotelContext` needs a new `nights?: number` field plumbed through `parseBookingHotelContext`/`buildHotelBookingHref`), but the acceptance bar should note these are latent-path fixes, and UI/DEV effort should sequence `DealCard` → deal detail → `HotelCard`/`BookingFlow`.

8. **Instrumentation is out of scope to build here, but the copy/estimate work should not block on it.** `CompareRow` click tracking and a support/report surface are pre-existing gaps (confirmed still true) affecting far more than this ticket; do not add tracking as part of this feature's UI change unless a separate ticket scopes it. If UXDES wants a signal to validate the new estimate copy later, it must first go through a ticket that adds `track()` calls to `CompareRow`, not assume one exists.

## Acceptance Criteria For UXDES

- The design spec covers, for `DealCard` (both feed and landing-page call sites) and the deal detail page: default (nights + subtotal known), nights-known-but-invalid (e.g., 0 or missing), price-invalid, mobile 375px, desktop 1280px, focus/keyboard, and assistive-tech text for the new subtotal line.
- The design spec covers `HotelCard` and `BookingFlow` to the same completeness as directive 7, explicitly marked as "implement for correctness, not for current traffic" so TEST does not fail the ticket on live-traffic grounds for those two surfaces.
- The design never presents `pricePerNight × nights` styled or labeled as a confirmed total; every occurrence carries "Est." and a "before taxes & fees" qualifier in the same visual unit as the number.
- The design specifies the exact shared fallback-copy strings from directive 4, written once, referenced by name, so DEV can implement a single constant/component rather than four inline strings.
- The design explicitly rules out a resort-fee range disclosure (directive 5) so DEV/TEST don't reintroduce it later without a fresh decision.
- The design identifies UI-only vs. DEV-dependency work: `DealCard`/`DealFeed`/deal-detail wiring (directives 1–3) is UI-only, since `nights` already exists end-to-end; `HotelOffer`/`BookingHotelContext` type changes (directive 7) are DEV-stage contract changes; real fee data (taxes/resort fee/pay-at-property) remains a DEV provider-adapter dependency not resolvable in this ticket.
- At 375px, `DealCard`'s price block (headline price, `/ night`, strikethrough median, new stay-length + subtotal line) must not overlap the hotel name, star rating, or `CompareRow` links.

## Out Of Scope Findings

- `HotelCard` and `BookingFlow`'s hotel path being unreachable from any live route is a pre-existing product-navigation gap (the search form that used to link to them appears to have been removed when `app/page.tsx` became a marketing landing page). Not fixed here — flagging it is this ticket's job; reconnecting search is a separate, larger decision.
- `lib/analytics.ts` being a no-op stub and the absence of a support/report surface are unchanged pre-existing gaps affecting the whole app, confirmed still true. Not fixed here (same conclusion as discovery).
- Real tax/resort-fee/pay-at-property data from a hotel provider adapter remains out of scope for UXDES/UI; it is a DEV-stage provider integration decision.
- Flight baggage-fee transparency (`docs/pipeline/baggage-fee-decision-context/`) remains a separate, already-scoped flight-side problem. Not addressed here.
- This research does not evaluate `lib/providers/hotellook.ts` line-by-line beyond confirming its normalized shape is unchanged from the prior research's audit, since that audit is still current and re-auditing it would repeat rather than extend prior work.
