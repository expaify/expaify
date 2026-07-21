# UX Research: Hotel Review Relevance and Recency

Ticket: `UXR-HOTEL-REVIEW-RELEVANCE-01`
Stage: UX Research
Priority: P2
Date: 2026-07-21

## Source Inputs

- Discovery report: `docs/pipeline/hotel-review-relevance/01-discovery.md`
- Adjacent research to coordinate with, not re-derive:
  - `docs/pipeline/hotel-quality-snapshot/02-research.md` (owns the review-recency caveat + amenity panel; defines the additive `reviewRecency?` contract)
  - `docs/pipeline/deal-supporting-facts-order/02-research.md` (owns the fixed collapsed scan sequence and the max-two-quality-chips-at-375px budget)
- Shipped work that must not be re-opened:
  - `hotel-rating-source-confidence` — `guestRating` kind/confidence/sourceLabel gating (`lib/types.ts:109-151`, `app/components/HotelCard.tsx:91-93,220-234`)
- Current implementation audited (read, not assumed):
  - `lib/types.ts` — `HotelOffer`, `HotelRatingEvidence`, `HotelProvider`
  - `lib/providers/hotellook.ts` — live + cached normalization, the only `HotelProvider`
  - `lib/providers/bookingComRapidApi.ts` — implements `FlightProvider`, not hotels
  - `lib/providers/index.ts`, `amadeus.ts`, `duffel.ts`, `kiwi.ts`, `travelpayouts.ts` — flight providers only
  - `app/components/HotelCard.tsx` — collapsed + expanded render, `QualityEvidencePanel`
  - `app/globals.css` — design tokens
- Reference patterns checked at the interaction level (not visual style): Booking.com themed review categories + "recent reviews" recency framing; Google Hotels "review summary" AI-generated block with explicit attribution/hedging.

## Research Question

Given the aggregate guest score, source/confidence gating, review count, and data-fetch freshness are already shipped, can expaify surface **theme-level review signals** (cleanliness, noise, location, service) and **review-level recency** at deal detail so a first-time user can judge whether a cheap deal is credible for *their* concern — and if the data is not licensed today, what is the honest MVP, and how must derived summaries be framed so they never read as expaify facts?

## Research Summary

**Theme-level review evidence is unbuildable from any current or candidate provider, so the MVP is fallback-first.** No provider on any code path returns theme/category subscores, review text, or per-review dates. The live Hotellook `cache.json` payload carries only `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType` (`lib/providers/hotellook.ts:10-28`); the cached/seeded path validates only `{value, scaleMax, sourceLabel, reviewCount, fetchedAt}` and **silently drops any other field** (`hotellook.ts:277-316`). There is no second hotel provider — `bookingComRapidApi.ts` implements `FlightProvider` and exposes no `searchHotels`. A repo-wide grep for `cleanliness | noise | sentiment | subscore | theme | reviewText | snippet | pros | cons` across `lib/` and `app/` returns nothing outside the aggregate rating path.

This is the same underlying data gap that `hotel-quality-snapshot` already resolved for *recency* with an honesty caveat. This ticket is narrower and complementary: `hotel-quality-snapshot` answers **"is the score fresh?"**; this ticket answers **"what are recent guests saying, and about what?"**. Because both are blocked on the identical missing provider capability, **recency must be defined once, in `hotel-quality-snapshot`'s `reviewRecency?` contract — this ticket must not define a second recency field or a second recency caveat.**

Therefore the design output for this ticket is not a populated theme UI. It is:
1. A **details-only "review themes" fallback state** that honestly says theme-level review data is not provided, without inventing content.
2. An **additive, provider-sourced-only theme contract** so DEV/UXDES know the future target without shipping empty-data UI.
3. A **strict summarization-framing rule set** (attribution, hedging verbs, source line, no color-only encoding) that governs any future derived theme summary, defined up front because it is a source-constraint requirement — not a polish item to retrofit.

The validated theme set for the future contract is a **small fixed four: cleanliness, noise, location, service** — the discovery candidate set is confirmed as the decision-critical dimensions for the "is this cheap deal credible for me" question. This must be a closed enum, not an open tag cloud.

## Current Implementation Findings

### 1. No theme-level field exists on any type or provider path

`HotelRatingEvidence` (`lib/types.ts:109-117`) models exactly one aggregate signal: `kind`, `value`, `scaleMax`, `sourceLabel`, `reviewCount`, `fetchedAt`, `confidence`. `HotelOffer` (`lib/types.ts:137-151`) carries `hotelClass` and `guestRating` evidence and nothing per-theme. There is no `themes`, no per-category subscore, no pros/cons, no review-text field. Nothing to conceal or reveal at the theme level exists in the data model.

### 2. The live provider returns no review content, and the cached path cannot smuggle it in

Live normalization (`hotellook.ts:448-487`) builds each offer from the eight cache fields and, with no `legacyRating`, produces `guestRating = { kind: 'unknown', confidence: 'unavailable' }` (`hotellook.ts:270-274`). The verified guest score + `reviewCount` the shipped card can display arrive only through `normalizeCachedEvidence` (`hotellook.ts:277-316`), whose allow-list reads `value`, `scaleMax`, `sourceLabel`, `reviewCount`, `fetchedAt` and **nothing else** — any `themes` or per-review-date field on a cached object is dropped on the floor. So theme evidence is unbuildable today live *and* cached, exactly as recency is.

### 3. There is no themed review evidence in the flow at all

The expanded deal detail (`HotelCard.tsx:523-582`) renders Deal Score → `QualityEvidencePanel` (class, guest rating, review count, confidence, updated) → Location → Price scope → Provider handoff. Zero themed pros/cons, zero representative recent statements, no per-theme signal. The user's only "why" behind the aggregate number is to leave expaify for the provider — the exact gap the discovery names.

### 4. No safe convention exists for showing derived/summarized review content

The shipped card is scrupulous about provenance for *scores* (`getConfidenceText`, `getQualityHelperText`, `HotelCard.tsx:248-282`) but there is no pattern anywhere for rendering *summarized opinion* — themed pros/cons distilled from many reviews — without it reading as an expaify-verified property fact. This is a trust landmine that must be designed before any theme data arrives, not after.

### 5. `fetchedAt` is not review recency (inherited constraint)

`fetchedAt` is when expaify pulled the rate (`hotellook.ts:447`). It is structurally incapable of expressing how recent the underlying reviews are, and `hotel-quality-snapshot` already forbids deriving recency from it. This ticket inherits that rule verbatim: a theme signal must carry its own provider-sourced date/window or be shown undated.

## Reference Pattern Comparison (interaction level, not visual style)

### Booking.com — themed subscores + recency framing

Booking.com decomposes the aggregate into a small fixed set of category subscores (cleanliness, comfort, location, staff, facilities, value, wifi) and separately surfaces "recent reviews." **Interaction principle:** a theme shown is a theme the provider computed from real reviews, each attributable and bounded to a closed category set — never an open, editorialized tag list.

Delta vs expaify: expaify has no subscore field on any path. It cannot replicate the substance; it can only replicate the *honesty* — state that theme-level data is not provided — and pre-agree the closed four-theme set the contract would populate. Inventing a "cleanliness" bar from the single aggregate number would be the exact anti-pattern this reference warns against.

### Google Hotels — AI review summary with explicit framing

Google Hotels shows an AI-generated review summary explicitly labeled as generated from guest reviews, hedged ("guests mention…"), and linked to the underlying reviews. **Interaction principle:** a summary of opinion is visibly marked as a summary of *guests'* opinion, attributed to a source, and never presented as a first-party factual claim about the property.

Delta vs expaify: expaify has no licensed review text to summarize today, so it cannot ship a summary at all. But this reference defines the *rules the summary must obey the day one exists* — attribution, hedging verbs, a source line, and separation from expaify's own verified claims — which this brief converts into a hard directive (Directive 3) rather than leaving to UXDES taste.

## Source-Data Reality: What expaify Can Honestly Claim Today

| Signal | Claimable today? | Backing path | Honest state when absent |
| --- | --- | --- | --- |
| Aggregate guest score + confidence | Only from cached/seeded data | `normalizeCachedEvidence` (shipped) | `Guest rating not provided` (shipped) |
| Review count | Only from cached/seeded data | `normalizeCachedEvidence.reviewCount` (shipped) | `Review count not provided` (shipped) |
| Data-fetch freshness | Yes | `fetchedAt` (shipped) | `Freshness not provided` (shipped) |
| Review recency (per-review dates) | **No — owned by `hotel-quality-snapshot`** | none (its `reviewRecency?` contract, unbuilt) | its recency caveat (do not duplicate here) |
| **Per-theme signal (cleanliness/noise/location/service)** | **No — no provider field exists** | none (live returns nothing; cached allow-list drops it) | **Design the fallback below** |
| **Representative review snippets/text** | **No — none licensed** | none | **Not shown at all today (no fabrication)** |

Line every downstream stage must respect: **expaify may not manufacture a theme signal, a snippet, or a per-theme recency from the aggregate score, `reviewCount`, or `fetchedAt`.** The only shippable state today is an honest fallback.

## Recency Coordination (single-definition rule)

Per the discovery handoff, recency is defined **once**. `hotel-quality-snapshot/02-research.md` §Directive 3 already specifies the additive `reviewRecency?` object (`mostRecentReviewDate`, `shareLast12mo`, `sourceLabel`) on `HotelRatingEvidence`. This ticket **does not** add a competing recency field or caveat. Recommendation for the future contract:

- **Aggregate recency** (how recent the reviews behind the score are) stays owned by `hotel-quality-snapshot`'s `reviewRecency?`.
- **Per-theme recency** (is *this* theme's signal current) is expressed as an **optional `observedThrough?` window on each theme item** in this ticket's theme contract (Directive 2), populated only when a provider dates its subscores. When absent, the theme is shown undated — never back-filled from the aggregate `reviewRecency` or `fetchedAt`.
- MVP ships neither populated state. The recency caveat the user sees at deal detail is the single one `hotel-quality-snapshot` owns; the review-themes fallback (this ticket) references "not provided by this hotel source" in the same voice, so the two panels read as one honest snapshot rather than two overlapping disclaimers.

## Placement Recommendation

Given the shipped collapsed budget is fully spent (max two quality chips at 375px; `deal-supporting-facts-order` scan sequence: identity → price/scope → quality → compact score support → confidence → handoff caveat → CTA), **review-theme evidence is details-only.** The collapsed card gains no theme chip, no theme text, and no fallback line in this iteration — a signal that renders only as "not provided" adds scan cost without decision value and would displace facts the two prior tickets fought to make visible.

Within the expanded panel, coordinate with the `hotel-quality-snapshot` expanded order (Deal Score → Quality evidence → Amenities → Location → Price scope → Provider handoff). Insert **Review themes as a sibling panel directly after `Quality evidence` and before/adjacent to Amenities** — both are "what the provider told us about guest opinion / what it didn't," so they belong together and above Location. The fallback state lives inside this Review themes panel; there is no separate collapsed fallback.

## Design Directives For UXDES

1. **Ship a details-only "Review themes" panel whose only wired state today is an honest fallback; no collapsed-card change.**
   - Add one expanded panel, placed directly after the `Quality evidence` region and before Amenities/Location, consistent with the `hotel-quality-snapshot` expanded order.
   - Collapsed card DOM contains no theme chip, no theme text, no fallback line (preserve the max-two-quality-chips-at-375px cap and the `deal-supporting-facts-order` sequence).
   - Final fallback copy (today, always): heading `Review themes`; body `Theme-level guest reviews (cleanliness, noise, location, service) are not provided by this hotel source. The score above is an overall rating, not a breakdown.`
   - Testable: at 375px and 1280px the collapsed row still renders at most two chips; the expanded panel exists after Quality evidence and shows the fallback; no `HotelOffer`/`HotelRatingEvidence` theme field is read (none exists).

2. **Specify the additive, provider-sourced-only theme contract as a closed four-theme enum — marked "requires provider contract; not for build."**
   - Bound the MVP theme set to a fixed closed enum: `'cleanliness' | 'noise' | 'location' | 'service'`. No open tag cloud; no free-text theme labels.
   - Additive shape (absent on every provider path today):
     ```ts
     // Additive to HotelOffer; absent today. Provider-sourced only — never derived.
     reviewThemes?: {
       sourceLabel: string;              // required; a theme with no source is not evidence
       items: Array<{
         theme: 'cleanliness' | 'noise' | 'location' | 'service';
         sentiment: 'positive' | 'mixed' | 'negative';
         // Optional provider-computed subscore; same {value, scaleMax} shape as guestRating.
         value?: number;
         scaleMax?: number;
         // Optional provider-attributed summary of guest opinion (Directive 3 framing applies).
         summary?: string;
         // Per-theme recency window; provider-sourced only, never from fetchedAt/aggregate.
         observedThrough?: string;       // ISO
       }>;
     };
     ```
   - When absent (the only real state today) → render the Directive 1 fallback. Never infer `sentiment`, `value`, or `observedThrough` from the aggregate score, `reviewCount`, or `fetchedAt`.
   - Testable: the design marks every populated theme state "requires new provider contract"; the only state wired for shipping is the fallback; the theme set is exactly the four listed, in a fixed display order.

3. **Define the summarization-framing rules that keep any theme summary from reading as an expaify fact — this is a source constraint, not polish.**
   - Any `summary` string, whenever a future provider supplies one, must render with **all** of: (a) an attribution lead-in using a hedging verb — `Guests mention…` / `Guests report…`, never a bare declarative; (b) a visible source line — `Summary of guest reviews via {sourceLabel}`; (c) visual separation from expaify's own verified claims (its own panel, not merged into the Quality evidence dl). expaify must never render a theme summary as `This hotel is clean` or any first-party assertion.
   - Sentiment must not be encoded by color alone: each theme item pairs a text label (`Positive` / `Mixed` / `Negative`) and an icon/shape with the color, per WCAG and consistency with the shipped evidence copy.
   - If a provider supplies a subscore (`value`/`scaleMax`) but no `summary`, show the subscore with the same source line and no invented prose.
   - Testable: the spec includes the exact hedged lead-in and source-line copy for the future populated state; no populated example renders a summary without attribution + source line; no state relies on color alone for sentiment.

4. **Coordinate recency with `hotel-quality-snapshot`; do not define a second recency field or caveat.**
   - Do not add a recency caveat to the Review themes panel that duplicates the one `hotel-quality-snapshot` owns. Per-theme recency, when it exists, is the optional `observedThrough` window on each theme item (Directive 2), shown as `Guests through {month year}` and omitted when absent — never back-filled from `fetchedAt` or the aggregate `reviewRecency`.
   - The fallback copy references the same "not provided by this hotel source" voice as the shipped quality caveats so the panels read as one honest snapshot.
   - Testable: no new top-level recency type is introduced by this ticket; per-theme recency reads only from `observedThrough`; the design cites `hotel-quality-snapshot`'s `reviewRecency?` as the single aggregate-recency owner.

5. **Cover every state with final copy and keep the fallback first-class at 375px and desktop.**
   - The design must specify, with final copy: the fallback (today's only state), the future populated state (subscore-only, summary-only, subscore+summary, per-theme mixed sentiments), keyboard focus order (panel reachable in the expanded tab sequence), and screen-reader naming (the panel is an `aria-label`ed region; sentiment labels are in text, not color).
   - At 375px the panel and its four theme rows must wrap without overlap, without horizontal scroll, and without pushing the Location/Price scope/Provider handoff panels out of their shipped order.
   - Use existing tokens only (`--bg-raised`, `--border`, `--text-1/2/3`, `--warning`/`--warning-soft` for caveat emphasis, `--success`/`--success-soft` and `--error`/`--error-soft` for sentiment *paired with text/icon*). No new colors or font sizes.
   - Testable: the spec enumerates each state's copy; the fallback is a designed first-class state, not an edge case; expanded DOM order is Deal Score → Quality evidence → Review themes → Amenities → Location → Price scope → Provider handoff.

## Acceptance Criteria For UXDES

- The design covers, with final copy: today's fallback state, the future populated theme states, desktop 1280px, mobile 375px, focus/keyboard order, and screen-reader text.
- The collapsed card gains no theme content; the max-two-quality-chips-at-375px cap and the `deal-supporting-facts-order` scan sequence are preserved and cited.
- The theme set is exactly the closed four (cleanliness, noise, location, service) in a fixed order; no open tag cloud.
- Every populated theme summary state is framed with a hedged lead-in + source line and is visually separated from expaify's verified claims; sentiment never relies on color alone.
- Review recency is not redefined here; per-theme recency reads only from `observedThrough`, aggregate recency stays owned by `hotel-quality-snapshot`.
- The design marks every populated state "requires provider contract; not for build" and wires only the fallback for shipping — no empty-data UI, no fabricated themes/snippets/dates.

## Risks And Constraints

- **Fabrication is the whole risk.** The failure mode is not a missing panel; it is a "cleanliness bar" invented from the aggregate score, a snippet expaify has no license to show, or a summary rendered as a first-party fact. The fallback and the framing rules are first-class requirements, not edge cases.
- **Measurable-outcome tension:** the discovery requires engagement + confidence up *without* reducing qualified booking intent. Honest negative theme evidence (once it exists) must be framed as guests' opinion for *this* traveler's concern, not a blanket warning that scares users off deals that are fine for them — Directive 3's hedged, attributed framing is what protects intent.
- Non-negotiables still apply: external calls stay in `lib/providers`; adapters return `Result<T>`; money stays integer cents; theme/recency vocab is normalized in `lib/providers`, never parsed in components; outbound deeplinks keep affiliate markers.
- No change to Deal Score: theme/recency signals stay out of `scoreDeal.ts` and `DealBadge`.

## Out-Of-Scope Findings

- Licensing/acquiring a provider that returns themed subscores or licensed review text is a data/BD workstream and its own ticket; this ticket only defines the honest fallback and the contract that provider would satisfy.
- Persisting theme data into `/book` and any theme-based filtering/ranking are out of scope until a provider supplies the data.
- The live Hotellook path yields no verified guest score or review count either (only `stars`) — noted in `hotel-quality-snapshot`; unchanged here.

## Handoff

Create `UXDES-HOTEL-REVIEW-RELEVANCE-01` for an implementation-ready design of the details-only Review themes panel: today's honest fallback state, the closed four-theme additive contract marked "not for build," and the strict summarization-framing rules (attribution + hedging + source line + no color-only sentiment), coordinated with the `hotel-quality-snapshot` expanded order and its single recency contract.
