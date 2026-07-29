# UXR-HOTEL-GUEST-COUNT-CLARITY-01: Hotel Guest-Count Fit Research

Date: 2026-07-29
Stage: UX Research (UXR)
Persona: Senior UX Researcher
Ticket: UXR-HOTEL-GUEST-COUNT-CLARITY-01 (P1)
Upstream: `docs/pipeline/hotel-guest-count-clarity/01-discovery.md`

Files read for this brief (verified, not assumed):
`lib/hotels/searchCriteria.ts`, `lib/hotels/__tests__/searchCriteria.test.ts`,
`app/components/HotelSearchCriteria.tsx`, `app/deals/DealFeed.tsx`,
`app/components/HotelCard.tsx`, `app/deals/[dealId]/page.tsx`,
`app/book/BookingFlow.tsx`, `app/components/ui/CompareRow.tsx`,
`lib/pipeline/otaLinks.ts`, `lib/pipeline/snapshot.ts`, `app/api/deals/route.ts`,
`lib/types.ts`, `app/api/analytics/route.ts`, `app/components/FlightCard.tsx`.

---

## 1. Discovery Claims: Verification Status

Every structural claim in the discovery doc reproduces against current code. Line
references re-verified in this worktree.

| Discovery claim | Status | Verified at |
|---|---|---|
| `occupancy.applied` variant is unreachable | **Confirmed** | `searchCriteria.ts:11-13` declares it; the only two constructors hardcode `not_captured` (`:120`, `:182`) |
| `HotelCriteriaDraft` has only city/dateFrom/dateTo | **Confirmed** | `searchCriteria.ts:17-21`; `hotelCriteriaDraftChanged` compares exactly those three (`:125-128`) |
| URLs carrying `adults`/`rooms`/`occupancy` resolve `invalid` | **Confirmed** | `searchCriteria.ts:162-164`; asserted as intended behaviour by test `searchCriteria.test.ts:59` |
| Editor renders a dead read-only guests panel | **Confirmed** | `HotelSearchCriteria.tsx:230-234` — three `<p>` elements, no control, no action |
| `occupancy_state` / `room_state` can only emit `not_captured` | **Confirmed, and worse than stated** | `HotelSearchCriteria.tsx:42-43` and `DealFeed.tsx:1378-1379` read the (constant) criteria value; `CompareRow.tsx:131-132` does not read criteria at all — it **hardcodes the string literal** `'not_captured'` |
| `changed_fields` cannot carry a guest dimension | **Confirmed** | `DealFeed.tsx:878-882` builds the list from destination/date_from/date_to only |
| `priceBasis` qualifies taxes, never headcount | **Confirmed** | single-valued union `lib/types.ts:481`; rendered `HotelCard.tsx:359`, `HotelCard.tsx:1047`, `app/deals/[dealId]/page.tsx:379`, `BookingFlow.tsx:241-242,354,1029` |
| Occupancy stripped outbound in two places | **Confirmed** | `otaLinks.ts:18-30` emits only name/city/checkIn/checkOut; `CompareRow.tsx:55-66` rejects any link whose params — or nested `u` param — contain `adults`/`rooms`/`children`/`child_ages` |
| Flights already ship a party scope; hotels do not | **Confirmed** | `FarePriceScope` (`lib/types.ts:4`) → `FlightCard.tsx:450-453`; hotel handoff name recites price, tax basis, and smoking status, never headcount (`BookingFlow.tsx:1029`) |
| `HotelOffer` carries no occupancy/capacity field | **Confirmed** | `lib/types.ts:474-495` |

**One correction to the discovery's framing.** Discovery treats the price's
occupancy assumption as unknown to expaify — "the provider applies **its own
default**." For the displayed price that is not accurate, and the difference
matters for the whole solution. See §2.

---

## 2. The Decisive Finding: The Assumption Is Already Known

The nightly price rendered on `/deals` traces to `price_snapshots` rows written by
`runSnapshotsForMarket` (`lib/pipeline/snapshot.ts:205-209`). All three
acquisition providers are queried at a **fixed, hardcoded occupancy**:

| Acquisition path | Occupancy in the request | Line |
|---|---|---|
| booking-com15 (city `dest_id`) | `adults=2&room_qty=1` | `snapshot.ts:80` |
| booking-com v1 (coordinates) | `adults_number=2&room_number=1` | `snapshot.ts:114` (`room_number=1` at `:112`) |
| tripadvisor16 (`geoId`) | `adults=2&rooms=1` | `snapshot.ts:153` |

So the shown rate is not occupancy-unqualified in the data layer — it is a
**2-adult, 1-room rate**, uniformly, across every live provider. The
unqualified-ness exists only in the UI copy and in the type
(`priceBasis` has no occupancy dimension, `lib/types.ts:481`).

Two consequences:

1. The disclosure expaify owes the traveler is a **statement of fact**, not a
   hedge. "This rate was collected for 2 adults in 1 room" is verifiable against
   `snapshot.ts`. Nothing has to be invented, and constraint 1 (no invented
   capability) is fully satisfied by a factual price-basis label.
2. Because the basis is a *constant of acquisition* and not a *function of the
   request*, occupancy can never be a pricing or filtering input in this
   architecture. Re-querying at 3 adults is not possible: there is no live hotel
   provider (`lib/providers/hotellook.ts` returns empty; it contains no
   occupancy parameter at all) and the snapshot job runs nightly on a fixed
   golden-route set.

**Caveat the design must handle:** `app/api/deals/route.ts:98` can serve rows with
`isMock: true`, which have no acquisition provenance. A hardcoded "2 adults, 1
room" string in JSX would be a false claim on those rows. The basis must therefore
travel as **data with an `unknown` state**, not as a literal in a component.

---

## 3. Reference Patterns

### 3.1 Booking.com — occupancy as a pricing input

Occupancy is a first-class, always-visible search field (Adults / Children /
Rooms stepper), defaulted to 2 adults / 0 children / 1 room, persisted in the URL
(`group_adults`, `group_children`, `age`, `no_rooms`), echoed back in the search
bar on the results page, and **re-priced on change** — every rate on the results
page is a rate for the stated party. Child ages are mandatory per child because
child pricing and eligibility depend on them. Rooms that cannot hold the party are
labelled, and the property card states the basis explicitly ("Price for 2 nights,
2 adults").

**Why this pattern is not available to expaify:** it requires per-request
occupancy-aware pricing. expaify's price is a nightly snapshot captured at a fixed
occupancy. Adopting Booking's interaction pattern — a stepper that changes the
result set or the prices — would produce prices that do not respond to the input,
which is a worse trust failure than the current silence.

### 3.2 Google Hotels — occupancy as declared context plus a price-basis footnote

Google's guest control is a filter chip in the filter row, not a required field,
and — the part that matters here — every price surface carries an explicit basis
footnote ("Prices are for 1 room, 2 guests" / nightly-vs-total toggle with its
scope named). Google separates two jobs that expaify has collapsed into one
silence:

- **What did you tell us about your party** (declared context), and
- **What does this number cover** (price basis disclosure).

Google can also re-query partners on guest change; the basis footnote, however, is
independent of that capability. It is a labelling contract, not a pricing one.

### 3.3 The delta

| Job | Booking.com | Google Hotels | expaify today | Honest target |
|---|---|---|---|---|
| Capture party | Required field, re-prices | Optional filter, re-queries | **Nothing.** Dead panel (`HotelSearchCriteria.tsx:230-234`) | Optional declared field, **does not** re-price or filter |
| Carry party | URL + search bar + card | URL + chip | **Rejected from URL as invalid** (`searchCriteria.ts:162-164`) | URL round-trip → summary → card → handoff |
| Disclose price basis | "for 2 adults" per card | "Prices are for 1 room, 2 guests" | "per night before taxes and fees" only | One canonical occupancy-basis string sourced from data |
| Reconcile party vs basis | Not needed (they match) | Not needed (they match) | Not possible (neither exists) | **Explicit mismatch statement** — expaify's differentiating requirement |
| Pass party to provider | Native | Native | Stripped, twice, deliberately (`otaLinks.ts:18-21`, `CompareRow.tsx:55-66`) | Stripping retained; the **fact of stripping is disclosed** |

---

## 4. Resolution of the Open Question

> Should party size be a filtering input or a declared-and-disclosed context
> value, given `HotelOffer` carries no capacity data and the hotel provider
> returns empty?

**A declared-and-disclosed context value. Not a filter, not a re-pricing input,
not a Deal Score input.** Three independent reasons, each grounded in code:

1. **Filtering has no data to filter on.** `HotelOffer` (`lib/types.ts:474-495`)
   has no capacity, bed, or child-policy field, and per the sibling brief
   (`docs/pipeline/guest-room-fit/`) no provider path ever returns one. A guest
   filter would either drop nothing (useless) or drop offers on a fabricated
   capacity rule (dishonest).
2. **Re-pricing is architecturally impossible.** Prices are nightly snapshots
   captured at fixed 2-adult/1-room occupancy (§2). A control that changes party
   size and leaves every price identical *teaches the user the prices are
   party-adjusted when they are not* — it manufactures exactly the false
   confidence this ticket exists to remove.
3. **Declaration alone closes the actual loop.** The discovery's failure mode is
   "a number with no denominator and a handoff with no memory." A declared party
   plus a factual basis label yields the one sentence the traveler needs — *"you
   said 4; this price covers 2; set your party at the provider"* — which is
   strictly more useful than a filter that silently narrows results on invented
   capacity.

This is deliberately **half of Google's pattern**: the price-basis footnote and
the declared-context chip, without the partner re-query that expaify cannot
perform. The half that is omitted is the half that requires data we do not have.

**Corollary — party size must never gate results.** No offer may be hidden,
reordered, badged, or re-scored on the basis of a declared party. `hotelCriteria
ContextStatus` (`searchCriteria.ts:286-297`) must keep comparing destination and
dates only; adding occupancy to the `mismatch` verdict would suppress provider
options (`HotelSearchCriteria.tsx:268`) for a fit expaify cannot assess.

---

## 5. Design Directives

Five directives, each testable. Copy strings are final; UXDES may re-place them
but must not re-word them without stating why.

### D1 — Capture adults and children in the criteria editor. No rooms input. No child ages.

Replace the dead panel at `HotelSearchCriteria.tsx:230-234` with two real number
inputs inside the existing `<fieldset>` idiom, and extend
`HotelCriteriaDraft` (`searchCriteria.ts:17-21`) with `adults: string` and
`children: string` (string-typed to match the existing date-field draft
convention, validated like `isValidHotelDate`).

- Legend: **`Guests`**
- Label 1: **`Adults`** — integer, bounds **1–8 inclusive**, empty allowed.
- Label 2: **`Children`** — integer, bounds **0–6 inclusive**, empty allowed.
- Helper under the pair: **`Guest counts are carried with your search. They don't change which deals are shown or what they cost.`**
- Adults error: **`Enter 1 to 8 adults, or leave blank.`**
- Children error: **`Enter 0 to 6 children, or leave blank.`**
- Empty-adults-with-children error: **`Add the number of adults travelling with the children.`**

Both blank → `occupancy: { state: 'not_captured' }`. Adults present →
`occupancy: { state: 'applied'; adults; children: children || 0; childAges: []; rooms: 1 }`.

**No rooms input.** The basis is 1 room (§2) and expaify cannot price a second
room; offering the field implies a capability that does not exist. `rooms` stays
in the type, pinned to `1`, and appears only inside the basis disclosure (D3) as a
property of the *price*, never as a property of the *user's input*.

**No child ages.** `childAges` stays `[]`. Booking.com requires ages because ages
drive its pricing and eligibility; expaify has neither, so the field would be pure
intake burden with no consumer. UXDES must document this in the spec so a later
stage does not read `childAges: []` as an oversight.

**Residual, stated plainly:** with `rooms` pinned to 1, the `room_state` analytics
dimension (`app/api/analytics/route.ts:133`) still has zero variance. It moves
from `not_captured` to `applied` in lockstep with `occupancy_state` and carries no
independent information. Either document it as a duplicate of `occupancy_state` or
retire it; do not leave it looking like a live dimension.

### D2 — Round-trip the party in the URL under new keys. Legacy occupancy keys degrade, they do not collapse.

The existing rejection of `adults`/`rooms`/`occupancy` (`searchCriteria.ts:162-164`)
is protecting something real: a legacy or partner link carrying `adults=2` cannot
be distinguished from the acquisition default, and promoting it to
`occupancy.state === 'applied'` would put words in the traveler's mouth. Removing
the guard outright would trade a visible failure for a silent lie.

Resolution — namespace declared intent, and demote the legacy keys:

- Emit and parse **`party_adults`** and **`party_children`** in
  `buildHotelResultsUrl` (`searchCriteria.ts:188-207`) and
  `resolveHotelSearchCriteria` (`:136-186`). Add both to the `singletonKeys`
  list (`:140-143`) so duplicates remain `invalid`. Out-of-bounds or non-integer
  values are `invalid` — a malformed party is never partially trusted, matching
  the existing date discipline.
- `adults`, `rooms`, and `occupancy` stop being `invalid` triggers and become
  **ignored** keys: they resolve to `not_captured` and the search proceeds. They
  are not traveler intent, so they must not be honoured; they are also not
  corruption, so they must not destroy the search.
- `market_id` and `criteriaReturn` guards are untouched.
- `schemaVersion` stays `1`. No URL already in the wild changes meaning: it either
  carried no party keys (unchanged) or carried legacy keys (previously a hard
  error page, now a working search).

**Test debt this creates, flagged for DEV/TEST:**
`lib/hotels/__tests__/searchCriteria.test.ts:59` currently asserts
`&adults=2` → `invalid`, and `:50-51` asserts the built URL contains no
`adults`/`rooms`. Both encode the old decision. The first must become an
assertion that `adults=2` resolves `valid` with `occupancy.state ===
'not_captured'`; the second still holds verbatim (the new keys are
`party_adults`/`party_children`, so `params.has('adults')` stays false) and should
be kept as the regression guard that declared intent never leaks into the legacy
namespace.

### D3 — One canonical price-basis string, sourced from data, on every surface that shows a nightly price.

Add an occupancy dimension to the price basis rather than overloading
`priceBasis` (`lib/types.ts:481`), which is a tax-scope union and should stay one.
Mirror the flights precedent (`FarePriceScope`, `lib/types.ts:4`):

```
export type HotelPriceOccupancyBasis =
  | { state: 'known'; adults: number; rooms: number }
  | { state: 'unknown' }
```

carried on `HotelOffer` and on the deal payload from `app/api/deals/route.ts`.
Live snapshot rows resolve to `{ state: 'known', adults: 2, rooms: 1 }` — a value
derived from the acquisition constants in `lib/pipeline/snapshot.ts:80,114,153`,
not typed into a component. Rows with `isMock: true`
(`app/api/deals/route.ts:98`) resolve to `{ state: 'unknown' }`.

Canonical strings — **one per state, used verbatim at `HotelCard.tsx:359`,
`HotelCard.tsx:1047` (the existing "Price scope" panel), `app/deals/[dealId]/page.tsx:379`,
and `BookingFlow.tsx:241-242`:**

- `known`: **`Priced for 2 adults, 1 room`** (counts interpolated), rendered as a
  second line beneath the existing **`per night before taxes and fees`**. The tax
  basis line is not replaced — the two answer different questions and both are
  needed.
- `unknown`: **`Occupancy this rate covers isn't recorded`**
- Expanded / detail long form, one sentence:
  **`This rate was collected for a search of 2 adults in 1 room. A different party can change the price — confirm it with the provider.`**

The three divergent existing phrasings the discovery catalogued
(`HotelSearchCriteria.tsx:64`, `:233`, `:252`) collapse into this set. The
implementation-facing string **`This version of expaify can't filter hotel deals
by party size yet`** (`:233`) is deleted outright — it describes expaify's roadmap,
not the user's price.

### D4 — Reconcile the declared party against the basis, in words, wherever the party is shown.

This is the directive with no equivalent at Booking.com or Google Hotels, because
neither ships a price whose occupancy can differ from the user's stated party.
Compare `criteria.occupancy` against the offer's `HotelPriceOccupancyBasis` and
render exactly one of four states. Replace the flat string at
`HotelSearchCriteria.tsx:62-66` and the sr-only string at `:66` /
`DealFeed.tsx:903`:

| State | Condition | Copy |
|---|---|---|
| `not_captured` | occupancy not captured | **`Guests not captured`** / sub: **`Add your party size so expaify can tell you what these prices assume.`** |
| `match` | captured; adults equal basis adults; children = 0 | **`2 adults`** / sub: **`Matches what these prices were collected for.`** |
| `differs` | captured; any difference | **`3 adults, 2 children`** / sub: **`These prices were collected for 2 adults in 1 room, so your price will differ. Set your party size at the provider.`** |
| `basis_unknown` | captured; basis `unknown` | **`3 adults, 2 children`** / sub: **`We can't confirm what occupancy this price covers. Check it with the provider.`** |

Party rendering rules, fixed so all surfaces agree: `N adult`/`N adults`;
children appended only when non-zero as `, N child` / `, N children`. Screen-reader
string is the same text with the `·` separators spoken as sentence breaks, matching
the existing `sr-only` pattern at `HotelSearchCriteria.tsx:66`.

Explicitly **not** permitted by this directive: any variant of "fits your party",
"sleeps N", "room for N", or a badge/icon implying verified capacity. Bed
configuration, per-room capacity, and child policy belong to
`docs/pipeline/guest-room-fit/`; which room the price describes belongs to
`docs/pipeline/hotel-room-choice-clarity/`.

### D5 — State at the handoff that the party is not passed, and make the funnel measurable.

**Handoff disclosure.** The occupancy-stripping decisions at `otaLinks.ts:18-21`
and `CompareRow.tsx:55-66` stay exactly as they are — one approved Travelpayouts
marker, no fabricated occupancy params, `isAttributedHotelProviderUrl` unchanged.
What changes is that the stripping stops being invisible. Add to the handoff
summary (`HotelSearchCriteria.tsx` `surface === 'handoff'` branch, `:48-52`) and to
the continue-button accessible name (`BookingFlow.tsx:1029`), after the existing
price and tax basis and before the smoking-status clause:

- captured: **`Your party size isn't sent to the provider. Set 3 adults and 2 children on their site before comparing the price.`**
- not captured: **`Your party size isn't sent to the provider. Set your party size on their site before comparing the price.`**

**Analytics.** Three fixes, in order of severity:

1. `CompareRow.tsx:131-132` hardcodes `occupancy_state: 'not_captured'` and
   `room_state: 'not_captured'` as literals. Once D1 lands this event reports a
   falsehood on every captured-party handoff. Thread the real value through
   `HotelHandoffAnalyticsContext` (`CompareRow.tsx:12-18`), which today carries
   `contextStatus`, `criteriaVersion`, `destinationPresent`, and `dateState` but
   no occupancy field. **This is the one place where shipping D1 without the
   analytics change actively corrupts data rather than merely under-reporting.**
2. Add `'guests'` to the `changed_fields` list built at `DealFeed.tsx:878-882`
   when adults or children changed, so criteria-edit friction on the guest
   dimension becomes visible (discovery signal 3.3). `hotelCriteriaDraftChanged`
   (`searchCriteria.ts:125-128`) must compare the new draft fields or the Update
   button stays disabled for a guests-only edit — a silent dead end.
3. Add one new dimension, **`party_vs_basis`**, values
   `['match', 'differs', 'basis_unknown', 'not_captured']`, to
   `hotel_criteria_summary_viewed`, `hotel_results_viewed`, and
   `hotel_provider_handoff_clicked` (`app/api/analytics/route.ts:14,18,23`, with
   the value validator alongside `:133`). `occupancy_state` answers "did we ask";
   only `party_vs_basis` answers the discovery's actual question — how many
   handoffs leave with a party the price never covered. Without it,
   mismatched-party handoffs remain unmeasurable even after `occupancy_state`
   starts varying.

---

## 6. States UXDES Must Specify

Derived from the surfaces audited; every one of these exists in code today and
will render a guest-count state after D1–D5.

- **Criteria summary** (`HotelSearchCriteriaSummary`, three surfaces: `results`,
  `detail`, `handoff`) × four D4 states × `status: 'ready' | 'updating'`.
- **Criteria editor** (`HotelSearchCriteriaEditor`): default, blank, valid,
  out-of-bounds adults, out-of-bounds children, children-without-adults,
  submitting, unchanged-draft (submit disabled), and the retry path that reopens a
  failed draft via `initialDraft` (`HotelSearchCriteria.tsx:113-118`).
- **Context card** (`HotelCriteriaContextCard`): `missing` and `invalid`, with
  `invalid` no longer reachable via legacy occupancy params (D2).
- **Offer card** (`HotelCard`): collapsed price (`:359`) and expanded "Price
  scope" panel (`:1045-1047`), each × `known` / `unknown` basis, plus the existing
  `PriceUnavailable` path (`:368`) which shows no basis at all.
- **Detail page** (`app/deals/[dealId]/page.tsx:377-380`) × basis states,
  alongside the existing expired / stale / aging / fresh price-freshness variants.
- **Handoff** (`BookingFlow` hotel branch): summary block, continue-button
  accessible name (`:1029`), × captured / not-captured.
- **Viewports:** 375px and 1280px for all of the above. The summary stacks at
  `min-[420px]` (`HotelSearchCriteria.tsx:54`) and the editor's date pair is
  `grid-cols-1 min-[420px]:grid-cols-2` (`:215`) — the guests pair should follow
  the same breakpoint, and the added rows must not push the
  Cancel / Update actions (`:236-239`) out of the dialog's
  `max-h-[calc(100dvh-1rem)]` scroll container at 375px.
- **Keyboard:** the editor's focus trap queries
  `button, select, input` (`:148`); number inputs are picked up automatically, but
  tab order must place Guests after the check-in window and before the actions.
  New announcements route through the existing `role="status"` region (`:67-69`)
  and the `setStatusAnnouncement` path (`DealFeed.tsx:902`).

---

## 7. Out-of-Scope Findings (recorded, not actioned)

1. **`NIGHTS = 2` is also a hardcoded acquisition constant**
   (`lib/pipeline/snapshot.ts:4`), and the coordinate provider derives a nightly
   price by dividing a 2-night total (`:134`). The stay-length basis of the price
   is as undisclosed as the occupancy basis was. Owned by
   `docs/pipeline/hotel-total-stay-cost/` — flagged, not touched.
2. **`room_state` is structurally redundant** once `rooms` is pinned to 1 (D1).
   Recorded there; the decision to retire the dimension is larger than this
   ticket.
3. **Mock deals (`isMock: true`, `app/api/deals/route.ts:98`) show a price with no
   provenance of any kind.** D3's `unknown` state labels this honestly, but the
   deeper question — whether an unprovenanced price should be shown beside real
   ones — belongs to the price-visibility/freshness line of work.

---

## 8. Handoff

Next stage: **UXDES-HOTEL-GUEST-COUNT-CLARITY-01** (UX Design, Claude Fable 5).

Design must consume D1–D5 and produce `03-design.md` covering every state in §6
with final copy, Tailwind class patterns against the tokens in `app/globals.css`,
and the exact interaction rules for the guests fields (bounds enforcement,
error timing relative to the existing `attempted` flag, announcement text). The
open question from discovery is resolved in §4 and is not reopened at design:
party size is declared and disclosed, never a filter, never a re-pricing or
Deal Score input.
