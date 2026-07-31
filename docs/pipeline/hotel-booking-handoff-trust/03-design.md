# UXDES-HOTEL-BOOKING-HANDOFF-TRUST-01: Hotel Booking Handoff Trust — Design Spec

**Stage:** UX Design (UXDES)
**Date:** 2026-07-31
**Upstream:** `docs/pipeline/hotel-booking-handoff-trust/02-research.md`, `01-discovery.md`
**Implements:** D1–D5 from the research brief
**Downstream ticket:** `UI-HOTEL-BOOKING-HANDOFF-TRUST-01`

---

## 0. What this spec decides

The `/book?kind=hotel` review screen currently asserts five things it does not know and one thing that is false. This spec defines:

1. The **continuity contract** — what a caller must pass, at the `HotelCard` props boundary and at `buildBookingHotelContext`, for the review screen to carry the traveler's selection (§2).
2. The **read model** — a single derivation, `deriveHotelContinuityPresentation`, that turns a `BookingHotelContext` into the four presentation states the screen renders (§3).
3. **Every visible string**, final, for every state (§4–§8).
4. **Degradation** — invalid continuity drops one field, never the page (§9).
5. **Layout, focus order, and 375/1280 behaviour** (§10–§11).
6. The **analytics prerequisite** without which none of this is measurable (§12).

Two rules govern every decision below and override any convenience:

> **Never render a fact the traveler's search did not produce.** Absence is a state with its own copy, not a gap to be filled.
>
> **Never contradict the card.** If the result card displayed a fact, the review screen displays the same fact with the same confidence language. If the card showed absence, the review screen shows the same absence wording.

---

## 1. Hierarchy of the review screen

Reading order after this change, top to bottom. Nothing moves except the two new insertions marked **NEW**.

| # | Block | Rank | Job |
|---|---|---|---|
| 1 | Back affordance | tertiary | Return to the search that produced the offer (D5) |
| 2 | Property identity (`hotel-property-title`) + location | **primary** | "This is the property you chose" |
| 3 | **Stay block** (inside block 2) | **primary** | "These are the dates this rate covers" (D1) |
| 4 | Price and Deal Score (`hotel-price-score-title`) | **primary** | "This is the price and whether it is good" (D2) |
| 5 | Hotel fit — class, guest rating, admission policy | secondary | "This is why you picked it" (D2) |
| 6 | **Hotel evidence — smoking policy panel** | secondary | Decision evidence read *before* leaving (D4) — **NEW** here |
| 7 | `{status}` | contextual | Existing |
| 8 | **Return prompt** (`showReturnPrompt`) | contextual | Post-return interruption, above the CTA (D4) — **NEW** here |
| 9 | Check rooms with provider — the outbound CTA | **primary action** | Leave |
| 10 | Supporting evidence (rate restrictions, parking, readiness, requests, funds policy) | tertiary | Existing |

Rationale for 6 before 8 before 9: evidence is read on the way out; the mismatch prompt must be met by a returning traveler **before** they can click out a second time. Putting the prompt below the CTA (its only other plausible home) guarantees the second click happens first, which is the exact behaviour the prompt exists to interrogate.

---

## 2. Continuity contract

### 2.1 `HotelCard` props (additive; no existing prop renamed or removed)

```ts
type Props = {
  hotel: HotelOffer
  score?: DealScore | null          // EXISTING — now forwarded into continuity
  stay?: { checkIn: string; checkOut: string }   // NEW
  returnUrl?: string                // NEW
  entrySource?: BookingHotelEntrySource // NEW
  // …all existing props unchanged
}
```

**`stay` — the only legal source.** `stay` may be populated **only** from the `{ checkin, checkout }` range `/api/search` passed to `searchHotelAvailability` (`app/api/search/route.ts:397-404`) — the span the nightly rate was actually quoted for. That range must be attached to the `hotels` NDJSON message so a parent can forward it.

**`HotelSearchCriteriaV1.dates` must never populate `stay`.** `{ semantic: 'checkin_window', dateFrom, dateTo }` is an arrival window, not a stay. Mapping `dateFrom → checkIn` and `dateTo → checkOut` compiles, validates, and fabricates a stay: a traveler who asked "check in any time Sep 14–18" would be told "Check in Sep 14 · Check out Sep 18 · 4 nights" on the last screen before handoff. An entry point that holds only criteria dates passes **no** `stay` and renders §5.2.

**No parent is being built by this ticket.** `HotelCard` is not mounted by any route today (research §3). This contract is specified so it is correct for whatever mounts it; mounting the results surface is a separate ticket.

### 2.2 `buildHotelBookingHref` and `buildBookingHotelContext`

```ts
export function buildHotelBookingHref(
  hotel: HotelOffer,
  continuity?: BookingHotelContinuity,   // NEW second argument
): string
```

Both call sites in `HotelCard` (`:753` href build, `:812` store POST body) pass the **same** continuity object, assembled once:

```ts
const continuity: BookingHotelContinuity = {
  ...(stay ? { checkIn: stay.checkIn, checkOut: stay.checkOut } : {}),
  ...(score ? { dealScore: score } : {}),
  ...(classEvidence ? { hotelClass: classEvidence } : {}),
  ...(hotel.guestRating ? { guestRating: hotel.guestRating } : {}),
  ...(returnUrl ? { returnUrl } : {}),
  ...(entrySource ? { entrySource } : {}),
}
```

Three required behaviours:

1. **`nightCount` is derived once, in `validateHotelStayContinuity`, and never in a view.** `buildBookingHotelContext` must run `{ checkIn, checkOut }` through `validateHotelStayContinuity` so the built context already carries a derived `nightCount` and an invalid span is dropped at build time as well as at read time. Callers never compute a night count.
2. **`hotelClass` uses the same derivation as the card.** `HotelCard.getHotelClassEvidence` (`HotelCard.tsx:441-457`) reads `hotel.hotelClass` when it is `kind: 'hotel_class'` with a positive value, and otherwise synthesizes `{ kind: 'hotel_class', value: hotel.stars, scaleMax: 5, sourceLabel: hotel.source, confidence: 'provider_only' }` from `hotel.stars`. Copying only `hotel.hotelClass` would make the review screen show absence for every card that displayed a star rating from `hotel.stars` — a direct hit on D2's fail condition. **Extract `getHotelClassEvidence` into a shared helper** (`lib/hotels/qualityEvidence.ts`) and call it from both `HotelCard` and `buildBookingHotelContext`. This is a move, not a rewrite: behaviour must be identical.
3. **`priceCheckedAt` is not populated by this ticket.** No provider, route, or type produces it (research §2(a)). It is rendered when present (§6.3) and absent otherwise. Sourcing it belongs to `hotel-price-freshness`.

### 2.3 Transport — URL first, store as the existing overflow path

Measured (research §2(b)): heavy inline href 1,716 chars; full continuity +994; total **2,711** against `MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH` 4,096. **The URL carries continuity.** No new transport, no store-first redesign.

The overflow path is already built and already tested: `buildHotelBookingHref` falls back to `?hotelContextRef=required`, `handleReviewClick` POSTs the structured context to `/api/book/hotel-context`, and `validateStructuredBookingHotelContext` round-trips every continuity field as a live object. Continuity makes that path slightly more likely on very heavy offers; the existing button states cover it and need no design change:

| Review button state | Copy | Trigger |
|---|---|---|
| idle | `Review hotel` | default |
| loading | existing `reviewState === 'loading'` treatment | store POST in flight |
| error | existing `reviewState === 'error'` treatment | store POST failed |

---

## 3. Read model — one derivation, four states per field

`HotelDecisionSummary` must not branch on raw context fields inline. Implement one pure helper and render from it:

```ts
type HotelStayPresentation =
  | { state: 'carried'; checkIn: string; checkOut: string; nightCount: number }
  | { state: 'absent' }

type HotelQualityPresentation =
  | { state: 'verified';      text: string; confidenceText: string; reviewCountText?: string; sourceLabel?: string }
  | { state: 'provider_only'; text: string; confidenceText: string; reviewCountText?: string; sourceLabel?: string }
  | { state: 'inferred';      text: string; confidenceText: string }
  | { state: 'absent' }

type HotelFreshnessPresentation =
  | { state: 'known'; text: string }
  | { state: 'unavailable' }
```

**`stay.state === 'carried'` requires all three of `checkIn`, `checkOut`, `nightCount`.** A half-span (`checkIn` only, or a dropped `nightCount`) is `'absent'`. The screen never renders "Check in Sep 14 · Check out —".

**`hasSearchDates` is derived from this same value**, not defaulted:

```ts
const hasStay = stay.state === 'carried'
```

`HotelHandoffReview` passes `hasSearchDates={hasStay}` to `ParkingSection`. Today `BookingFlow` defaults `hasSearchDates = true` and `app/book/page.tsx` never passes it, so `HotelParking` renders **"Space confirmed for these dates"** (`HotelParking.tsx:75`) on the same screen that says stay dates are not provided — a false availability claim and the sixth contradiction on this surface. After this change, no-stay renders `"Space confirmed for a selected stay"`, which `HotelParking` already supports.

The `hasSearchDates` prop on `BookingFlowProps` and `HotelHandoffReview` is **retained** (contract preservation) but no longer influences the hotel branch. Flag it for removal in a later cleanup ticket; do not remove it here.

---

## 4. Stay block (D1)

### 4.1 Present — `stay.state === 'carried'`

Replaces `BookingFlow.tsx:357-362`, inside the property section.

```
┌────────────────────────────────────────────────┐
│ CHECK IN        CHECK OUT       NIGHTS         │
│ Sun, Sep 14     Thu, Sep 18     4 nights       │
│                                                │
│ This nightly rate is priced for these dates.   │
└────────────────────────────────────────────────┘
```

**Copy — final:**

| Element | String |
|---|---|
| `dt` 1 | `Check in` |
| `dd` 1 | `formatDateTime(checkIn)` → e.g. `Sun, Sep 14` |
| `dt` 2 | `Check out` |
| `dd` 2 | `formatDateTime(checkOut)` → e.g. `Thu, Sep 18` |
| `dt` 3 | `Nights` |
| `dd` 3 | `1 night` when `nightCount === 1`, else `{nightCount} nights` |
| caption | `This nightly rate is priced for these dates.` |

The caption is not decoration. The span's provenance is the flight itinerary's depart/return, not a hotel date picker (research §2(a)); the honest claim is *what the rate covers*, never *what you chose for this hotel*. Do not write "Your selected dates".

**Markup and classes:**

```tsx
<div className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3">
  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div className="min-w-0">
      <dt className={factLabelCls}>Check in</dt>
      <dd className={`${factValueCls} break-words`}>{formatDateTime(stay.checkIn)}</dd>
    </div>
    <div className="min-w-0">
      <dt className={factLabelCls}>Check out</dt>
      <dd className={`${factValueCls} break-words`}>{formatDateTime(stay.checkOut)}</dd>
    </div>
    <div className="min-w-0">
      <dt className={factLabelCls}>Nights</dt>
      <dd className={factValueCls}>{nightsLabel(stay.nightCount)}</dd>
    </div>
  </dl>
  <p className="mt-3 text-xs font-medium leading-5 text-[color:var(--text-2)]">
    This nightly rate is priced for these dates.
  </p>
</div>
```

`formatDateTime` (`BookingFlow.tsx:210`) already yields `Sun, Sep 14` for a date-only value and appends a time only when the value contains `T`; stay dates are date-only, so no time is shown. Reuse it; do not add a second date formatter.

### 4.2 Absent — `stay.state === 'absent'`

```tsx
<div className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3">
  <p className={factLabelCls}>Stay dates not selected</p>
  <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{stayAbsenceCopy}</p>
</div>
```

**Copy — final:**

| Condition | String |
|---|---|
| label | `Stay dates not selected` |
| body, partner named | `Choose your dates with {partner.label} before comparing room options.` |
| body, partner not named | `Choose your dates with the booking partner before comparing room options.` |

`partner` comes from `getHotelPartnerIdentity(hotelContext.providerUrl)`, the same identity `HotelHandoffReview` already derives (`BookingFlow.tsx:728`). `HotelDecisionSummary` derives it the same way rather than taking a new prop.

**Why the wording changed.** "Stay dates not provided" reads as *expaify lost your selection*. "Not selected" is accurate — no stay was ever captured — and the second line is an action, matching the shipped `/deals` rule and the Booking.com pattern where an unset stay is a prompt, never a dead statement. Delete `Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options.` entirely.

### 4.3 The unconditional handoff sentence becomes conditional

`BookingFlow.tsx:1125-1128`:

```tsx
<p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">
  The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.
  {hasStay ? null : ' Choose or confirm your dates there before comparing room options.'}
</p>
```

Mirrors `HotelDealCriteria.tsx:146`, which already ships this rule. One product, two contradictory rules, one of them already correct.

### 4.4 CTA accessible name absorbs the stay

Constraint 2 requires the primary CTA's accessible name to stay accurate as surrounding facts change. Insert one clause into `accessibleName` (`BookingFlow.tsx:1061`), immediately after the rate clause:

- stay carried: `… The selected nightly rate is $189.00, per night before taxes and fees, for 4 nights from Sun, Sep 14 to Thu, Sep 18. The final total may differ. …`
- stay absent: unchanged from today (no stay clause).

The visible label (`Check rooms at {partner}`) does **not** change.

---

## 5. Deal Score (D2)

Pass `hotelContext.dealScore` through unchanged:

```tsx
<DealScorePanel
  score={hotelContext.dealScore ?? null}
  loading={false}
  scope="hotel"
  priceNoun="nightly rate"
  unavailableCopy="We could not compare this nightly rate with enough recent hotel prices."
/>
```

That is the entire change: delete nothing, add nothing. `DealScorePanel` already renders every required state and must not be modified.

| Context | Panel behaviour (already implemented) |
|---|---|
| `dealScore` absent or dropped | `Deal Score unavailable` + the unavailable copy above, `role="status"` |
| `confidence: 'high'` | `DealBadge` verdict + explanation + evidence grid (`Usual nightly rate`, `% below/above usual`, `Based on N price checks, last 90 days`) |
| `confidence: 'low'` | **Limited-history treatment**: warning-soft panel, badge carries the low-confidence state, `Compared with N recent prices — not enough to confirm a rating.`, `aria-label` reads `Deal Score for this nightly rate: limited price history.` — never a bare verdict |

**A thin-history score stays thin.** Do not soften, do not promote a low-confidence `Great` to a verdict line, do not hide the count line.

---

## 6. Hotel fit — class, guest rating, freshness (D2)

### 6.1 Hotel class

Replaces `BookingFlow.tsx:390-393`.

| State | `dd` copy | Confidence line |
|---|---|---|
| integer value, `scaleMax === 5` | `{value}-star hotel class from {sourceLabel}` | see below |
| other value/scale | `{value} of {scaleMax} hotel class from {sourceLabel}` | see below |
| absent | `Hotel class not provided` | *(none)* |

Confidence line, rendered under the value whenever class is present:

| `confidence` | String |
|---|---|
| `verified` | `Verified hotel class` |
| `provider_only` | `Provider-reported class; not independently verified` |
| `inferred` | `Inferred class; not provider-confirmed` |

`sourceLabel` falls back to `providerDisplayName(hotelContext.provider)` when the evidence carries none — identical to the card (`getHotelClassDetailText`).

### 6.2 Guest rating

Replaces `BookingFlow.tsx:394-398`, including the deletion required by D2.

| State | `dd` copy | Confidence line | Review count line |
|---|---|---|---|
| verified (`kind: 'guest_review'`, `confidence: 'verified'`, positive value + scaleMax) | `{value}/{scaleMax} guest rating from {sourceLabel}` | `Verified guest reviews` | `{n} guest reviews` when `reviewCount > 0`, else `Review count not provided` |
| provider only (`confidence: 'provider_only'`, positive value + scaleMax) | `{value}/{scaleMax} provider rating from {sourceLabel}` | `Provider rating; review source not confirmed` | as above |
| inferred (`confidence: 'inferred'`, or a value that duplicates class data) | `No verified guest rating` | `Not shown as a guest rating because it matches hotel class data` | *(none)* |
| absent | `Guest rating not available for this property.` | *(none)* | *(none)* |

**Deleted, unconditionally:** `This provider did not return guest-rating evidence.` It is false whenever the card showed a rating and unverifiable in every other case. No replacement makes a claim about what the provider did or did not return.

**The verified / provider-only distinction is carried in text, never in colour alone.** The confidence line is the distinction; any tonal styling is additive. Class and rating cells keep the neutral `insetPanelCls` treatment in all states — colour is not a channel here.

Confidence strings are lifted verbatim from the card's `getConfidenceText` and `getGuestRatingDetailText` (`HotelCard.tsx:529-582`) so the two screens are word-identical. Extract them alongside `getHotelClassEvidence` into `lib/hotels/qualityEvidence.ts` and consume from both.

**Markup:**

```tsx
<dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div className={`p-3.5 ${insetPanelCls}`}>
    <dt className={factLabelCls}>Hotel class</dt>
    <dd className={`${factValueCls} break-words`}>{hotelClass.text}</dd>
    {hotelClass.state !== 'absent' && (
      <p className="mt-2 text-xs leading-5 text-[color:var(--text-2)]">{hotelClass.confidenceText}</p>
    )}
  </div>
  <div className={`p-3.5 ${insetPanelCls}`}>
    <dt className={factLabelCls}>Guest rating</dt>
    <dd className={`${factValueCls} break-words`}>{guestRating.text}</dd>
    {guestRating.state !== 'absent' && (
      <>
        <p className="mt-2 text-xs leading-5 text-[color:var(--text-2)]">{guestRating.confidenceText}</p>
        {guestRating.reviewCountText && (
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">{guestRating.reviewCountText}</p>
        )}
      </>
    )}
  </div>
</dl>
```

### 6.3 Price freshness

Replaces `BookingFlow.tsx:375`.

| State | Copy | Class |
|---|---|---|
| `priceCheckedAt` absent or dropped | `Last-checked time unavailable.` | `mt-2 text-xs font-medium leading-5 text-[color:var(--warning)]` |
| `priceCheckedAt` present | `Last checked {formatDateTime(priceCheckedAt)}.` | `mt-2 text-xs font-medium leading-5 text-[color:var(--text-2)]` |

The absent wording now matches the card verbatim (`HotelCard.tsx:753`: `Rate from {provider}. Last-checked time unavailable.`). Two screens, one sentence. Do not soften absence into an implied freshness guarantee — no "recently checked", no omission of the line.

---

## 7. Evidence and return prompt (D4)

`ReviewShell` replaces the single dropped `hotelSupplement` prop with two:

```tsx
function ReviewShell({
  …,
  hotelEvidence,      // NEW — replaces hotelSupplement
  hotelReturnPrompt,  // NEW
  children,
}: { …; hotelEvidence?: ReactNode; hotelReturnPrompt?: ReactNode; children: ReactNode })
```

Hotel branch:

```tsx
<div className="mt-4 space-y-4 sm:mt-6">
  <HotelDecisionSummary hotelContext={hotelContext} />
  {hotelEvidence}
  {status}
  {hotelReturnPrompt}
  {children}
</div>
```

`hotelSupplement` is removed; it has no other consumer.

**Ungate the return prompt.** `HotelHandoffReview` currently wraps both nodes in `policy ? (…) : undefined` (`BookingFlow.tsx:1072`), so the mismatch prompt's existence depends on a smoking policy existing. Construct them independently:

```tsx
hotelEvidence={policy ? (
  <TrackedSmokingPolicyPanel offerId={…} provider={…} policy={policy} surface="review" />
) : undefined}
hotelReturnPrompt={showReturnPrompt ? <HotelReturnPrompt … /> : undefined}
```

### 7.1 Return prompt states — final copy

| State | Content |
|---|---|
| collapsed (`showReturnPrompt`, `!feedbackOpen`, `!feedbackSent`) | Heading `Did the partner details match?`; body `Optional: tell us what changed so we can improve hotel evidence.`; button `Report a mismatch` |
| open (`feedbackOpen`) | + fieldset legend `What did not match?`; one radio per `HOTEL_RETURN_REASONS`; buttons `Send feedback` (disabled until a reason is selected) and `Cancel` |
| sent (`feedbackSent`) | `Thanks. Your feedback was recorded.` |
| not returned | not rendered |

All four strings are unchanged from the existing (never-rendered) implementation. They are correct; the defect was that nothing rendered them.

### 7.2 Return prompt accessibility

```tsx
<section
  role="status"
  aria-live="polite"
  aria-atomic="false"
  aria-labelledby="hotel-return-feedback-title"
  className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4"
>
```

- `aria-atomic="false"` so expanding the form announces only the new nodes, not the whole panel again.
- **The prompt never steals focus on appearance.** A traveler returning from the partner keeps their scroll and focus position.
- Cancel returns focus to `feedbackTriggerRef` via the existing `setTimeout(…, 0)` (`BookingFlow.tsx:1108`). Retained exactly.
- Radios keep `min-h-11` targets and the `focus-within:shadow-[var(--focus-ring)]` label treatment.

---

## 8. Back affordances and return URL (D5)

### 8.1 Both shells read the context

| Shell | `href` | Label |
|---|---|---|
| hotel (`BookingFlow.tsx:534`) | `hotelContext.returnUrl ?? '/'` | `← Back to results` when `returnUrl` present, `← Back to search` when it falls back to `/` |
| flight (`:548`) | `'/'` | `← Back to search` (unchanged) |

Today the hotel shell says "← Back to results" while linking to `/` — the label promises a result set and delivers an empty form. The label must follow the destination.

`handleBack`'s `hotel_handoff_back_clicked` emission stays on the same element and is unchanged.

### 8.2 Producing `returnUrl`

Reuse the shipped helpers; invent no new format:

| Origin | Builder |
|---|---|
| `/deals` results | `buildHotelResultsUrl(criteria, view)` |
| `/destinations/<slug>` | `buildHotelDestinationUrl(criteria, view)` — sets `criteriaReturn=destination` |
| either, resolved from the current request | `buildHotelBackUrl(criteria, view, searchParams)` |

`validateHotelReturnUrl` (`config.ts:221-241`) already allows exactly `/`, `/deals*`, `/destinations/<slug>*` and rejects protocol-relative, scheme-prefixed, credentialed, and control-character input. **No new validation.** An off-allowlist or tampered value degrades to `undefined` → `/` → `← Back to search` (§9).

### 8.3 `entrySource`

Set alongside `returnUrl` so return behaviour is attributable:

| Value | When |
|---|---|
| `'search'` | offer came from a results surface |
| `'saved'` | offer came from a saved deal |
| `'direct'` | anything else |

`entrySource` has no visible rendering. It is analytics-only.

---

## 9. Degradation (D3) — a bad field, never a dead page

Today `validateBookingHotelContext` (`config.ts:825-844`) returns `null` — nulling the whole context — when any of `stayContinuity`, `priceCheckedAt`, `hotelClass`, `guestRating`, `dealScore` is invalid. `parseBookingHotelContext` returning `null` sets `invalidHotelSelection` (`app/book/page.tsx:53`) and the traveler loses the entire review screen and the handoff.

These gates are dormant only because the fields are always absent. **Populating them arms five whole-page failure modes**, including a subtle one: `validateHotelDealScore` requires `currency === observedCurrency` (`config.ts:608`), so a score computed against a differently-denominated baseline would destroy the page rather than hide a badge.

**Required behaviour.** Each field degrades in isolation:

| Input | Result | Rendered as |
|---|---|---|
| `checkIn`/`checkOut`/`nightCount` invalid, inconsistent, or non-date | all three dropped to `undefined` | §4.2 stay absence + parking `for a selected stay` |
| `dealScore` invalid, malformed, or currency-mismatched | dropped to `undefined` | `Deal Score unavailable` (§5) |
| `hotelClass` invalid | dropped to `undefined` | `Hotel class not provided` (§6.1) |
| `guestRating` invalid | dropped to `undefined` | `Guest rating not available for this property.` (§6.2) |
| `priceCheckedAt` not a valid date | dropped to `undefined` | `Last-checked time unavailable.` (§6.3) |
| `returnUrl` off-allowlist | already `undefined` | `← Back to search` → `/` (§8.1) |
| `entrySource` not one of the three values | dropped to `undefined` | no visible effect |

Remove `stayContinuity === null`, `priceCheckedAt` validity, `hotelClass === null`, `guestRating === null`, and `dealScore === null` from the fail-fast condition at `config.ts:825-844`; coerce each to `undefined` instead. This follows the precedent already written into the same file for `rateEligibility` (`config.ts:818-820`): *"Invalid/tampered eligibility context degrades to 'not provided' at read time; it must never block an otherwise-valid hotel context or the review/handoff gate."*

**What must still null the context** (unchanged — these are identity and money, not continuity): `kind`, `offerId`, `provider`, `name`, `currency`, `priceCents`, `priceBasis`, `providerUrl` affiliate validation, `location`.

**No special "tampered" copy.** A dropped field is indistinguishable from an absent one, by design: the screen states what it knows and never speculates about why it does not know something.

**Acceptance:** `/book?kind=hotel&…&checkIn=banana`, and the same URL with a currency-mismatched `dealScore`, both render a working review screen with the stay block in its absence state and a working outbound CTA — never `invalidHotelSelection`.

---

## 10. States matrix

Every row is a required test case. "Parking" is the `ParkingSection` space wording driven by derived `hasSearchDates`.

| # | Scenario | Stay block | Deal Score | Class | Rating | Handoff sentence | Parking | Back link |
|---|---|---|---|---|---|---|---|---|
| 1 | All continuity present | dates + `4 nights` + rate caption | verdict panel | value + confidence | value + confidence + count | no dates clause | `for these dates` | `← Back to results` |
| 2 | Stay absent, score present | `Stay dates not selected` + partner action | verdict panel | value | value | dates clause shown | `for a selected stay` | per `returnUrl` |
| 3 | Stay present, score absent | dates + nights | `Deal Score unavailable` | value | value | no dates clause | `for these dates` | per `returnUrl` |
| 4 | Fully absent (today's real handoff) | `Stay dates not selected` | `Deal Score unavailable` | `Hotel class not provided` | `Guest rating not available for this property.` | dates clause shown | `for a selected stay` | `← Back to search` |
| 5 | Tampered stay (`checkIn=banana`) | absence state | unaffected | unaffected | unaffected | dates clause shown | `for a selected stay` | unaffected |
| 6 | Currency-mismatched `dealScore` | unaffected | `Deal Score unavailable` | unaffected | unaffected | unaffected | unaffected | unaffected |
| 7 | Off-allowlist `returnUrl` | unaffected | unaffected | unaffected | unaffected | unaffected | unaffected | `← Back to search` → `/` |
| 8 | Low-confidence score | any | limited-history treatment + count line | any | any | any | any | any |
| 9 | Provider-only rating | any | any | `Provider-reported class; not independently verified` | `Provider rating; review source not confirmed` | any | any | any |
| 10 | Inferred rating | any | any | any | `No verified guest rating` + match explanation | any | any | any |
| 11 | Post-return | unaffected | unaffected | unaffected | unaffected | unaffected | unaffected | unaffected — **plus** the return prompt above the CTA |
| 12 | Post-return, no smoking policy | unaffected | unaffected | unaffected | unaffected | unaffected | unaffected | prompt still renders; smoking panel absent |
| 13 | Href over 4,096 chars | store path; identical rendering after resolve | — | — | — | — | — | — |

Row 12 is the D4 regression guard: the prompt must not be gated on `policy`.

---

## 11. Responsive and focus

### 11.1 375px (mobile)

- Page container `px-4 py-5`, `max-w-[1080px]` — unchanged.
- Stay `dl`: `grid-cols-2` — `Check in` and `Check out` side by side (~163px each; values are ≤12 characters at `--text-sm` 13px), `Nights` wraps to the second row. `min-w-0` + `break-words` on every `dd`.
- Hotel fit `dl`: `grid-cols-1` — class and rating stack.
- Price/Deal Score: `grid gap-4` single column; the `DealScorePanel` sits under the rate.
- Long property names, partner labels, and source labels use `break-words` / `[overflow-wrap:anywhere]`. **No horizontal scroll at 375px, no overlapping text.**
- All interactive targets keep `min-h-11`.

### 11.2 1280px (desktop)

- Stay `dl`: `sm:grid-cols-3` — one row, three facts.
- Hotel fit `dl`: `sm:grid-cols-2`.
- Price/Deal Score: existing `lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]` — rate left, score right. The score sits beside the price and one section above the CTA, matching the Google Hotels pattern of putting the assessment at the decision moment.

### 11.3 Focus order into the outbound link

Tab order must be exactly:

1. `← Back to results` / `← Back to search`
2. Any interactive control inside the property/stay block — **none; the stay block is static content only**
3. Hotel fit disclosures (admission policy, existing)
4. Smoking policy panel controls (`hotelEvidence`) — *newly reachable*
5. Return prompt controls, when shown: `Report a mismatch` → (`Send feedback`, `Cancel` when open) — *newly reachable*
6. Booking-ownership disclosure
7. Loyalty disclosure
8. **`Check rooms at {partner}`** — the outbound link
9. Supporting-evidence controls

The stay block, class, rating, score and freshness are non-interactive, so **no new tab stop precedes the CTA from this ticket's content additions**. The two new tab stops (4, 5) come from rendering nodes that were already constructed and dropped, and both sit above the CTA by design. Focus order into the outbound link does not regress.

Additional requirements:

- All restored facts are real DOM content in `dl`/`dt`/`dd` or heading semantics — never `aria-label`-only, never `::before` content.
- Focus rings use `focus-visible:shadow-[var(--focus-ring)]`; nothing suppresses them.
- The return prompt is announced politely and does not move focus (§7.2).
- The CTA keeps `rel="noopener noreferrer sponsored"`, `target="_blank"`, and its affiliate marker. Its accessible name updates per §4.4.

---

## 12. Analytics prerequisite (blocking for MEASURE, not for UI)

**Every `hotel_handoff_*` event is currently rejected with HTTP 400.** `/api/analytics` `parseBody` rejects an entire event if any submitted prop is missing from that event's allowlist, and `emitAnalytics` swallows the failure ("Analytics must never block or alter the booking handoff" — correct, but it means this has failed silently). The ticket's MEASURE plan reads zero today and will keep reading zero after this ships unless the registry is fixed.

Required additions to `EVENT_PROPERTIES` and `REQUIRED_PROPERTIES` in `app/api/analytics/route.ts`:

| Event | Add to allowlist |
|---|---|
| `hotel_handoff_viewed` | `policyState`, `obligationTypes`, `stayState`, `scoreState`, `classState`, `ratingState` |
| `hotel_handoff_continue_clicked` | `policyState`, `obligationTypes`, `invoiceNeeded`, `invoiceReadinessStatus`, `helpViewed`, `loyaltyDisclosureViewed` |
| `hotel_handoff_returned` | `policyState`, `obligationTypes` |
| `hotel_handoff_back_clicked` | `policyState`, `obligationTypes` |
| `hotel_handoff_return_reason_selected` | **entire event is absent** — register with `reason`, `offerId`, `provider`, `partnerHost`, `handoffSessionId` |

New `validPropertyValue` branches:

| Key | Rule |
|---|---|
| `invoiceNeeded`, `helpViewed`, `loyaltyDisclosureViewed` | boolean |
| `policyState`, `obligationTypes`, `invoiceReadinessStatus` | constrain to the emitting helpers' vocabularies |
| `reason` | one of `HOTEL_RETURN_REASONS` values |
| `offerId`, `handoffSessionId` | `OPAQUE_VALUE` — **not** the stricter `ID` pattern. `handoffSessionId` is a `crypto.randomUUID()` with a `handoff-${Date.now()}` fallback; the UUID form does not match `ID`. |
| `stayState` | `carried` \| `absent` |
| `scoreState` | reuse the existing `score_state` vocabulary: `loading` \| `confirmed` \| `unavailable` \| `error` |
| `classState`, `ratingState` | `verified` \| `provider_only` \| `inferred` \| `absent` |

The four continuity dimensions on `hotel_handoff_viewed` make this ticket's fix attributable: click-through can be compared across `stayState=carried` vs `absent`.

This is registry work (`app/api/analytics/route.ts`), not UI work. It belongs in the DEV ticket alongside the `config.ts` degradation change, or in a dedicated follow-up — but the UI ticket must emit the new dimensions so the registry has something to accept.

---

## 13. Test rewrites required

`app/book/__tests__/BookingFlow.test.tsx:198` and `:204` assert the exact hardcoded strings `'Stay dates not provided'` and `'Last-checked time not provided.'`. **Rewrite against context-driven behaviour — do not delete.**

- The existing "unresolved-partner handoff" fixture carries no continuity, so it becomes the row-4 case: assert `Stay dates not selected`, `Choose your dates with the booking partner before comparing room options.`, `Last-checked time unavailable.`, `Guest rating not available for this property.`, `Hotel class not provided`, `Deal Score unavailable`.
- Add a continuity-carrying fixture for row 1 and assert `Check in`, `Check out`, `4 nights`, `This nightly rate is priced for these dates.`, the verdict, the class value, and the rating value.
- Add rows 5 and 6 as parse-level tests: a tampered `checkIn` and a currency-mismatched `dealScore` must both yield a non-null context.
- Add row 12: `showReturnPrompt` with no smoking policy renders `Did the partner details match?`.
- Assert the review screen contains **no** occurrence of `This provider did not return guest-rating evidence.`

---

## 14. Definition of done for `UI-HOTEL-BOOKING-HANDOFF-TRUST-01`

1. Every string in §4–§8 renders exactly as written; no placeholder text anywhere.
2. All 13 rows of §10 are reachable and correct.
3. No absence line appears for a field the originating card displayed (§2.2 item 2 is the trap).
4. A `confidence: 'low'` Deal Score never renders as a bare verdict.
5. No copy asserts what the provider did or did not return.
6. Parking never says "for these dates" on a screen with no stay block.
7. Tampered continuity renders a working review screen, never `invalidHotelSelection`.
8. Smoking panel and return prompt both render; the prompt is above the CTA and is not gated on the smoking policy.
9. Back link label matches its destination in both branches.
10. 375px: no horizontal scroll, no overlap, all targets ≥44px. 1280px: three-across stay, two-across fit, score beside the rate.
11. Focus order per §11.3; no new tab stop between the last disclosure and the outbound CTA.
12. `npx tsc --noEmit --incremental false` exits 0; `npm test -- --passWithNoTests` exits 0.

**Out of scope — do not smuggle in:** mounting `HotelCard` or the `/api/search` results stream (its own ticket); sourcing `priceCheckedAt` (`hotel-price-freshness`); result-card copy (`booking-handoff-trust`); partner naming and new-tab cueing (`booking-handoff-confidence`, shipped); anything on the partner's own checkout.
