# UXD-HOTEL-REVIEW-SIGNAL-TRUST-01: Hotel Review Signal Trust

## Problem Statement

Review evidence on a hotel card is presented as five separate provenance fields written in expaify's internal vocabulary, so a first-time user judging whether a discounted hotel is credible cannot resolve them into a single answer — and in the state the live provider actually returns most of the time, the card says only that the rating is *not* verified, without telling the user what to do about it.

## Scope Note: What Is Already Solved (Do Not Re-Solve)

Three adjacent pipelines already own the *data contract* for review evidence. This ticket owns only its **presentation and interpretation**. It must not reopen:

- **Source, scale, and confidence modeling** — `HotelRatingEvidence` (`lib/types.ts:110-118`) carries `kind`, `confidence`, `scaleMax`, `sourceLabel`, `reviewCount`, `fetchedAt`. Shipped under `hotel-rating-source-confidence` (design complete, `03-design.md` exists).
- **Review recency as a new data field** — owned by `hotel-quality-snapshot` (`01-discovery.md`, gap 1). That pipeline is defining a review-recency field distinct from `fetchedAt`. This ticket must not define a competing field.
- **Theme-level review content and licensed summarization** — owned by `hotel-review-relevance`. That pipeline explicitly owns the "no summarizing without licensed content" question.

**This ticket adds no new fields.** It is a repair of how the *existing* six signals are rendered and read. If UXR concludes new data is required, that is a conflict to report, not to design around.

## The Actual Gap

The rating-source-confidence pipeline correctly made provenance *available*. It did not make it *legible*. The result is an accreted panel that is honest and unreadable at the same time.

### 1. The dominant production state is the degraded one

`buildGuestRatingEvidence` (`lib/providers/hotellook.ts:266-292`) returns exactly two outcomes on the live path: `inferred` when a legacy rating exists, `unavailable` otherwise. It never returns `verified`. `verified` reaches the UI only through `normalizeCachedEvidence` (`hotellook.ts:295-375`).

So for most live hotel results the user sees:

- Collapsed card: **no rating chip at all** — `getGuestRatingCollapsedText` (`HotelCard.tsx:502-521`) returns `null` for both `inferred` and `unavailable`, so the entire review signal silently vanishes from the scan surface.
- Expanded panel: `No verified guest rating` + `No review count available` + `Not shown as a guest rating because it matches hotel class data`.

The design system treats this as an edge case; the provider makes it the default. A user scanning a discounted hotel gets *silence* where the credibility signal should be, and silence reads as "unremarkable," not as "unknown."

### 2. Source attribution is dropped on the one path that most needs it

`getGuestRatingDetailText` (`HotelCard.tsx:523-549`) has a branch for verified ratings on a 10-point scale at or above 7.0:

```
const label = evidence.scaleMax === 10 && evidence.value >= 7 ? `${ratingLabel(evidence.value)} guest rating: ` : ''
return label ? `${label}${ratingText}` : `${ratingText} guest rating from ${sourceLabel}`
```

When the label applies, the output is `Excellent guest rating: 8.6/10` — **`sourceLabel` is discarded**. The strongest, most persuasive claim on the card is the only one rendered without attribution, while weaker claims (`8.6/10 provider rating from Hotellook`) keep theirs. This directly contradicts the ticket constraint to retain review-source attribution. The `Confidence` row still says `Verified guest reviews`, but the *who* is gone.

### 3. One question is answered across five rows in system vocabulary

`QualityEvidencePanel` (`HotelCard.tsx:624-677`) renders `Hotel class`, `Guest rating`, `Review count`, `Confidence`, `Updated` as five `dt`/`dd` pairs plus a sixth helper paragraph. The user's actual question is singular: *can I trust this score?* Observed consequences in the current markup:

- **Review count is stated up to three times** — in the collapsed chip (`· 1,248 reviews`, `HotelCard.tsx:508-510`), inside the `Guest rating` row's non-label branch, and again as its own `Review count` row.
- **`Confidence` copy explains expaify's pipeline, not the decision.** `Not shown as a guest rating because it matches hotel class data` (`getConfidenceText`, `HotelCard.tsx:563-577`) describes an internal de-duplication rule. A first-time user cannot act on it.
- **The helper paragraph restates the `Confidence` row** in different words (`getQualityHelperText`, `HotelCard.tsx:579-597`) — e.g. `Provider rating; review source not confirmed` followed by `This score is shown for context, but the provider did not include enough review evidence to verify it.`

### 4. `Updated` is read as review recency

The `Updated Mar 3, 2026` row sits inside a panel titled **Quality evidence**, directly beneath `Review count`. Its value is `guestRating.fetchedAt` — when expaify pulled the record. Adjacency makes it read as *when guests last reviewed this property*. This is the specific misreading `hotel-quality-snapshot` identified at the data layer; it is live in the UI today and is a presentation defect this ticket can fix with copy alone, without waiting on a recency field.

### 5. Credibility is never connected to the discount

`ScoreChip` (`HotelCard.tsx:939-942`) and the review evidence render in unconnected regions — the chip above the fold, the panel behind a `Details` toggle (`HotelCard.tsx:987-1002`). The ticket's question is whether a **discounted** hotel is credible, and cheap-plus-thin-reviews is exactly the pairing that should give a user pause. The card can currently show `Great` beside a property with no verified rating and no review count, and nothing in either region acknowledges the other.

### 6. The one chip that distinguishes verified from unverified can truncate away

Both rating chips use `truncate` inside a flex row (`HotelCard.tsx:864-870`). The verified and provider-only variants differ by success/muted token styling and by a single word — `guest` vs `provider` — placed mid-string: `8.6/10 provider rating · 1,248 reviews`. At 375px, sharing a wrapping row with the hotel-class chip, the distinguishing word is in the segment most likely to clip. Colour alone then carries the provenance distinction, which fails for low-vision and colourblind users.

## Who Is Affected And Where

- **Who:** First-time, paid-intent users evaluating a *discounted* hotel — the case where a low price is itself the thing prompting suspicion, and review evidence is the only available counterweight.
- **Flow step 1 — deal-card scan** (collapsed `HotelCard`, `app/components/HotelCard.tsx:838-985`): user decides whether this hotel is worth opening. Today the review signal is either a truncatable chip or entirely absent.
- **Flow step 2 — hotel-detail evaluation** (expanded `HotelCard`, `HotelCard.tsx:987-1076`, `QualityEvidencePanel`): user decides whether to proceed to provider handoff via `Review hotel`. This is the last expaify surface before the user leaves.

## Measurable Signal

The problem is observable in the current build without user testing:

1. `buildGuestRatingEvidence` (`hotellook.ts:266-292`) has no code path returning `confidence: 'verified'` — the live default is `inferred` or `unavailable`.
2. `getGuestRatingCollapsedText` (`HotelCard.tsx:502-521`) returns `null` for every non-verified, non-provider-only case, so the collapsed card renders no review signal at all in the default production state.
3. `getGuestRatingDetailText` (`HotelCard.tsx:536-537`) omits `sourceLabel` on the qualitative-label branch; every other branch includes it.
4. `reviewCount` is formatted in three separate render paths (`HotelCard.tsx:508-510`, `533-537`, `551-561`).
5. `getConfidenceText` and `getQualityHelperText` (`HotelCard.tsx:563-597`) return paired strings that restate the same fact in all four confidence states.
6. The `Updated` row (`HotelCard.tsx:667-672`) is sourced from `fetchedAt` but labelled and positioned as review metadata.
7. Both rating chips apply `truncate` (`HotelCard.tsx:869`) to strings whose distinguishing token is non-initial.

**To be measured in first-time-user testing (UXR to instrument):**

- **Correct interpretation** — shown a card, can the user state (a) whether the score comes from guests or from the provider, (b) roughly how many reviews support it, (c) whether it is recent? Target: correct on all three without opening a provider link.
- **Detail click-through** — do users open `Details` when the collapsed review signal is absent or unverified? Absence of a signal should provoke inspection, not indifference.
- **Confidence** — self-reported confidence in the book/skip decision, measured separately for verified, provider-only, and unavailable states. Confidence in the *unavailable* state should be low-but-informed, not falsely high and not abandonment.

## Constraints

1. **Review-source attribution is retained everywhere a score is shown.** No rendering path may display a rating value without its `sourceLabel`. This includes the qualitative-label branch that currently drops it, and any collapsed-card treatment. Attribution must survive truncation at 375px.
2. **No summarization of review content without licensed rights.** This ticket surfaces only the numeric aggregate and its metadata — score, count, scale, source, recency. No quotes, no themes, no derived sentiment, no paraphrase of review text. Theme-level work belongs to `hotel-review-relevance` and must not be pre-empted here.
3. **Graceful degradation is the primary case, not the fallback.** Because the live provider returns unverified evidence by default, the missing-field states — no count, no score, no freshness, no source — must be designed first and must remain honest without reading as an error or as a defect in the hotel. Absent evidence must never silently disappear from the collapsed card, and must never be styled to imply a negative judgment of the property.
4. **No new fields, no Deal Score coupling.** Work within `HotelRatingEvidence` as it exists (`lib/types.ts:110-118`). Review credibility must not be folded into `DealScore.verdict`, `percentile`, or `confidence` — price-normality and property-quality stay separate signals, per `lib/scoring/scoreDeal.ts`.
5. **Provenance must not rely on colour alone.** The verified/provider-only distinction currently leans on `--success-soft` versus `--bg-muted`. It must be carried by text that survives truncation and by the accessible label, per WCAG 1.4.1.

## Success Statement

**This is solved when a first-time user, looking at a discounted hotel, can state in one read whether the review score comes from guests or from the provider, how much evidence sits behind it, and how current it is — without opening the provider link, and without the card falling silent when that evidence is missing.**

Concretely, the minimal trustworthy presentation must:

- Render exactly one review-credibility statement per card, in traveler language, at both collapsed and expanded levels.
- Carry `sourceLabel` on every path that renders a score.
- Say plainly when evidence is thin or absent, and say what the user should do instead.
- Distinguish data freshness from review recency in copy, without waiting on a new field.
- Remain legible and unambiguous at 375px with the provenance word intact.

## Out-Of-Scope Findings (Report, Do Not Fix Here)

- `Price` and `PriceUnavailable` (`HotelCard.tsx:349-383`) hardcode `Last-checked time unavailable` as a literal warning string with no conditional path. This appears to be an unfinished freshness integration owned by `provider-freshness-timestamp-clarity`. Flagged, not touched.
- `hotel-quality-snapshot` and `hotel-review-relevance` both stalled after `02-research.md` with no design stage. Both claim adjacent territory over review recency. Recency should be defined once; UXR must confirm which pipeline owns the *field* before this pipeline commits to recency *copy*.

## Handoff

Next stage ticket: `UXR-HOTEL-REVIEW-SIGNAL-TRUST-01`.

UXR must:

1. Audit `HotelCard.tsx:406-677` and `lib/providers/hotellook.ts:240-380` directly — do not rely on this report's line numbers alone.
2. Compare against Booking.com's review-score block and Google Hotels' rating treatment at the level of **interaction and disclosure order**, not visual style — specifically how each handles a low review count and a missing score.
3. Resolve the recency-ownership conflict with `hotel-quality-snapshot` before writing directives.
4. Produce 3–5 testable directives covering, at minimum: the collapsed-card treatment of the unverified default state, the single-statement replacement for the five-row panel, mandatory source attribution on every render path, and the freshness-versus-recency copy distinction.
