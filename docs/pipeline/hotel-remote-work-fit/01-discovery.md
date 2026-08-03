# UXD-HOTEL-REMOTE-WORK-FIT-01: In-Room Workspace Suitability Discovery

Date: 2026-08-03
Stage: UX Discovery
Persona: Senior UX Strategist
Priority: P2
Feature slug: `hotel-remote-work-fit`

## Verdict First

**Yes — physical in-room workspace is a distinct pain point, and it is *more* distinct today than when it was last examined.** But it is smaller than the ticket implies, and the ticket's proposed measurement is not runnable as written. Both findings are load-bearing for the next stage, so they are stated up front:

1. **Distinctness is now structural, not argued.** When `hotel-workspace-fit` was researched (2026-07), "work fit" was a three-part bundle: connectivity + workspace + quiet. That bundle has since decomposed and three of its parts have been claimed by other tickets or already shipped. The physical workspace residual — desk, power at the desk, task lighting — is the only part left with no owner, no design, and no code. This ticket is that residual.
2. **The ticket's measurable signal cannot be computed.** It proposes correlating multi-night/weekday-heavy bookings against post-stay complaints referencing desk/workspace/lighting. The booking-proxy half is computable today; the post-stay-complaint half does not exist in this product and cannot be made to exist without a data source expaify does not have. A substitute signal is defined in [Measurable Signal](#measurable-signal).

## User Pain Point

A guest booking a multi-night or weekday stay they intend to work from cannot tell, from any expaify surface, whether the room contains a usable work surface — a desk with a chair, a reachable power outlet at that desk, and light adequate to work by — because expaify carries no workspace field in any type, adapter, or component, and the one amenity channel that looks like it could carry one is a closed accessibility set that structurally cannot.

## Who Is Affected, And Where

**Who:** guests whose stay has a work requirement in the room itself — extended remote-work stays, weekday business trips, and "bleisure" travelers working part of a leisure stay. This is a *subset* of hotel searchers, not all of them, and the brief does not claim otherwise; see [Is This Sizeable?](#is-this-sizeable).

**Where — the two surfaces named in the ticket:**

- **Deal feed card** (`app/deals/DealFeed.tsx`). The feed renders deal cards with hotel name, price, discount, Deal Score, and — via the established evidence pattern — optional per-deal evidence summaries. `DealFeed.tsx:1931` passes `poolEvidence` into the card, which the card reduces to a one-line summary through `getHotelPoolCardSummary` (`app/components/ui/HotelPoolEvidenceLedger.tsx:71`). There is no workspace equivalent, and no slot for one.
- **Hotel detail page** (`app/deals/[dealId]/page.tsx`). The evidence region at lines `438`–`445` stacks `HotelPoolEvidenceLedger`, `HotelDisruptionEvidenceLedger`, `QuietStayEvidenceLedger`, and `HotelSustainabilityCredentialEvidence`. Four evidence ledgers render here. None concerns the physical work surface.

**What the code actually establishes (verified, not assumed):**

- **`HotelOffer` has no workspace field.** `lib/types.ts:755`–`779` carries identity, location, stars, price, ratings, document readiness, transport, smoking, rate eligibility, tax and required-charge evidence. There is no desk, outlet, lighting, or workspace member.
- **`amenityEvidence` is not a general amenity channel — this is the central structural finding.** The field name (`lib/types.ts:766`) and its type `HotelAmenityEvidence` (`lib/types.ts:138`) both read generic, but the normalizer behind them is a **closed seven-item accessibility set**: `ACCESS_FACTS` in `lib/providers/hotelAmenityEvidence.ts:18`–`26` is exactly `elevator`, `on_site_parking`, `step_free_route`, and four room-preference facts. `normalizeItem` **drops any id not in that map** (`hotelAmenityEvidence.ts:116`: `if (!fact) return undefined`), and the output is always rebuilt from `ACCESS_FACTS` (`hotelAmenityEvidence.ts:174`). Its only consumer is `getAccessEvidence` in `HotelCard.tsx:857`. A workspace fact pushed through this field is silently discarded. **Downstream stages must not assume `amenityEvidence` is an extension point for workspace data** — extending an access-scoped, per-fact-validated list (see the id-specific rules at `hotelAmenityEvidence.ts:70`–`83`) to carry work amenities would conflate two different concerns in one validator.
- **No provider maps any workspace field.** `hotellook.ts`, `hotelbeds.ts`, and `bookingComHotelsRapidApi.ts` all route amenity data through `normalizeHotelAmenityEvidence`, i.e. through the access set. A repo search for `workspace` or `desk` across `app/` and `lib/` returns only the "Deal Desk" brand string in `app/layout.tsx:35,46`, a "front desk" phrase in a continuity test fixture, and a check-in fixture label — no product signal.
- **The established shape for a new fit signal is known and stable.** Four ledgers on the detail page plus a `get*CardSummary` reducer for the feed card is a repeated, working pattern. This ticket does not need to invent a mechanism; it needs to establish whether the signal deserves one.

## Why This Is Distinct — And What It Must Not Re-Litigate

The ticket excludes Wi-Fi reliability and business-invoice eligibility. Auditing the repo shows the exclusion list should be **longer**, because the surrounding work has moved:

| Concern | Owner | State in repo | Bearing on this ticket |
|---|---|---|---|
| Wi-Fi / connection reliability | `hotel-wifi-reliability` | `01`–`03` docs exist; **no code** (zero `wifi` matches in `app/`, `lib/`) | Excluded by ticket. Confirmed still unshipped — do not fill the gap opportunistically. |
| Quiet / noise for focus | `hotel-noise-fit`, `hotel-noise-quiet-fit` | **Shipped**: `QuietStayEvidenceLedger` renders at `app/deals/[dealId]/page.tsx:444` | Excluded. Quiet is no longer part of the work bundle — it has its own ledger. |
| Business services, invoicing | `hotel-business-invoice`, `hotel-invoice-readiness` | `01`–`03` docs exist | Excluded by ticket. |
| Trip-purpose "Work trip" control | `hotel-trip-purpose-fit` | `01`–`02` docs; no control exists in code | This ticket must not build a purpose picker. |
| Amenity filter mechanism | `hotel-amenity-fit` | `01`–`02` docs | This ticket must not build a filter. |
| Connectivity + workspace + quiet as one bundle | `hotel-workspace-fit` | `01`–`02` docs; **stalled at research, no `03-design.md`** | **Direct overlap — see below.** |

**The overlap with `hotel-workspace-fit` is real and must be resolved, not ignored.** That lineage's research (`docs/pipeline/hotel-workspace-fit/02-research.md`) already ranked `work_desk` at #2 and `work_power` ("reachable outlets/USB at the desk, adequate lighting") at #5 — which together are precisely this ticket's scope. It stalled before design.

Two things have changed since, and they are what make a narrower re-cut correct rather than duplicative:

- Its #1 signal (`work_connectivity`) and #3 (`work_quiet`) have both left: one to a ticket with a finished design, one to shipped code. A five-signal ranking whose top and third entries are owned elsewhere is no longer the right unit of work.
- It named an unresolved blocker — "`HotelCard` is tests-only; `DealFeed` renders `DealCard`" — as blocking design input. This ticket's surfaces are named explicitly (`DealFeed.tsx`, `[dealId]/page.tsx`), and the detail page now has four working evidence ledgers to pattern against. That blocker is resolved by scoping.

**Recommendation, requiring a human decision (flagged, not assumed):** treat `hotel-remote-work-fit` as the surviving lineage for physical workspace evidence and retire `hotel-workspace-fit` rather than running both. UXR must not re-derive that document's provenance conclusions — they are settled foundation. Two parallel `work_*` vocabularies reaching UI stage is a concrete, avoidable risk.

## Is This Sizeable?

Honest answer: **narrow but real, and its value is defensive rather than promotional.**

Arguing it is *smaller* than the ticket frames it:
- Work-intent stays are a minority of hotel searches on a deal-led consumer product, and expaify has no trip-purpose signal to identify them.
- Desk, outlet placement, and lighting are among the **least** structurally documented hotel attributes. `hotel-workspace-fit`'s own ranking put in-room power/lighting last and called it "first to cut" for exactly this reason. Realistic coverage at launch is near zero.
- With connectivity and quiet removed, the remaining three facts are the *least* task-blocking of the original bundle. A bad desk degrades a work stay; a dead connection ends it.

Arguing it is nonetheless **worth a distinct signal**:
- It is the only unowned residual. Every adjacent concern now has a ticket or shipped code; workspace is what falls through.
- Its failure mode is discovered at the worst possible time — on arrival, mid-trip, unfixable — and on a stay the guest is paying for because they must work.
- Expected coverage being near zero is an argument about *sequencing*, not about whether the pain is real. The product's repeated pattern is to define the evidence contract and its "not reported" states first, then light up when a provider supplies data.

**Recommendation to UXR: scope this as a contract-and-states deliverable, not a launch feature.** The proportionate answer is likely **one detail-page ledger, and a feed-card summary line only when a fact is confirmed** — not a workspace filter, not a card badge that renders on every result, and not a roll-up "good for remote work" verdict. Sizing the surface to the (thin) data is the design problem, and UXR should test that framing rather than assume a full treatment is warranted.

## Measurable Signal

**The ticket's proposed signal is not runnable. Stated plainly, with the reason:**

> "Measure correlation between multi-night/weekday-heavy bookings and post-stay complaints referencing desk, workspace, or lighting."

- **The proxy half is computable.** `deals` carries `nights SMALLINT` and `check_in_date DATE` (`lib/db/schema.sql:125`–`149`), so multi-night and weekday-heavy stays can be identified today.
- **The outcome half does not exist.** There is no bookings table, no post-stay record, and no review-text store anywhere in `lib/db/schema.sql`. expaify hands off to the provider via affiliate deeplink and never observes the completed stay. `lib/types.ts:99` has a `guest_review` *source label* and `:115` a `reviewCount` *integer* — neither is review text. **There is no corpus in which to find a complaint mentioning "desk."** No amount of engineering inside this product produces one; it would require a provider review-text feed the product does not have and this ticket cannot authorize.

**Substitute signals, in priority order:**

1. **Structural baseline (verifiable now, no instrumentation).** Zero workspace fields in `HotelOffer`; zero workspace mapping in any adapter; zero workspace UI on either named surface; `amenityEvidence` structurally incapable of carrying one. In-app workspace resolution is **0%** by construction. This is the honest statement of the problem's existence and is available today.
2. **Provider coverage probe (the decision-gating measurement).** Before any design commits, sample the workspace-relevant fields actually returned by the live hotel providers and report the share of properties documenting a desk, in-room outlet detail, or lighting. `analytics_events` and `product_analytics_events` (`schema.sql:275`, `:398`) exist for in-app instrumentation, but this probe is a provider-payload audit, not an analytics query. **If coverage is effectively zero across all providers, the correct outcome is to ship the contract and "not reported" states and stop — and UXR should say so rather than design a surface for data that will not arrive.**
3. **Comprehension gate (moderated, pre-launch).** Given near-zero coverage, the dominant risk is not absence but misread absence. Test that a guest reads a missing workspace fact as "the provider didn't report this," never as "this room has no desk," and reads a property-level claim as never promising anything about the booked room.
4. **Post-launch behavioural proxy (in-app only, honest about its limits).** Among multi-night and weekday-heavy stays, whether detail-page engagement with the workspace ledger correlates with proceeding to "Review hotel." This measures in-app decision support, **not** stay satisfaction. No in-app metric can substitute for the post-stay outcome the ticket asked for; UXR should not present one as if it could.

## Constraints

1. **Provider-documented facts only — never infer a workspace.** A workspace fact may be shown only where a provider explicitly documents it, normalized inside `lib/providers` per the non-negotiable contract. No workspace value may be derived from stars, `hotelClass`, `guestRating`, price, property type, room name, or photos. Undocumented renders as an explicit "not reported by the provider" state — never as present, never as absent. A "business hotel" property type is not evidence of a desk.

2. **Scope must be explicit, and property-level must never read as a room promise.** Desk, outlet, and lighting are **room-scoped facts by nature**, which makes this the sharpest scope trap in the hotel surface: a property-level claim ("business-friendly property," "workstations in the lobby") says nothing about the room being booked. Every fact must declare its scope and route room/rate confirmation to the provider before payment. Reuse the existing `HotelEvidenceStatus` / `HotelEvidenceScope` / `sourceLabel` / `confidence` model (`lib/types.ts:120`–`148`) as the substructure — **but do not route through `normalizeHotelAmenityEvidence`**, which will discard the data (`hotelAmenityEvidence.ts:116`). Follow the ledger precedent (`HotelPoolEvidence`, `QuietStayEvidence`) instead.

3. **Fit the existing hierarchy; add no new competing surface.** Workspace evidence is orthogonal to Deal Score (a price percentile) and must never feed, adjust, or sit adjacent to `DealBadge`/`ScoreChip` or the quality-evidence panel. On the detail page it joins the existing ledger stack (`[dealId]/page.tsx:438`–`445`) without displacing pool, disruption, quiet, or sustainability. On the feed card it may contribute at most a single summary line, present only when a fact is confirmed, following the `getHotelPoolCardSummary` precedent (`HotelPoolEvidenceLedger.tsx:71`) — and it must not crowd price, discount, or the CTA at 375px. State must be conveyed in words, never by colour or icon alone.

## Success Statement

This is solved when a first-time guest booking a multi-night or weekday stay they intend to work from can tell, on the expaify deal card and hotel detail page, which physical workspace facts the provider has documented for the room they are booking — a work surface, power reachable from it, and light to work by — at what scope, and which are simply not reported, without ever mistaking an unreported fact for a confirmed absence, a property-level claim for a room guarantee, or the absence of the whole section for a verdict that the room is unsuitable for work.

## Blockers And Out-Of-Scope Findings

**Blockers (must be resolved before this reaches UI or DEV):**
- **Provider data availability is unproven and gates everything downstream of design.** No adapter maps a workspace field and no provider is known to return one. Signal #2 above must run before UI/DEV is scheduled; DEV is contingent on a provider that documents these facts.
- **Ticket-lineage overlap with `hotel-workspace-fit` needs a human decision.** Recommendation is to retire that lineage in favour of this one. Until decided, UXR must reference its research as settled input and must not fork a second `work_*` vocabulary.
- **The ticket's stated measurable signal cannot be computed** (no post-stay or review-text data). The substitute signals above should be confirmed as acceptable; if the correlational study is genuinely required, this ticket is blocked on a data source outside the product.

**Out of scope — flag, do not build here:**
- Wi-Fi and connection reliability (`hotel-wifi-reliability`), quiet and noise (`hotel-noise-fit`, already shipped as `QuietStayEvidenceLedger`), business-invoice eligibility (`hotel-business-invoice`) — all excluded by the ticket and confirmed as separately owned.
- A trip-purpose or "Work trip" control (`hotel-trip-purpose-fit`) and any amenity-filter mechanism (`hotel-amenity-fit`).
- Any expaify-computed "good for remote work" roll-up verdict. `hotel-workspace-fit` already excluded this and the exclusion carries forward: expaify cannot synthesize a suitability judgment from thin provider data. A provider-attributed label quoted verbatim is the only permissible form.
- Letting workspace data influence Deal Score. Scoring has no approved hotel-fit model.
- Extending `ACCESS_FACTS` in `lib/providers/hotelAmenityEvidence.ts` to carry workspace ids. Named explicitly so a later stage does not attempt it as a shortcut.
- Review-text mining for workspace mentions. No corpus exists; adjacent to `hotel-review-relevance`.
- Monitor/second-screen rental, day-rate "work from hotel" products, coworking partnerships.

## Required UXR Focus (mandatory deliverables for `UXR-HOTEL-REMOTE-WORK-FIT-01`)

1. **Provider coverage probe** for desk, in-room power/outlet, and lighting fields across the live hotel providers — with an explicit recommendation to stop at contract-and-states if coverage is effectively zero.
2. **A minimal ranked workspace fact set** (desk/work surface, power reachable from it, task lighting; chair as a candidate), each with scope, a one-line justification, and a documentability assessment. Reconcile ids with `hotel-workspace-fit`'s `work_desk` / `work_power` rather than inventing new ones.
3. **Surface-proportionality recommendation:** whether the feed card warrants any workspace line at all given expected coverage, or whether this is detail-page-only at MVP. Argue it; do not assume both surfaces.
4. **Empty-data treatment as the default case** — exact copy and screen-reader behaviour when nothing is documented, including whether the section renders at all. Absence must not read as a negative verdict.
5. **Comprehension tasks** covering not-reported vs. confirmed-absent, property-scope vs. room-scope, and the absence of the whole section vs. a verdict of unsuitability.
6. **Reference comparison at the interaction level** (one or two of Booking.com work-facility surfacing, Google Hotels amenity grouping), focused specifically on how each handles *undocumented* room-level workspace attributes — the state expaify will be in most of the time.

## Handoff

Create `UXR-HOTEL-REMOTE-WORK-FIT-01` (UX Research, P2, role `qa`, status `backlog`) referencing `docs/pipeline/hotel-remote-work-fit/01-discovery.md`, carrying the problem statement, the three blockers, and the six mandatory deliverables above.
