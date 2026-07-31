# UX Research: Hotel Saved-Search Price Alerts

**Ticket:** UXR-HOTEL-PRICE-ALERT-01 · **Stage:** UXR · **Date:** 2026-07-31  
**Discovery input:** `docs/pipeline/hotel-price-alert/01-discovery.md`  
**Scope:** A saved **hotel search**, not a hotel shortlist and not a flight alert.

## Executive decision

Build the concept around one honest promise: **“Save this search. We’ll check it daily and email you when a matching hotel gets substantially cheaper.”**

“Substantially cheaper” should mean that the same hotel/check-in price is both **at least 10% and at least $20 per night lower** than the price stored when the search was saved or last alerted. The result must still match the saved criteria and the account’s existing minimum-deal setting. This is a price-change notification, not a “book now” prediction. Deal Score may explain the current price, but neither a verdict change nor a new cheapest hotel is sufficient by itself to send.

Use a **capped-free** model: one active saved search on Free and up to ten on Premium. A signed-in shopper saves with one action; a signed-out shopper enters an email and activates the alert from a verification link. Do not create an active alert for an unverified address, and do not require a shopper to navigate through account creation before expressing intent.

This recommendation has two implementation blockers. First, the feature must be explicitly marked **APPROVED FEATURE**: the ticket requests a new persistence and delivery capability, while the current repair-mode contract forbids implementation of an unapproved new feature. Second, the nightly job samples only two rotating monthly check-in dates with a hidden fixed stay of two nights, two adults, and one room. It cannot evaluate an arbitrary saved check-in window or party. Research and design can define the intended experience; UI/DEV must not ship an activation control until product approval exists and the provider pipeline can report that the exact saved criteria are monitorable.

## Method and evidence standard

- Read the discovery report and the current source for hotel criteria, result filtering, paywall behavior, alert creation, account alert settings, digest/instant delivery, snapshots, analytics, authentication, and affiliate links.
- Compared current public, first-party descriptions of Google Hotels and KAYAK hotel price tracking. Research was conducted 2026-07-31.
- Searched Booking.com’s current public product/help content for a documented hotel saved-search trigger. A Booking.com-hosted user review indicates that Booking.com can send a price-drop message, but no first-party product/help page found in this audit specifies what is tracked, what change triggers it, or its cadence. Booking.com is therefore an **existence signal only**, not evidence for a trigger rule.
- Reference behavior below is guidance, not a claim that expaify currently supports it.

## Current implementation audit

### What exists

| Surface | Current-code evidence | Consequence for this feature |
|---|---|---|
| Search criteria | `HotelSearchCriteriaV1` contains destination, a check-in window, occupancy state, source, and `criteriaVersion` (`lib/hotels/searchCriteria.ts:4-15`). The editor supports city and check-in-window From/Through, and explicitly says guests/rooms are not captured (`app/components/HotelSearchCriteria.tsx:208-233`). | The MVP can save city and a check-in window. It cannot honestly claim to preserve checkout date, stay length, guests, rooms, room type, or cancellation terms. |
| Result filters | The result view supports minimum discount, maximum nightly price, minimum stars, and sort (`lib/hotels/searchCriteria.ts:31-36,250-278`). The URL builder serializes them (`:188-206`). The result UI exposes discount/stars/price (`app/deals/DealFeed.tsx:1553-1612`). | Eligibility filters can be saved. Sort is presentation only and must not affect which changes qualify. |
| Free/Premium behavior | The server ignores discount/price/stars/sort requested by Free users and applies the fixed 20%-off, newest-first view (`app/api/deals/route.ts:120-138`). | Persist the **effective server criteria**, not merely the attempted URL. Otherwise a saved search could promise filters that never constrained the displayed set. |
| Criteria lifecycle | `criteriaVersion` is created with `crypto.randomUUID()` for edits and used to reject stale responses (`lib/hotels/searchCriteria.ts:299-300`; `app/deals/DealFeed.tsx:603-614`). Only default page criteria use a deterministic version (`searchCriteria.ts:303-318`). | `criteriaVersion` is an interaction/concurrency token, **not a saved-search identity**. Saved searches need a canonical fingerprint of normalized eligibility fields. |
| Hotel prices | `price_snapshots` stores integer `price_cents` and `currency` and permits one point per hotel/market/check-in/day (`lib/db/schema.sql:104-118`). The workflow runs once daily at 04:00 UTC (`.github/workflows/snapshot.yml:3-20`). | Daily checking is the maximum honest cadence. Intraday or “the moment” claims are false. |
| Snapshot coverage | The job alternates between only two fixed monthly check-in anchors (`lib/pipeline/snapshot.ts:4-21`) and queries a fixed two-night stay. Provider requests hardcode two adults and one room (`:72-80,106-115,147-154`). | Current snapshots cannot monitor an arbitrary check-in window, stay length, or party. A saved search is not deliverable unless the server can first prove its exact effective criteria are covered. |
| Provider contract | The nightly job calls three RapidAPI vendor endpoints directly from `lib/pipeline/snapshot.ts:70-181`. | This violates the non-negotiable adapter boundary. Coverage work must move vendor I/O behind `lib/providers` and return `Result<T>` before this feature can rely on it. This research ticket does not repair it. |
| Deal qualification | The current hotel pipeline flags a deal at 30% below its 60-day median after at least 8 snapshots (`lib/pipeline/dealRules.ts:9-11,24-42`); the shared Deal Score requires 10 comparable points and suppresses Great/Good on thin data (`lib/scoring/scoreDeal.ts:25,94-136`). | The saved-search trigger and Deal Score are different concepts. Do not substitute the current 8-point deal flag for the 10-point Deal Score confidence contract. |
| Public price-alert endpoint | `POST /api/alerts` requires origin and destination IATA codes before accepting optional `hotelId` (`app/api/alerts/route.ts:45-75`). `price_alerts` has non-null flight origin/destination fields (`lib/db/schema.sql:43-58`). | This route/table cannot represent a hotel saved search and must not be extended by stuffing criteria into flight fields. |
| Account consent | `subscriptions` already owns `alert_preference`, `alert_min_discount`, `alert_timezone`, unsubscribe token, and last-alert time (`lib/db/schema.sql:201-224`). The account API and UI currently restrict editing these settings to Premium (`app/api/account/alerts/route.ts:10-19`; `app/account/AccountClient.tsx:273-303`). | The consent model should remain singular, but capped-free alerts require the settings/read path to stop assuming every alert recipient is Premium. |
| Delivery | Daily digest selects trialing/active users at 09:00 local (`lib/email/sendDailyDigest.ts:32-46`). “Instant” recipients are also trialing/active (`lib/email/sendDealAlert.ts:46-69`), and the send is invoked only after the nightly snapshot pipeline (`app/api/pipeline/run/route.ts:31-35,64-82`). | Existing “instant” means immediate after daily detection, not continuous monitoring. Saved-search MVP must always say daily. |
| Return attribution | Analytics identity is stored in `sessionStorage` (`lib/analytics.ts:3-23`). | Cross-session return and booking attribution needs the saved-search/user id; the current session id cannot measure the outcome. |
| Outbound booking | Attributed hotel links are produced only when `HOTEL_AFFILIATE_ID` is configured (`lib/pipeline/otaLinks.ts:8-30`). | Email links must reuse stored/provider-built attributed links; no email template may synthesize a raw OTA URL. |

### Exact current-to-target gap

```text
Current
search URL → filtered current deal set → leave → no durable identity or return path

Target
effective criteria → verified user + canonical saved search → daily comparable snapshot
→ material-change gate → one deduped email → restored results → attributed provider handoff
```

The gap is not a missing bell icon. It spans criteria identity, verified ownership, persistence, **monitorable criteria coverage**, comparable-price history, trigger/dedupe logic, consent, delivery, management, and cross-session attribution.

## Reference-pattern comparison

| Pattern | What is tracked | What fires | Identity/cadence | Applicable guidance |
|---|---|---|---|---|
| Google Hotels | Chosen destination and dates, the selected filters, and the current map area; the alert applies to any hotel listed in that result set. | An email when prices “go down substantially.” Google does not publish the numeric hotel threshold in this announcement. | Email; the announcement does not state cadence. | Put the save control adjacent to the active search/filter summary; preserve the whole eligibility set; trigger on a material drop for any matching hotel rather than only the hotel that happens to be cheapest. [Google, “5 tips for summer travel prep” (2025-03-27)](https://blog.google/products-and-platforms/products/search/summer-travel-tips-ai-overviews-hotel-price-tracking/) |
| KAYAK | A destination search or a specific hotel. Destination alerts include location, dates, rooms, and optional star rating. | “Significant” real-time changes are typically about 10% up or down since the last update. | Account required. Most alerts refresh daily and are bundled in an early-morning email; alerts expire after the travel date and can be paused/deleted. | Ten percent is a defensible reference floor, but expaify should add an absolute-dollar floor. Use a finite lifecycle, a management surface, and honest daily copy. [KAYAK pricing help](https://www.kayak.com/c/help/pricing/), [KAYAK hotel alert guide](https://www.kayak.com/news/track-hotel-prices/) |
| Booking.com | A Booking.com-hosted review reports receipt of a $19 hotel price-drop message, establishing that some price-drop messaging exists. | **Not publicly specified in a current first-party product/help source found in this audit.** | **Not verified.** | Do not cite Booking.com as evidence for a threshold, saved-search scope, or cadence. Validate with an owned inbox/session or Booking.com research contact before using it in product rationale. |

Two pattern distinctions matter:

1. Google’s event is **a matching hotel price decreasing materially**, not “the cheapest hotel changed.” A newly cheapest property can be caused by inventory churn, and the cheapest property may be irrelevant to a shopper who cared about another match.
2. KAYAK separates **price alerts** from **buy/wait forecasts**. Its help content describes buy/wait as a predictive model with confidence, while price alerts report observed change. expaify has observed price history and a Deal Score, but no validated forward-price model. “We tell you to stop waiting” would overclaim.

## Answers to the five research questions

### 1. Material-change trigger

Use an observed price-drop gate, evaluated once after the daily snapshot run.

For each same-currency hotel + market + check-in + comparable-stay match in a saved result set:

```text
referencePriceCents = price at save, or price used in the most recent alert
dropCents           = referencePriceCents - currentPriceCents
dropPct             = floor(dropCents * 100 / referencePriceCents)

eligible when:
  dropCents >= 2_000
  AND dropPct >= 10
  AND current result still matches every saved eligibility filter
  AND its discount from normal meets subscriptions.alert_min_discount
  AND alert_preference != 'off'
```

All prices remain `{ priceCents: integer, currency: string }`; a currency, stay-length, occupancy, room/rate basis, or tax-inclusion change is non-comparable and cannot trigger. The current data does not carry enough of those fields, which is why coverage is a blocker rather than an edge case. After sending, advance that comparable match’s reference to the alerted price. A later rise does not send; a later fall must clear both thresholds from the last alerted price. Bundle every qualifying match for the same saved search into one daily email, ordered by dollar savings, with at most three detailed results plus a count/link for the remainder.

Why not the alternatives:

- **Percentage alone:** 10% of a $70 room is noise for many trips.
- **Absolute cents alone:** $20 on a $700 room is noise.
- **Deal Score verdict change:** it can move because history ages even when today’s price does not, and low-confidence history cannot support a strong verdict.
- **Cheapest-in-set change:** inventory churn can change the winner without any hotel getting cheaper; a meaningful drop on the shopper’s second-cheapest match would be missed.

The $20 + 10% pair is a product hypothesis, not a fact published by Google. KAYAK supplies the 10% reference; the $20 floor is an expaify noise-control decision and must be measured. Launch guardrails: unsubscribe-within-7-days below 2%, provider price mismatch below 1%, and no more than one saved-search email per user per local day.

### 2. Value proposition wording

Use **observed-change language**, not timing advice.

- Save control: **Save this search**
- Supporting copy: **We’ll check daily and email you when a matching hotel gets substantially cheaper.**
- Success: **Search saved. We’ll check daily and email {email} after a matching price drops at least 10% and $20 per night.**
- Email subject pattern: **{City} hotel prices dropped — from {money}/night**
- Email price line: **Now {money}/night — down {money} ({pct}%) since {date}.**

Do not use “book now,” “best time to book,” “stop waiting,” “real time,” “instant,” or “the moment.” Deal Score can appear as secondary evidence only when it uses at least 10 comparable same-currency points; it does not turn an observed alert into a forecast.

### 3. Gating

Recommend **capped-free**, explicitly:

- Free: one active saved hotel search.
- Premium: up to ten active saved hotel searches.
- At cap: preserve every existing alert; block the new activation and explain the limit. Never silently replace an alert.
- On Premium downgrade: keep the most recently created search active, pause the others, retain their exact criteria, and explain how to reactivate them. Never broaden a paused Premium search by stripping its filters.

This creates a truthful free path behind the landing-page promise while preserving Premium value in breadth. Fully premium would reproduce the current promise/gating gap; unlimited free has an unbounded nightly provider and email cost. The cap is a product recommendation to validate with activation, paid conversion, provider cost, and unsubscribe data—not a competitor-derived requirement.

The existing `alert_preference`, `alert_min_discount`, `alert_timezone`, and unsubscribe token remain authoritative for all tiers. UXDES must not add per-search frequency or threshold controls. If the save confirmation exposes the existing minimum-deal threshold, it must say that changing it affects all hotel alerts.

### 4. Identity for anonymous shoppers

Recommend **email-on-save with verification**, then durable account ownership.

- Signed in: “Save this search” opens a concise review/consent panel; confirmation activates it.
- Signed out: the same panel adds one required email field. Submission creates a pending, expiring save; the email link verifies ownership, activates the alert, and returns to the restored search.
- Until verification, no alert is active and the cap is not consumed. The pending token must be single-use and expire.
- If the email already belongs to an account, the verification link attaches to that account; do not disclose account existence in the response.

This preserves the low-friction email entry pattern while avoiding the abuse and consent ambiguity of the existing public `/api/alerts` route. It also lands alerts in the user-linked `subscriptions` consent model instead of creating a second email-only identity silo. A forced sign-in page before saving is not recommended: it interrupts intent before the user has seen what will be saved, while the existing Resend magic-link provider can combine verification and sign-in (`auth.ts:20-27,44-65`).

### 5. Landing-page promise

Correct the promise before any alert UI ships; the current metadata and hero say “the moment” (`app/page.tsx:9-13,131-137`) while detection is nightly.

- **Before saved-search launch:** “We check 20 destinations daily and surface hotel deals 30%+ below their recent median. Premium members can choose email alerts.”
- **After the capped-free feature is live end to end:** “Save one hotel search free. We check prices daily and email you when a matching hotel gets substantially cheaper.”

The Premium feature list may continue to distinguish greater capacity, but “Instant + daily email alerts” also needs correction because the instant path is fed only by the nightly pipeline. Recommended label: **“Up to 10 saved searches with email alerts.”** Metadata, hero, pricing list, welcome email, and any alert template cadence copy must be audited as one release; fixing only the visible hero leaves indexed and emailed promises inconsistent.

## Implementation-ready design directives

### Directive 1 — Save only a complete, server-effective search

Place **Save this search** beside the existing “Your search” summary on `/deals` and destination results, after results have resolved. Enable it only when a supported city and both From/Through check-in-window dates are present, the result set is real (not mock, loading, failed, invalid, or criteria-update pending), **and the server confirms the exact effective criteria can be monitored**. If incomplete, selecting it opens the criteria editor with: **“Choose one destination and a complete check-in window before saving this search.”** If complete but unsupported, do not accept an alert; say: **“Daily price tracking isn’t available for these dates yet.”**

Persist a versioned normalized payload containing destination, check-in-window bounds, occupancy state, minimum discount, maximum nightly-price money object or null, and minimum stars. Exclude `source`, `criteriaVersion`, and sort from identity. Compute a canonical server-side fingerprint from normalized eligibility fields and user id for idempotency; saving the same search twice returns the existing record rather than consuming another slot.

*Testable:* save the same effective search from two sort orders and only one record exists; a Free user who tampers with Premium filter query params saves the server-effective 20%-off/unfiltered view, not the attempted filters; no UI says guests, rooms, checkout, or stay length were saved; an arbitrary date window not covered by the pipeline cannot become active.

### Directive 2 — Show the trigger and cadence before consent

The review panel must summarize destination, check-in window, effective filters, global minimum-deal setting, daily cadence, email destination, and cap usage. Required copy: **“We check once a day. We’ll email only when a matching hotel is at least 10% and $20/night cheaper than when you saved it or we last alerted you, and it meets your {n}% minimum-deal setting.”** Provide a link to the single hotel-alert settings surface; do not add a per-search frequency switch.

*Testable:* the confirmation contains no “instant,” “real time,” “the moment,” or “book now”; changing `alert_preference` to `off` prevents every saved-search send; changing `alert_min_discount` changes eligibility for all saved searches and the management UI explains that scope.

### Directive 3 — Verify anonymous ownership without losing the search

For signed-out users, collect email in the save panel and send a single-use verification link. Preserve the pending canonical criteria server-side and restore the exact result URL after verification. Provide pending, sent, expired-link, already-used, cap-reached, storage-failed, email-failed, and retry states. Never report whether the address already has an account.

*Testable:* closing the tab after submission and opening the email on another device activates the same criteria; an unverified request sends no price alerts; repeated submit/verification is idempotent; network failure retains every visible criterion and the typed email; keyboard focus moves to the status/error and returns predictably on close.

### Directive 4 — Send one comparable, deduped daily change email

Evaluate after the nightly snapshot, in the user’s `alert_timezone`, at most once per user per local day. Compare only a fully comparable hotel/market/check-in/stay/party/rate basis and the same currency. Apply both the 10% and $20/night gates plus all saved/global eligibility filters. Sort qualifying results by absolute savings, show at most three, and include one restored-search CTA. Every displayed price must come from the same snapshot used by the trigger. Expire the saved search after its Through date; provide pause, resume, and delete on the account alert surface and an unsubscribe link in every email.

*Testable:* $19/20%, $25/9%, a price rise, a currency change, a filter mismatch, `alert_preference='off'`, and a second run on the same snapshot all send zero; $25/12% sends once; a second qualifying hotel that day is bundled rather than creating another email; the CTA restores exact criteria and every outbound provider URL retains `HOTEL_AFFILIATE_ID` attribution.

### Directive 5 — Measure trust and the return loop, not raw email volume

Instrument `hotel_saved_search_started`, `verification_sent`, `activated`, `material_change_qualified`, `email_sent`, `email_opened` (only if privacy policy permits), `restored`, `provider_clicked`, `paused`, `deleted`, `expired`, and `unsubscribed`. Attach saved-search id and criteria schema version, never raw email or affiliate URL. Link restored sessions to the saved-search id because the current sessionStorage id cannot establish cross-session return.

Primary success metric: **saved-search alert → restored matching search → attributed provider click within 7 days.** Supporting metrics: eligible-search save rate, verification completion, material-change incidence, and 14-day return. Guardrails: send failures, duplicate sends, price mismatch reports, unsubscribe within 7 days, and Premium downgrade pauses.

*Testable:* a cross-device email click produces one restored event tied to the saved-search id; analytics payloads contain no email, raw criteria URL, provider URL, or affiliate marker; duplicate job execution does not duplicate events or mail.

## Required states for UXDES

UXDES must specify default, loading, success, empty/no-results, mock-results unavailable, incomplete-criteria, signed-out email entry, verification sent, verification expired/used, duplicate save, Free cap, Premium cap, downgraded/paused, global alerts off, storage error, email error, daily evaluation with no qualifying change (silent), qualifying email, expired search, unsubscribe, mobile 375px, desktop 1280px, focus/keyboard, and reduced-motion behavior.

Hierarchy on the results surface:

1. Primary: current search criteria and current results.
2. Secondary: **Save this search** / saved state.
3. Tertiary: cadence, threshold, cap, and settings explanation.

The save control must not outrank the search itself or appear on each hotel card; this ticket tracks a result set, not individual properties.

## Scope boundaries and blockers

- **Approval blocker for implementation:** this is a new feature and is not marked APPROVED FEATURE. Do not advance to UI/DEV implementation until product supplies that designation.
- **Coverage blocker:** the nightly job checks only two rotating monthly check-in anchors with a fixed two-night, two-adult, one-room request. It cannot evaluate arbitrary criteria. A saved search must never activate until the server can prove the full comparable stay is covered.
- **Occupancy/stay-definition blocker:** current criteria explicitly do not capture guests/rooms and the two dates are a check-in window, not check-in/check-out. The MVP must state this limitation; tracking an exact stay requires separate approved criteria work.
- **Provider-contract violation (existing, out of scope):** `lib/pipeline/snapshot.ts` calls vendor endpoints directly rather than through `lib/providers`, and its helpers return arrays rather than `Result<T>`. Any coverage expansion must first comply with the non-negotiable provider boundary.
- **Existing “instant” terminology is misleading:** it is out of scope to repair in this research ticket, but UXDES must include copy reconciliation in the release spec.
- **No shortlist dependency:** do not add per-card hearts/bells or reuse the unimplemented hotel-shortlist concept.
- **No reuse of `price_alerts` or dead `AlertSignup.tsx`:** both are flight-shaped.

## Handoff acceptance criteria

The UXDES spec is ready for UI/DEV only when it:

1. Uses the trigger and exact copy rules above without predictive claims.
2. Defines every state listed above at 375px and 1280px, including focus and keyboard behavior.
3. Saves the normalized effective criteria and explicitly excludes `criteriaVersion`, `source`, and sort from identity.
4. Reuses the single subscription consent model and gives each saved search lifecycle controls without a second notification preference.
5. Reconciles landing, pricing, account, and email cadence copy in one release.
6. Carries the APPROVED FEATURE designation before any implementation ticket begins.
7. Defines an explicit server-authored “monitorable criteria” contract and never activates an unsupported search.
