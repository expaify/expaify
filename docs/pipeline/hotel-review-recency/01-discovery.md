# UXD-HOTEL-REVIEW-RECENCY-01: Hotel Review Recency and Relevance

**Ticket:** UXD-HOTEL-REVIEW-RECENCY-01 · **Stage:** UX Discovery · **Priority:** P2  
**Date:** 2026-07-31 · **Feature slug:** `hotel-review-recency`

## User pain point

When comparing a hotel result with its detail evidence, a traveler can see a guest score and sometimes a review total but cannot tell when the underlying reviews were written or whether they describe concerns relevant to this trip, so an apparently strong rating cannot reliably support the decision to inspect rooms with the provider.

## Who is affected and where

The primary users are first-time hotel shoppers choosing among unfamiliar properties, especially travelers for whom a broad average can conceal a trip-critical condition: a light sleeper, a family, a solo traveler, a business traveler, or someone evaluating a specific room or selected stay.

The affected decision spans two existing steps:

1. **Result-card comparison.** On a live `HotelCard`, the traveler scans property identity, hotel class, guest score, review count when available, nightly price, Deal Score, and lightweight policy cues before choosing **Details** or **Review hotel**.
2. **Detail-to-provider decision.** On the saved-deal detail page, the traveler reviews the “Hotel fit” evidence before choosing **Check rooms with provider**. This is the last expaify-owned point at which the rating can earn or lose trust.

The problem is not that expaify lacks first-party reviews. The problem is that the interface cannot state the evidentiary limits of the provider-supplied rating consistently across these two steps.

## Current implementation evidence

### What the product can show

- `HotelRatingEvidence` in `lib/types.ts` supports rating kind, value, scale, source, `reviewCount`, `fetchedAt`, and confidence. It does **not** support the date range of the reviews, latest-review date, traveler segment, topic cue, or the number of reviews supporting a cue.
- `HotelCard` distinguishes verified guest-review data from provider-quality, inferred, and unavailable values. Its collapsed card can show a verified guest score plus a review count, for example “8.7/10 · 1,248 reviews.” This provenance guard is valuable and should remain.
- Expanded `HotelCard` details separate **Guest rating**, **Review count**, **Confidence**, and **Updated**. Missing volume is stated honestly as “Review count not provided.”
- The provider adapter preserves cached verified evidence when it exists, including `sourceLabel`, `reviewCount`, and `fetchedAt`; otherwise legacy rating data is deliberately treated as inferred rather than presented as verified guest feedback.
- A separate `QuietStayEvidenceLedger` already demonstrates a bounded provider-evidence pattern for one traveler concern. A valid guest noise pattern has a licensed display flag, normalized topic, source, review window start/end, observation time, and optional review count. It explicitly says the evidence does not predict a specific room.

### Exact decision gap

1. **Metadata freshness is presented where review recency is needed.** `HotelCard` formats `guestRating.fetchedAt` as “Updated …”. That value records when expaify/provider metadata was fetched, not when guests stayed or wrote reviews. A rating fetched today can still summarize old feedback. The UI does not make this distinction legible.
2. **Volume is optional and has no interpretation boundary.** The card may show a total review count, but no state distinguishes a well-supported current rating from a large lifetime total whose recent contribution is unknown. When count is absent, the detail is honest; the collapsed comparison surface simply omits it.
3. **Trip relevance is absent from the general rating model.** No concise, normalized traveler-context cue is attached to `HotelRatingEvidence`. The quiet-stay ledger contains a narrow research-grade guest-pattern contract, but the saved-deal detail always receives `NO_QUIET_STAY_EVIDENCE`, and it is not a general review-relevance system.
4. **The result-to-detail story is inconsistent.** A live result card can carry verified rating evidence, while `app/deals/[dealId]/page.tsx` hard-codes “Guest rating not provided” and sends `hasVerifiedGuestRating={false}` to analytics. Evidence seen during comparison therefore does not persist as support for the next decision step.
5. **Current measurement cannot explain confidence.** `hotel_detail_viewed` records only `has_verified_guest_rating: boolean`; `hotel_result_card_opened` contains sort/filter/card-position context but no rating-evidence state. Section reach and provider handoff are measured, but there is no way to relate either behavior to review recency, volume, relevance, or the traveler’s stated confidence.

This is a discoverability and evidence-integrity repair. It is not authorization to acquire, ingest, summarize, or host first-party reviews.

## Measurable signal

The problem exists when a traveler reaches or acts on a hotel detail without enough provider evidence to answer three distinct questions: **Is this a real guest score? Is it supported by enough and sufficiently recent feedback? Does any bounded feedback speak to my trip concern?**

Current code establishes the implementation-side signal:

- There are **zero fields** for underlying review-window start/end or latest-review date in `HotelRatingEvidence`.
- There are **zero fields** for normalized traveler context, cue coverage, or cue-supporting review count in `HotelRatingEvidence`.
- The saved-deal detail supplies **zero verified guest-rating evidence** in every rendered state, regardless of what may have appeared upstream.
- The detail-view analytics reduce rating evidence to **one boolean**, so confidence cannot be segmented by evidence completeness.

Validation should establish a behavioral and stated-confidence baseline before judging a presentation successful:

- **Evidence-qualified detail progression:** result-card opens and detail views segmented by evidence state, followed by provider handoff within the same session.
- **Evidence inspection rate:** share of exposed travelers who expand/reach the review-evidence area before a provider handoff or return to results.
- **Decision latency:** time from first evidence exposure to provider handoff, back-to-results, or session exit, bucketed rather than recorded as raw timestamps.
- **Comparison continuation:** back-to-results followed by opening a different property, segmented by evidence state; this is a useful uncertainty proxy, not automatically a failure.
- **Stated selection confidence:** in moderated validation, and in a time-boxed one-question intercept if approved, the share answering “Confident” or “Very confident” to “Based on the evidence shown, how confident are you choosing whether to inspect rooms at this property?”
- **Comprehension guardrail:** share who can correctly distinguish “reviews written recently” from “rating data checked recently.” A presentation that increases handoff but fails this distinction is not successful.

No target percentage is defensible before a baseline exists. UXR should establish baseline and minimum detectable sample before UXDES assigns a launch target.

## Prioritized evidence model for validation

This ordering defines what earns space; it does not prescribe a component layout.

| Priority | Evidence question | Minimum provider-supplied fields | Honest absent/partial state | Why it earns priority |
|---|---|---|---|---|
| **P0 — identity and provenance** | Is this explicitly guest-review data, and who supplied it? | `kind=guest_review`, normalized score and scale, source label, verified/provider confidence | Do not label an inferred or provider-quality value as a guest rating | Recency and relevance must never decorate an unverified score |
| **P1 — underlying review recency** | How recent is the feedback represented? | Review-window end or latest included review date; ideally window start; distinct metadata observation time | “Review dates not provided”; never substitute `fetchedAt` | Directly answers whether the sentiment may still describe the property |
| **P2 — decision-useful volume** | How much guest feedback supports the score or cue? | Positive integer total rating review count; separate cue-level count where a cue is shown | “Review count not provided”; never imply the lifetime total supports a recent cue | Lets travelers judge stability without inventing a universal “enough reviews” threshold |
| **P3 — bounded trip-relevance cue** | Does provider-supplied feedback speak to a concern relevant to this trip? | Licensed/approved normalized topic, neutral direction or pattern statement, evidence scope, source, review window, and supporting count when supplied | “Traveler-context feedback not provided”; no generic inference from rating, class, location, or amenities | Adds relevance only when the cue is traceable and scoped |

Evidence completeness should be evaluated as four non-ordinal states rather than collapsed into one “quality score”:

- **Complete for comparison:** verified score provenance + underlying review recency + rating volume; context cue is an optional enhancement.
- **Current but volume unknown:** verified score + review recency, no count.
- **Volume known but recency unknown:** verified score + count, no underlying review dates. This is the current best-case shape and must not be called recent.
- **Score only / unavailable:** verified score without count or review dates, or no verified guest score. State the missing evidence instead of filling gaps with metadata freshness.

Trip-context cues are deliberately subordinate to P0–P2. A cue must not rescue an unverified rating, become a property-wide promise, identify individual reviewers, quote unlicensed review text, or claim applicability to a selected room/stay unless the provider explicitly supplies that scope.

## Instrumentation plan

Use low-cardinality, non-content properties only. Do not emit hotel names, free-text review content, user-entered concerns, or exact review dates.

1. **`hotel_review_evidence_exposed`** — fire once when at least 50% of the evidence block is visible for at least one second. Properties: `surface` (`result_card`/`detail`), `hotel_id`, `entry_source`, `viewport_group`, `provenance_state` (`verified_guest`/`provider_only`/`inferred`/`unavailable`), `recency_state` (`recent_window`/`older_window`/`dates_missing`/`invalid`), `volume_bucket` (`missing`/`1_9`/`10_49`/`50_199`/`200_plus`), `context_state` (`available`/`not_provided`/`invalid`), and `evidence_completeness` (the four states above). The exact “recent” threshold must be researched and documented before implementation.
2. **`hotel_review_evidence_opened`** — fire on intentional card disclosure. Add `card_position` and the same evidence-state dimensions. This separates passive exposure from active inspection.
3. **Extend `hotel_detail_viewed` and `hotel_room_handoff_started`.** Replace reliance on `has_verified_guest_rating` alone by carrying the same bounded evidence-state dimensions, while retaining the boolean during migration if analytics compatibility requires it.
4. **`hotel_review_confidence_answered`** — validation-only, not an always-on interruption. Properties: `confidence` (`very_low`/`low`/`neutral`/`high`/`very_high`), `prompt_point` (`after_detail_evidence`/`before_handoff`), and the evidence-state dimensions. Record dismissal separately as `hotel_review_confidence_dismissed`; do not treat dismissal as low confidence.
5. **Derive funnels by session, not by adding identity.** Compare exposure → detail open → review-evidence reach → provider handoff/back/exit. Segment by mobile 375px and desktop 1280px, entry source, evidence completeness, and whether a relevance cue was present. Report confidence and comprehension alongside conversion; never optimize handoff alone.

Instrumentation acceptance guardrails:

- Missing/invalid provider data must produce an explicit analytics state, not suppress the event.
- Each exposure fires once per surface/property render; disclosure events fire only on user action.
- Analytics failure must never block detail viewing or provider handoff.
- Buckets and enums must be validated by the existing `/api/analytics` allowlist before collection.
- A short research intercept requires separate product approval and a documented sampling window; otherwise stated confidence is collected only in moderated UXR.

## Constraints

1. **Provider and evidence integrity.** Use only provider-supplied, display-licensed review metadata behind `lib/providers`. Keep metadata fetch time separate from underlying review dates, preserve `Result<T>` boundaries, and show a missing state rather than infer recency, traveler type, sentiment, or scope.
2. **Lightweight, decision-stage presentation.** This is a result-card-to-detail repair, not a first-party review product, review browser, ranking redesign, personalization engine, or AI review summarizer. Preserve existing card contracts, Deal Score hierarchy, affiliate handoff, and integer-money contract.
3. **Accessible, comparable, and measurable.** The minimum evidence and its absence must remain understandable at 375px and 1280px, in reading and keyboard order, without relying on color or hover. Instrumentation must use bounded enums/buckets, collect no review text or sensitive traveler profile, and never block the flow.

## Success statement

This is solved when a first-time traveler can compare a result, open its detail, and state whether the guest score is provider-verified, how recent and well-supported the underlying feedback is, and whether any bounded cue applies to their trip concern—without mistaking metadata fetch time for review recency, without assuming a cue guarantees a specific room experience, and without leaving expaify to discover that the evidence was missing.

For validation, success requires both:

- higher stated confidence among travelers shown complete evidence than those shown score-only evidence; and
- correct comprehension of the recency boundary, with no deterioration in usable provider-handoff or back-to-results completion at 375px or 1280px.

## Out of scope

- Collecting, hosting, moderating, or soliciting first-party reviews
- Importing raw review text or reviewer identities
- Generating traveler-context claims from unlicensed text, hotel class, amenities, location, or a general score
- Personalized review ranking, reviewer verification, fraud detection, or a universal review-quality score
- Changing Deal Score, hotel price ranking, provider selection, booking logic, or affiliate deeplinks
- Repairing the separate saved-deal data pipeline beyond documenting the result-to-detail evidence discontinuity for UXR

## UXR handoff questions

1. Which provider contracts can supply underlying review-window dates, total rating count, and licensed normalized context cues independently—and what are their missing/stale semantics?
2. At result-card density, what is the smallest evidence set that improves accurate comparison rather than simply increasing perceived certainty?
3. How do Booking.com and one comparable travel product distinguish review recency, volume, and traveler/topic relevance from metadata freshness at card and detail levels?
4. What age bands do travelers interpret as “recent” for hotels, and does that expectation vary by contextual cue? Research must choose a threshold before analytics or UI labels encode one.
5. Can participants correctly explain the difference between a large lifetime review total, a recent review window, and the count supporting one context cue?

**Next stage:** `UXR-HOTEL-REVIEW-RECENCY-01` (UX Research, Claude Fable 5).
