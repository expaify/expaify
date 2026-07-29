# UXR-HOTEL-CHECKIN-LOGISTICS-01 — Check-In Logistics Research Brief

**Stage:** UX Research · **Priority:** P1 · **Feature slug:** `hotel-checkin-logistics`
**Upstream:** `docs/pipeline/hotel-checkin-logistics/01-discovery.md`
**Downstream ticket:** `UXDES-HOTEL-CHECKIN-LOGISTICS-01`

**Scope — exactly four fields:** late-arrival process, front-desk availability, check-in window, checkout time.
**Out of scope, not re-opened:** parking (shipped, `HotelParking.tsx`), airport/ground transfer, baggage storage, cancellation policy, deposits/holds.

---

## 1. Current-code audit

Every claim below is from source read in this worktree. Line numbers are current at time of writing.

### 1.1 `app/components/HotelCard.tsx` — collapsed row and expanded Details panel

**Expanded Details panel** (`HotelCard.tsx:987–1076`) renders, in order: `DealScorePanel`, `QualityEvidencePanel`, Location block, `ParkingSection`, `HotelPetPolicyDetails`, `TrackedSmokingPolicyPanel`, `AccessEvidencePanel`, Price scope / Rate check block, `HotelFundsPolicyPanel`, Provider handoff block, expanded photo.

**Confirmed: no check-in time, no desk hours, no late-arrival content, no checkout time anywhere in the panel.** The nearest adjacent surface, `AccessEvidencePanel` (`HotelCard.tsx:259–299`), covers elevator / step-free / room requests — physical access, not temporal access.

**Collapsed card, above the Details button** — the density budget the discovery constraint names. Elements that can render simultaneously at 375px:

| # | Element | Source |
|---|---|---|
| 1 | Hotel-class chip (stars + text) | `HotelCard.tsx:857–862` |
| 2 | Guest-rating chip | `HotelCard.tsx:863–871` |
| 3 | Elevator access chip | `HotelCard.tsx:874–881` (gated on `status==='confirmed' && certainty==='guaranteed' && scope==='property'`) |
| 4 | Location label + value (2 lines) | `HotelCard.tsx:882–887` |
| 5 | Eligibility line | `HotelCardEligibilityLine`, `HotelCard.tsx:906` |
| 6 | Parking summary row | `ParkingSummary`, `HotelCard.tsx:908–913` |
| 7 | Funds-policy summary | `HotelCard.tsx:915–926` |
| 8 | Pet-policy scan line | `HotelCard.tsx:928` |
| 9 | Smoking-policy line (2-line clamp) | `HotelCard.tsx:930–937` |
| 10 | Score chip + review CTA | `HotelCard.tsx:939–969` |

**Ten elements are already competing above the fold on a 375px card.** The chip budget in the discovery constraint is not a stylistic preference; it is the only remaining headroom. Note the precedent set by element 3: the elevator chip renders **only on confirmed, sourced, guaranteed, property-scoped evidence** — never on unknown. That gate is the pattern to copy.

### 1.2 `app/deals/[dealId]/page.tsx` — the label collision, confirmed

Five sections in the shipped decision order (`data-hotel-decision-section` values `property_stay`, `price_deal_score`, `hotel_fit`, `provider_handoff`, `supporting_evidence`, positions 1–5, at lines 347, 373, 399, 414, 427). **No logistics section exists.**

The collision is real and worse than discovery describes. Two distinct fields both surface as "check-in":

1. `page.tsx:352–356` renders `<dt>Check-in</dt>` over `checkInDisplay`, which is `fmtShort(deal.check_in_date)` — **a bare calendar date**, e.g. "Mar 12, 2026". Its sibling `<dt>Check-out</dt>` (`page.tsx:357–360`) is `addNights(...)` — also a calendar date, and *derived arithmetic*, not a property statement.
2. `deal.check_in_window` (`lib/db/schema.sql:135`, `TEXT NOT NULL`) is a **date-range string** — fixtures confirm the format: `'Sep 1 - Sep 3'` (`lib/email/__tests__/sendDailyDigest.test.ts:75`), `'Aug 1–3'` (`app/deals/__tests__/page.test.tsx:82`). It is rendered as prose in `LockedDealDetail` (`page.tsx:135`: "This {city} deal ({checkInWindow}) is locked…") and in `opengraph-image.tsx:17`. It flows through `lib/pipeline/dealDetection.ts`, `lib/email/sendDailyDigest.ts`, `app/deals/page.tsx`, `app/destinations/[city]/page.tsx`, and `lib/ai/generateHeadline.ts:133`.

So the string "check-in window" is **already spent** in this codebase on a date range, across six files and two rendered surfaces. A new time-of-day field named `checkInWindow` would collide at the type level and in the copy simultaneously. Additionally `SupplierSmokingStatement.checkin/checkout` (`lib/types.ts`) are stay-scoping dates on a policy statement — a third occupant of the same word.

Also relevant: the "Check-out" cell at `page.tsx:359` is computed by `addNights()`, i.e. expaify-derived, but presented in the same visual weight as provider-supplied facts. It is a date, so it is not a constraint-1 violation, but it establishes the exact failure mode the constraint forbids for times.

### 1.3 `app/book/BookingFlow.tsx` — `HotelHandoffReview`

`HotelHandoffReview` (`BookingFlow.tsx:684–…`) renders a "Check rooms with provider" section whose single catch-all line is (`BookingFlow.tsx:1079`):

> "The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms. Choose or confirm your dates there before comparing room options."

**Arrival timing is not named.** It is absorbed into "room details" and "terms". By contrast, parking gets a named, structured treatment on this same surface — `ParkingSection` accepts `bookingReview` and renders a dedicated "Before you pay" block with `getParkingBeforePay()` (`HotelParking.tsx:237–251, 336–341`). Parking earned a named line; arrival timing did not. That asymmetry is the delta to close on this surface.

### 1.4 `lib/providers/hotellook.ts` + `lib/types.ts` — zero-supply finding **confirmed**

`HotelOffer` (`lib/types.ts:474–495`) fields: `id, name, area, location?, stars, pricePerNight, priceBasis?, rating?, photoUrl?, deeplink, source, documentReadiness, hotelClass?, guestRating?, amenityEvidence?, accessEvidenceState?, fundsPolicy, smokingPolicy?, rateEligibility?, rateEligibilityCapability?`. **No time-of-day field of any kind. No desk-hours field. No arrival field.**

`HotellookProvider` (`lib/providers/hotellook.ts`) parses from the raw feed: `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType` (`:495–528`). `checkIn` appears exactly once (`:475`) — as a **query parameter** on the outbound URL (`&checkIn=${range.checkin}`), a stay date we send, not a property time we receive. Nothing temporal is parsed, normalized, or cached.

**Conclusion: the zero-supply finding holds without qualification.** Today, and for every offer in production, the honest state for all four fields is "not provided." Hard constraint upheld: the UI stage delivers the type, the panel, every state, the naming fix, and the instrumentation. Populating values is a separate DEV/provider ticket.

### 1.5 Existing evidence vocabularies — the three that already exist

Do not invent a fourth. Available in `lib/types.ts`:

| Vocabulary | Members | Where |
|---|---|---|
| `HotelEvidenceStatus` | `confirmed` / `unavailable` / `not_returned` / `unknown` | `:120–124` |
| `HotelQualityConfidence` (aliased `HotelAmenityConfidence`) | `verified` / `provider_only` / `inferred` / `unavailable` | `:104–108`, `:134` |
| Load state (`HotelParkingEvidence.state`, `HotelAccessEvidenceState`) | `loading` / `ready` / `error` | `:150`, `:193` |
| Envelope fields (parking precedent) | `evidenceRevision: string`, `conflict: boolean` | `:192–197` |
| Per-fact provenance | `sourceLabel: string`, `fetchedAt?: string` | throughout |

`HotelParkingEvidence` is the closest structural analogue and the model to follow: a load-state envelope wrapping per-item evidence, each item carrying its own status, source label and `fetchedAt`.

### 1.6 Analytics inventory

`HotelDecisionAnalytics` (`app/components/HotelDecisionAnalytics.tsx`) emits `hotel_detail_viewed` (`:50`) and `hotel_decision_section_reached` (`:98`) for any element carrying `data-hotel-decision-section`, gated on ≥50% visibility for 1000 ms (`:20–36`), one-shot per section. A delegated click handler emits `hotel_room_handoff_started` (`:125`) from `[data-hotel-provider]` and `hotel_detail_back_to_results` (`:135`) from `[data-hotel-back]`.

Existing event-name convention, verified across `app/` and `lib/`: `hotel_*`, snake_case, `noun_verb_past` (`hotel_handoff_viewed`, `hotel_invoice_need_changed`, `hotel_sort_changed`, `hotel_provider_handoff_clicked`). No arrival/logistics event exists. Discovery is correct that instrumentation is part of the deliverable.

---

## 2. Reference comparison — interaction pattern

Compared at pattern level only. No visual style is imported.

### 2.1 Booking.com — property "House rules"

- **Always-present, fixed-slot block.** House rules is a persistent, separately-headed block, reached from the property page. Rows appear in a fixed order whether or not the value is interesting. Absence of a row is not used as a communication channel.
- **Check-in and check-out are ranges, not points**: "From 15:00", "Until 11:00". The pattern treats the earliest-admission time as a *boundary*, not a fact about a moment.
- **Late arrival is modelled as an obligation attached to check-in, not as a separate time fact.** The canonical string is of the form "You'll need to let the property know in advance if you plan to arrive after HH:MM." It is an *action the user must take*, conditional on a cutoff — not a claim about who is at the desk.
- **Front-desk availability is a separate, plainly-worded row** ("Front desk is open 24 hours" / staffed hours / "self check-in with a keypad"). Where it is limited, it is stated as a constraint alongside the check-in row.

### 2.2 Google Hotels — check-in / check-out

- **Two values in a compact info block**, paired, low in the page hierarchy, below price and reviews. Confirms the discovery ranking of check-in/checkout as low-salience confirmation facts.
- **Omitted entirely when unknown.** No placeholder, no "not provided." Silence is the unknown state.
- **No late-arrival concept at all.** The surface does not attempt rank 1.

### 2.3 The deltas

| | Booking.com | Google Hotels | expaify today | Delta expaify must close |
|---|---|---|---|---|
| Block exists | Yes, fixed slots | Partial (2 fields) | **No** | Add one block, all four slots always rendered |
| Late arrival | Conditional **obligation** with cutoff | Absent | **Absent** | Adopt the obligation framing, not a time claim |
| Desk availability | Named row | Absent | **Absent** | Named row |
| Unknown handling | Rarely needed (direct property data) | Silent omission | n/a | **Neither reference solves our default case** |
| Naming | "Check-in / Check-out" unambiguous (no calendar date nearby) | same | **"Check-in" already bound to a calendar date** | Disambiguate before adding anything |

**Two deltas have no reference to copy.**

First, **the unknown state.** Booking.com contracts directly with properties and rarely has to render "we don't know"; Google omits silently. expaify has neither option — omission is exactly the failure mode discovery's success statement forbids, and it is our 100% case. The unavailable state must be designed from scratch, as a first-class state, and it is the *only* state that ships in this feature's first release.

Second, **the label collision.** Neither reference places a calendar date labelled "Check-in" adjacent to a time labelled "Check-in." expaify does (§1.2). The disambiguation is expaify-specific work with no pattern to borrow.

---

## 3. Priority-model validation — the ranking is right, the data model is inverted

Discovery's ranking: **late-arrival (1) > desk availability (2) > check-in window (3) > checkout (4)**, by decision impact.

**Validated as a display ranking.** Booking.com's House Rules confirms that late arrival is the only row that carries a *user obligation* — the only one whose neglect produces a failure rather than an inconvenience. Google Hotels confirms ranks 3–4 are low-salience confirmation facts. Nothing in either reference suggests reordering by impact.

### 3.1 The test discovery asked for: is the late-arrival answer expressible when desk hours are unknown?

**No. And this is the central finding of this brief.**

"Will they let me in at 23:40?" is not an atomic fact any provider returns. It is a *derivation* over at least three inputs:

```
admitted at T  ⟸  (desk is staffed at T)
               ∨  (a self check-in mechanism exists and operates at T)
               ∨  (a documented late-arrival arrangement covers T)
```

If desk availability is `not_returned` — the state of every offer today — then no disjunct is known true and none is known false. The derivation resolves to **`unknown`, and to nothing else**. There is no partial answer, no hedged answer, and critically no *reassuring* answer available from the remaining fields. A property with a documented 15:00 check-in time tells you nothing about 23:40.

This produces the inversion:

- **By decision impact:** late arrival ranks 1.
- **By evidence dependency:** late arrival ranks *last* — it is a derived verdict downstream of desk availability, which is the atomic, provider-suppliable fact.

**Both are correct and they must be reconciled in the model, not by reordering the display.** The panel leads with the late-arrival answer (impact order preserved) while the *type* treats desk availability as the primary evidence and late arrival as a resolver over it. The failure mode of getting this wrong is precise and severe: a model that stores `lateArrival` as an independent optional field invites a future adapter to populate it from a check-in time, or from a star class, or from a default — and that is the exact fabrication the hard constraint forbids. Making it a derived value with a single documented resolver makes the fabrication structurally unavailable, not merely prohibited by convention.

### 3.2 Consequent reorder — accepted with one change

Ranks 1–4 stand as **display order**. The change is to rank 1's framing: following Booking.com, late arrival renders as **an obligation and its cutoff**, not as a time. "Contact the property before arrival if you arrive after 22:00" is a shippable, verifiable statement. "Late check-in available" is not — it is a claim about admission that no provider field supports.

### 3.3 Scope-boundary check (discovery §4 asked for a conflict report if the model cannot cohere)

**No conflict to report.** The four fields are self-contained: the late-arrival derivation depends only on desk availability and any documented arrangement, both in scope. Transfer and baggage storage are *remedies* for the gaps these fields expose (early arrival → storage; late arrival → transfer timing), not inputs to them. One boundary rule follows, stated in D3 below: the check-in-window row may state the gap but **must not propose a remedy** — suggesting bag storage would assert an unverified facility and re-open out-of-scope ground.

---

## 4. Directives

Five directives. Each is exact and testable at TEST.

---

### D1 — One evidence type, three existing vocabularies, late arrival derived not stored

Add a single field to `HotelOffer` (`lib/types.ts`): `arrivalLogistics?: HotelArrivalLogisticsEvidence`. Optional, so every existing construction site (e.g. `app/deals/[dealId]/page.tsx:212–222`) stays valid.

Shape — reusing `HotelParkingEvidence` as the structural model, `HotelEvidenceStatus` for per-fact status, `HotelQualityConfidence` for confidence, `'loading' | 'ready' | 'error'` for load state. **No fourth vocabulary is introduced.**

```ts
export type HotelDeskAccessMode =
  | 'staffed_24h'
  | 'staffed_limited_hours'
  | 'self_check_in'
  | 'unknown'

export type HotelLateArrivalObligation =
  | 'contact_property_required'   // must notify in advance
  | 'no_action_required'          // admission not conditional on notice
  | 'not_accommodated'            // property states no admission after cutoff
  | 'unknown'

/** Property-local wall-clock time, 'HH:MM' 24h, verbatim from the provider. Never computed. */
export type HotelLocalTime = string

export interface HotelArrivalTimeFact {
  status: HotelEvidenceStatus            // confirmed | unavailable | not_returned | unknown
  time?: HotelLocalTime
  sourceLabel: string
  fetchedAt?: string
  confidence?: HotelAmenityConfidence    // verified | provider_only | inferred | unavailable
}

export interface HotelDeskAccessFact {
  status: HotelEvidenceStatus
  mode: HotelDeskAccessMode
  opensAt?: HotelLocalTime               // only when mode === 'staffed_limited_hours'
  closesAt?: HotelLocalTime
  sourceLabel: string
  fetchedAt?: string
  confidence?: HotelAmenityConfidence
}

export interface HotelLateArrivalFact {
  status: HotelEvidenceStatus
  obligation: HotelLateArrivalObligation
  cutoff?: HotelLocalTime                // the "after HH:MM" boundary, provider-stated only
  sourceLabel: string
  fetchedAt?: string
  confidence?: HotelAmenityConfidence
}

export interface HotelArrivalLogisticsEvidence {
  state: 'loading' | 'ready' | 'error'
  deskAccess: HotelDeskAccessFact
  lateArrival: HotelLateArrivalFact
  arrivalFrom: HotelArrivalTimeFact      // earliest admission time — NOT named checkInWindow
  departureBy: HotelArrivalTimeFact      // checkout time
  evidenceRevision: string
  conflict: boolean
}
```

**Naming is load-bearing, not cosmetic.** `arrivalFrom` / `departureBy`. The identifiers `checkInWindow`, `checkIn`, `checkOut`, `check_in_window` are **forbidden** for these fields — all four are already bound to date semantics in this repo (`deals.check_in_window` date-range string, `deal.check_in_date`, `SupplierSmokingStatement.checkin/checkout`, and the Hotellook outbound query param `checkIn`).

**The late-arrival answer is derived by exactly one exported pure function**, colocated with the panel:

```ts
export type LateArrivalAnswer = 'admitted' | 'conditional' | 'not_admitted' | 'unknown'
export function resolveLateArrivalAnswer(e?: HotelArrivalLogisticsEvidence | null): LateArrivalAnswer
```

Resolution rules, exhaustive and in order:

1. `!e` or `e.state === 'error'` or `e.conflict` → `'unknown'`.
2. `e.lateArrival.status === 'confirmed' && obligation === 'not_accommodated'` → `'not_admitted'`.
3. `e.lateArrival.status === 'confirmed' && obligation === 'contact_property_required'` → `'conditional'`.
4. `e.deskAccess.status === 'confirmed' && mode === 'staffed_24h'` → `'admitted'`.
5. `e.deskAccess.status === 'confirmed' && mode === 'self_check_in' && e.lateArrival.status === 'confirmed' && obligation === 'no_action_required'` → `'admitted'`.
6. **Everything else → `'unknown'`.** Specifically: `deskAccess.status !== 'confirmed'` can never produce `'admitted'`, and `arrivalFrom` / `departureBy` are **never inputs** to this function.

**Hard-constraint enforcement, all grep-testable:**
- No default, industry-standard, or star-derived time is written anywhere in delivered code. Forbidden literals in any non-test path: `'15:00'`, `'3:00 PM'`, `'11:00'`, `'noon'` as a fallback value; forbidden patterns: `?? '15:00'`, `time || '…'`.
- `confidence: 'inferred'` must not be constructed for any of these four facts in any production path. `'inferred'` exists in the shared union for other consumers; emitting it here would be a constraint violation and TEST must grep for it.
- `stars` / `hotelClass` must not be referenced by the logistics component or resolver. TEST greps the file.
- Any fixture with populated times lives only under `app/components/research/` (existing precedent: `hotelContinuityFixtures.ts`) and is unreachable from `HotelCard`, the deal page, and `BookingFlow`.

---

### D2 — The unavailable state is the default path and ships first, on all three surfaces

Because no provider returns these fields (§1.4), **`arrivalLogistics === undefined` is the production state for 100% of offers.** Design and implement this state first; every other state is the exception.

**Rule: the panel is never conditionally hidden.** No `{arrivalLogistics ? <Panel/> : null}`. The component receives the optional evidence and renders all four labelled rows regardless. This is the Booking.com fixed-slot pattern (§2.1) and the opposite of Google's silent omission (§2.2).

**Rendering, in the validated display order (§3.2):**

| Slot | Row label | Unavailable-state value | Verified-state form |
|---|---|---|---|
| 1 | Arriving late | "The property has not told us what happens if you arrive late." | Obligation + cutoff, e.g. "Contact the property before arrival if you arrive after 22:00." |
| 2 | Front desk | "Front desk hours not provided." | "Front desk open 24 hours." / "Front desk staffed 07:00–23:00." / "Self check-in." |
| 3 | Earliest arrival | "Earliest arrival time not provided." | "From 15:00." |
| 4 | Latest departure | "Latest departure time not provided." | "Until 11:00." |

Copy rules:
- Slot 1's unavailable copy attributes the gap to the property/provider — "has not told us" — never to a system failure, and never softened into implied availability.
- One action line closes the panel in every non-verified state: **"Confirm arrival and departure times with the booking partner before you book."** This mirrors `HotelParking.tsx:16`'s `confirmationCopy` pattern.
- **Slot 3 must not propose a remedy** (§3.3). Never suggest bag storage, an early-check-in request, or a nearby facility — all are unverified and out of scope.
- No time-of-day string appears in any unavailable-state copy.

**Load states**, reusing the parking precedent exactly (`HotelParking.tsx:295–333`): `state === 'loading'` with no returned facts → "Checking arrival details…" in a `role="status" aria-live="polite"` region with skeleton rows; `state === 'error'` → "Arrival details could not be checked." plus the action line; `conflict === true` → warning treatment and "Sources disagree about arrival details. Confirm the current details with the booking partner."

**Surface placement:**
- **`HotelCard.tsx` expanded panel:** insert between `ParkingSection` (`:1018`) and `HotelPetPolicyDetails` (`:1026`) — after the physical-access-adjacent parking block, before policy blocks. Do not displace `DealScorePanel`, `QualityEvidencePanel`, or Location.
- **`app/deals/[dealId]/page.tsx`:** a subsection inside the existing `hotel_fit` section (position 3, `:399`). It must **not** become a sixth top-level section — sections 1–5 and their `data-hotel-decision-position` values are unchanged. Non-negotiable: sections 1–4 are not displaced.
- **`app/book/BookingFlow.tsx`:** the catch-all at `:1079` gains "arrival and departure times" to its named list, and a named line follows the parking precedent (`getParkingBeforePay`, `HotelParking.tsx:237–251`): **"expaify has no arrival or departure times for this property. Confirm them with the booking partner before you pay — especially if you arrive late."**

**Testable at TEST:** render `HotelCard` with `arrivalLogistics` omitted → all four row labels present, four "not provided"-class values present, action line present, zero time strings, at 375px and 1280px with no overlap.

---

### D3 — Resolve the check-in label collision before adding any time field

Currently `app/deals/[dealId]/page.tsx:352–360` renders `<dt>Check-in</dt>` over a calendar date and `<dt>Check-out</dt>` over a derived calendar date. Adding a time row labelled with either word makes the page unreadable.

**Required, and required *first* — the rename lands before or with the new panel, never after:**

1. `page.tsx:354` `Check-in` → **`Check-in date`**. `page.tsx:358` `Check-out` → **`Check-out date`**. Empty-state copy at `:355`/`:359` follows: "Check-in date not provided" / "Check-out date not provided".
2. The new panel **never uses the bare tokens "Check-in" or "Check-out"** as a row label. Its labels are the four in D2's table: *Arriving late*, *Front desk*, *Earliest arrival*, *Latest departure*. Panel heading: **"Arrival and departure times."**
3. The string **"check-in window" must not appear as a new UI string anywhere.** It is bound to `deals.check_in_window`, the date-range string rendered at `page.tsx:135` and `opengraph-image.tsx:17`. Existing uses stay as they are — renaming the column is out of scope.
4. The date cells keep their existing derivation but gain provenance parity: the "Check-out date" value at `:359` is computed by `addNights()`, so it must not read as a property statement. The section's existing explanatory line (`:366–370`) is the place to carry this; a time value must never be produced by arithmetic in any code path.

**Testable at TEST:** on the deal page, no `<dt>` reads exactly "Check-in" or "Check-out"; the tokens "date" and "time" never label the same value; a user scanning for arrival time cannot land on a calendar date under a matching label.

---

### D4 — Collapsed-card chip budget: zero by default, at most one, gated on confirmed evidence

The collapsed card already carries ten competing elements at 375px (§1.1). The default contribution of this feature to that row is **zero**.

**Exactly one chip may render, and only when both hold:**
1. `resolveLateArrivalAnswer(evidence)` returns **`'not_admitted'`** or **`'conditional'`** — the only two answers that change a book/don't-book decision; and
2. the underlying `lateArrival.status === 'confirmed'` with a non-empty `sourceLabel` — the same gate the elevator chip already applies (`HotelCard.tsx:771–777`).

**Never render a chip for `'unknown'` or `'admitted'`.** `'unknown'` is today's universal state — a chip there would add one row of noise to every card in every result list while communicating nothing. `'admitted'` is reassurance, not a decision change; it belongs in the expanded panel.

Chip copy, ≤ 24 characters, reusing the existing chip markup at `HotelCard.tsx:874–881` (`--radius-control`, `--border`, `--bg-surface`, `text-xs`, `truncate`, `max-w-full`) with no new tokens:
- `'not_admitted'` → **"No late arrival"**, `--warning` treatment.
- `'conditional'` → **"Late arrival: notify"**, neutral treatment.

Each chip carries an `aria-label` naming the source, mirroring `collapsedAccessAriaLabel` (`:778–780`): e.g. `"Late arrival. {sourceLabel} reports this property does not admit guests after {cutoff}."`

**Testable at TEST:** with no evidence (production default), the collapsed card is byte-for-byte unchanged. Chip never wraps to a second line at 375px. At most one logistics chip ever renders.

---

### D5 — Named analytics: logistics engagement and late-arrival-segmented handoff

Follows the established `hotel_*` snake_case convention (§1.6). Four new events plus one property addition.

**1. Section exposure — deal page: reuse the existing observer, no new code path.**
The panel wrapper on `app/deals/[dealId]/page.tsx` carries `data-hotel-decision-section="arrival_logistics"`. Because it nests inside the `hotel_fit` section it gets its own `hotel_decision_section_reached` at the existing ≥50%/1000 ms bar (`HotelDecisionAnalytics.tsx:64–116`) with `section: 'arrival_logistics'` and **no `data-hotel-decision-position`** — positions 1–5 stay reserved for top-level sections.

**2. `hotel_arrival_logistics_viewed`** — fires once per surface when the panel becomes visible (card panel on expand; booking review on mount, matching `hotel_handoff_viewed` at `BookingFlow.tsx:744`).
Props: `hotel_id`, `provider`, `surface` (`'hotel_card' | 'hotel_detail' | 'book_handoff'` — the vocabulary already used by `HotelFundsPolicyPanel`), `evidence_state` (`'absent' | 'loading' | 'ready' | 'error' | 'conflict'`), `late_arrival_state` (the `LateArrivalAnswer`), `desk_access_mode`, `has_arrival_from` (boolean), `has_departure_by` (boolean).

**3. `hotel_arrival_logistics_expanded`** — the card's Details toggle opening, emitted alongside the existing funds-policy call in `handleDetailsToggle` (`HotelCard.tsx:791–801`).
Props: `hotel_id`, `provider`, `late_arrival_state`, `evidence_state`.

**4. `hotel_late_arrival_handoff_started`** — a provider handoff initiated while `late_arrival_state !== 'admitted'`. This is the ticket's late-arrival-scenario handoff signal: it counts users leaving expaify **without** an arrival answer.
Props: `hotel_id`, `provider`, `surface`, `late_arrival_state`, `evidence_state`, `logistics_seen` (boolean — whether event 2 fired first on this surface).

**5. `hotel_arrival_logistics_conflict_shown`** — `conflict === true` or `state === 'error'` rendered. Props: `hotel_id`, `provider`, `surface`, `evidence_state`. Low volume by design; it is the trust-regression alarm once a provider starts supplying data.

**Property addition (no new event):** the existing `hotel_room_handoff_started` (`HotelDecisionAnalytics.tsx:125`) and `hotel_provider_handoff_clicked` gain a `late_arrival_state` property, so **every** handoff is segmentable by arrival-answer state without joining across events. This is what makes discovery §3's "no way to segment a handoff by late-arrival intent" queryable.

**Testable at TEST:** with zero evidence, expanding a card emits `hotel_arrival_logistics_expanded` and `hotel_arrival_logistics_viewed` with `evidence_state: 'absent'`, `late_arrival_state: 'unknown'`; clicking through to a provider emits `hotel_late_arrival_handoff_started`. All five names are greppable; none collide with the 42 existing event names.

---

## 5. Handoff to UXDES

`UXDES-HOTEL-CHECKIN-LOGISTICS-01` must produce `docs/pipeline/hotel-checkin-logistics/03-design.md` covering:

- The unavailable state **first and in full** (D2) — it is the only state that ships in release one.
- Every other state: loading, error, conflict, partial (some facts confirmed, others not), and fully verified.
- All four row labels and every visible string as final copy — the D2 table is the starting point, not the finished copy deck.
- The deal-page label rename (D3) as part of the same spec, not a follow-up.
- The collapsed-card chip, both copy variants and the gate (D4).
- 375px and 1280px layouts for the card panel, the deal-page subsection, and the booking-review line, with no displacement of decision-order sections 1–4.
- Focus order and `aria` treatment for the panel and the chip, matching the `role="status"`/`aria-live` conventions in `HotelParking.tsx` and `AccessEvidencePanel`.
- Tailwind classes referencing only existing `app/globals.css` tokens.

**Carried constraints, non-negotiable downstream:** no inferred, default, or star-class-derived time may be stated as fact; `resolveLateArrivalAnswer` never returns `'admitted'` without confirmed desk-access evidence; no field, type, or UI string reuses `checkInWindow` / `check_in_window`; production fixtures with populated times are forbidden outside `app/components/research/`.

**No conflict to report.** The four-field model coheres without transfer or baggage storage (§3.3). Populating real values remains a separate DEV/provider ticket and is not part of the UXDES → UI scope.
