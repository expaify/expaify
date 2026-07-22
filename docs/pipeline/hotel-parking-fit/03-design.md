# UX Design: Hotel Parking Fit

**Ticket:** `UXDES-HOTEL-PARKING-FIT-01`  
**Stage:** UX Design  
**Priority:** P0  
**Date:** 2026-07-22

## Source inputs

- Discovery: `docs/pipeline/hotel-parking-fit/01-discovery.md`
- Research: `docs/pipeline/hotel-parking-fit/02-research.md`
- Current implementation inspected:
  - `lib/types.ts`
  - `lib/providers/hotelAmenityEvidence.ts`
  - `lib/providers/hotellook.ts`
  - `app/api/search/route.ts`
  - `app/components/HotelCard.tsx`
  - `lib/booking/config.ts`
  - `app/book/BookingFlow.tsx`
  - `lib/analytics.ts`
  - `app/page.tsx`
  - `app/deals/DealFeed.tsx`
  - `app/globals.css`

## Problem statement

A driver cannot reliably compare true hotel parking fit because a property-level parking fact does not establish a selected-stay space, location, cost and basis, reservation rule, or operator.

## Design goal and trust rule

A first-time driver can distinguish a documented parking facility from a space for the selected dates, compare every supplier-supported parking dimension, and carry the same certainty into booking review without reading omission, a reservation rule, or a property amenity as a space promise.

The governing rule for every surface is:

> A documented parking option is not a promised space. Only explicit date/rate/stay-scoped supplier evidence may produce **Space confirmed for these dates**. expaify never says it reserved, held, or guaranteed a parking space.

This is trust repair, not a new booking capability. expaify does not reserve or collect payment for parking, add parking to the room total, rank hotels by parking, or alter Deal Score.

## Current live-surface and supply dependencies

### Result-surface wiring dependency

`app/components/HotelCard.tsx` is the specified comparison component, but it is currently mounted only in tests. Neither `app/page.tsx` nor `app/deals/DealFeed.tsx` mounts it. UI may implement the component states, but end-to-end delivery and production analytics require a separately scoped decision about which real results route mounts `HotelCard` and supplies `searchId` and `evidenceRevision`. No production impression, reach, or handoff denominator is valid until that wiring exists.

### Provider-coverage dependency

The current `lib/providers/hotellook.ts` contract has no native structured parking supply. It can preserve only pre-enriched `amenityEvidence`, and it cannot establish exact amount/basis, nearby/street location, reservation rule, operator, or selected-stay space. Therefore the first release must expect **Parking details not provided** on most current offers. DEV must add provider-neutral types and conservative provider mappings before richer states can be data-backed. Missing provider data must never be filled through UI inference.

### Booking transport dependency

`BookingHotelContext` and its URL parser/serializer currently drop parking evidence. DEV must implement bounded, validated parking transport before UI can claim result-to-review continuity. Raw supplier JSON, prose, URLs, or unbounded addresses must not be serialized.

## Information hierarchy

### Collapsed hotel card

1. **Primary:** hotel name, nightly room rate, **Review hotel**.
2. **Secondary:** hotel location, Deal Score, and one parking decision summary.
3. **Tertiary:** hotel class/guest rating and provider/freshness context.

Parking must not displace or visually compete with the hotel identity, rate, Deal Score, or CTA. Elevator and other access facts must not suppress the parking summary when the scoped parking surface is present.

### Expanded hotel details

1. **Primary:** Deal Score explanation, location evidence, and the dedicated **Parking** section.
2. **Secondary:** non-parking **Access & room requests**, quality evidence, and price scope.
3. **Tertiary:** provider handoff detail and property photo.

### Booking review

1. **Primary:** hotel identity, selected room rate, parking status/next action, and provider CTA.
2. **Secondary:** normalized parking option facts and rate/location evidence.
3. **Tertiary:** source/freshness, special-request education, and offer reference.

## Provider-neutral data contract

DEV must add this shared contract in `lib/types.ts`; UI consumes normalized values only.

```ts
type ParkingLocationKind =
  | 'on_site'
  | 'nearby_off_site'
  | 'street'
  | 'unknown'

type ParkingSpaceState =
  | 'confirmed_for_selected_stay'
  | 'unavailable_for_selected_stay'
  | 'not_returned'
  | 'unknown'

type ParkingReservationRule =
  | 'required'
  | 'not_required'
  | 'not_possible'
  | 'available_on_request'
  | 'first_come_first_served'
  | 'unknown'

type ParkingOperator =
  | 'hotel_operated'
  | 'third_party'
  | 'unknown'

type ParkingCostState = 'included' | 'paid' | 'unknown'

type ParkingCostBasis =
  | 'per_night'
  | 'per_stay'
  | 'per_entry'
  | 'per_hour'
  | 'unknown'

interface HotelParkingOptionEvidence {
  id: string
  facilityStatus: HotelEvidenceStatus
  facilityScope: 'property'
  selectedStaySpace: ParkingSpaceState
  location: {
    kind: ParkingLocationKind
    distance?: HotelLocationDistance
    address?: string
  }
  cost: {
    state: ParkingCostState
    amount?: Money
    basis: ParkingCostBasis
  }
  reservation: ParkingReservationRule
  operator: ParkingOperator
  sourceLabel: string
  fetchedAt?: string
  confidence?: HotelAmenityConfidence
}

interface HotelParkingEvidence {
  state: 'loading' | 'ready' | 'error'
  options: HotelParkingOptionEvidence[]
  evidenceRevision: string
  conflict: boolean
}
```

### Normalization and validation rules

1. `facilityStatus='confirmed'` proves only a supplier-documented option at property scope. It does not change `selectedStaySpace`.
2. `selectedStaySpace='confirmed_for_selected_stay'` requires explicit selected-date/rate/stay evidence. `required`, `available_on_request`, `not_required`, and `first_come_first_served` do not imply a confirmed space.
3. Supplier silence becomes `not_returned`; malformed or irreconcilable supplier content becomes `unknown`. Neither becomes `unavailable`.
4. Explicit no-parking evidence is represented as an unavailable facility outcome, not as an empty option array with an inferred meaning.
5. `cost.amount` is valid only when `priceCents` is a non-negative safe integer and `currency` is a supported three-letter code. Never use floats or a bare number.
6. `cost.state='included'` may not have an amount. `cost.state='paid'` may omit amount and use `basis='unknown'`. Do not relabel included as “free.”
7. If an amount exists but its basis is absent, show the amount and **charge basis not provided**; do not multiply it by nights.
8. Nearby distance/address may render only when supplier documented. Do not calculate parking distance from hotel coordinates. Limit transport to one normalized distance and a validated display-safe address; analytics never receives either.
9. `reservation='not_possible'` means advance reservation is not accepted. It does not mean parking is unavailable or first come unless that separate evidence exists.
10. Public/private classifications do not populate `operator`. Only explicit operator evidence maps to hotel-operated or third-party.
11. Retain distinct options. When apparent duplicates conflict on one dimension, set that dimension to `unknown`, set `conflict=true`, keep one display option, and preserve both sources outside UI transport for audit. Never silently choose the more favorable claim.
12. Reject unsafe/oversized booking context rather than partially changing meaning: maximum two options; option IDs/provider labels are bounded enums or sanitized identifiers; no raw provider prose; no raw URL; address excluded from booking context. If parking transport alone is invalid, keep the valid hotel review and show the parking malformed state rather than invalidating the entire hotel handoff.

## Collapsed comparison signal

### Placement

In `HotelCard`, place the parking summary after the existing collapsed hotel location/quality content and before the action row. It is a static comparison line, not a button or chip. The existing **Details** control remains the only disclosure control.

Base class pattern:

```txt
mt-3 flex min-w-0 items-start gap-2 rounded-lg
border border-[color:var(--border)] bg-[color:var(--bg-raised)]
px-3 py-2 text-small leading-5 text-[color:var(--text-2)]
```

Use an `aria-hidden` status dot or simple parking icon only if an existing icon is available. Meaning must be fully present in text. Do not introduce a green success treatment for a property-level facility. Use `--text-1`, `--text-2`, `--text-3`, `--warning`, and `--error` only as reinforcement.

### Composition rule

For one or more confirmed options, compose exactly three clauses in this order:

`{location}. {cost}. {space}.`

Examples:

- `On-site parking. $25 per night. Space not confirmed.`
- `Nearby parking. Included. Space confirmed for these dates.`
- `Street parking. Paid — amount not provided. Space not confirmed.`
- `Parking location not provided. Cost not provided. Space not confirmed.`

If multiple options exist, summarize the best-scannable location set without claiming preference:

- on-site plus any other kind: `2 parking options: on site and nearby. {cost summary}. {space summary}.`
- nearby plus street: `2 parking options: nearby and street. {cost summary}. {space summary}.`
- three or more normalized source records are not transported; UI receives at most two and uses `2 parking options`.
- mixed cost: `Costs vary by option.`
- every option included: `Included.`
- every option paid with same exact amount/basis: use exact formatted amount/basis.
- otherwise: `Cost details vary.`
- any selected-stay confirmed and no selected-stay unavailable: `One space confirmed for these dates.`
- any selected-stay unavailable: `Stay-specific space status varies.`
- otherwise: `Spaces not confirmed.`

The collapsed line must not use “available parking,” “parking available,” “guaranteed,” “reserved,” or “free.”

### Collapsed state copy

| State | Visible copy | Treatment |
|---|---|---|
| Initial loading, no evidence | `Checking parking details…` | `.skeleton` dot may animate; text remains visible in `role="status"` |
| Refreshing with known evidence | Render known summary, then `Refreshing details…` | Preserve dimensions; append quiet `--text-3` status |
| All not returned | `Parking details not provided.` | Neutral |
| Malformed/unclear | `Parking details are unclear.` | Warning |
| Explicit no option | `{Provider} reports no parking option at this property.` | Neutral/strong text; never red error |
| One confirmed option | Three-clause composition above | Neutral |
| Multiple options | Multi-option composition above | Neutral |
| Conflict | `Parking details conflict across sources. Confirm with the booking partner.` | Warning |
| Retrieval error, no known evidence | `Parking details could not be checked.` | Error text, no retry inside card |
| Retrieval error with known evidence | Render known summary, then `Latest check failed.` | Preserve evidence; warning |
| Selected-stay unavailable | `{location}. {cost}. No space reported for these dates.` | Warning; not “no parking” |
| Selected-stay confirmed | `{location}. {cost}. Space confirmed for these dates.` | Brand/success text may reinforce exact stay-scoped claim |

Provider naming rule: use the normalized display name only when non-empty and recognized. Otherwise use `The provider reports no parking option at this property.` Never expose a raw provider ID.

## Dedicated expanded Parking section

### Placement and structure

Remove parking from the current **Access & room requests** rows. Inside expanded `HotelCard`, place a sibling `<section>` titled **Parking** after **Location** and before non-parking **Access & room requests**. Give it `aria-labelledby="hotel-parking-title-{offerId}"`.

Section class pattern:

```txt
rounded-[var(--radius-card)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4
```

Header:

- H3: `Parking`
- Supporting line for returned options: `Property details and stay-specific space status are shown separately.`
- Supporting line for explicit none: no extra line; the explicit statement is sufficient.

Each option is one `<article>` or `<li>` with an accessible name `Parking option {n}`. Do not split a single option across desktop columns. Within an option, render six facts in fixed DOM order.

1. **Option**
2. **Space for your stay**
3. **Cost**
4. **Advance action**
5. **Operated by**
6. **Source**

Option layout class pattern:

```txt
grid min-w-0 grid-cols-1 gap-x-5 gap-y-3
border-t border-[color:var(--border)] pt-4 first:border-t-0 first:pt-0
md:grid-cols-2
```

The entire option remains one list item and reading unit. Desktop columns follow DOM row order. Values use `break-words`; no critical qualifier is truncated.

### Final field copy

#### Option

| Value | Copy |
|---|---|
| `on_site` | `On site` |
| `nearby_off_site` | `Nearby, off site` |
| `street` | `Street parking` |
| `unknown` | `Location not provided` |

For supplier-documented nearby detail, append only one line:

- distance: `{distance} from the hotel, as reported by {Provider}.`
- address: `{address}`
- both: address first, then distance.

Never label the hotel address as the parking address. Prefix a parking address with `Parking address:`.

#### Space for your stay

| Value | Copy |
|---|---|
| `confirmed_for_selected_stay` | `Provider reports a space for these dates. expaify has not reserved it.` |
| `unavailable_for_selected_stay` | `Provider reports no space for these dates.` |
| `not_returned` | `Provider did not provide stay-specific space information.` |
| `unknown` | `Stay-specific space status is unclear.` |

If search dates are absent, replace “these dates” in visible text with “a selected stay”; never imply the status was date-checked.

#### Cost

| State | Copy |
|---|---|
| Included | `Included.` |
| Paid, exact amount and basis | `{formatted amount} {basis}.` |
| Paid, exact amount, unknown basis | `{formatted amount}; charge basis not provided.` |
| Paid, no amount, known basis | `Paid {basis}; amount not provided.` |
| Paid, no amount or basis | `Paid — amount and charge basis not provided.` |
| Unknown/not returned | `Cost not provided.` |

Basis strings:

- `per_night` → `per night`
- `per_stay` → `per stay`
- `per_entry` → `per entry`
- `per_hour` → `per hour`

Below every paid cost not proven to be in the room total, show: `Parking is separate from the nightly room rate shown.` Do not calculate a stay total from an amount with unknown basis.

#### Advance action

| Value | Copy |
|---|---|
| `required` | `Advance reservation required. expaify has not made it.` |
| `not_required` | `Advance reservation not required. A space is still not promised.` |
| `not_possible` | `Advance reservation is not accepted.` |
| `available_on_request` | `A request can be made; it is not guaranteed.` |
| `first_come_first_served` | `First come, first served. A space is not guaranteed.` |
| `unknown` | `Reservation rule not provided.` |

#### Operated by

| Value | Copy |
|---|---|
| `hotel_operated` | `Hotel` |
| `third_party` | `Third party` |
| `unknown` | `Operator not provided` |

Do not derive this field from on-site/nearby or public/private.

#### Source

- recognized provider, valid time: `{Provider} · Updated {localized date and time}`
- recognized provider, no time: `{Provider} · Update time not provided`
- unknown provider label, valid time: `Provider name not provided · Updated {localized date and time}`
- unknown provider label and no time: `Provider and update time not provided`

Do not show malformed timestamps. Do not describe stale evidence as current. If product later defines a freshness threshold, stale copy must be separately approved.

### Section-level states

| State | Title/body and behavior |
|---|---|
| Initial loading | Title `Parking`; body `Checking parking details…`; three short skeleton rows are `aria-hidden`; one polite status provides the text |
| Refresh with known evidence | Keep all option facts visible; polite status `Refreshing parking details…`; do not clear or dim facts |
| All not returned | `Parking details not provided.` + `Confirm location, cost, reservation rules, operator, and space availability with the booking partner.` |
| Malformed/unknown | `Parking details are unclear.` + same confirmation sentence |
| Explicit no option | `{Provider} reports no parking option at this property.` + `This is a property-level statement; street or third-party options were not assessed unless listed separately.` |
| One option | Render one grouped option and support line |
| Multiple options | Intro `2 parking options reported.`; render each numbered group in supplier order; do not visually recommend one |
| Conflict | Warning heading `Parking details conflict.` + `Sources disagree about {bounded dimension list}. Confirm the current details with the booking partner.`; render non-conflicting facts; each conflicted field reads `{Label} is unclear because sources disagree.` |
| Error, no evidence | `Parking details could not be checked.` + `Confirm location, cost, reservation rules, operator, and space availability with the booking partner.` |
| Error, known evidence | Keep evidence; warning `The latest parking check failed. Confirm these details with the booking partner.` |
| Selected-stay confirmed | Render exact space copy; no celebratory badge and no guarantee language |
| Selected-stay unavailable | Render exact unavailable space copy; keep facility, cost, reservation, and operator facts because the facility can still exist |

Bounded conflict labels are `location`, `cost`, `reservation rule`, `operator`, and `space for your stay`. If more than two conflict, use `multiple parking details` rather than a long list.

### Retry rule

The existing hotel-card data stream does not expose a parking-only retry contract. Do not add a decorative/non-functional retry. If DEV later supplies `onRetryParking`, render `Retry parking check` as a text button after the error body; activation preserves focus on the button, announces `Checking parking details…`, disables the button during loading, and announces the resulting ready/error state. Without that contract, confirmation with the booking partner is the final recovery copy.

## Booking-review continuity

### Placement

In `HotelHandoffReview`, place a dedicated **Parking for this stay** section immediately after `HotelSummary`/rate expectation and before the booking-partner confirmation and **Special requests** content. It must render from the normalized snapshot transported with the selected offer, not refetch independently.

The section repeats at most two options using the same six-field order and exact copy as result details. This continuity is more important than compactness. It ends with exactly one status-driven **Before you pay** message.

Base class pattern:

```txt
rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)]
px-4 py-4 sm:px-5 sm:py-5
```

### Before-you-pay precedence

Evaluate in this order and render only the first matching message:

1. **Explicit selected-stay unavailable:** `The provider reports no parking space for these dates. Choose another parking plan or confirm a changed status before you pay.`
2. **Conflict or unknown-dominant:** `Parking location, cost, reservation rules, operator, or space availability are still not fully documented. Confirm them before you pay.`
3. **Reservation required:** `This parking option requires advance reservation. Complete or confirm it with the booking partner; expaify has not reserved a space.`
4. **Third-party:** `This option is operated by a third party. Confirm payment, access, and cancellation terms with that operator or the booking partner.`
5. **Explicit selected-stay confirmation:** `The provider reports a parking space for these dates. Recheck the live booking terms before payment.`
6. **Documented facility without stay confirmation:** `Parking is documented, but expaify has not confirmed a space for your dates. Check availability with the booking partner before you pay.`
7. **Explicit no option:** `The provider reports no parking option at this property. Make another parking plan before you pay.`
8. **No parking fields/error:** `Parking details were not provided or could not be checked. Confirm your parking plan before you pay.`

For multiple options, any conflict/critical unknown triggers rule 2. A confirmed space on one option does not hide an unavailable or unresolved second option; the section shows both and uses rule 2 unless the user has selected a specific option in a separately approved future flow.

### Provider CTA

Visible CTA stays `Continue to {Partner}` or `Continue to booking partner`.

Append this sentence to its accessible name whenever no option has `selectedStaySpace='confirmed_for_selected_stay'`:

`Parking space not confirmed.`

If a selected-stay space is explicitly unavailable, use:

`Provider reports no parking space for these dates.`

If one is confirmed, use:

`Provider reports a parking space for these dates; expaify has not reserved it.`

The existing final-total caveat remains. Never add a parking amount to the room rate/total unless a future provider total-price contract explicitly proves inclusion.

### Invalid or absent transport

- No parking context: show the no-fields state; do not reconstruct it from legacy `amenityEvidence` on `/book`.
- Malformed parking context: show the unclear state and preserve the otherwise valid hotel review/CTA.
- More than two options, raw prose, invalid enum, unsafe integer, or invalid currency: reject the parking snapshot, show unclear, and emit no value from the rejected field.
- The booking page does not announce an error assertively for parking transport because booking can continue; the inline warning is a polite status.

## Interaction rules

### Pointer and touch

- The collapsed parking summary is static and has no click handler.
- **Details** expands/collapses the entire hotel detail region, including parking.
- **Review hotel** navigates to expaify booking review and carries the bounded parking snapshot.
- The external provider CTA opens the existing sponsored handoff in a new tab. No parking request or reservation is sent.
- All controls retain a minimum `44px` target; no field value is independently tappable.

### Keyboard

- Tab order remains DOM order: hotel CTA, **Details**, then subsequent focusable controls. Static parking facts receive no `tabIndex`.
- `Enter` or `Space` on **Details** toggles expansion through the native button behavior.
- The control maintains `aria-expanded` and `aria-controls="hotel-details-{offerId}"`.
- On expansion/collapse, focus stays on **Details**. Do not move focus into **Parking** and do not scroll the section automatically.
- If a real retry callback exists, `Retry parking check` follows section text in tab order and keeps focus through status changes.

### Screen reader and live status

- The expanded region referenced by `aria-controls` contains a landmark section labelled **Parking**.
- Each option is a list item/group labelled `Parking option {n}`; its facts are read in the fixed six-field DOM order.
- Visible text carries all meaning; icons/dots are `aria-hidden="true"` and color is never the only distinction.
- Initial loading, refresh completion, and retrieval error use one `role="status" aria-live="polite" aria-atomic="true"` per parking surface. Do not nest live regions.
- Preserve known evidence during refresh so the live region announces only `Refreshing parking details…` and completion, not the entire section.
- A user-triggered retry failure remains polite; parking is important but does not block access to the hotel review.
- Dynamic updates never move focus.
- Collapsed visible copy is the accessible copy. Do not attach an aria-label that adds stronger certainty than the visible words.

## Responsive specification

### Mobile: 375px viewport

- Hotel card stays one column with `min-w-0`; hotel name/rate retain their existing layout.
- Parking summary occupies its own full-width row below identity/location evidence and above actions.
- Use `whitespace-normal break-words`; never `truncate`, line-clamp, fixed height, or horizontal scrolling.
- Summary may wrap to three lines. The nightly rate, Deal Score, **Review hotel**, and **Details** remain visible and undisplaced in their existing order.
- Expanded **Parking** uses one option column and one fact column. Each label/value pair stacks; `gap-y-3`.
- Multiple options stack vertically with a border divider and at least `16px` separation.
- Booking review is one column; parking section precedes partner CTA content. CTA remains full width.
- Long provider names fall back to normalized display names and wrap; long parking addresses use `break-words` and are never placed in analytics/booking URL.

### Desktop: 1280px viewport

- Card summary may render as one compact row but must wrap within its card column instead of squeezing the rate/actions.
- Expanded detail stack remains full card width. A single option may use a two-column fact grid; each option is never split into separate sibling cards.
- Two parking options stack as two full-width grouped units, not side-by-side comparison cards; this preserves the fixed reading order and prevents false ranking.
- Booking review can use the existing centered desktop shell. Each option uses a two-column fact grid; **Before you pay** spans both columns.
- No new fixed widths. Use `min-w-0`, `max-w-full`, and the existing page/card constraints.

## Tailwind and token patterns

Use only existing tokens from `app/globals.css`:

- page/card background: `bg-[color:var(--bg-base)]`, `bg-[color:var(--bg-surface)]`, `bg-[color:var(--bg-raised)]`
- neutral borders: `border-[color:var(--border)]`, stronger separation `border-[color:var(--border-strong)]`
- text: `text-[color:var(--text-1)]`, `text-[color:var(--text-2)]`, `text-[color:var(--text-3)]`
- selected-stay confirmation only: `text-[color:var(--success)] bg-[color:var(--success-soft)]`
- unresolved/conflict: `text-[color:var(--warning)] bg-[color:var(--warning-soft)]`
- retrieval failure: `text-[color:var(--error)] bg-[color:var(--error-soft)]`
- keyboard focus: global `:focus-visible`, `--focus-outline`, and `--focus-ring`; do not override with `outline-none` unless equivalent visible focus is restored
- radii: `rounded-lg` for inset groups and `rounded-[var(--radius-card)]` for card-level sections
- type: `text-h3` only for a page-level parking heading if one is later introduced; card section heading `text-sm font-bold`; facts `text-small`; tertiary provenance `text-caption`

Do not add colors, shadows, decorative badges, or vehicle illustrations.

## Edge cases

| Edge case | Required behavior |
|---|---|
| Facility confirmed, every other field unknown | Show location/cost/rule/operator unknown explicitly and space not confirmed; never collapse to `Parking available` |
| Facility unavailable plus other populated fields | Treat as malformed/conflict; do not show cost/rule as a usable option |
| Nearby option without distance/address | Show `Nearby, off site`; omit detail line; do not substitute hotel location |
| Street option | Keep separate from nearby and on-site; do not infer operator |
| Paid amount is zero | Reject as inconsistent unless supplier explicitly maps it to included; do not show `$0` as proof of included parking |
| Negative/float/unsafe amount | Reject parking snapshot as malformed; do not format |
| Unsupported currency | Show paid amount not provided; do not convert in UI |
| Amount currency differs from room currency | Show the supplier parking currency as given; do not convert or combine with room price |
| Exact amount, unknown basis | Show amount plus `charge basis not provided`; do not calculate stay total |
| Reservation required/requestable, space unknown | Show required/request copy and `space not confirmed`; never reserved/guaranteed |
| Reservation not accepted | Show exact copy; do not infer no facility or first-come status |
| Public/private only | Operator remains `Operator not provided` |
| On-site plus third-party | Show both dimensions; do not imply hotel operation from location |
| Selected-stay unavailable but property facility confirmed | Show `No space reported for these dates`; retain property option facts |
| Selected-stay confirmed but retrieval refresh fails | Preserve confirmation with source time and append latest-check warning; do not silently recast as current |
| Duplicate source records | Retain distinct options unless normalized identity is proven; never merge only because both are on-site |
| Two providers conflict | Unknown the conflicted dimension and show conflict copy; never choose cheapest/friendliest value |
| Provider returns no fields | `Parking details not provided`, not `No parking` |
| No dates in search | Use `a selected stay`, not `these dates`; selected-stay state should normally remain not returned |
| Very long localized currency/provider/address | Wrap; no truncation of space/cost qualifiers; bounded values only in booking transport |
| JavaScript/observer unavailable | All content and interactions remain usable; analytics absence does not change UI |

## Bounded measurement specification

Instrumentation begins only after `HotelCard` is mounted in an actual results flow. Test fixtures do not count as production exposure.

### Shared properties

Allowed bounded properties:

- `searchId`: ephemeral opaque search-session ID; never raw origin/destination/query
- `offerId`: existing normalized offer ID
- `provider`: normalized provider ID
- `surface`: `results_card` or `booking_review`
- `viewportGroup`: `mobile_375_767` or `desktop_768_plus`
- `optionCountBucket`: `0`, `1`, `2_plus`
- `completenessBucket`: `none`, `facility_only`, `partial`, `comparison_ready`, `stay_confirmed`, `explicit_none`
- `facilityState`: `confirmed`, `explicit_none`, `not_returned`, `unknown`
- `locationState`: `on_site`, `nearby_off_site`, `street`, `mixed`, `unknown`
- `spaceState`: `confirmed_selected_stay`, `unavailable_selected_stay`, `not_returned`, `unknown`
- `costState`: `included`, `paid_exact`, `paid_amount_unknown`, `unknown`
- `reservationState`: `required`, `not_required`, `not_possible`, `requestable`, `first_come`, `unknown`, `mixed`
- `operatorState`: `hotel`, `third_party`, `unknown`, `mixed`
- `evidenceRevision`: stable internal schema/version label

Never emit raw address, distance, URL, provider prose, source label, exact parking amount, hotel name, or free text.

### Completeness rules

- `none`: all dimensions are unknown/not returned.
- `facility_only`: facility known; location, cost, reservation, and operator all unknown/not returned.
- `partial`: facility plus at least one but not all comparison dimensions known.
- `comparison_ready`: facility, location, cost, reservation, and operator known; selected-stay space not confirmed.
- `stay_confirmed`: comparison-ready and selected-stay space explicitly confirmed.
- `explicit_none`: supplier explicitly reports no parking option; remaining option fields are not applicable.

### Events

1. `hotel_parking_signal_impression`: 50% of collapsed summary visible for 500 continuous ms. Deduplicate by `searchId + offerId + surface + evidenceRevision`.
2. `hotel_parking_details_opened`: fire per user activation when **Details** opens and the region contains a parking section. This is disclosure demand, not section review.
3. `hotel_parking_section_reached`: 50% of parking section visible for one continuous second. Deduplicate with the same key and store an in-memory reviewed timestamp for that search/offer.
4. `hotel_property_rejected_after_parking_review`: only after valid reach and before handoff when user opens another offer or activates a separately approved parking refinement. `rejectionAction`: `opened_other_offer` or `parking_refinement`.
5. `hotel_handoff_after_parking_review`: same offer had valid reach, then **Review hotel** or external CTA activated. `handoffStage`: `result_to_review` or `review_to_partner`.
6. `hotel_unresolved_parking_handoff`: emit beside `review_to_partner` when completeness is neither `stay_confirmed` nor `explicit_none` and a critical dimension remains unresolved. `unknownDimensionCountBucket`: `1`, `2`, `3_plus`.
7. Existing `hotel_handoff_returned`: add only `completenessBucket` and `spaceState` from validated context. Report return after unresolved handoff, never return because of parking.

Do not infer rejection from tab close, browser abandonment, timeout, or generic browser back. A generic **Details** click is not a parking review.

### Coverage denominators

Compute on unique displayed hotel offers per search, segmented by normalized provider, destination market, date presence, and viewport:

- any-evidence coverage: any supplier-returned dimension, including explicit negative / all offers
- facility coverage: confirmed or explicit none / all offers
- comparison-ready coverage: facility/location/cost/reservation/operator known / all offers
- selected-stay coverage: confirmed or unavailable stay-scoped evidence / offers with valid check-in and checkout
- unknown share by dimension: unknown or not returned / all offers

No metric may treat an inferred fallback as coverage.

## Acceptance tests for UI and DEV

1. Fixtures for on-site, nearby, street, explicit none, not returned, unknown, conflict, selected-stay confirmed, and selected-stay unavailable produce distinct visible and screen-reader text.
2. No fixture says or implies a space unless `selectedStaySpace='confirmed_for_selected_stay'`.
3. Required, requestable, not accepted, and first-come rules never produce reserved/guaranteed copy.
4. Hotel-operated and third-party are independent of on-site/nearby/public/private.
5. All six facts have visible unknown outcomes, in the same DOM order on 375px and 1280px.
6. Initial loading, stale refresh, empty/not returned, malformed, conflict, and error preserve the exact state copy above.
7. Expansion by mouse, Enter, and Space retains focus on **Details** and updates `aria-expanded`/`aria-controls`.
8. Polite status updates do not move focus or re-announce the entire known option list.
9. Booking serialization/parsing round trip preserves no more than two normalized options, all bounded enums, safe integer money, and evidence revision; rejects malformed/oversized parking without breaking a valid hotel review.
10. The result and booking-review surfaces render the same facility/location/cost/reservation/operator/space certainty.
11. Provider CTA accessible name says `Parking space not confirmed` unless explicit stay-scoped confirmation exists.
12. Parking amount is never added to room total or Deal Score.
13. At 375px no parking copy overlaps, truncates a critical qualifier, or displaces rate, Deal Score, location, **Review hotel**, or **Details**.
14. At 1280px each option stays a single grouped reading unit.
15. Impression/reach events meet visibility durations, are deduplicated, and contain only the allowed bounded properties.

## Delivery split and handoff

### UI stage

- Implement `HotelCard` collapsed summary and dedicated expanded section for every state.
- Remove only parking from **Access & room requests**; preserve other access contracts and exports.
- Implement booking-review parking section, status-driven next step, responsive layouts, and accessibility behavior against typed props.
- Add component fixtures/tests for visible copy, ordering, responsive classes, keyboard semantics, and CTA accessible names.
- Do not invent provider data or change external API/business logic.

### DEV stage required after UI

- Add provider-neutral parking types and normalization in `lib/types.ts`/`lib/providers` with `Result<T>` boundaries.
- Map only supplier-supported dimensions; current Hotellook gaps remain not returned.
- Add parking-specific loading/error state from the search layer without conflating `ready` with completeness.
- Add bounded `BookingHotelContext` transport, validation, and round-trip tests.
- Add analytics sequencing/deduplication and only activate it once a real results surface supplies `searchId` and mounts `HotelCard`.
- Preserve integer-minor-unit money and affiliate markers.

### Explicitly out of scope

- Parking reservation or payment in expaify
- Maps, directions, parking security, accessible bays/routes, EV charging, valet/self-park, vehicle clearance, hours, or cancellation policy collection
- Parking filter/ranking or Deal Score changes
- Estimated parking totals or combining parking with hotel price history
- Inferring operator, amount, basis, location, or space from unstructured supplier prose in a component
- Choosing the production result route to mount `HotelCard` without a separately scoped product/implementation decision

## Success and validation

Prototype with 8–10 drivers who treat parking as a requirement, counterbalancing 375px and 1280px. Trust-critical tasks—facility versus selected-stay space, on-site versus nearby, operator, cost certainty, reservation versus guarantee, and undocumented versus unavailable—each require at least 85% correct, with no more than one participant making a false space-guarantee claim in any condition.

This design is ready for UI implementation once the typed prop boundary is agreed. End-to-end continuity remains dependent on DEV-owned normalized transport/provider mapping and a live result-surface wiring decision.
