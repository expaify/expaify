# UXD-HOTEL-REVIEW-RELEVANCE-01: Review Relevance and Recency

## User Pain Point

A hotel deal is judged on a single aggregate guest score, so a traveler cannot tell whether that score hides a recent, stay-breaking problem — a property rated "8.6 · Very good" can be currently loud, dirty, or badly located, and expaify shows nothing that would let the user catch it before they commit to the provider handoff.

## Scope Note: What Is Already Solved (Do Not Re-Solve)

Prior tickets already shipped or scoped the *aggregate* rating trust layer. This ticket builds on them and must not reopen them:

- **Rating source, scale, and confidence** — `HotelOffer.guestRating` (`lib/types.ts:109-151`) carries `kind` (`guest_review` / `provider_quality` / `inferred` / `unknown`), `confidence` (`verified` / `provider_only` / `inferred` / `unavailable`), `scaleMax`, and `sourceLabel`, gating qualitative labels so "Excellent/Very good/Good" never appear on unverified data (`app/components/HotelCard.tsx:91-93`, `220-234`). Shipped under `hotel-rating-source-confidence`.
- **Review count** — `HotelRatingEvidence.reviewCount` (`lib/types.ts:114`), shown collapsed and in the `Quality evidence` panel with an explicit "not provided" state (`HotelCard.tsx:236-246`).
- **Data-fetch freshness** — `HotelRatingEvidence.fetchedAt` shown as `Updated <date>` / `Freshness not provided` (`HotelCard.tsx:353-357`). Note: this is when *expaify* pulled the data, not how recent the underlying reviews are.

## Relationship To `hotel-quality-snapshot` (Adjacent, Not Duplicate)

`docs/pipeline/hotel-quality-snapshot/01-discovery.md` already flagged a **review-recency caveat** and **amenity highlights** as open gaps. This ticket is narrower and complementary: it is about the **content of the reviews themselves** — the specific themes that make or break a stay — not amenities, and not a single "reviews may be stale" caveat bolted onto the aggregate score. Where `hotel-quality-snapshot` asks "is the score fresh," this ticket asks "*what are recent guests actually saying, and about what*." UXR must coordinate so recency work is defined once, not twice; see Handoff Notes.

## The Actual Gap

1. **No theme-level signal exists.** `HotelRatingEvidence` (`lib/types.ts:109-117`) models one score, one scale, one review count. There is no field for per-theme signals such as cleanliness, noise, location, or service — the exact dimensions that materially change whether a given traveler should book. A repo-wide grep for `cleanliness | noise | reviewText | reviewTheme | sentiment | subscore` across `lib/` and `app/` returns nothing outside the aggregate rating path.
2. **No review recency at the review level.** Nothing distinguishes a score built from stays last month from one built from stays three years ago. `fetchedAt` cannot answer this. A cheap property whose service collapsed six months ago looks identical to a consistently good one.
3. **No review evidence in the flow at all.** The deal detail (`HotelCard` expanded, `HotelCard.tsx:523-582`) shows quality *scores* and *location/price scope* panels, but zero review *evidence* — no themed pros/cons, no representative recent guest statements, no way to see the "why" behind the number without leaving expaify for the provider.
4. **No safe pattern for summarization.** The moment expaify surfaces review themes it must decide how — and the current codebase has no convention for showing derived/summarized review content without presenting it as verified fact. This is a trust landmine that must be designed for up front, not retrofitted.

## Affected Users And Flow Step

- **Who:** Paid-intent users comparing hotel deals — especially those choosing between similar nightly rates where the aggregate scores are close, and the deciding factor is a specific concern (a light sleeper who cares about noise, a business traveler who cares about service, a first-timer unsure a cheap deal is credible).
- **Flow:** deal feed (collapsed `HotelCard`) → deal detail (expanded `HotelCard` `Quality evidence` region) → booking decision (provider handoff via `Review hotel`). The gap bites hardest at deal detail, the last surface before the user leaves expaify.

## Measurable Signal

The problem is observable today:

- No theme or recency field exists in `HotelOffer` / `HotelRatingEvidence` (`lib/types.ts:109-151`) — confirmed by grep.
- The provider adapter (`lib/providers/hotellook.ts:249-275`) only ever emits `inferred` or `unavailable` guest-rating evidence and never populates `reviewCount` or any theme data, so even the aggregate is frequently thin — there is no theme data to conceal *or* reveal.
- A user cannot answer "what do recent guests complain about" or "is this cheap deal credible for *my* concern" from any expaify surface.

**Success is measured as:** increased engagement with review evidence (users opening/reading the review section at deal detail) and improved self-reported confidence in the booking decision, **without reducing qualified booking intent** (i.e., adding honest negative evidence must not simply scare off users from deals that are genuinely fine for them).

## Constraints The Solution Must Respect

1. **Licensed data only.** Review themes, snippets, and recency may use only licensed or provider-approved review data. No scraping, no re-hosting review text expaify has no right to display. If the current provider (Hotellook `cache.json`) returns none — which its response shape suggests — the honest MVP state is a fallback, not invented content.
2. **Preserve source attribution.** Every review signal must carry its source, consistent with the shipped `sourceLabel` / provenance model. A theme or snippet with no attributable source may not be shown as evidence.
3. **Never present generated summaries as facts.** If themes are derived or summarized (including via any model), they must be visibly framed as a summary of guest opinion — attributed, hedged, and never rendered as an expaify-verified claim about the property. This is non-negotiable and overrides visual polish.
4. **Accessibility and 375px.** Any review-evidence pattern must stay usable at 375px without crowding the existing price → quality → confidence → handoff hierarchy, must not rely on color alone (e.g., positive/negative themes need text/icon labels), and must be reachable by keyboard and assistive tech.

## Success Statement

This is solved when a first-time user judging a hotel deal at deal detail can see *what recent guests say about the things that would break their stay* — attributed, honestly framed, and recency-aware — or a clear, non-fabricated fallback when that data is not licensed/available, all without the aggregate score being the only thing they have to trust.

## Handoff Notes For UXR (`UXR-HOTEL-REVIEW-RELEVANCE-01`)

Research prompts:

- **Data availability first.** Determine what review-level data any current or candidate provider actually licenses to expaify: does Hotellook (or any provider under `lib/providers/`) return theme/category subscores, review text, or per-review dates? If none, state plainly that the MVP is a *fallback-first* pattern and that theme evidence is unbuildable until a provider contract changes — so UXDES does not design UI for data that does not exist.
- **Theme set.** Validate which themes matter most for the "is this deal credible" decision (candidate set from the ticket: cleanliness, noise, location, service). Bound the MVP to a small fixed set; do not design an open-ended tag cloud.
- **Recency handling.** Coordinate with `hotel-quality-snapshot` so review recency is defined once. Recommend whether recency is a per-theme signal, a single "reviews from the last N months" caveat, or both.
- **Summarization framing.** Define the exact copy and visual rules that keep any derived/summarized theme from reading as an expaify fact (attribution, hedging verbs, source line) — this is a source-constraint requirement, not a nicety.
- **Placement.** Given `deal-supporting-facts-order` and the shipped collapsed-card hierarchy, decide whether review evidence is collapsed-card visible or details-only, and where the fallback state lives.

Source constraints for downstream: licensed/provider-approved data only, source attribution required, generated summaries never presented as fact.

Measurable outcomes for downstream: engagement with review evidence up, decision confidence up, qualified booking intent not reduced.
