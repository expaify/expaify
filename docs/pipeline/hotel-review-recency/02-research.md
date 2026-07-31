# UXR-HOTEL-REVIEW-RECENCY-01: Hotel Review Recency and Relevance

**Ticket:** UXR-HOTEL-REVIEW-RECENCY-01 · **Stage:** UX Research · **Priority:** P2  
**Date:** 2026-07-31 · **Feature slug:** `hotel-review-recency`

## Research decision

The discovery problem is valid, but the present product cannot truthfully ship a positive review-recency or trip-relevance claim.

The production `/deals` comparison path carries hotel class and price evidence, not a guest score. The only implemented hotel provider, Hotellook, calls a cached-price endpoint whose documented response has no review total, review dates, traveler type, topic, or licensed review summary. A richer, currently unmounted `HotelCard` can render a provider-verified guest score and optional lifetime count from normalized or cached evidence, but labels `fetchedAt` as **Updated**; that timestamp is metadata observation time, not the age of reviews underlying the score. Saved-deal detail and booking review then hard-code the guest rating as unavailable.

The repair should therefore do two things in order:

1. remove the misleading equivalence between metadata freshness and review recency; and
2. define an evidence-gated presentation and continuity contract that remains explicit when review dates, volume, or context are not supplied.

Do not add review-age badges, review summaries, traveler claims, ranking changes, or a “recent” label on current Hotellook data. More capable review APIs are future provider options, not evidence available to this ticket.

## Method and inspected surfaces

This brief separates three sources:

- **Current-code evidence:** direct inspection of the production deal feed, saved detail, booking review, hotel provider adapter, shared types, cache normalization, analytics collector, and tests.
- **Provider-contract evidence:** current official documentation for Travelpayouts/Hotellook, Booking.com Demand API, and Expedia Rapid.
- **Reference-pattern guidance:** current official descriptions of Google Hotels, Booking.com, and Expedia review interactions. These establish useful information architecture, not permission to copy content or call an uncontracted API.

No live vendor call was made: credentials and commercial/display rights are not established by this ticket. No product analytics baseline is claimed because the checked-in schema is not deployable as written and emitted hotel-detail values do not match the collector allowlist.

## Corrections and refinements to discovery assumptions

| Discovery assumption | Audit result | Consequence |
|---|---|---|
| A live result card can show a guest score and review total | True for `HotelCard`, but `HotelCard` is referenced only by tests in the current repo. Production `/deals` renders `DealCard`, whose contract has no guest-rating fields. | UXDES must specify the actual `DealCard` → saved detail path. `HotelCard` is a useful prior pattern, not proof of current production exposure. |
| Saved detail drops evidence that appeared upstream | Confirmed for the production deal path, and broader than stated: `DealRow`, `/api/deals`, and `DealCard` never carry it. | This is a data-continuity dependency, not only a detail-page copy defect. |
| Booking review context cannot carry guest evidence | Refined: `BookingHotelContext` already has optional `hotelClass` and `guestRating`, but `BookingFlow` ignores them and hard-codes both unavailable. | Preserve the additive context contract; repair rendering and normalization rather than inventing a second review shape. |
| “Updated” shows metadata freshness where review recency is needed | Confirmed in the richer `HotelCard`. | Rename the concept to **Rating data checked** if retained; never use it as a substitute for review dates. |
| Current analytics can establish a baseline after adding evidence fields | Not currently. The schema contains committed merge-conflict markers, and existing detail events carry enum values rejected by the collector. | Collector/schema repair and an end-to-end 202 verification are prerequisites to any baseline, target, or experiment. |

## Current implementation audit

### 1. Production result comparison has no review evidence

`app/deals/DealFeed.tsx:1892-1925` mounts `DealCard` for unlocked hotel deals. `DealCardDeal` contains identity, class, photo, current and median money, discount, dates, price-snapshot count, links, and price timestamps (`app/components/ui/DealCard.tsx:21-38`). It has no guest score, score scale, rating source, overall review count, review dates, or context cue. Its “Based on … price checks” line concerns Deal Score inputs, not guest reviews (`DealCard.tsx:139-142`).

`app/api/deals/route.ts:12-32` and `lib/pipeline/dealDetection.ts:155-176` confirm that no review evidence crosses the production feed boundary. The visible stars are hotel class; they must not be relabeled or treated as guest sentiment.

### 2. The richer `HotelCard` has sound provenance guards but is not mounted

`HotelCard` distinguishes verified guest scores, provider ratings, inferred values, and unavailable values (`app/components/HotelCard.tsx:515-610`). Its collapsed form can include a verified score and total; expanded “Quality evidence” separates hotel class, guest rating, count, and confidence (`HotelCard.tsx:637-688`). These are good reusable rules:

- inferred/class-like values never become guest ratings;
- missing totals are stated rather than synthesized;
- source confidence is separate from the numeric score.

The defect is the final **Updated** row: it formats `guestRating.fetchedAt` (`HotelCard.tsx:643,680-684`). `fetchedAt` means when the adapter observed or cached metadata. It says nothing about when guests stayed, submitted reviews, or which reviews contribute to the aggregate.

Repository search finds no production `<HotelCard>` mount. UXDES must not spend scarce result-card space on a component users do not currently encounter without first defining its integration surface.

### 3. The normalized rating type cannot represent review recency or relevance

`HotelRatingEvidence` contains `kind`, value, scale, source label, optional `reviewCount`, optional `fetchedAt`, and confidence (`lib/types.ts:97-118`). It cannot distinguish:

- aggregate score coverage from the dates of a returned review sample;
- review submission date from stay date;
- overall review count from the count supporting a context cue;
- provider-authored topic/traveler summaries from expaify inference;
- allowed display scope, license, or invalid/stale review evidence.

An additive future contract needs separate concepts, not more ambiguous fields on `fetchedAt`:

| Concept | Minimum normalized value | Important boundary |
|---|---|---|
| Metadata observation | `ratingObservedAt` | Only when expaify/provider checked the rating object |
| Aggregate coverage | provider-declared `aggregateWindowStart?`, `aggregateWindowEnd` and coverage kind | Describes reviews included in the score only when the provider explicitly says so |
| Returned-review sample | `sampleLatestStayMonth?`, `sampleLatestSubmittedAt?`, `sampleSize?` | Never present this as the aggregate rating window |
| Overall volume | `overallReviewCount` | Lifetime/aggregate total; not cue support |
| Context cue | normalized topic/traveler segment, neutral pattern/direction, source, scope, window, `supportingReviewCount?`, `licensedForDisplay` | Optional and subordinate; never a selected-room promise |

### 4. Hotellook cannot populate the prioritized model

The adapter calls `engine.hotellook.com/api/v2/cache.json` (`lib/providers/hotellook.ts:474-481`). Official Travelpayouts documentation describes this as cached accommodation cost data and shows `hotelId`, `hotelName`, location, prices, percentiles, and stars—no guest-review fields. [Travelpayouts Hotel API reference](https://travelpayouts.github.io/slate/#displays-the-cost-of-living-in-hotels)

The live mapping consequently creates an unavailable guest-rating object (`hotellook.ts:494-542`). Cached objects can preserve a previously normalized guest score, review count, source, and `fetchedAt` (`hotellook.ts:296-335`), but that is compatibility behavior, not evidence that the active endpoint supplies those fields. Cache preservation also supplies no coverage dates or context.

Travelpayouts documents a separate static hotels response with an opaque visitor `rating`, but it provides no review total, date coverage, traveler type, or topic context and is not called by this adapter. [Travelpayouts Hotels data API](https://support.travelpayouts.com/hc/ru/articles/115000343268-API-%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85-%D0%BE%D1%82%D0%B5%D0%BB%D0%B5%D0%B9)

Current provider coverage is therefore:

| Evidence | Implemented Hotellook cache call | Honest state |
|---|---:|---|
| Explicit guest-review provenance | No | Unavailable |
| Score and scale | No | Unavailable |
| Overall review count | No | Not provided |
| Aggregate review window/latest included review | No | Review dates not provided |
| Returned review dates/stay dates | No | Not provided |
| Traveler/topic relevance | No | Traveler-context feedback not provided |
| Rating metadata observation | Yes, generated by adapter | May say rating data checked; must not imply review recency |

### 5. Capable reference providers are agreement-gated and absent from the app

Booking.com Demand API separates individual reviews from statistical review scores and states that both endpoints require an enabling partner agreement. This supports the separation of score provenance, aggregate statistics, and review content; it does not establish that expaify may use them. [Booking.com accommodation review endpoints](https://developers.booking.com/demand/docs/accommodations/about-accommodation#reviews)

Expedia Rapid Guest Reviews can return up to 100 verified reviews with submission date, stay month/year, travel companion, and trip reason; its request can filter by business travel, language, or pet companion. Expedia also requires launch/display compliance and permits caching after a live call for up to 48 hours. This proves that recency and trip-context inputs can exist independently, but the response is a returned sample—not proof of the date window behind a separate lifetime aggregate score. [Expedia Rapid Guest Reviews API](https://developers.expediagroup.com/rapid/lodging/content/guest-reviews?locale=en_US)

Neither provider is implemented as a hotel provider in this repo. `bookingComRapidApi.ts` is a flight-only adapter whose fare mapping is unfinished. UXDES may define compatible states; DEV may not select or call a new hotel review provider without a separate approved contract and display-rights decision.

### 6. Detail and review surfaces always state that rating evidence is unavailable

Saved deal detail renders “Guest rating not provided,” mounts `NO_QUIET_STAY_EVIDENCE`, and reports `hasVerifiedGuestRating={false}` (`app/deals/[dealId]/page.tsx:399-413,453-460`). The booking review similarly hard-codes “Guest rating not provided” even though `BookingHotelContext` has optional rating evidence (`app/book/BookingFlow.tsx:392-405`; `lib/booking/config.ts:70-98`).

The existing `QuietStayEvidenceLedger` is a useful narrow pattern, not a general review system. Its guest pattern requires a licensed flag, normalized noise topic, source, review window, observation date, and optional supporting count, and includes a specific-room caveat (`app/components/ui/QuietStayEvidenceLedger.tsx:45-62,95-104,330-342`). Production always sends the no-evidence constant. Do not generalize its topic taxonomy or imply that its presence validates the overall guest score.

### 7. Existing instrumentation cannot measure the proposed baseline

The client sink is intended to persist allowlisted events to Postgres (`lib/analytics.ts:25-42`; `app/api/analytics/route.ts:263-284`), but three independent blockers exist:

1. `lib/db/schema.sql` contains committed merge-conflict markers around competing `analytics_events` and `product_analytics_events` definitions (`schema.sql:272,395,408`). The file is not deployable as valid SQL.
2. `HotelDecisionAnalytics` emits `entry_source=search|saved|direct`, `viewport_group=mobile|tablet|desktop`, `score_state=confident|low_confidence|…`, and `price_freshness_state=unknown` (`HotelDecisionAnalytics.tsx:6-27,49-59`). The route accepts different enums: `search_results|saved_deal`, `mobile_375|desktop_1280|other`, `confirmed` rather than confident states, and `unavailable` rather than unknown (`app/api/analytics/route.ts:140-147`). These detail-view payloads are rejected with 400.
3. `hotel_result_card_opened` has no `deal_id`/`hotel_id` or evidence state; `hotel_room_handoff_started` has no evidence state (`route.ts:19-27`). A session funnel cannot reliably join a specific result exposure to its detail and handoff.

No current percentage, funnel, decision-time baseline, or minimum detectable product effect is defensible. This is an out-of-scope analytics repair dependency and must be visible in the UXDES handoff.

## Reference interaction patterns

### Google Hotels: compact comparison, deeper contextual evidence

Google describes a result listing as a snapshot containing average user rating, amenities, and price; selecting the listing opens a property detail page. On detail, Google may show topic summaries such as rooms, service, and location, plus ratings by traveler type. Google also distinguishes its own review summary from licensed third-party reviews and names TrustYou as the provider of topic/traveler summaries. [Google Travel hotel search and user reviews](https://support.google.com/travel/answer/6276008?hl=en)

**Pattern to adopt:** keep the result scan concise; place provenance, date/volume limits, and optional contextual evidence in a named detail region before the provider handoff. Name third-party summary provenance.

**Pattern not to copy:** topic summaries without a contracted, licensed summarization source. Google’s access to TrustYou is not evidence that expaify may generate or display equivalent claims.

### Booking.com and Expedia: separate score statistics from review records

Booking.com exposes separate review-comments and statistical-score endpoints, and warns integrators to explain what ratings represent. Expedia returns dated verified review records and lets an integration request reviews relevant to a traveler segment. Both models separate the aggregate from individual evidence and gate use through partner terms.

**Pattern to adopt:** score identity, overall volume, review/sample dates, and traveler relevance are independent evidence layers. Show only the layers actually returned for the same property and source.

**Pattern not to copy:** treating the newest returned review as the end date of the aggregate score, or treating a traveler filter as a provider-authored aggregate conclusion.

## Validation of the prioritized evidence model

The discovery ordering is directionally correct and should remain **P0 provenance → P1 recency → P2 volume → P3 context**, with two refinements.

First, “underlying review recency” is only claimable from provider-declared aggregate coverage. Dates from an API’s newest 100 reviews describe that returned sample, not necessarily the rating calculation. UXDES must present these differently:

- provider-declared coverage: **“Guest score includes reviews through Mar 2026.”**
- returned sample only: **“Most recent review returned: Mar 2026.”** This may support inspection, but not a “current score” claim.
- metadata observation only: **“Rating data checked Jul 31, 2026.”** Never place it under a “Recent reviews” label.

Second, volume must retain its denominator:

- **“1,248 reviews”** means overall score volume only when the provider defines it that way;
- **“Based on 34 reviews from Jan–Mar 2026”** means a dated cue/sample count;
- never let the overall count visually appear to support a narrower traveler/topic cue.

Evidence completeness remains non-ordinal. A truthful state with missing dates is not “low quality”; it is **verified score, review dates not provided**. A context cue is an optional independent layer and cannot upgrade an unverified score.

## Recency threshold decision

Desk research did not identify a defensible universal age at which hotel reviews become “old.” The relevance of age depends on the concern: renovation, management, cleanliness, construction, noise, and neighborhood conditions change at different rates. Expedia labels a response collection `recent` but does not publish a cutoff that expaify can reuse. Academic work supports review age as a relevant visibility/helpfulness feature, but not a universal traveler-comprehension threshold transferable to this interface. [Review visibility and hotel-review helpfulness](https://doi.org/10.1016/j.ijinfomgt.2016.06.003)

Therefore:

- **User-facing copy must use an absolute month/year or explicit window, not “recent,” “current reviews,” “older,” or a green/amber recency judgment.**
- **Analytics may use neutral age bands** derived only from a provider-declared aggregate end date: `0_30_days`, `31_90_days`, `91_180_days`, `181_365_days`, `366_plus_days`, `missing`, `invalid`. These are analysis bins, not UX verdicts.
- If only returned-sample dates exist, emit a separate `sample_age_band`; do not populate `aggregate_age_band`.
- UXDES must not convert the 90-day boundary into visible copy until moderated threshold elicitation supports it for the relevant concern.

This resolves the discovery requirement without fabricating a meaning for “recent.”

## Specific, testable design directives

### D1 — Repair the actual result-to-detail hierarchy

On the production `DealCard`, preserve the current primary hierarchy: hotel identity/class, price, Deal Score evidence, and **View deal**. Add no guest-rating line when the feed has no verified guest evidence. When a future normalized contract supplies a verified score, the maximum scan line is:

`{score}/{scale} guest score · {overall count} reviews`

Omit only the count fragment when missing. Do not show review dates or context chips in the collapsed card; those belong in detail. The card must never substitute stars, price-check count, `updatedAt`, or a cached legacy number.

**Test:** every combination of verified/unverified score × count present/missing renders the correct line or no line at 375px without truncating identity, price, or CTA; screen-reader text identifies hotel class and guest score as different concepts.

### D2 — Create one named review-evidence region before provider handoff

Replace the current isolated “Guest rating” fact in saved detail and booking review with one **Guest review evidence** region, ordered:

1. verified guest score and source;
2. overall review count or **“Review count not provided”**;
3. aggregate coverage statement, returned-sample statement, or **“Review dates not provided”**;
4. optional bounded traveler/topic cue with its own source, window, scope, and supporting count;
5. metadata observation as tertiary copy: **“Rating data checked {date}”**.

When no verified score exists, lead with **“Guest score not provided by this provider.”** Keep the count/date/context missing states subordinate; do not render five equally weighted warnings.

**Test:** default, partial, unavailable, invalid, loading, and error fixtures preserve this order on 375px and 1280px; no state uses “Updated” alone or calls metadata observation a review date.

### D3 — Keep aggregate, sample, and cue scope explicit

Use three mutually exclusive recency labels based on evidence kind:

- **“Guest score includes reviews through {month year}”** only for provider-declared aggregate coverage;
- **“Most recent review returned: {month year}”** for a returned review sample;
- **“Review dates not provided”** otherwise.

A context cue must use neutral, bounded copy such as **“Guests traveling with family mention {provider-supplied topic/pattern}”**, followed by **“Based on {cue count} reviews from {window}”** when supplied and **“This feedback does not predict a specific room or stay.”** Do not display raw reviews, user identities, generated sentiment, or a cue without `licensedForDisplay` and traceable scope.

**Test:** a newest returned review can never populate the aggregate-coverage label; an overall review total can never populate cue support; malformed/future/inverted dates downgrade to explicit unavailable/invalid state and do not render a claim.

### D4 — Preserve identical evidence through result, saved detail, review, and handoff analytics

Define one normalized evidence snapshot keyed to the provider property ID and carry it through `/api/deals`, `DealCard`, saved detail, `BookingHotelContext`, and `BookingFlow`. Every boundary must preserve provenance, score/scale, source, overall count, aggregate/sample coverage kind and dates, optional licensed cue, and rating observation time. Cache validation must reject impossible dates, negative counts, unknown scopes, or provider/property mismatches rather than fall back to a legacy rating.

The user-visible evidence state on saved detail and booking review must match the selected result; missing evidence must remain missing rather than disappear.

**Test:** contract fixtures for complete, score+count only, score+dates only, score only, unavailable, malformed, and stale-cache states round-trip without changing labels or scope. Cache and analytics failures never block provider handoff.

### D5 — Instrument comprehension-relevant states only after the collector works

Before adding review events, resolve the SQL conflict, align existing enum producers/validators, add property identity to result-open events, and prove a real POST returns 202 and persists one row.

Then implement:

- `hotel_review_evidence_exposed`: once per property/surface render after ≥50% visibility for ≥1 second;
- `hotel_review_evidence_opened`: only for an intentional disclosure on surfaces that have one;
- the same evidence snapshot on `hotel_detail_viewed` and `hotel_room_handoff_started`.

Use bounded, non-content properties:

| Property | Allowed values |
|---|---|
| `surface` | `results`, `detail`, `handoff` |
| `provenance_state` | `verified_guest`, `provider_only`, `inferred`, `unavailable` |
| `coverage_kind` | `provider_declared_aggregate`, `returned_sample`, `none`, `invalid` |
| `aggregate_age_band` / `sample_age_band` | neutral bands above plus `missing`, `invalid` |
| `overall_volume_bucket` | `missing`, `1_9`, `10_49`, `50_199`, `200_plus`, `invalid` |
| `cue_support_bucket` | same buckets, kept separate |
| `context_state` | `available`, `not_provided`, `invalid` |
| `evidence_state` | `complete_core`, `dates_missing`, `volume_missing`, `score_only`, `unavailable`, `invalid` |
| `viewport_group` | `mobile_375`, `desktop_1280`, `other` |

Do not emit hotel names, review text, traveler-entered concerns, raw dates, or reviewer identity. Do not treat back-to-results as failure or dismissal as low confidence.

**Test:** every allowed fixture receives 202 and persists; an unknown enum, exact date, free text, or duplicate exposure is rejected/suppressed; event failure leaves navigation intact.

## Validation plan before a positive recency label

### Moderated comprehension study

Recruit **12–16 travelers** who booked an unfamiliar hotel in the last 12 months, balanced across mobile/desktop and four concern contexts: quiet sleep, family travel, solo travel, and business travel. This is directional qualitative validation, not population inference.

Use counterbalanced property pairs with the same price and score across four evidence conditions:

1. verified score only;
2. verified score + overall count;
3. score + count + “rating data checked today” (misinterpretation control);
4. score + count + explicit aggregate/sample date language + bounded context cue.

Required tasks and pass bars:

- identify whether the score is guest feedback or hotel class: **≥12/16 correct**;
- distinguish rating-data check time from review age: **≥12/16 correct**, with no condition worse than score-only;
- correctly identify which count supports the score and which supports a cue: **≥12/16 correct**;
- explain whether the cue predicts a selected room: **≥14/16 reject the guarantee**;
- choose whether to inspect rooms and state confidence on a five-point scale; report by condition, but do not optimize handoff alone;
- threshold elicitation: show aggregate end dates 30, 90, 180, and 365 days old in randomized order and ask for interpretation before offering labels. Record concern-specific boundaries; do not average incompatible concerns into a universal threshold.

Any visible “recent” label fails validation if fewer than 12/16 independently map the chosen band to that meaning or if more than 2/16 mistake metadata observation for review age.

### Product baseline and experiment sizing

After the collector repair, collect at least **14 complete days** before setting a conversion target. Report exposure → detail → evidence reach → handoff/back/exit by evidence state and viewport, plus join success and rejection rates. Use session sequences; do not add identity.

For a later two-arm binary comprehension/confidence intercept, a conservative 50% baseline at two-sided 5% alpha and 80% power needs approximately **388 completed responses per arm for a 10-point lift**, **610 per arm for an 8-point lift**, or **1,565 per arm for a 5-point lift**. Recalculate from the observed baseline and approved primary outcome. The intercept remains separately approval-gated; until then, confidence is moderated-research data only.

## States UXDES must specify

UXDES must cover, without assuming a new provider:

- default current-provider state: no verified score, count, dates, or context;
- verified score with count and provider-declared aggregate coverage;
- verified score with count but dates missing;
- verified score with aggregate coverage but count missing;
- verified score with returned-sample dates only;
- score only;
- provider-only/inferred value that must not be called a guest score;
- licensed context cue available independently of aggregate coverage;
- context absent, malformed, conflicting, stale, or unlicensed;
- loading and provider error local to review evidence;
- invalid/future/inverted dates and zero/negative/non-integer counts;
- stale cached evidence/property mismatch;
- result → saved detail → booking review continuity;
- 375px, 1280px, keyboard/focus, screen-reader reading order, reduced motion, and no-color comprehension.

Loading/error states must not disable **View deal**, **Check rooms with provider**, back-to-results, or existing Deal Score actions.

## Blockers and out-of-scope findings

1. **P0-adjacent analytics blocker:** `lib/db/schema.sql` has committed conflict markers and is invalid SQL. The active route writes `analytics_events`, while the competing block defines `product_analytics_events`. This requires a separate DEV repair and migration decision.
2. **Analytics contract blocker:** current hotel-detail event values are rejected by the route allowlist. No review baseline should be claimed until a persistence smoke test passes.
3. **Provider blocker:** Hotellook cannot supply the P0–P3 review model. Positive review evidence requires an approved hotel provider contract, display rights, cache policy, property-ID continuity, and sample payload.
4. **Integration blocker:** production `DealCard`/deal tables carry no rating evidence; `HotelCard` is unmounted; `BookingFlow` ignores optional rating context.
5. **Not authorized:** new vendor selection, review ingestion, raw review display, AI summarization, ranking/filter changes, first-party reviews, Deal Score changes, affiliate changes, or repair of the analytics/schema conflict.

These blockers do not prevent UXDES from specifying honest missing, partial, invalid, and future evidence-ready states. They do prevent UXDES from claiming that positive recency or relevance is currently shippable.

## UXDES handoff

Create `UXDES-HOTEL-REVIEW-RECENCY-01` for an implementation-ready specification that follows D1–D5; starts from the actual `DealCard` → saved detail → provider-handoff flow; reuses the provenance rules in `HotelCard`; distinguishes aggregate coverage, returned-sample dates, and metadata observation; provides exact copy for every evidence state; preserves optional evidence through `BookingHotelContext`; keeps actions usable during review loading/error; and documents the analytics/provider dependencies without selecting a new vendor.
