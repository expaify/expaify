# UXR-HOTEL-REVIEW-SIGNAL-TRUST-01: Hotel Review Signal Trust — Research Brief

**Stage:** UX Research
**Upstream:** `docs/pipeline/hotel-review-signal-trust/01-discovery.md`
**Scope:** Presentation and interpretation of existing `HotelRatingEvidence`. No new fields.

---

## Source Inputs

Read directly for this brief (not taken from discovery's line numbers):

- `app/components/HotelCard.tsx:406-677` (evidence formatters + `QualityEvidencePanel`), `838-1002` (collapsed row, chips, score chip, expanded panel order)
- `lib/providers/hotellook.ts:233-380` (evidence builders + cached normalizer), `445-545` (live `searchHotels` path and its call sites)
- `lib/types.ts:99-118` (`HotelQualityKind`, `HotelQualityConfidence`, `HotelRatingEvidence`)
- `docs/pipeline/hotel-rating-source-confidence/03-design.md` (shipped design — the source of two defects below)
- `docs/pipeline/hotel-quality-snapshot/02-research.md` (recency ownership)
- `docs/pipeline/hotel-review-relevance/02-research.md` (theme content + per-theme recency ownership)

Reference patterns compared at interaction/disclosure level: Booking.com review-score block, Google Hotels rating treatment.

---

## Research Summary

Discovery is correct that the degraded review state is the production default, and the live path is **worse than discovery described**. Discovery reported the live path returns `inferred` when a legacy rating exists and `unavailable` otherwise. In the actual live call site (`hotellook.ts:527-531`) `buildGuestRatingEvidence` is invoked with `{ stars, source, fetchedAt }` and **no `legacyRating`**, so the `inferred` branch (`hotellook.ts:278-286`) is unreachable on the live path. Every live Hotellook result therefore produces exactly:

```ts
{ kind: 'unknown', confidence: 'unavailable', sourceLabel: 'Hotellook', fetchedAt }
```

`inferred` reaches the UI only through `normalizeCachedHotelOffer` (`hotellook.ts:371-380`), which passes `normalizedRating` as `legacyRating`. So the single dominant production state is `unavailable` — no value, no scale, no count, no verified anything.

Traced through the card in that state:

| Surface | Rendered today | Function |
|---|---|---|
| Collapsed chip | *nothing* (row shows only the star-class chip; whole row omitted if `stars === 0`) | `getGuestRatingCollapsedText` → `null` (`HotelCard.tsx:502-521`) |
| Guest rating row | `Guest rating not provided` | `getGuestRatingDetailText:528-529` (confidence is `unavailable`, not `inferred`) |
| Review count row | `No review count available` | `getReviewCountText:551-554` |
| Confidence row | `No rating evidence from this provider` | `getConfidenceText:576` |
| Updated row | `Updated <date>` from `fetchedAt` | `QualityEvidencePanel:630, 667-672` |
| Helper | `No verified guest-rating evidence from this provider.` | `getQualityHelperText:596` |

Four rows and a helper paragraph say the same thing four different ways, behind a `Details` toggle, while the surface the user actually scans says nothing at all.

**The two headline defects are inherited from the shipped `hotel-rating-source-confidence` design spec, not from sloppy implementation.** That spec states `Omit unknown guest ratings from the collapsed row` (§Collapsed Card Pattern) and `Verified with label: 8.7/10` → `Excellent guest rating: 8.7/10` (§Expanded Details Pattern, guest rating row), the latter with no source clause. The implementation is faithful. This brief therefore **supersedes two presentation rules** of that shipped design (Directives 1 and 3 below) while leaving its data contract — `kind`, `confidence`, `scaleMax`, `sourceLabel`, `reviewCount`, `fetchedAt` — completely untouched. Superseding rendered copy is in scope; superseding the contract is not, and is not proposed.

---

## Current Implementation Findings

### 1. The collapsed card is silent in the only state that actually ships

`getGuestRatingCollapsedText` (`HotelCard.tsx:502-521`) returns `null` on two guards: missing `value`/`scaleMax`, and failing both `isVerifiedGuestRating` and `isProviderRating`. The live state fails the first guard. The collapsed row (`HotelCard.tsx:852-873`) renders only when `hotelClass || collapsedGuestRating`, so:

- `stars > 0` (typical): one chip, `4-star hotel`. Review evidence absent with no acknowledgement.
- `stars === 0`: the entire quality row is removed from the DOM.

Silence is not a neutral state. A scanning user reads an absent credibility signal as "nothing notable here," which is the opposite of the true meaning ("we don't know"). It also removes the one cue that would provoke opening `Details` — where the honest answer already exists.

### 2. `sourceLabel` is computed and then discarded on the strongest claim

`getGuestRatingDetailText:532` resolves `const sourceLabel = evidence.sourceLabel ?? source`, then at `536-537`:

```ts
const label = evidence.scaleMax === 10 && evidence.value >= 7 ? `${ratingLabel(evidence.value)} guest rating: ` : ''
return label ? `${label}${ratingText}` : `${ratingText} guest rating from ${sourceLabel}`
```

The variable is unused on the taken branch. Output: `Excellent guest rating: 8.6/10`. The provider-only branch (`541`) keeps its attribution, as does hotel class (`496-499`). So the card attributes its weak claims and orphans its strong one — the precise inversion of what a trust surface should do, and a direct violation of discovery constraint 1. `getQualityAriaLabel:610-614` drops it too, so the screen-reader path is equally unattributed.

### 3. One question, five rows, three review-count restatements

`QualityEvidencePanel` (`HotelCard.tsx:636-676`) renders `Hotel class`, `Guest rating`, `Review count`, `Confidence`, `Updated`, then a sixth helper paragraph. Review count appears in the collapsed chip (`508-510`), inside the guest-rating row's non-label branch (`533-537`), and as its own row (`551-561`). `Confidence` and the helper paragraph are paired restatements in all four confidence states — compare `getConfidenceText:569` (`Provider rating; review source not confirmed`) against `getQualityHelperText:585` (`This score is shown for context, but the provider did not include enough review evidence to verify it.`). The `inferred` pair is worse: `Not shown as a guest rating because it matches hotel class data` describes an internal de-duplication rule in expaify's vocabulary; a first-time user cannot act on it.

### 4. `Updated` is `fetchedAt`, positioned as review metadata

`updatedDate` comes from `guestRating.fetchedAt` (`HotelCard.tsx:630`), which on the live path is `new Date().toISOString()` at fetch time (`hotellook.ts:494`). The row is labelled `Updated`, sits inside a section titled `Quality evidence`, and is placed directly beneath `Review count`. Label, container, and adjacency all push the reading "reviews last updated then." `hotel-quality-snapshot/02-research.md` states the rule plainly: **`fetchedAt` is not recency.**

### 5. Provenance survives on colour and one mid-string word

Both chips are `<span className="truncate">` inside a wrapping flex row (`HotelCard.tsx:863-871`). The verified and provider-only variants differ by `--success-soft`/`--success` versus `--bg-muted`/`--text-2`, and by one word at character ~8 of `8.6/10 provider rating · 1,248 reviews`. At 375px, sharing the row with the class chip, that word is inside the clipped segment. When it clips, colour alone carries provenance — WCAG 1.4.1 failure, and discovery constraint 5.

### 6. No low-evidence qualification

`ratingLabel` (`HotelCard.tsx:406-408`) gates only on value and `scaleMax === 10`. Nothing consults `reviewCount`. A verified `8.6/10` backed by **3** reviews renders identically to one backed by 1,248: `Excellent guest rating: 8.6/10`. The `Review count` row states the number four rows away and draws no conclusion from it. This is the single most consequential gap for the discovery's target user — someone whose suspicion was raised by a low price.

---

## Reference Pattern Comparison

Interaction and disclosure order only; copy below paraphrases the *pattern*, and is not proposed as verbatim expaify strings. Final expaify copy is specified in the directives.

### Booking.com — review-score block

The score, the qualitative word, and the evidence volume are one bound unit rendered together in a fixed order: **number → word → volume** (`8.6` · `Excellent` · `1,248 reviews`). Two behaviours matter here:

- **Low review count.** Below its confidence threshold, Booking suppresses the qualitative word and leads with the count, so a thin score never borrows the authority of a thick one. The evidence volume qualifies the claim in the same glance, not in a detail panel.
- **Missing score.** A property with no score is not rendered blank. It gets an explicit, non-judgmental token in the score slot ("new to the site" framing) that explains the absence and is neutral about property quality.

**Delta vs expaify:** expaify splits the unit across three surfaces (chip, panel row, separate count row), applies its qualitative word with no count gate (Finding 6), and renders the missing-score case as `null` (Finding 1). The pattern's substance — *the score slot is always occupied, and volume qualifies the claim inline* — is exactly what is missing, and it requires no new field.

### Google Hotels — rating treatment

The rating is a compact bound pair, score plus parenthesised review volume, with the review source named as part of the rating unit rather than in a separate provenance region. A property without a rating keeps its card slot and shows an explicit no-rating state; the rest of the card (price, class, location) continues to carry the decision.

**Delta vs expaify:** expaify names the source in prose, in the expanded panel only, and drops it entirely on the qualitative branch (Finding 2). The pattern's principle — *attribution travels with the number, at every zoom level* — is what discovery constraint 1 demands and what the collapsed chip currently has no mechanism for.

### Synthesised principle for both

Neither reference treats "no score" as an edge case to omit and neither separates the number from its evidence. Both treat the score slot as **always occupied by one statement whose parts cannot be split**: value, volume, source, and — when volume is thin — a qualification. That is the pattern expaify should adopt, and it is implementable entirely within `HotelRatingEvidence` as shipped.

---

## Recency Ownership — Conflict Resolved

Discovery required this be settled before directives. Resolution, derived from the two adjacent briefs:

| Concern | Owner | Status |
|---|---|---|
| `reviewRecency?` field on `HotelRatingEvidence` (`mostRecentReviewDate`, `shareLast12mo`, `sourceLabel`) | `hotel-quality-snapshot` (Directive 3) | Additive contract specified; **no provider returns it**; not for build |
| The standalone details-only recency **caveat line** and its exact copy | `hotel-quality-snapshot` (Directive 2) | Copy already written; renders inside/directly after the `Quality evidence` panel |
| Per-theme `observedThrough` window | `hotel-review-relevance` (Directive 2) | Deferred with theme content |
| **How the existing `fetchedAt` render is labelled so it does not read as review recency** | **this ticket** | Open — Directive 4 below |

The line is clean: `hotel-quality-snapshot` owns *recency*; this ticket owns *freshness labelling*. This brief defines **no recency field, no recency value, and no second recency caveat**. It does constrain the rewritten panel to (a) label the `fetchedAt` render unambiguously as a data-check time and (b) preserve a named insertion slot so `hotel-quality-snapshot`'s caveat lands adjacent to it without contradiction or duplication. **No conflict remains.**

Secondary confirmation from the same brief, relevant to Directive 1: `hotel-quality-snapshot` Directive 1 caps the collapsed quality row at **two chips at 375px** and forbids adding recency/amenity chips. Directive 1 below occupies the *existing* guest-rating slot rather than adding a third chip, so the cap holds.

---

## Design Directives For UXDES

Five directives. Each is testable against the current build.

### Directive 1 — The collapsed guest-rating slot is never empty

**Supersedes** `hotel-rating-source-confidence/03-design.md` §Collapsed Card Pattern, rule `Omit unknown guest ratings from the collapsed row`, and §State Specifications → *Inferred Or Unknown Rating* / *No Rating And No Class* collapsed rules. Data contract unchanged.

`getGuestRatingCollapsedText` must return a string for every state. Final copy:

| Evidence state | Collapsed chip |
|---|---|
| Verified, count present | `Hotellook guests · 8.6/10 · 1,248 reviews` |
| Verified, no count | `Hotellook guests · 8.6/10 · review count not given` |
| Verified, count below 10 | `Hotellook guests · 8.6/10 · only 3 reviews` |
| Provider-only | `Hotellook rating · 8.6/10 · not from guest reviews` |
| Inferred | `No guest reviews from Hotellook` |
| Unavailable (**the live default**) | `No guest reviews from Hotellook` |

Rules:

- Source name is the **leading** token on every variant (see Directive 3).
- The unrated variants are styled with neutral tokens (`--bg-muted` / `--text-2` on `--border`), **never** `--warning-soft` or `--error-text`. Absent evidence is a statement about expaify's data, not a judgment of the hotel.
- This chip occupies the existing guest-rating slot. The collapsed row still renders at most two chips at 375px, preserving `hotel-quality-snapshot` Directive 1.
- The row's render guard changes from `hotelClass || collapsedGuestRating` to always-render, since `collapsedGuestRating` is now never `null`. The `stars === 0` case must still produce a review chip.
- `getQualityAriaLabel` must announce the same statement, including the source name, in all six states.

**Testable:** for each of the six states, at 375px and 1280px, the collapsed card contains a review chip; its accessible name contains the source name; no unrated variant uses a warning or error token; the row never exceeds two chips.

### Directive 2 — One review-credibility statement replaces the five-row panel

`QualityEvidencePanel` (`HotelCard.tsx:636-676`) is restructured. Hotel class keeps its own row — it is a different fact. The four review rows (`Guest rating`, `Review count`, `Confidence`, `Updated`) plus the helper paragraph collapse into **one labelled statement plus at most one supporting line**.

Structure:

- Row label: `Guest reviews`
- **Statement** — value, volume, source in one sentence.
- **Supporting line** — what the user should do about it. Present only where the statement leaves a decision open.

Final copy:

| State | Statement | Supporting line |
|---|---|---|
| Verified, count ≥ 10 | `8.6/10 from 1,248 guest reviews on Hotellook.` | *(none)* |
| Verified, count < 10 | `8.6/10 from only 3 guest reviews on Hotellook.` | `Too few reviews to be reliable. Check the reviews on Hotellook before booking.` |
| Verified, no count | `8.6/10 from guest reviews on Hotellook. Hotellook did not say how many.` | `Check the review count on Hotellook before booking.` |
| Provider-only | `8.6/10 is Hotellook's own rating, not a guest review score.` | `Check guest reviews on Hotellook before booking.` |
| Inferred | `Hotellook gave no guest review score for this hotel.` | `The rating we received repeats the hotel class above, so we do not show it as a review score. Check guest reviews on Hotellook before booking.` |
| Unavailable (**live default**) | `Hotellook gave no guest review score for this hotel.` | `Check guest reviews on Hotellook before booking. Its price and location above are unaffected.` |

Rules:

- **Review count is stated once per surface.** Once in the collapsed chip, once in the expanded statement. Delete the standalone `Review count` row, the `Confidence` row, and `getQualityHelperText` entirely.
- No string may name an internal mechanism. `Not shown as a guest rating because it matches hotel class data` and `We do not label inferred hotel data as a guest rating.` are both removed; the `inferred` supporting line above explains the same fact in traveler terms.
- Every non-verified state ends with an action. Discovery's success statement requires the card to "say what the user should do instead" — that is the supporting line's whole job.
- The unavailable state's second clause exists to stop absent review data reading as a defect in the property.
- No review text, quote, theme, or sentiment. Numeric aggregate and its metadata only (discovery constraint 2; `hotel-review-relevance` owns the rest).

**Testable:** the expanded panel contains exactly one `dt` matching `Guest reviews`; review count appears at most once in the expanded DOM; no rendered string contains `confidence`, `inferred`, `verified`, or `evidence` as user-facing vocabulary; every non-verified state renders a supporting line ending in an action.

### Directive 3 — `sourceLabel` renders on every path that renders a score, and survives truncation

**Supersedes** `hotel-rating-source-confidence/03-design.md` §Expanded Details Pattern, guest-rating row value `Excellent guest rating: 8.7/10`.

- No render path may output a rating value without its source. This includes `getGuestRatingDetailText:536-537` (currently drops it), `getGuestRatingCollapsedText` (currently has no mechanism for it), and `getQualityAriaLabel:610-614`.
- Resolution stays `evidence.sourceLabel ?? source`, as today. No new field.
- **The qualitative word is removed from the rating statement.** `Excellent` / `Very good` / `Good` (`ratingLabel`, `HotelCard.tsx:406-408`) are dropped from both collapsed and expanded copy. They add no information the number does not carry, they are what displaced attribution in the shipped spec, and — per Directive 5 — they are the wrong thing to assert when volume is thin. `ratingLabel` becomes dead and should be deleted.
- **Truncation:** in every chip variant the source name is the leading token and the provenance word (`guests` / `rating` / `No guest reviews`) is within the first two tokens, so a 375px clip removes the count, not the provenance. The chip is split into a non-truncating provenance segment (`shrink-0`) and a truncating detail segment, rather than one `truncate` span over the whole string (`HotelCard.tsx:869`).
- Colour may reinforce but never carry the verified/provider distinction; the distinction must be readable in the clipped string and in the accessible name (discovery constraint 5, WCAG 1.4.1).

**Testable:** grep every return path in `HotelCard.tsx:502-560` — each branch returning a numeric rating also contains the source token; at 375px with a long hotel name and a 4-digit review count, the rendered chip text still contains the source name and the provenance word; disabling colour leaves verified and provider-only distinguishable by text alone.

### Directive 4 — Freshness copy states what it is; recency stays with `hotel-quality-snapshot`

- The `Updated` row is relabelled and moved **out of the review statement's adjacency**. It renders after the `Guest reviews` row, not between review facts.
- Label: `Rate last checked`
- Present: `Rate last checked Mar 3, 2026`
- Missing: `Rate check time not given`
- The word `Updated` is removed; unqualified, inside a panel titled `Quality evidence` and adjacent to review facts, it is the source of the misreading.
- **No recency claim, value, or caveat is written by this ticket.** The design spec must leave a named slot directly after the `Rate last checked` row for `hotel-quality-snapshot` Directive 2's caveat line, and must state that this pipeline does not author it. `fetchedAt` must not be read by any recency copy.
- If UXDES finds the two lines redundant once adjacent, that is a note back to `hotel-quality-snapshot`, not a licence to rewrite its copy here.

**Testable:** no rendered string in `HotelCard.tsx` derives review recency from `fetchedAt`; the `fetchedAt` row's label contains `Rate`, not `Updated`; the design spec names the insertion slot and attributes the caveat to `hotel-quality-snapshot`.

### Directive 5 — Thin evidence is qualified inline, at the number

Uses the existing `reviewCount` only. No new field, no Deal Score coupling.

- Threshold: **`reviewCount < 10`** is thin. Chosen to match `scoreDeal`'s existing low-confidence convention (`lib/scoring/scoreDeal.ts` treats fewer than 10 historical points as low confidence), so expaify applies one evidence-sufficiency rule across price and quality. This is a shared *convention*, not a data dependency — the two signals stay computationally separate per discovery constraint 4.
- Thin and missing counts are qualified **in the same statement as the number** (`only 3 reviews`, `review count not given`), never in a separate row four lines away. This is the Booking.com low-count behaviour and the core of Findings 3 and 6.
- No qualitative word is asserted at any count (Directive 3), which removes the `Excellent` / 3-reviews failure without needing a second threshold.
- **Deal Score stays uncoupled.** Review credibility must not read into `DealScore.verdict`, `percentile`, or `confidence`, and no copy may say the price is suspicious because reviews are thin. Discovery's item 5 (cheap + thin reviews should give pause) is answered by **proximity and parity**, not by coupling: the `Guest reviews` statement is the first row of the expanded panel directly beneath `DealScorePanel` (`HotelCard.tsx:990-1002`, order preserved), and the collapsed review chip is always present (Directive 1) so the two signals are visible in the same scan. The user draws the inference; expaify does not draw it for them.

**Testable:** a verified 8.6/10 with `reviewCount: 3` renders `only 3 reviews` in both collapsed and expanded surfaces and renders no qualitative word; `scoreDeal.ts` and `DealBadge.tsx` are unmodified; no rendered string links review volume to price verdict.

---

## Acceptance Criteria For UXDES

`03-design.md` is complete when:

1. All six evidence states (verified ≥10 / verified <10 / verified no-count / provider-only / inferred / unavailable) are specified for collapsed, expanded, 375px, 1280px, focus/keyboard, and accessible name — with **`unavailable` written first**, as the production default (discovery constraint 3).
2. Every rendered string is final. No placeholders. Every string naming a rating value also names its source.
3. The five-row panel is replaced by one `Guest reviews` statement plus at most one supporting line; `Review count`, `Confidence`, and the helper paragraph are gone from the spec.
4. The `fetchedAt` row is relabelled `Rate last checked`, and the spec names the insertion slot for `hotel-quality-snapshot`'s recency caveat without authoring it.
5. The spec states in writing that it supersedes two presentation rules of `hotel-rating-source-confidence/03-design.md` (collapsed omission of unknown ratings; unattributed qualitative-label value) and reopens none of its data contract.
6. No new field on `HotelRatingEvidence`; no change to `scoreDeal.ts` or `DealBadge`; no review text, quote, theme, or sentiment.
7. Tailwind patterns are given per state using existing tokens only, with the two-segment chip structure (non-truncating provenance, truncating detail) specified explicitly.

---

## Risks And Constraints

- **The main risk is tone, not layout.** Six of the six states are honest today; the failure is that the honest ones are either invisible or written in expaify's voice. Directive 2's copy must stay neutral about the property — the unavailable state describes a gap in Hotellook's data, and if it reads as "this hotel is dubious" the fix has traded silence for a worse error.
- **Directive 1 makes the dominant state louder.** Every live card gains a `No guest reviews from Hotellook` chip. That is the intended correction — absence should provoke inspection — but it should be validated against discovery's detail-click-through and confidence measures before the styling is tuned further.
- **Superseding shipped design copy is deliberate and bounded.** Only the two presentation rules named in Directives 1 and 3 are overridden. `HotelRatingEvidence`, the confidence taxonomy, the `kind` gate on guest-review labelling, and the two-chip mobile cap all stand.
- Non-negotiables unchanged: provider calls stay in `lib/providers`; adapters return `Result<T>`; money stays integer cents; affiliate markers stay on outbound deeplinks; no vendor call from a component.

---

## Out-Of-Scope Findings

Reported, not designed here:

1. **The `inferred` branch is unreachable on the live path.** `buildGuestRatingEvidence` is called at `hotellook.ts:527-531` without `legacyRating`, so live results are always `unavailable`; `inferred` occurs only via the cached/seeded path (`hotellook.ts:371-380`). Directive 1 and 2 specify `inferred` copy regardless, since cached data reaches the same UI — but whoever owns the provider layer should confirm whether omitting `legacyRating` on the live path is intentional. Presentation-only ticket; not touched.
2. **`Price` / `PriceUnavailable` (`HotelCard.tsx:349-383`) hardcode `Last-checked time unavailable`** with no conditional path. Owned by `provider-freshness-timestamp-clarity` (which has a `03-design.md`). It sits next to Directive 4's `Rate last checked` copy, so that pipeline should reconcile the two freshness voices at implementation time. Flagged, not touched.
3. **`hotel-quality-snapshot` and `hotel-review-relevance` are both stalled after `02-research.md`.** Directive 4 leaves a slot that only `hotel-quality-snapshot`'s design stage can fill. This ticket ships correctly without it — the `Rate last checked` relabel removes the misreading on its own — but the recency caveat stays unwritten until that pipeline resumes.

---

## Handoff

Create `UXDES-HOTEL-REVIEW-SIGNAL-TRUST-01` — implementation-ready design spec for the six-state review-credibility statement (collapsed chip + expanded `Guest reviews` row), covering the `unavailable` live default first, with final copy for every string, per-state Tailwind patterns using existing tokens, the two-segment truncation-safe chip structure, and written supersession of the two named presentation rules in `hotel-rating-source-confidence/03-design.md`.
