# UXD-HOTEL-RATE-ELIGIBILITY-01: Conflict Report — Duplicate Of A Shipped Pipeline

Date: 2026-07-31
Stage: UX Discovery (halted)
Priority: P0
Persona: Senior UX Strategist
Status: **No discovery report produced. No UXR ticket created.**

> This is deliberately **not** `01-discovery.md`. A second discovery brief would create a
> competing specification for a problem that has already passed through discovery, research,
> design, UI, and development.

## Summary

`UXD-HOTEL-RATE-ELIGIBILITY-01` asks how travelers can recognize member, resident,
mobile-only, age-restricted, and other conditional hotel rates before selecting a deal so an
apparently valid price does not fail at booking or check-in.

That same user problem, on the same hotel result-to-provider-handoff flow, was already handled
under the **`rate-eligibility`** pipeline. The shipped contract covers membership, residency,
age, and non-refundable conditions; distinguishes a reported restriction, an explicitly clear
rate, and missing supplier evidence; preserves the evidence into booking review; and never
claims that expaify verified the traveler.

Per the ticket briefing's conflict rule — *"If a ticket conflicts with this briefing or the
current code contract, stop and report the conflict instead of guessing"* — this stage halted
instead of producing a duplicate discovery report and launching another five-stage chain.

The assigned ticket mentions mobile-only pricing. The prior pipeline's supplier research
examined it as a targeting/deal attribute but deliberately did not normalize it into the four
supported restriction families without selected-rate supplier semantics. Adding it now would
be a contract expansion, not discovery of a missing disclosure, and would require an explicit
approved-feature or provider-contract ticket.

## Evidence Of The Prior Pipeline

Docs at `docs/pipeline/rate-eligibility/`:

| File | Content |
| --- | --- |
| `01-discovery.md` | The same pain point, affected flow, measurable signals, three constraints, and success statement |
| `02-research.md` | Current-code and supplier-contract audit plus Booking.com and Expedia Rapid interaction patterns |
| `03-design.md` | Complete result-card and booking-review state specification, final copy, keyboard/accessibility behavior, mobile and desktop rules |

The pipeline was implemented in these commits:

```text
b48fc5cc UXD-RATE-ELIGIBILITY-01: Codex output [monitor auto-commit]
c2b66fe6 UXR-RATE-ELIGIBILITY-01: Codex output [monitor auto-commit]
ac5fa857 UXDES-RATE-ELIGIBILITY-01: Codex output [monitor auto-commit]
019249e9 UI-RATE-ELIGIBILITY-01: add hotel rate restriction clarity
56412307 DEV-RATE-ELIGIBILITY-01: complete provider evidence and analytics
72a806c2 DEV-RATE-ELIGIBILITY-01: add provider-backed rate eligibility contract and fix broken analytics sink
```

## Evidence In The Current Product Contract

- `lib/types.ts` defines four restriction families (`membership`, `residency`, `age`, and
  `refundability`), per-family evidence states, supplier/offer provenance, adapter capability,
  and the honest presentation states `restricted`, `clear`, `not_provided`, `loading`, and
  `error`.
- `lib/hotels/rateEligibility.ts` validates supplier evidence, rejects mismatched offer or
  supplier provenance, degrades malformed or incomplete evidence to `not_provided`, orders and
  de-duplicates conditions, and permits an all-clear claim only when every family is explicitly
  clear and the provider contract supports that claim.
- `lib/providers/hotellook.ts` declares every eligibility family unsupported. It does not turn
  omitted supplier data into an unrestricted rate.
- `app/components/HotelCard.tsx` derives the rate state and renders
  `HotelCardEligibilityLine` before **Review hotel**. The same state is included in the CTA's
  accessible name.
- `app/components/HotelRateRestrictions.tsx` supplies the concise card label and the expanded,
  supplier-attributed disclosure for known, clear, missing, loading, error, malformed, and
  partial-coverage states.
- `lib/booking/config.ts` validates and serializes both eligibility evidence and provider
  capability with the selected hotel offer, preserving meaning across the review boundary.
- `app/book/BookingFlow.tsx` repeats the full **Rate restrictions** disclosure in supporting
  evidence before the provider handoff.
- Tests in `lib/hotels/__tests__/rateEligibility.test.ts`,
  `app/components/__tests__/HotelRateRestrictions.test.tsx`, provider tests, booking-context
  tests, and booking-flow tests exercise evidence normalization, missing data, restrictive and
  clear states, continuity, copy, and accessible presentation.

The current implementation therefore already meets the assigned success condition at the UX
level: before selecting the expaify review and before leaving for the provider, a first-time
user sees either the provider-backed condition or an explicit statement that restrictions were
not provided. The booking partner, not expaify, is named as the final eligibility decision-maker.

## The Remaining Production Gap Is Provider Evidence, Not Disclosure Design

Hotellook is the active hotel adapter and its cache feed does not expose selected-room/rate
eligibility fields. Every live Hotellook offer therefore resolves honestly to **Restrictions
not provided**. The UI cannot show a populated member, residency, age, or refundability
condition until a hotel provider returns that evidence through `lib/providers`.

This is a provider integration and commercial-contract dependency. A new UX research pass
cannot make the current supplier answer a question its payload does not represent. Any future
adapter must map selected-rate evidence into the existing contract, preserve affiliate markers
and integer-minor-unit money, and return `Result<T>` without throwing.

## Measurement Audit: A Regression, Not A New UXD Problem

The ticket requests rate-selection reversals, eligibility-related handoff failures, and support
contacts. The prior development work implemented eligibility-state and return-reason analytics,
but later broad changes to `app/book/BookingFlow.tsx` and `app/api/analytics/route.ts` no longer
preserve that complete measurement design:

- the current booking review emits general viewed, continue, returned, and return-reason events,
  but does not attach the normalized rate-eligibility state to the handoff funnel;
- the current return-reason choices do not include a rate-eligibility failure such as membership,
  residency, or age (the loyalty/points choice answers a different question);
- the current analytics API allowlist does not admit the return-reason event emitted by the
  booking review, so that signal cannot be relied on as a production baseline; and
- no eligibility-specific support-contact taxonomy is present.

A generic provider-tab return must not be counted as an eligibility failure: price changes,
fees, sold-out rooms, room mismatch, and ordinary comparison behavior produce the same action.
The measurement repair should pair the normalized eligibility state with an explicit traveler-
selected eligibility reason or a structured provider rejection. It belongs in a narrowly scoped
DEV/analytics repair ticket against the shipped feature, not a second UXR chain.

## Recommendation

1. Close `UXD-HOTEL-RATE-ELIGIBILITY-01` as a duplicate of
   `UXD-RATE-ELIGIBILITY-01`. Do not create `UXR-HOTEL-RATE-ELIGIBILITY-01`.
2. If the intent is to populate restrictions, open a provider-integration ticket only after a
   hotel supplier contract is confirmed to return selected-rate eligibility evidence. Reuse the
   existing `HotelRateEligibilityEvidence` contract and UI.
3. If the intent is to restore the requested metrics, open a DEV analytics-repair ticket to
   restore eligibility-state funnel dimensions, an explicit rate-eligibility return reason,
   allowlisted ingestion, and a support-contact taxonomy. Do not infer failure from tab return.
4. Treat mobile-only rate normalization as a separate contract decision. The current shipped
   taxonomy does not claim it, and the ticket is not marked **APPROVED FEATURE**.

## Verification

- `npx tsc --noEmit --incremental false` — **exit 0**.
- `npm test -- --passWithNoTests` — **exit 1: 3 suites failed, 76 passed; 44 tests
  failed, 597 passed (641 total)**. All failures are in
  `scorePresentation.test.tsx`, `HotelCard.accessEvidence.test.tsx`, and
  `HotelCard.petPolicy.test.tsx`; they share a pre-existing test-helper null traversal error
  (`Cannot read properties of null (reading 'props')`). This docs-only stage changed none of
  those files.
- `git diff --check` — **exit 0**.

## Out-Of-Scope Findings

- Rate eligibility (may the traveler book this price?) is distinct from loyalty benefits (will
  the stay earn points/status?) and property admission (may the traveler check in?). Current
  code correctly keeps these contracts separate; they must not be merged to fill supplier gaps.
- The inherited 44-test failure blocks the repository test quality gate independently of this
  docs-only conflict report. It needs a separate repair ticket; changing test helpers is outside
  this UXD assignment.
- The analytics allowlist drift may affect other hotel-handoff feedback measurements too. This
  report records the issue but does not repair adjacent analytics under a UXD ticket.
- There is no current provider-backed basis for claiming a mobile-only rate restriction. The
  product must not derive one from viewport, user agent, deeplink text, or a generic promotion.
