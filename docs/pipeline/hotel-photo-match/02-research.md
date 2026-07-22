# UX Research: Hotel and Room Photo Match

Ticket: `UXR-HOTEL-PHOTO-MATCH-01`
Stage: UX Research
Priority: P1
Date: 2026-07-22

## Source Inputs

- Discovery report: `docs/pipeline/hotel-photo-match/01-discovery.md` — **NOT FOUND on disk.** The
  upstream UXD stage did not leave the discovery file. The problem statement, scope, and
  instrumentation signals used below are reconstructed verbatim from the `UXR-HOTEL-PHOTO-MATCH-01`
  ticket body, which embeds them. See Blockers. This does not change the audit findings (those come
  from source), but the design stage should treat the reconstructed problem statement as the
  discovery of record until the real file is restored.
- Current implementation audited (read, not assumed):
  - `lib/types.ts` — `HotelOffer.photoUrl` (line 146), the only photo field in the offer shape.
  - `lib/providers/hotellook.ts` — live provider photo source (`HotelLookCacheEntry.photoUrl`,
    line 26; normalization at line 474; sanitizer at 347–371).
  - `lib/pipeline/snapshot.ts` — how the persisted `photo_url` is chosen (lines 96, 130).
  - `lib/db/schema.sql` — `price_snapshots.photo_url` (line 109) and `deals.photo_url` (line 130).
  - `app/components/HotelCard.tsx` — search-results card, collapsed thumb (429–443) + expanded
    hero (526–536).
  - `app/components/ui/DealCard.tsx` — deal-feed card hero (54–106).
  - `app/deals/[dealId]/page.tsx` — deal-detail hero (264–290).
  - `app/components/ui/LockedDealCard.tsx` — locked/members deal thumb (25–30).
  - `app/components/__tests__/scorePresentation.test.tsx` — the "honest no-photo state" test
    (321–345) that pins HotelCard's missing-photo behavior.
- Reference patterns checked at the interaction level (not visual style): Booking.com property
  gallery + room-selection step; Google Hotels photo tabs.
- Sibling honesty contracts this brief must stay consistent with:
  `docs/pipeline/hotel-quality-snapshot/02-research.md` (provenance-or-caveat rule) and
  `docs/pipeline/hotel-rating-source-confidence/03-design.md` (confidence-labeled evidence).

## Research Question

expaify ships exactly one property-level photo per hotel and cannot attribute it to a room or to
the specific nightly rate shown beside it. Within that constraint — single `photoUrl`, no room
galleries to be invented — what is the smallest set of labeling, ordering, and missing-state rules
that stops a generic property photo from *implying* "this is the room you get at this price,"
without depressing qualified provider handoffs?

## Research Summary

The photo is the **only element on the hotel surfaces that carries no provenance**, and it sits in
a card system that is otherwise meticulous about provenance. HotelCard already labels the rate
("Rate from {provider}", "Last-checked time unavailable", "per night before taxes and fees"),
labels hotel class and guest rating with an explicit `confidence` axis (verified / provider_only /
inferred / unavailable), and discloses the provider handoff. The photo breaks that contract: it is
presented as if it were verified depiction of the named hotel and, by adjacency, of the rate.

Two independent, confirmed defects drive the trust problem:

1. **The photo is unambiguously property-level and unattributable, but it is rendered adjacent to —
   and on the feed/detail surfaces *overlaid by* — a specific rate and discount claim.** The data
   never contained a room or a rate association (see Finding 1). So the "room at this price"
   reading is not a copy nuance; it is an implication manufactured entirely by layout.

2. **The four rendering surfaces disagree with each other about what the photo even is.** HotelCard
   asserts it *is* the hotel (`alt={hotel.name}`); DealCard, the deal-detail hero, and
   LockedDealCard declare it decorative (`alt=""`). Same field, opposite semantics. And the
   missing-photo states diverge just as badly: HotelCard shows an honest "Photo unavailable" text
   tile, while the feed and detail render a branded gradient + building icon that dresses *absence*
   up as intentional design (see Findings 2–3).

The honest resolution mirrors `hotel-quality-snapshot`: **do not claim more than the data supports.**
The photo cannot be claimed as "the room" or "the hotel as it is today," so it must be labeled for
what it verifiably is — a **provider property photo that may not show the booked room** — with one
alt rule, one visible label, and one missing-photo state applied across all four surfaces. This is
a labeling/consistency repair, not a feature: no new photo data, no galleries.

## Current Implementation Findings

### 1. The photo is property-level and has no room or rate association anywhere in the pipeline

`HotelOffer` carries a single optional `photoUrl?: string` (`lib/types.ts:146`) and nothing else
photo-related — no room type, no rate id, no gallery, no caption, no source/fetchedAt for the
image. The live provider fills it from `HotelLookCacheEntry.photoUrl` (`hotellook.ts:26`), a single
property image that sits beside `propertyType` and is sanitized to a plain string or dropped
(`hotellook.ts:347–371`, assigned at `474`). The persisted path is even more explicit that this is
a *property* image: the snapshot job takes `prop.photoUrls?.[0]` or
`hotel.main_photo_url ?? hotel.max_photo_url` (`lib/pipeline/snapshot.ts:96,130`) — literally the
property's "main photo," the first of a property array — and writes it to `price_snapshots.photo_url`
and `deals.photo_url` (`schema.sql:109,130`), both a single `TEXT` column. **At no layer does a room
or a rate touch the photo.** The design stage cannot assume otherwise, and must not invent
room-level imagery.

### 2. The `alt` contradiction: same data, opposite semantics, and the "content" reading is wrong

- `HotelCard.tsx:434` and `:531` render `alt={hotel.name}`. To assistive tech this asserts "this
  image is {Hotel Name}" — a claim expaify cannot verify (the image may be stale, stock, or the
  wrong wing) and that reinforces the room/rate implication.
- `DealCard.tsx:59`, `app/deals/[dealId]/page.tsx:268`, and `LockedDealCard.tsx:27` render `alt=""`
  — decorative, i.e. "this image carries no information."

Both cannot be right for the same field. The decorative reading (`alt=""`) is closer to the truth
of the data, but on its own it is insufficient here: a *sighted* user still reads the photo→rate
adjacency as attribution, and `alt=""` does nothing for them. The correct target is a single rule
that is honest for both audiences — see Directive 1.

### 3. Two different missing-photo states, one honest and one that hides absence

- HotelCard renders an explicit **"Photo unavailable"** text tile (`HotelCard.tsx:439–443`), and a
  regression test locks this in (`scorePresentation.test.tsx:321–345`: asserts `"Photo unavailable"`
  and no fake imagery). This is the honest state.
- DealCard (`:66–87`) and the deal-detail hero (`page.tsx:271–282`) render a **brand gradient +
  generic building SVG**, marked `aria-hidden`. This is decorative filler that reads as a designed
  choice, not as "we have no photo of this property." It also silently removes the fact of absence
  from the accessibility tree.

Three surfaces, two behaviors, and the prettier one is the less honest one. The feature needs one
missing-photo state, and it should be the honest one.

### 4. Layout actively manufactures the "room at this price" implication

- HotelCard collapsed: the thumb is the left cell of a
  `grid-cols-[4.5rem_minmax(0,1fr)_minmax(6.75rem,auto)]` row whose right cell is the nightly-rate
  `Price` block (`HotelCard.tsx:428–484`). Photo and specific rate are literally the same row.
- DealCard feed: the discount chip (`DealChip`) is **overlaid on the photo** (`DealCard.tsx:90–91`),
  and the "usually {median}" strikethrough price sits directly under it. The deal *claim* is stamped
  onto the generic photo.
- Deal detail: same overlay — `DealChip` on the hero photo (`page.tsx:283–285`), price below.

So the implication the discovery names is not hypothetical; it is produced by three separate
layouts pinning a rate or discount to an unattributed image.

## Reference Pattern Comparison (interaction level)

| | Booking.com / Google Hotels | expaify today | Delta |
|---|---|---|---|
| What the hero photo claims | Explicitly *property* imagery; galleries are tabbed "Property" vs "Rooms" | Implicitly "the hotel," and by adjacency "the room at this rate" | expaify makes an attribution claim the data can't back |
| Photo ↔ rate coupling | Decoupled: room-specific photos appear only on the room-selection step, next to that room's rate | A single property photo sits beside / under one specific nightly rate and discount | expaify collapses two steps into one misleading pairing |
| Missing photo | Neutral, explicit placeholder consistent everywhere | Honest text on one surface, decorative gradient on two others | expaify is internally inconsistent and hides absence on 2/3 surfaces |

The delta is **not** "expaify needs room galleries." References decouple photo from rate and *label*
the photo's scope. expaify can achieve the same trust outcome with labeling + one honest
missing-state, staying inside the single-photo constraint.

## Design Directives (specific, testable)

Constraint on all directives: existing single `photoUrl` only. No fabricated room galleries, no new
photo provider work, no per-room imagery.

### D1 — One alt rule across all four surfaces; never assert the image *is* the hotel or room
Replace both `alt={hotel.name}` (HotelCard) and the bare `alt=""` (DealCard, deal-detail,
LockedDealCard) with a single rule. The image must not claim to depict the named hotel or the booked
room. Recommended: decorative `alt=""` **paired with a visible caption** (D2) that carries the scope
for sighted users, OR a descriptive alt that states scope, e.g.
`alt="Property photo — may not show the booked room"`. Pick one and apply identically to
`HotelCard.tsx:434,531`, `DealCard.tsx:59`, `app/deals/[dealId]/page.tsx:268`,
`LockedDealCard.tsx:27`. Testable: no surface renders `alt={hotel.name}`; the existing
`scorePresentation` test is extended to assert the chosen alt rule.

### D2 — A persistent, visible photo-scope label that breaks the rate-attribution implication
Every rendered property photo carries a short visible label establishing scope, minimum copy
**"Property photo"** (design stage finalizes exact string; must state it is not room- or
rate-specific). The label must be visually attached to the image, not to the rate block, so scope
travels with the photo. Copy must be factual and non-alarming — it clarifies scope, it does not warn
users off the deal (guardrail: it must not read as "this deal is fake"). Testable: label text is
present on every surface that renders a photo, at 375px and desktop, without overlapping the
discount chip or price.

### D3 — One honest missing-photo state everywhere
Replace the decorative gradient + building icon on DealCard (`:66–87`) and deal-detail
(`page.tsx:271–282`) with the honest, explicit no-photo treatment already used by HotelCard
("Photo unavailable" / "No property photo" — design stage settles final copy). The state must convey
absence rather than decorate it, and must be represented accessibly (not silently `aria-hidden`
when it is the only photo signal). Testable: all three surfaces render the same missing-photo copy;
the HotelCard regression test's spirit ("honest no-photo state, no fake imagery") extends to
DealCard and the detail page.

### D4 — Photo stays visually subordinate to the rate + Deal Score, and the discount chip stops
stamping the deal claim onto the image
Keep the photo tertiary in scan order: on HotelCard the 4.5rem left thumb is already subordinate and
should stay so with the D2 label attached; on DealCard and deal-detail, the discount chip should not
read as a verified label *of the photo*. Either move the `DealChip` off the image or ensure the D2
scope label sits with the chip so the discount is clearly a price claim, not a photo claim. Primary
remains rate + Deal Score; photo + label are supporting context. Testable: on every surface the rate
and Deal Score are reachable/announced before the photo is treated as evidence, and the discount
chip is not the only thing labeling the image.

### D5 — Do not add photo confidence data the pipeline doesn't have
Because there is no image `source`/`fetchedAt`/room association in the data (Finding 1), the label
must claim only scope ("property photo"), never freshness or verification. The design stage must not
introduce a "verified photo" or "recent photo" claim — that would repeat exactly the over-claim this
ticket exists to fix. Testable: no surface renders any freshness/verification claim about the image.

## Hypothesis & Validation Plan

**Hypothesis (from ticket):** an unlabeled property photo adjacent to a specific rate degrades trust
in two directions — booking hesitation (users unsure the pictured room is what they'll get) and
false confidence that breaks at provider handoff. Labeling the photo's scope should reduce both
*without* depressing qualified handoffs.

The discovery doc that was to define exact instrumentation is missing (see Blockers), so this brief
specifies the measurable validation itself, anchored to the three signals named in the ticket. The
app already has a lightweight event mechanism (`TrackOnMount`, e.g.
`deal_stale_banner_viewed` in `app/deals/[dealId]/page.tsx:256`) that the label/impression events can
reuse — no new analytics infra required.

1. **Rate-selection confidence (primary).** Proxy: on HotelCard, the "Details"/expand rate and
   time-on-card before CTA — high pre-CTA expansion suggests users are hunting to confirm "is this
   the room?". Expect the D2 label to *reduce* uncertainty-driven expansion, not increase it.
   Instrument a `hotel_photo_label_viewed` impression alongside the existing CTA events.
2. **Booking-CTA progression (guardrail).** "Review hotel" / provider-handoff click-through rate
   (HotelCard CTA at `:490–500`; feed/detail deal-open). The honesty label must **not** drop
   click-through below the pre-change baseline. This is the "don't depress qualified handoffs" gate:
   if labeled scope reduces CTA clicks materially, the copy is too alarming and D2 must be softened.
3. **Handoff honesty (secondary).** Among users who do hand off, post-handoff bounce-back /
   short-return rate should not worsen and ideally improves — the premise being that scope-labeled
   users arrive at the provider with correct expectations and abandon less on "that's not the room I
   saw." Measure via return-to-expaify-within-N-seconds after an outbound click where instrumentable.

**Pass reading:** signal 1 flat-or-better, signal 2 within noise of baseline (no material drop),
signal 3 flat-or-better. **Fail reading:** signal 2 drops materially → the label is depressing
qualified handoffs → return to design for softer, scope-only copy (never remove the label; remove
the alarm).

## Out of Scope / Explicitly Not This Ticket

- Room-level galleries, multiple photos, or any per-room imagery (no data; would be a new feature).
- Any image freshness/verification claim (no `fetchedAt`/`source` on the image).
- Changing what photo the snapshot job selects, or provider photo sourcing.
- Deal Score, rating, location, or price-provenance copy — those chains are shipped and out of
  scope here except that the photo must not visually borrow the rate's provenance.

## Blockers

- **Missing upstream discovery doc.** `docs/pipeline/hotel-photo-match/01-discovery.md` does not
  exist on disk; the UXD stage's output was not left in the worktree. Per the pipeline dependency
  rule ("no stage may begin until the previous stage's output exists") this is a genuine gap. It is
  mitigated — not resolved — by the ticket body embedding the full problem statement, scope, and
  instrumentation signals, which this brief treats as the discovery of record. The design stage
  should proceed on this brief, but the discovery file should be restored so the chain has a
  durable UXD artifact.

## Handoff

Next stage ticket: `UXDES-HOTEL-PHOTO-MATCH-01` (UX Design). The design spec must cover, for all
four surfaces (HotelCard collapsed + expanded, DealCard, deal-detail hero, LockedDealCard), and at
375px + desktop: the single alt rule (D1), the visible scope label + final copy (D2), the one
honest missing-photo state + final copy (D3), the photo/rate hierarchy and discount-chip treatment
(D4), and the no-freshness-claim constraint (D5) — plus how the extended `scorePresentation` test
should assert each.
