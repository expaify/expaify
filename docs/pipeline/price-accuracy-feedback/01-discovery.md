# UXD-PRICE-ACCURACY-FEEDBACK-01: Price Accuracy Feedback (Hotels)

**Stage:** UX Discovery (UXD)
**Date:** 2026-07-21
**Surface:** `app/components/HotelCard.tsx` (results), `app/book/BookingFlow.tsx` → `HotelHandoffReview` (last expaify screen before provider handoff), `app/deals/[dealId]/page.tsx` (deal detail, hotel deals), and the return path from the partner site back to expaify.

## Pain Point

When the nightly rate a user sees on expaify does not match what the partner site shows after handoff, the user has no way to tell expaify the number was wrong — so a stale or inaccurate Deal Score keeps surfacing to the next user with no signal ever reaching the product team.

## Affected Users And Flow Step

- **Who is affected:** Any user who clicks "Review hotel" (`HotelCard.tsx:490-500`) or "Continue to provider" (`BookingFlow.tsx:505-516`) on a hotel offer, lands on the partner site, and finds a nightly rate that differs from the price expaify displayed — whether higher, lower, unavailable, or for a different room/date.
- **Flow step:** Post-outbound-return. The user has already left expaify (`HotelHandoffReview`, `BookingFlow.tsx:481-520`) and is either (a) back on the partner tab noticing the mismatch, or (b) returned to the expaify tab/browser-back after noticing it. Secondary surface: the hotel deal detail page (`app/deals/[dealId]/page.tsx`), which is the terminal expaify screen before the same kind of outbound click for deal-feed hotels.
- **Trust risk:** A hotel's nightly rate on expaify is the single number the entire Deal Score claim ("Great"/"Good" vs. recent history) is built on. If that number is wrong at the source and no one reports it, the same bad price keeps computing a false verdict for every subsequent viewer, and repeat mismatches from one partner/source silently erode trust in the whole score system, not just one listing.

## Current Implementation Signals

- There is no report affordance anywhere in the hotel flow. `grep -ri "report"` across `app/` and `lib/` returns zero UI or API matches related to price/data reporting.
- `lib/analytics.ts` (`track()`) is a no-op outside development — it only `console.debug`s. Even if a report button existed today wired to `track()`, no mismatch data would reach the product team; there is no persistence path.
- The last expaify screen before partner handoff, `HotelHandoffReview` (`BookingFlow.tsx:481-520`), already sets the expectation that price can change ("Confirm the location, taxes, fees, cancellation policy, room details, and live availability with the provider before payment," `hotelTermsCopy` at `BookingFlow.tsx:18`) — but this is a disclaimer, not a feedback mechanism. There is nowhere to act on "the rate did not just change, it was wrong."
- expaify has **no detection of return-from-partner** at all: no `visibilitychange`, `focus`, or referrer-based handling anywhere in `app/` or `lib/` (confirmed by grep). The handoff link (`target="_blank"`, `rel="noopener noreferrer sponsored"`) opens a new tab and expaify has no way to know the user came back, let alone prompt them.
- `HotelCard.tsx` already renders `Price`/`PriceUnavailable` (`HotelCard.tsx:34-68`) with the caveat "Last-checked time unavailable" on every rate — the UI already concedes staleness is possible but gives the user no channel to flag it when it turns out to be true.
- `app/deals/[dealId]/page.tsx` (per `docs/pipeline/deal-detail-booking/01-discovery.md`) sends hotel deal clicks to partner **search** pages, not the specific rate — a second, upstream source of exactly the "price I saw isn't the price I found" mismatch, distinct from genuine rate drift.
- No existing DB table, API route, or type models a "report" or "mismatch" concept: `lib/types.ts` has no such shape, `lib/db/schema.sql` (per file map) covers only snapshots/route_baseline, not user-submitted signals.

## Measurable Signal

This problem exists today because none of the following can currently happen:

1. **Report rate** — there is no control to click, so the report rate is definitionally zero regardless of true mismatch frequency.
2. **Mismatch categories** — even a motivated user emailing support has no structured taxonomy to select (price higher, price lower, room/dates different, rate unavailable, wrong hotel), so any manual reports that do arrive today would be unstructured free text with no consistent field to aggregate on.
3. **Repeated partner/source issues** — `HotelOffer.source` (`lib/types.ts`) already identifies the provider per offer, but nothing ties a report back to `source` + `id`, so expaify cannot currently tell whether mismatches cluster on one partner (e.g., Hotellook) versus being evenly distributed.
4. **Reduced exposure of inaccurate deals** — `scoreDeal.ts` and the nightly snapshot job have no input channel from user reports; a hotel flagged 10 times today would be scored and surfaced identically to one flagged zero times.

Observable QA signal today: a user who catches a wrong price has exactly one option — abandon silently — which is indistinguishable, from expaify's telemetry, from a user who simply changed their mind.

## Constraints

1. **Hotels-first MVP:** The report affordance and its data model must be scoped to `HotelOffer` / hotel deals only. Do not require a parallel flight-fare reporting path in this pass; the taxonomy and schema should not preclude flights later, but should not be built for them now.
2. **No support inbox buildout:** This is not a ticket to stand up a helpdesk, email routing, or agent-facing case management tool. The output is structured data the product team can query/aggregate (e.g., a table plus a lightweight list view), not a two-way support conversation.
3. **Lightweight and structured:** The report action must be a small, fast, category-driven control (e.g., tap a reason chip, optional one-line note) — not a multi-field form. It must not block or gate the booking/handoff flow, and it must not require the user to have successfully booked to submit a report.
4. **Accessibility & performance (carried from existing contract):** Any new control must meet the same bar as `HotelCard.tsx`/`BookingFlow.tsx` — keyboard reachable, labeled for assistive tech, no blocking network round trip before the existing handoff CTA renders.
5. **Data integrity (non-negotiable contract):** Any stored report must reference money using the existing `Money` shape and must not fabricate a "corrected" price as fact — it is a user claim to be aggregated and reviewed, not an authoritative price update.

## Success Statement

This is solved when a user who notices a hotel price mismatch — whether still on the partner tab or back on expaify — can report it in under 15 seconds using a small set of structured categories (no free-form-only path required), and the product team can query that data by hotel, partner/source, and mismatch category to see report rate, repeat-offender partners, and which live deals should have reduced exposure or re-verification.

## Downstream Focus

The research stage (`UXR-PRICE-ACCURACY-FEEDBACK-01`) should:

- Audit `HotelCard.tsx`, `BookingFlow.tsx` (`HotelHandoffReview`), and `app/deals/[dealId]/page.tsx` to identify every point a report entry could attach (pre-handoff card, post-handoff review screen, and — if feasible — a return-triggered prompt, given there is currently no return-from-partner detection to build on).
- Propose a concrete mismatch-category taxonomy (e.g., price higher, price lower, rate/room unavailable, wrong hotel/listing, wrong dates) as testable hypotheses, each tied to what data field it would populate.
- Define the minimum data shape a report needs (hotel/offer id, source, category, optional note, timestamp, the price expaify showed) without inventing a new money-handling path outside the existing `Money` contract.
- Specify what "reduced exposure" means operationally for DEV/scoring — e.g., a report threshold that suppresses a listing from `scoreDeal.ts` output or nightly snapshot inclusion pending re-verification — as a requirement, not an implementation.
- Compare against how Booking.com or Google Flights/Hotels surface "report this price"-style controls at the interaction-pattern level (placement relative to the CTA, category-first vs. free-text-first, whether it's pre- or post-handoff).
