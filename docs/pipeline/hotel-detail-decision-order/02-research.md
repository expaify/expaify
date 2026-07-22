# UX Research — Hotel detail decision order

**Ticket:** UXR-HOTEL-DETAIL-DECISION-ORDER-01  
**Stage:** UXR (Research)  
**Priority:** P0  
**Date:** 2026-07-22  
**Method:** Static heuristic and content audit of the current repository, followed by interaction-pattern comparison with Google Hotels and Booking.com. No production analytics, moderated sessions, or prototype test results were supplied; behavioral conclusions below are hypotheses and release gates, not observed user findings.

## Source inputs

- Discovery report: `docs/pipeline/hotel-detail-decision-order/01-discovery.md`
- Current implementation audited:
  - `app/components/HotelCard.tsx`
  - `app/components/DealScorePanel.tsx`
  - `app/components/hotelLocationContext.ts`
  - `app/book/page.tsx`
  - `app/book/BookingFlow.tsx`
  - `app/deals/DealFeed.tsx`
  - `app/deals/[dealId]/page.tsx`
  - `app/deals/[dealId]/loading.tsx`
  - `app/components/ui/CompareRow.tsx`
  - `lib/booking/config.ts`
  - `lib/types.ts`
  - `lib/analytics.ts`
- Adjacent research used as constraints, not reopened:
  - `docs/pipeline/hotel-price-visibility/02-research.md`
  - `docs/pipeline/hotel-location-decision-context/02-research.md`
  - `docs/pipeline/hotel-rating-source-confidence/03-design.md`
  - `docs/pipeline/hotel-quality-snapshot/02-research.md`
  - `docs/pipeline/guest-room-fit/02-research.md`
  - `docs/pipeline/deal-supporting-facts-order/02-research.md`
- Reference patterns:
  - [Google Travel Help — Search for hotels on Google](https://support.google.com/travel/answer/6276008?hl=en-EN)
  - [Google Hotel Center — Price Accuracy Policy](https://support.google.com/hotelprices/answer/6064419?hl=en)
  - [Booking.com property availability example — World Center Hotel](https://www.booking.com/hotel/us/world-center.html)

## Research conclusion

The discovery sequence is supported as the best prototype hypothesis: **identity and stay → nightly price and Deal Score/usual price → minimum fit evidence → one provider-confirmation boundary and room-inspection handoff → supporting evidence on demand.** It matches the questions the existing data can answer and keeps provider-owned unknowns at the transition where they become actionable.

The current product does not provide that sequence consistently. It contains three materially different structures:

1. `HotelCard` is a detailed availability-result component that can lead to `/book`, but it is not imported or mounted by any live page in this tree.
2. `/book` is a provider-handoff review that repeats identity, location, rate, price basis, and the provider-confirmation caveat, while dropping stay dates, Deal Score, quality evidence, and price freshness.
3. `/deals/[dealId]` is the reachable saved-deal detail. It leads directly to multiple providers before price history, Deal Score, and full stay details, and repeats price comparison after the handoff.

This is an information-order repair, not a request for more hotel content. UXDES should consolidate existing supported facts and explicit unknowns. It must not add rooms, amenities, reviews, availability, cancellation, or totals that the current contracts do not carry.

## Current-code evidence

### 1. The availability-search hotel card is currently an orphaned component

`HotelCard` accepts only `hotel`, `score`, and `loading` (`app/components/HotelCard.tsx:11-15`). It is rendered directly only in component tests; repository-wide search finds no production import or JSX use. The live landing page imports `DealCard`, `LockedDealCard`, and marketing components (`app/page.tsx:1-6`), while `/deals` renders `DealCard` entries that lead to saved-deal detail (`app/deals/DealFeed.tsx:680-713`).

Implication: the search-result entrant described by discovery is not a currently reachable end-to-end flow in this worktree. UXDES may specify a shared detail structure for this component path, but TEST cannot claim search-result parity until a separately authorized surface-wiring ticket mounts it. This brief does not repair that adjacent issue.

### 2. The card answers value and quality questions before the local review, but not stay context

The collapsed `HotelCard` orders photo, name, class/rating evidence, location, nightly rate with pre-tax basis and unknown freshness, a compact score state, and **Review hotel** (`app/components/HotelCard.tsx:425-510`). Expanded details then show the full Deal Score, quality evidence, location provenance, price scope, rate check, and provider-handoff copy (`app/components/HotelCard.tsx:523-580`).

The card does not receive or show check-in, check-out, night count, guests, or rooms. `HotelOffer` likewise carries hotel identity, location, class/rating evidence, nightly money, deeplink, source, and optional photo only (`lib/types.ts:137-151`).

Implication: price, score, rating, and location are available before review, but the traveler cannot verify that the displayed nightly rate applies to the stay they intend to inspect. This is the first continuity break.

### 3. The `/book` handoff review preserves only a narrow subset and repeats it

`BookingHotelContext` preserves offer ID, provider, name, area/location, nightly money, price basis, and provider URL (`lib/booking/config.ts:18-29`). `buildHotelBookingHref` serializes those fields, but not dates/night count, price freshness, Deal Score, hotel class, or guest-rating evidence (`lib/booking/config.ts:360-385`).

On `/book`, `ReviewShell` renders the page title/message, provider-confirmation status, and `HotelSummary` in the left column, with the action panel in a right column at desktop (`app/book/BookingFlow.tsx:318-341`). `HotelSummary` repeats the hotel name and location, then repeats hotel, location, location precision, provider, price basis, currency, and offer reference (`app/book/BookingFlow.tsx:159-195`). The boundary appears in the page message, the **Provider confirmation required** status, the **Before you continue** panel, the line before the CTA, and the CTA accessible name (`app/book/BookingFlow.tsx:481-518`).

Implication: the handoff is honest, but repetition displaces the missing decision facts. The user is asked to reconfirm metadata rather than completing one coherent property/value/fit pass.

### 4. Saved-deal detail exposes the handoff before its own decision evidence is complete

The reachable `/deals/[dealId]` sequence is: stale warning when applicable; 220px/320px hero photo; title/class/city/stay-window line; nightly price, savings, freshness, and a provider caveat; provider links; price history; full Deal Score; **Why this is a deal**; then **Stay details** (`app/deals/[dealId]/page.tsx:251-416`).

The provider action appears at lines 336-361, before Deal Score at lines 368-371 and before stay dates/night count at lines 403-416. **Why this is a deal** repeats usual and current nightly price already shown by `PriceBlock` and the Deal Score evidence. The final stay card repeats hotel and area, adds date facts late, and includes unavailable guest/room facts that remain provider-owned.

Implication: saved-deal entrants get the strongest freshness signal, but must either leave before seeing the score/stay evidence or scroll past the handoff and re-read repeated price facts. The current order prioritizes visual reassurance and outbound action over decision completion.

### 5. Search-result and saved-deal entrants do not share a continuity contract

The orphaned `HotelCard` path uses a single internal **Review hotel** step and then one **Continue to provider** link. The live saved-deal path opens provider links directly from the detail page through `CompareRow` (`app/components/ui/CompareRow.tsx:21-58`). The saved path carries dates and freshness but no verified guest-rating evidence; the card path carries rating/location evidence but loses dates and freshness in `/book`.

Implication: entry source changes both the facts available and the meaning/timing of the primary action. A stable hierarchy can serve both, but the detail model needs source-aware state labels rather than two unrelated page orders.

### 6. Current missing-data semantics are mostly honest but not prioritized by decision impact

- Invalid nightly money or booking URL disables the card action and gives a specific reason (`app/components/HotelCard.tsx:52-80`, `400-422`, `479-509`). This is a true action blocker.
- Missing or coarse location is rendered through labeled precision and warning copy rather than fabricated specificity (`app/components/hotelLocationContext.ts`). This is usually a fit caution, not proof that the property is unusable.
- Missing guest-rating evidence is distinguished from hotel class and provider-only evidence (`app/components/HotelCard.tsx:208-281`). This is reassurance loss, not an availability blocker.
- The availability card always says **Last-checked time unavailable** (`app/components/HotelCard.tsx:34-47`). Saved deals distinguish aging, stale, and expired states (`app/deals/[dealId]/page.tsx:221-227`, `253-261`, `326-346`).
- Missing stay dates are not represented on the card or `/book` because those contracts do not carry them. Saved detail can render **Check-in unavailable**, **Check-out unavailable**, and **Nights unavailable**, but only after provider links (`app/deals/[dealId]/page.tsx:403-415`).

Implication: the design needs a decision-impact model. Not every missing fact should disable room inspection, but every missing prerequisite must change what the product claims.

### 7. The requested funnel is not measurable in the current analytics implementation

`lib/analytics.ts` only logs generic events in development (`lib/analytics.ts:1-7`). None of `HotelCard`, `/book`, or the saved-deal detail emits `hotel_detail_viewed`, named section reach, handoff start, or back-to-results. Saved detail emits only `deal_stale_banner_viewed` when that banner mounts (`app/deals/[dealId]/page.tsx:253-260`).

Implication: no baseline or causal effect can be claimed. Instrumentation belongs in the implementation plan, but this research stage must not manufacture conversion findings.

## Prerequisite versus reassurance model

| Existing fact | Decision role | Missing-state effect | Handoff rule to validate |
|---|---|---|---|
| Hotel name | Prerequisite | The traveler cannot confirm the property. | Block a selected-hotel handoff; do not substitute generic identity. |
| Stay dates and night count | Prerequisite for interpreting a stay-specific rate | The nightly amount cannot be confidently described as applying to the intended stay. | Room inspection may remain available only with explicit **Choose/confirm dates with provider** language; do not call it the selected-stay rate. |
| Valid nightly money + currency + basis | Prerequisite for expaify's value claim | No trustworthy current price comparison can be made. | Keep the existing hard block when the price or valid provider link is absent; show a recovery action instead. |
| Deal Score, usual price, and confidence | Prerequisite for the expaify value decision; not a prerequisite for the hotel existing | The user can inspect rooms but cannot answer **Is this a good price?** from expaify. | Keep handoff available if price/link are valid, but show **Deal Score unavailable** in the normal position; never silently omit it. |
| Supported location precision | Prerequisite for property fit at at least area level | Exact address may be absent without blocking; no usable area/location makes fit unresolved. | Coarse location is a caution; no location evidence changes CTA support copy to require provider confirmation, not a false exact-location claim. |
| Hotel class / verified guest rating | Reassurance and minimum quality fit | Missing evidence reduces confidence but does not make room inspection invalid. | Never disable handoff solely for missing rating; state **Guest rating not provided** or the existing provenance-qualified equivalent. |
| Price freshness | Trust modifier | Unknown/aging means the displayed rate is not confirmed live; expired means it should not be promoted as current. | Unknown/aging retains a clearly qualified room-inspection action; expired replaces it with current-search recovery, as the saved-deal path already does. |
| Photo, price chart, detailed score evidence, offer reference | Reassurance / diagnostics | Their absence should not interrupt the core pass. | Keep below or behind the core decision path; offer reference is tertiary unless needed for support. |

This model intentionally separates **can the traveler inspect rooms?** from **can expaify claim this is a current, fitting, good-value stay?** Missing rating or exact address does not equal unavailable. Missing stay context, freshness, or score must downgrade the claim rather than silently disappear.

## Reference-pattern comparison

### Google Hotels: snapshot first, partner prices tied to trip context

Google describes result snapshots as combining user rating, key amenities, and the lowest partner price bookable for the selected dates. Its detail placesheet separates overview evidence from partner price links, and its booking links sit below the travel dates. It also distinguishes value badges from the actual partner booking transaction and tells users to check the final room cost because hotel prices can change quickly.

Interaction takeaway: identity/fit evidence and value comparison belong in the local decision surface; dates remain visible around booking links; the external partner owns completion and servicing.

Current expaify delta: the card exposes a price/value/quality snapshot but loses dates in local review. Saved detail has dates but places provider links before Deal Score and complete stay details. Neither path keeps all prerequisite facts together immediately before the handoff.

### Booking.com: availability is a dated, occupied, room-level boundary

The inspected Booking.com property page labels an **Availability** section with dates and occupancy, then lists room type, bed/fit facts, nightly price, multi-night price, included/excluded charges, cancellation/payment choice, and room selection together. This is a provider-owned room section, not a generic hotel-detail CTA.

Interaction takeaway: room availability begins when stay context, room/rate facts, and price terms are bound together. A metasearch product without room inventory should hand off into this boundary, not mimic it or imply that the preceding hotel-level rate proves a room is available.

Current expaify delta: expaify has no room/occupancy/cancellation/final-total fields, correctly leaving them to the provider. Its repair opportunity is to make that transition singular and predictable after expaify's own decision facts, not to build a fake availability section.

### Price-continuity guardrail

Google's Price Accuracy Policy defines the partner landing page as often being a room-selection page and requires price, occupancy, and dates to match the selected itinerary through the booking page. That standard is stronger than expaify's current provider contract can guarantee.

Interaction takeaway: expaify must frame its amount as an observed nightly rate and make the provider responsible for confirming the final total and live room state. It must not use **available**, **book**, **reserve**, or **final price** for the local CTA unless provider-confirmed fields later support those claims.

## Exact gap

**Current code does this:**

- Splits hotel identity, stay context, value evidence, fit evidence, and provider caveats across `HotelCard`, `/book`, and saved-deal detail.
- Uses one internal review for the orphaned search component and direct multi-provider links for saved deals.
- Repeats identity/price metadata and provider-confirmation copy while dropping dates, Deal Score, rating, and freshness between the card and `/book`.
- Places saved-deal provider links before Deal Score and complete stay details.
- Provides honest missing/unavailable copy, but does not order missing states by whether they block a claim, a fit decision, or the handoff itself.
- Emits none of the discovery funnel events.

**Reference patterns do this:**

- Keep trip dates/occupancy adjacent to price and booking/room-selection entry.
- Separate local hotel overview/value comparison from the provider-owned transaction.
- Bind actual availability to a dated room/rate choice, not a hotel-level lead-in price.
- Make price scope and final-total responsibility explicit at the transition.

**The delta:**

expaify needs one shared decision hierarchy across both entrants, source-aware missing states, and one consolidated provider boundary immediately adjacent to the outbound room-inspection action. The solution must preserve the distinction between observed nightly rate, Deal Score/usual price, and provider-confirmed final total.

## Design directives for UXDES

### Directive 1 — Use one semantic decision order on both entry paths

Specify the detail in this exact order:

1. **Property and stay:** hotel name; best-supported location label/value; check-in, check-out, and night count when carried; explicit unavailable state when not.
2. **Price and Deal Score:** observed nightly money and currency; **per night before taxes and fees**; freshness; Deal Score verdict/state, usual nightly price, comparison, and confidence.
3. **Minimum fit evidence:** hotel class and provenance-qualified guest-rating evidence; detailed location provenance only if needed beyond the identity summary.
4. **Rooms at provider:** one boundary statement plus the outbound action.
5. **Supporting evidence:** photo, price history, detailed score evidence, and offer reference after the core path or on demand.

Acceptance test: heading order, DOM order, keyboard order, and screen-reader order follow the same sequence at 375px and 1280px. A desktop two-column layout may position the handoff beside the facts, but must not move it earlier in the DOM. The hero photo must not consume the mobile first viewport ahead of property/stay and price/value facts.

### Directive 2 — Make the three price concepts adjacent and mutually exclusive

The price/value section must answer three separate questions:

- **Observed nightly rate:** `{money}` + **per night before taxes and fees** + freshness.
- **Deal Score/usual price:** whether that nightly rate is Great/Good/Typical or unavailable, its confidence, and the usual nightly comparison.
- **Provider-confirmed final total:** never display a value unless a future provider contract supplies one; current copy must say the provider confirms it after room/rate selection.

Acceptance test: in a five-second recall task, at least 85% of participants correctly identify which amount is one night, which value is historical comparison, and where the final total will be confirmed. No prototype may calculate `nightly × nights` and label it a confirmed total.

### Directive 3 — Encode missing facts by decision impact, not with one generic warning

UXDES must cover at minimum: complete stay; missing dates/night count; verified, provider-only, inferred, and absent rating; fresh, aging, stale/unknown, and expired price; exact, coordinates, area, search-area, and unavailable location; Deal Score loading, confident, low-confidence, and unavailable; valid action, missing price, missing link, and expired deal.

Rules:

- Missing rating/class is non-blocking reassurance loss.
- Coarse but labeled location is non-blocking; no usable location is an unresolved fit caution.
- Missing/unknown freshness is non-blocking only with explicit observed-rate language; expired replaces room handoff with current-search recovery.
- Missing stay context prevents describing the rate as selected-stay pricing; room inspection may continue only as a provider date-confirmation task.
- Missing valid money or provider URL remains a hard action block.
- Missing Deal Score occupies its normal section with explicit unavailable copy; it is never silently removed.

Acceptance test: participants distinguish **not provided / confirm with provider** from **unavailable / cannot continue** with at least 85% accuracy across the required cuts.

### Directive 4 — Consolidate provider ownership into one boundary-action unit

Use one visible boundary immediately before the outbound action. Required meaning: **The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.** The action must describe inspection, for example **Check rooms at {provider}** or, when multiple links are valid, **Check rooms on {provider}**. Do not use **Book**, **Reserve**, or any copy that implies availability.

Earlier price copy may retain only the local scope statement **per night before taxes and fees**; do not repeat the full provider checklist beside the title, price, status, action panel, and accessible name. The accessible name may include the boundary once for context.

Acceptance test: at least 85% of participants answer that the next step is to inspect room options and that neither a room nor final price is yet confirmed. The boundary and action remain one visual/semantic unit at 375px and 1280px.

### Directive 5 — Preserve one hierarchy while changing only entrant emphasis

- **Search/availability-card entrant:** retain the rate's search context when available; prioritize exact dates/night count and use **Back to results** tied to the originating results state. Do not route the user to generic `/` when a recoverable results destination exists.
- **Saved-deal entrant:** retain the same section order, but foreground observed/found freshness and saved/expired state inside the price section. Do not place provider links before Deal Score and stay details.
- Both entrants use the same section names and provider-boundary copy. Entry source may change labels and recovery destination, not the hierarchy.

Acceptance test: after entering from either prototype, at least 85% of participants can point to property/stay, price/value, fit, and room-inspection sections in the same order; back navigation returns to the correct source without losing orientation.

## Validation plan

Because no behavioral data was provided, these directives require prototype validation before implementation is called evidence-backed.

### Participants and cuts

- 12–16 moderated sessions total: half first-time/infrequent hotel shoppers entering from a result, half returning saved-deal members.
- Balance 375px mobile and 1280px desktop.
- Rotate scenarios for verified versus absent rating, fresh versus stale/unknown price, and complete versus missing stay context. These are scenario cuts, not separate features.

### Method

Use a within-subject comparison between the current sequence and the proposed sequence, counterbalanced to reduce learning effects. Test information priority and comprehension, not visual preference.

Tasks:

1. Confirm which property and stay the price applies to.
2. Explain the nightly rate, usual price/Deal Score, and what the provider still confirms.
3. Decide whether missing rating, freshness, location precision, or dates means **unavailable**, **unknown**, or **safe to inspect at provider**.
4. Find where room inspection begins and activate the provider handoff.
5. Return to the originating result/deal list.

Release gates:

- ≥85% correct price-scope/final-total comprehension.
- ≥85% correct unknown-versus-unavailable comprehension.
- ≥85% correctly identify the outbound step as room inspection, not confirmed availability or booking.
- ≥90% find the room-handoff unit without moderator help.
- 100% complete source-correct back navigation by keyboard and pointer.
- No critical overlap, clipping, obscured focus, or semantic-order mismatch at 375px or 1280px.

### Instrumentation specification

Once a mounted detail exists, emit:

- `hotel_detail_viewed`: `hotel_id`, `entry_source`, `viewport_group`, `has_dates`, `has_verified_guest_rating`, `score_state`, `price_freshness_state`.
- `hotel_decision_section_reached`: fire once per view when at least 50% of `identity_stay`, `price_score`, `fit_evidence`, or `room_handoff` is visible for at least one second; include `position`.
- `hotel_room_handoff_started`: fire before outbound navigation; include provider, entry source, viewport group; exclude raw URLs and personal data.
- `hotel_detail_back_to_results`: fire on the explicit source-correct back action.

Evaluate room-section reach and handoff initiation together with back-to-results and time-to-handoff. An outbound click alone is not booking success. Segment results by entrant and required data-state cuts; do not pool mobile and desktop before checking interaction effects.

## UXDES acceptance checklist

- Covers default, loading, empty, error, unavailable price/link, expired/stale, missing stay, missing/qualified rating, missing/coarse location, Deal Score loading/low-confidence/unavailable, mobile 375px, desktop 1280px, keyboard/focus, and assistive-technology order.
- Provides final copy for every visible state, including source-correct back actions and the single provider boundary.
- Does not add room inventory, occupancy, beds, amenities, reviews, cancellation terms, final totals, or live availability fields.
- Keeps money in integer-minor-unit-backed display and never invents a total.
- Preserves affiliate/sponsored semantics on every outbound provider link.
- Identifies which parts are UI ordering versus DEV contract/instrumentation work.
- Does not claim the orphaned `HotelCard` flow is live or testable end to end until mounted by an approved ticket.

## Blockers and out-of-scope findings

- **Recovered upstream artifact:** the assigned branch did not contain `01-discovery.md`; its exact contents were recovered from predecessor monitor commit `4004de9` and restored in this worktree. No discovery content was rewritten.
- **Measurement blocker:** the required events and production dataset do not exist, so this brief cannot report baseline conversion, scroll depth, or causal lift.
- **Surface-wiring blocker for parity testing:** `HotelCard` and `GET /api/search` are not mounted by a live results page. Search-result-to-detail parity cannot pass TEST until a separate authorized ticket resolves that wiring.
- **Contract dependency:** dates/night count, Deal Score, quality evidence, and freshness do not all survive into `BookingHotelContext`. A unified live detail will require a scoped DEV contract decision after UXDES; this UXR ticket does not change types or business logic.
- **Saved-deal structural difference:** saved detail uses direct multi-provider links rather than the `/book` review. UXDES must define the shared hierarchy, but changing routing/contract behavior belongs to UI/DEV stages.
- **Out of scope:** provider selection, new provider fields, room selection, amenities/reviews/photos/access/cancellation workstreams, Deal Score math, booking completion, search-page wiring, and analytics implementation.

## Handoff

Create `UXDES-HOTEL-DETAIL-DECISION-ORDER-01` for an implementation-ready spec that applies the five directives above to both the HotelCard→review concept and saved-deal detail; defines the shared semantic/DOM hierarchy; provides final copy for every missing, stale, expired, loading, error, and unavailable state; consolidates provider ownership into one room-inspection boundary; keeps entrant-specific freshness and back-navigation emphasis without changing order; covers 375px and 1280px plus keyboard/assistive-tech behavior; and explicitly separates UI reordering from any later DEV continuity/instrumentation work.
