# UXD-HOTEL-INVOICE-RECEIPT-01: Conflict Report — Duplicate Of A Shipped Pipeline

Date: 2026-07-31
Stage: UX Discovery (halted)
Persona: Senior UX Strategist
Status: **No discovery report produced. No UXR ticket created.**

> This is deliberately **not** `01-discovery.md`. Writing a second discovery doc for this
> surface would create a competing spec against a pipeline that has already shipped.

## Summary

`UXD-HOTEL-INVOICE-RECEIPT-01` asks for discovery of how business travelers establish
whether a hotel can provide an invoice or receipt suitable for reimbursement, across hotel
detail through booking handoff.

That problem was already discovered, researched, designed, implemented, and repaired under
the **`hotel-invoice-readiness`** pipeline. Its problem statement is the same problem, at the
same surface, for the same user. Per the briefing rule — *"If a ticket conflicts with this
briefing or the current code contract, stop and report the conflict instead of guessing"* —
this stage halted rather than produce a duplicate discovery doc and launch a duplicate
five-stage chain.

## Evidence Of The Prior Pipeline

Docs at `docs/pipeline/hotel-invoice-readiness/`:

| File | Content |
| --- | --- |
| `01-discovery.md` | Problem statement, four-part disclosure boundary, constraints, success statement |
| `02-research.md` | Supplier audit + reference-pattern teardown |
| `03-design.md` | Full state spec, final copy, Tailwind patterns |

Shipped through implementation and a QA-driven retry:

```
c7ded1ff UXD-HOTEL-INVOICE-READINESS-01
70cac1c7 UXR-HOTEL-INVOICE-READINESS-01
27c85156 UXDES-HOTEL-INVOICE-READINESS-01
93ef3cfc DEV-HOTEL-INVOICE-READINESS-01: preserve supplier document evidence
d38421bf RETRY-HOTEL-INVOICE-READINESS-DEV-01: harden evidence and retry handling
```

Live code implementing it:

- `lib/types.ts:224` — `HotelDocumentReadiness` (status, scope, documentTypes,
  `issuerByDocument`, `billingDetailsStep`, condition, source provenance,
  `conflictStatements`, `verificationTarget`)
- `lib/providers/hotelDocumentReadiness.ts` — normalizer; unverifiable positive, negative,
  conditional, and conflicting claims all degrade to `not_provided`
- `lib/providers/hotellook.ts:558` — `checkDocumentReadiness`, returns `not_provided` with an
  explicit comment preserving the supplier omission
- `app/api/hotels/document-readiness/route.ts` — check endpoint
- `app/components/HotelDocumentReadiness.tsx` — the disclosure UI (373 lines)
- `app/book/BookingFlow.tsx:1197` — wired into the handoff review, with loading/error retry
- Tests: `lib/providers/__tests__/hotelDocumentReadiness.test.ts`,
  `app/components/__tests__/HotelDocumentReadiness.test.tsx`

Every one of the four disclosure needs implied by the assigned ticket — availability, issuer,
billing-detail timing, escalation path — is represented in the shipped contract.

## The One Uncovered Part Of The Ticket Was Ruled Out On Purpose

The assigned ticket scopes "hotel detail through booking handoff." The shipped disclosure
lives at the `/book` review step. `HotelCard` carries no invoice language.

That is not an oversight. `03-design.md` excludes it explicitly:

> Do not add invoice language to `HotelCard` or the search form in this ticket. Readiness is
> selected-rate and handoff-stage information; the active search result is a property-level
> aggregate and cannot support a reliable claim.

The reasoning still holds against the current code contract. `HotelCard` renders a
property-level aggregate; invoice readiness is rate-scoped (`HotelDocumentScope = 'rate' |
'selected_stay'`). Surfacing a document claim on the result card would mean asserting
rate-level availability from property-level data — which the briefing's data-integrity rule
and the normalizer's degrade-to-`not_provided` design both forbid. Extending discovery to
hotel detail would therefore push toward the exact claim the prior pipeline rejected.

## The Real Residual Problem Is Supplier Data, Not UX Discovery

Worth recording, because it is invisible from the ticket text: the disclosure is fully built
but **currently renders `not_provided` for every live offer**. Hotellook's cache feed exposes
no rate- or stay-scoped document fields, so `checkDocumentReadiness` honestly returns
"provider did not supply this information" every time.

So the business traveler's question is still not *answered* in production — but the missing
piece is a supplier capable of returning invoice evidence, not another round of UX discovery.
No amount of design work on this surface changes the output while the only active hotel
provider returns nothing. That is a provider/BD question (confirming a hotel supplier whose
terms and API expose rate-level document policy), and it sits outside a UXD ticket.

## Recommendation

1. **Close `UXD-HOTEL-INVOICE-RECEIPT-01` as a duplicate** of `UXD-HOTEL-INVOICE-READINESS-01`.
   Do not create `UXR-HOTEL-INVOICE-RECEIPT-01`; it would re-audit a shipped surface.
2. If the intent was genuinely the **result-card surface**, that needs an explicit decision to
   overturn a documented data-integrity exclusion — not a fresh discovery pass. It should be
   raised as a scoped ticket that states the conflict, and it should not ship a rate-level
   claim from property-level data.
3. If the intent was to close the production gap, file it against the **provider layer**:
   confirm a hotel provider that returns rate-scoped document policy, then map it through the
   existing `HotelDocumentReadiness` contract. The UI needs no redesign to consume it.

## Verification

- `npx tsc --noEmit --incremental false` — **exit 0**
- `npm test -- --passWithNoTests` — **3 suites / 44 tests failing, pre-existing on this
  branch**, in `scorePresentation.test.tsx`, `HotelCard.accessEvidence.test.tsx`,
  `HotelCard.petPolicy.test.tsx`. Unrelated to invoice/receipt; present with a clean worktree
  before this stage touched anything. Left alone per the stay-in-ticket rule; flagged below.

## Out-Of-Scope Findings

- **Pre-existing test failures on `agent/UXD-HOTEL-INVOICE-RECEIPT-01`.** 44 failing tests
  across three suites, inherited from previously merged work. They gate the DEV/TEST quality
  bar for any ticket on this branch and should get their own repair ticket.
- **Pipeline duplication is systemic.** `docs/pipeline/` holds ~130 feature folders with heavy
  conceptual overlap around hotel disclosure (`hotel-invoice-readiness`,
  `hotel-rate-inclusions`, `hotel-cancellation-clarity`, `hotel-payment-timing`,
  `hotel-deposit-holds`, `hotel-booking-handoff-trust`, and more). Ticket intake appears not to
  check for an existing pipeline covering the same surface. Worth a dedupe pass before more
  UXD tickets are generated.
