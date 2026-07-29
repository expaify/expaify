# 02 — UX Research: Hotel Location Fit Before Booking

**Ticket:** UXR-HOTEL-LOCATION-FIT-01 · Stage: UXR (Research) · Priority: P1
**Upstream:** `docs/pipeline/hotel-location-fit/01-discovery.md`
**Prior art extended (not repeated):** `docs/pipeline/neighborhood-fit/02-research.md` — its directives D1–D6 are accepted as given. Everything below either *answers* one of its open questions or *corrects* an assumption that a first-hand code audit disproved.
**Date:** 2026-07-29

**Surfaces in scope:** deal feed (`app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx`), city pages (`app/destinations/[city]/page.tsx`), deal detail (`app/deals/[dealId]/page.tsx`), OTA handoff. **Out of scope:** live-search `HotelCard.tsx` and `hotelLocationContext.ts` internals — owned by `hotel-location-decision-context`. We *consume* that module; we do not modify it.

---

## 0. Headline findings — read before anything else

Three findings change the shape of the work relative to discovery. Each is verified in this worktree.

**F-1 — Tier A needs no new copy, and no new location language. It needs one wiring fix.**
Discovery framed A.1 as "remove the invented-precision label." The defect is worse than a label, and the fix is smaller than a rewrite. `app/deals/[dealId]/page.tsx:350-351` renders:

```
Area: {deal.city}
Provider supplied an area, not a street address.
```

That second line is a **verbatim clone of the `area`-precision note** in `getHotelLocationDisplay()` (`app/components/hotelLocationContext.ts:71`). So the page does not merely overstate granularity — it makes a **false provenance claim**: it tells the user a provider supplied an area when no provider supplied anything below city, and the string is a JOIN result from `tracked_markets.city` (`lib/pipeline/dealDetection.ts:185`).

The honest tier for this data already exists, already has approved copy, and is already shipped:

```
search_area → label "Search area"
              note  "Only the searched destination is available. Confirm the property location with the provider."
              isWarning: true
```
(`hotelLocationContext.ts:78-87`)

`search_area` is a literal description of a deal-feed deal: the only location fact we hold is the destination the snapshot job searched. **Tier A is therefore: stop hand-rolling the wrong tier, call the shared helper with `search_area`.** Zero invented copy, zero new vocabulary, and constraint 1 (honest precision) is satisfied by construction rather than by review.

**F-2 — Discovery's "ZERO analytics" evidence is out of date. A.3 shrinks from "build a funnel" to "add one dimension."**
`app/deals/[dealId]/page.tsx:456-464` mounts `<HotelDecisionAnalytics>`, which already emits four events (`app/components/HotelDecisionAnalytics.tsx`):

| Event | Line | Covers discovery funnel step |
|---|---|---|
| `hotel_detail_viewed` | :50 | step 2 (detail view) |
| `hotel_decision_section_reached` | :98 | step 3 (region view — fires per `data-hotel-decision-section`, 1s at ≥50% visibility) |
| `hotel_room_handoff_started` | :125 | step 5 (OTA handoff) |
| `hotel_detail_back_to_results` | :135 | step 6 (pogo-stick proxy) |

Step 1 (card impression + open) exists as `hotel_results_viewed` / `hotel_result_card_opened` (`DealFeed.tsx:1373`, `:1349`). **Step 4 — detail exit without handoff — is not a missing event; it is a derivation** (`hotel_detail_viewed` with no subsequent `hotel_room_handoff_started` in the same `sessionId`, which `lib/analytics.ts:8-23` already stamps on every event).

What is genuinely missing is **segmentation**: not one of these events carries a location dimension, so the funnel cannot be sliced by precision — which is the entire measurement ask. See R5.

**F-3 — There is a fourth card surface discovery did not name.**
`DealCard` renders on the homepage too (`app/page.tsx:171, 208, 210, 285`), and `LockedDealCard` renders `placeholderCity` for paywalled rows (`DealFeed.tsx:1795, 1812`; `destinations/[city]/page.tsx:25`). Any card-level change lands on **four** surfaces plus a locked variant. UXDES must spec the locked/mock/expired states or UI will improvise them.

---

## 1. Current-state audit — what is true in this worktree today

The `neighborhood-fit` §2 trail (location destroyed at ingestion; no location columns; city-only to pixel) **re-verified and still accurate**. Confirmed line references for this ticket:

| Stage | File · line | Location detail |
|---|---|---|
| Ingest normalize | `HotelEntry`, `lib/pipeline/snapshot.ts:58-64` | none — `hotelId, hotelName, stars, priceCents, photoUrl` |
| Provider parse ×3 | `:90-101`, `:125-136`, `:163-174` | each parser reads only the five fields above |
| Coordinate search | `fetchBookingComCoords`, `:106-137` | searches **by** `lat`/`lng` from `COORDS` (`:38-46`), reads no location field back |
| Snapshot store | `price_snapshots`, `lib/db/schema.sql:104-118` | no `lat`/`lng`/`address`/`district` |
| Deal store | `deals`, `:125-148` | same — location only via `market_id → tracked_markets.city` |
| Deal row | `DealRow`, `lib/pipeline/dealDetection.ts:155-175`; `m.city` at `:185` | `city` |
| Feed transport | `ApiDeal`, `app/deals/DealFeed.tsx:121-141` | `city` |
| Card prop | `DealCardDeal`, `app/components/ui/DealCard.tsx:17-34` | `city` |
| Card render | `DealCard.tsx:77-80` | `{stars} · {city} · {checkInWindow}` |
| Detail render | `app/deals/[dealId]/page.tsx:350-351` | `Area: {city}` + false provenance note (F-1) |

**New this ticket:**

- **The redundancy on city pages is exact, not approximate.** `destinations/[city]/page.tsx:159` renders `Hotel deals in {displayName}`, and every card below it renders that identical string at `DealCard.tsx:79` — `displayName` and `deal.city` are the same value, both keyed off `tracked_markets.city`. On this surface the city segment carries literally zero bits.
- **An implementation trap in the shared helper.** In `getHotelLocationDisplay()` the `area` branch is `if (location?.precision === 'area' || area)` (`hotelLocationContext.ts:67`) and sits **above** the `search_area` branch (`:78`). Passing `{ area: deal.city }` silently yields the `area` tier — which is almost certainly how today's wrong copy was derived. R1 must state the call shape explicitly.
- **A card-height coupling.** `DealFeed.tsx:214` documents that the loading skeleton "mirrors DealCard's block order and heights so the feed does not jump." Any card change that can wrap to a new line changes card height and must be mirrored in the skeleton, or the fix introduces a layout jump — a regression against acceptance signal 7.
- **The detail page is a Server Component.** New location events cannot call `track()` inline; they go through a client component. `app/components/TrackOnMount.tsx` already exists for exactly this, and `HotelDecisionAnalytics` already receives a `viewedProps` bag (`[dealId]/page.tsx:463`) — the cheapest insertion point.

---

## 2. Reference patterns — compared at the interaction level

- **Booking.com (result card):** two independent tiers — a coarse **district label** always present ("El Born"), and an **anchored distance** ("1.2 km from centre") present only when a reference point exists. The tiers degrade independently; the card never shows a bare number.
- **Google Hotels (list ↔ map):** location fit is resolved by an **affordance to a map view**, not by text on the card. This only works because every property has real coordinates; the affordance is a promise that a map exists.
- **Airbnb (pre-booking):** deliberately coarse area pre-booking, exact pin only after booking. Proof that **honest imprecision is a shippable product decision**, not a degraded state.

**The delta, stated precisely:** the references show a *graded* signal where each tier appears only when its data exists. expaify shows a **single ungraded string, mislabeled at a tier above its true precision, with a fabricated provenance note** (F-1). We already own the grading vocabulary (`HotelLocationPrecision`, `lib/types.ts:387`) and the honest copy for every tier; the deal surfaces simply do not call it.

**Anti-pattern warning for UXDES:** do not copy Google Hotels' map affordance in Tier A. An affordance that opens a map centred on a market centroid (`snapshot.ts:38-46`) would be the single most damaging possible outcome here — it renders a *fabricated* pin at full apparent precision. This is discovery's B.3 and it stays gated.

---

## 3. Answers to the discovery research questions (§8)

**Q1 — Which single cue lets a 375px shopper keep/reject fastest: district label, anchored distance, or map affordance?**
**A coarse district label.** Reasons, in order: (a) it is the only one of the three that is a *scan* primitive — one to three words parsed with the hotel name, no unit conversion, no reference point to hold in mind; (b) distance is meaningless without an anchor, and these deals carry no user anchor (Q3), so a feed distance would be against a system-chosen point the user never asked about; (c) a map affordance costs a tap and a context switch — it is a *resolution* tool for a shortlist of two or three, not a triage tool for a feed of twenty. Booking.com's own hierarchy agrees: the district label is the always-present tier, distance the conditional one. **Distance belongs on detail, not the card.**

**Q2 — For the city-only state, is a card certainty cue genuinely helpful, or noise? (`neighborhood-fit` Q3)**
**Helpful, but only if it is the same one word on every card and costs no new element.** The honest tension: in a single market *every* card is city-only, so a per-card cue repeats a constant — the classic definition of noise. But the cue is not competing with other cards; it is competing with the user's **default assumption that a listed city means a known location**, and that assumption is wrong and is what sends them to an external map. Discovery's acceptance signal 4 requires it be legible *from the card*, and the honesty constraint is not satisfied by silence.
**Recommendation:** express it inside the **existing secondary line** (`DealCard.tsx:77-80`) as a fourth segment — no new row, no new element, no new visual weight, and it sits in reading order *before* price and the CTA (a footer cue below the CTA would arrive after the decision). Accept that at 375px this line may wrap from one to two lines; that is a wrap, not an overlap, in a `leading-snug` block with no fixed height. **UI must mirror the extra line in the `DealFeed.tsx:214` skeleton.** See R2 for the phrase and the fallback if UXDES measures a wrap as unacceptable.

**Q3 — What is the honest reference anchor when the user has entered none?**
**Tier A: none. Do not render an anchor or a distance at all.** No coordinate exists for any deal (§1), so any anchor would be decorative.
**Tier B: `city_center`, and only under a constraint the code already enforces.** The market centroids in `COORDS` (`snapshot.ts:38-46`) are the only anchor candidates we hold. Mapping them into `HotelLocationAnchor` (`lib/types.ts:393-400`), their `source` is **`search_linked`** — expaify chose those coordinates as the search point — **not `provider_declared`**.
**This has a hard consequence that reverses a `neighborhood-fit` recommendation.** `hasVerifiedHotelLocationComparison()` (`lib/hotels/locationEvidence.ts:96-116`) accepts a `provider_documented` distance **only** when `anchor.source === 'provider_declared'`; otherwise it requires an `expaify_calculated` haversine that it recomputes and verifies to 1e-6 km. So booking-com v1's `distance_to_cc` — which `neighborhood-fit` §7/F3 called "the lowest-risk first anchor" — **cannot be surfaced as a `provider_documented` distance against our own centroid**. Tier B must either capture per-hotel `lat`/`lng` and let `withCalculatedAnchorDistance()` (`:53-84`) compute the distance, or show no distance. Taking the provider's number and pairing it with our anchor would fail the existing evidence gate — correctly.
The scenario-1/4 anchors (event venue, personal address) remain out of scope: `neighborhood-fit` D6 stands unchanged.

**Q4 — Card, detail, or both? Does the answer differ between feed and city pages?**
**Both, with different jobs, and yes — the city page differs.**
- *Card (feed + homepage):* orientation only — one label, one certainty word. Triage.
- *Card (city page):* the city segment is provably redundant (§1). It should be **replaced** by the district when Tier B lands, not appended to. In Tier A the redundancy is a cosmetic defect, not a trust defect; **leave it alone** — deduplicating it now means threading a surface prop through `DealCard` for zero honesty gain, and `DealCard` is shared with the homepage and feed where the city is *not* redundant.
- *Detail:* the full graded block — label, value, honest note, and (Tier B only) an anchored distance. This is the decision point immediately before handoff and is where the `search_area` warning must land.

**Q5 — Confirm the Tier B data ledger against one live payload per provider.**
**Not closeable in this worktree, and I will not guess.** There is no `.env` file of any kind here and `RAPIDAPI_KEY` is unset, so `runSnapshotsForMarket()` runs the mock path (`snapshot.ts:219-229`) and no live payload can be captured. Per discovery §6 this gates **B.1/B.2 scoping only and does not block Tier A**, which is why R1–R5 are all Tier A or measurement.
The `neighborhood-fit` §6 ledger therefore stays an **unverified assumption table**. It must not be treated as fact by UXDES. A DEV verification recipe is in §6.

---

## 4. Design directives (specific, testable — for UXDES)

Numbered R1–R5. Each states its relationship to `neighborhood-fit` D1–D6.

### R1 — Render the deal-detail location through `getHotelLocationDisplay()` at `search_area`. Invent no copy.
*Implements D1; supersedes its "spec the exact label + caveat copy" instruction, because the copy already exists and is already approved.*

`app/deals/[dealId]/page.tsx:350-351` must be replaced by a call to the shared helper with exactly this shape:

```ts
getHotelLocationDisplay({
  location: { precision: 'search_area', label: deal.city, source: 'search_fallback' },
})
// → label "Search area" · value deal.city
//   note  "Only the searched destination is available. Confirm the property location with the provider."
//   isWarning true
```

**Do not pass an `area` key.** The `area` branch precedes `search_area` in the helper (`hotelLocationContext.ts:67`) and a truthy `area` silently downgrades the result to the wrong tier — the exact bug being fixed. The warning treatment must be honored (`isWarning: true`), matching how `HotelCard.tsx:1010-1012` styles it.

*Testable:*
1. No expaify surface renders a bare city under a label implying finer-than-city granularity.
2. The string "Provider supplied an area, not a street address." does **not** appear on any deal-feed surface, because no provider supplied an area there.
3. The rendered label/note are byte-identical to the helper's `search_area` output — assert against `getHotelLocationDisplay`, not against a literal, so the two surfaces can never drift.

### R2 — One certainty word on the card, inside the existing secondary line.
*Implements D2; resolves `neighborhood-fit` Q3 in favour of a card cue, at minimum cost.*

`DealCard.tsx:77-80` becomes `{stars} · {city} · {checkInWindow} · {certainty}`, where `certainty` is a single fixed phrase for the city-only state. **Recommended copy: `area unconfirmed`.** It is four syllables, asserts nothing false, and does not read as a system error the way "unknown" or "missing" would.

Rules UXDES must spec:
- The phrase is derived from the same precision tier as R1 — one location language across card and detail (this is D3 applied to Tier A).
- **Locked cards** (`LockedDealCard`, `DealFeed.tsx:1795`): no cue. The hotel identity is withheld, so a location-certainty claim is meaningless.
- **Mock/example cards** (`DealCard.tsx:69-73, 120-121`): no cue. Sample data must not carry provenance claims.
- **Expired cards** (`deal.expired`): no cue. Location certainty is moot once the rate is dead.
- The cue must not sit in the price/Deal Score cluster (`:83-116`) — discovery constraint 3.
- **If UXDES measures the 375px wrap as unacceptable**, the fallback is to drop the cue from the card and rely on a single feed-level statement adjacent to the results header — but that fallback **fails discovery acceptance signal 4 as written**, so taking it requires an explicit amendment to that signal, not a silent substitution.

*Testable:* on a city-only deal at 375px and 1280px, a user can tell from the card that exact location is unconfirmed; no phrasing names or implies a neighborhood; the secondary line wraps without overlapping and without clipping; price and Deal Score hierarchy is byte-for-byte unchanged.

### R3 — Card height changes must be mirrored in the feed skeleton.
*New — no D-directive covers it; it is the regression this work is most likely to cause.*

`DealFeed.tsx:214` states the skeleton mirrors `DealCard`'s block order and heights. If R2 adds a line at any breakpoint, the skeleton's corresponding block must change with it.

*Testable:* at 375px and 1280px, the feed does not shift vertically when skeletons are replaced by real cards.

### R4 — Tier B stays gated, and the gate is written into the spec, not assumed.
*Scope guard; carries D4/D5/D6 forward with one correction.*

UXDES may write the Tier B spec, but it must be a **separate, clearly-marked section** that no UI/DEV ticket may implement without APPROVED FEATURE sign-off (discovery constraint 2). Two corrections to `neighborhood-fit`'s Tier B assumptions, both code-verified:

- **The `distance_to_cc` shortcut is not available.** Per Q3 above, `hasVerifiedHotelLocationComparison()` rejects a `provider_documented` distance paired with a non-`provider_declared` anchor (`locationEvidence.ts:104-106`). Distance requires per-hotel coordinates and `withCalculatedAnchorDistance()`. Spec it that way or spec no distance.
- **The §6 provider ledger is unverified** (Q5). Tier B copy must not name a provider field that has not been seen in a live payload.

D4 stands as written: no deal missing coordinates renders any distance; every rendered distance names its anchor and unit. D5 stands: an orientation label is not an address. D6 stands: no user-anchor input in this ticket.

*Testable:* the design doc's Tier B section is explicitly marked as blocked, names its blocker (APPROVED FEATURE + Q5 payload verification), and no Tier A acceptance criterion depends on any Tier B artifact.

### R5 — Add one location dimension to the four events that already exist. Build no new funnel.
*Implements discovery A.3, rescoped by F-2.*

Do not add a parallel event set. Add a `location_precision` property — values drawn from `HotelLocationPrecision` (`lib/types.ts:387`), which will be `'search_area'` for every deal-feed deal until Tier B ships — to:

| Event | Where | Insertion point |
|---|---|---|
| `hotel_result_card_opened` | `DealFeed.tsx:1349` | add to the existing props object |
| `hotel_detail_viewed` | `HotelDecisionAnalytics.tsx:50` | via the existing `viewedProps` bag (`[dealId]/page.tsx:463`) — no new component |
| `hotel_room_handoff_started` | `:125` | add to the existing props object |
| `hotel_detail_back_to_results` | `:135` | add to the existing props object |

Region-view (funnel step 3) is already covered: `hotel_decision_section_reached` fires per `data-hotel-decision-section`. If R1's location block becomes its own inspectable region, give it a `data-hotel-decision-section` attribute and it is instrumented for free.

**Exit-without-handoff (step 4) is a query, not an event:** `hotel_detail_viewed` with no `hotel_room_handoff_started` for the same `deal_id` within the same `sessionId` (`lib/analytics.ts:8-23`). UXDES should state this as the analysis definition so nobody ships a redundant `hotel_detail_exited` event.

**Primary decision signal** (unchanged from discovery): detail-view → OTA-handoff conversion, segmented by `location_precision`. **Guardrails:** repeated `hotel_result_card_opened` across distinct deals in one session must fall, not rise; and `hotel_decision_section_reached` on the location region followed by exit with no handoff is *unresolved doubt*, not success. A rise in location-region views is not a success measure on its own.

*Testable:* every event in the table above carries `location_precision`; its value maps 1:1 to a `HotelLocationPrecision` member; no new event name is introduced for exit; the detail page emits no `track()` call from server-component code.

---

## 5. What Tier A actually delivers, honestly stated

Tier A does **not** answer "is this hotel near the part of town I care about?" No amount of UI work can, because the data does not exist (§1). What Tier A delivers is narrower and still worth shipping:

- It **stops the product lying** about where its location knowledge comes from (F-1) — a live trust defect, squarely inside repair-mode scope.
- It **sets the expectation before the click** rather than after (R2), which is what converts pogo-sticking into a decision.
- It makes the eventual Tier B win **measurable against a real baseline** (R5) instead of an assumption.

Discovery's success statement — a shopper judging location fit without an external map — is achievable **only at Tier B**. UXDES should say so plainly in the spec rather than implying Tier A closes it.

---

## 6. Open items for downstream stages

- **Q5 (DEV, blocks Tier B scoping only):** capture one live payload per provider and record the exact field names for district and per-hotel `lat`/`lng`. Recipe: set `RAPIDAPI_KEY`, then call the three URLs constructed at `snapshot.ts:76-80`, `:111-115`, `:151-153` for one market (BCN has entries in all three of `BK_DEST`, `COORDS`, `TA_GEO`) and dump the raw JSON before the `flatMap` parse. Record findings back into `neighborhood-fit` §6 and mark each row verified or absent. Until then that table is an assumption, not a ledger.
- **UXDES decision:** R2's 375px wrap — accept the two-line secondary line, or invoke the fallback and amend discovery acceptance signal 4. Do not leave this to UI.
- **UXDES decision:** whether R1's location block gets its own `data-hotel-decision-section` region (see R5). Recommend yes — it costs one attribute and makes step 3 observable.
- **Noted, out of scope:** `app/deals/[dealId]/page.tsx:215` passes `area: deal.city` into the `HotelOffer` handed to `scoreDeal()`. Scoring does not read `area`, so there is no live defect, but it is the same city-as-area conflation as F-1 and will mislead the next reader. Flagging only — not part of this ticket.

---

## 7. Success check (how TEST will judge the eventual Tier A build)

1. No surface renders a city string under a label implying finer-than-city granularity (R1).
2. Every location state on deal-feed surfaces maps 1:1 to a `HotelLocationPrecision` tier with copy produced by `getHotelLocationDisplay()` — no bespoke phrasing (R1, R2).
3. No deal lacking coordinates renders any distance (R4).
4. On a city-only deal, a user can tell from the card that exact location is unconfirmed (R2).
5. The four events in R5 carry `location_precision`; detail-exit-without-handoff is derivable from `sessionId` (R5).
6. Card and detail are readable and non-overlapping at 375px and 1280px; price and Deal Score hierarchy unchanged; the feed does not jump between skeleton and loaded state (R2, R3).
7. No regression to feed filtering/sorting, deal detail rendering, the homepage cards, the locked-card variant, or the OTA handoff (F-3).
