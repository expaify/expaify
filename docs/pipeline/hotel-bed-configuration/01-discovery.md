# UXD-HOTEL-BED-CONFIGURATION-01: Bed Configuration Confidence

**Date:** 2026-07-31
**Stage:** UX Discovery (UXD)
**Priority:** P0
**Persona:** Senior UX Strategist

**Surfaces read (not assumed):**
- `app/components/HotelCard.tsx` — offer summary + expanded panel, access-evidence rendering
- `lib/providers/hotelAmenityEvidence.ts` — the evidence fact list and normalizer
- `lib/providers/hotellook.ts` — the only hotel provider adapter
- `lib/types.ts` — `HotelOffer`, `HotelAmenityEvidence`, `HotelEvidenceScope`, `HotelEvidenceCertainty`
- `app/book/BookingFlow.tsx` — handoff review, Special requests block, return-reason capture
- `app/api/analytics/route.ts` — event allow-list
- `lib/hotels/searchCriteria.ts` — occupancy state
- `app/deals/DealFeed.tsx`, `app/deals/[dealId]/page.tsx` — results and detail

---

## 0. Read this first — what is genuinely new here

Four prior pipelines have touched the bed question and **every one of them deferred
it to another one**:

| Pipeline | Stage reached | What it said about beds |
|---|---|---|
| `room-rate-clarity` | 03-design (never implemented) | Specced a `Room & bed` `dl` row with final copy (`§2.3`), all five states marked *"Reachable today: No"* except `not-returned`. |
| `guest-room-fit` | 02-research (no design) | Ranked `bed_config` as signal #2 of three; handed it to a `UXDES-GUEST-ROOM-FIT-01` that was never created. |
| `hotel-room-choice-clarity` | 02-research | Explicitly excluded beds: *"UXDES must not add a room-type or bed row"* (`02-research.md:148`), deferring to the two above. |
| `hotel-special-requests` | 01-discovery | Owns the guidance-only request block; scoped itself to cribs and connecting rooms, not beds. |

The result is a **circular deferral**: three docs each point at another doc as the
owner, and no bed string, field, or state exists in the product. `grep -rniE "bed"
app lib --include=*.ts --include=*.tsx` returns only `aria-describedby`,
`toBeDefined`, and a `PetProfilePanel` prop. **Zero bed data, zero bed copy, zero
bed instrumentation.**

This discovery does not re-litigate whether a bed row should exist — `room-rate-clarity`
already wrote that row's copy. It defines the *narrower and unowned* problem: the
traveler's **bed-arrangement confidence at the handoff boundary**, the
preference-versus-guarantee distinction that the ticket names, and the measurement
that would show the problem is real. It ends the deferral loop by naming a single
owner.

---

## 1. User pain point

**expaify never states how many beds a room has or how they are arranged, and its
one place for expressing a bed wish — the Special requests block — does not mention
beds at all, so a traveler whose trip only works with a specific bed arrangement
(one bed, or two separate beds) leaves for the provider unable to tell whether the
price they trusted buys the arrangement they need, or whether that arrangement is
guaranteed or merely a request that may be refused at check-in.**

The failure is not a missing data field alone. It is that expaify already ships the
exact machinery for this class of fact — a room-scoped evidence object with a
`guaranteed` / `requestable` certainty flag and four honest states — and **beds are
the one high-stakes room fact left out of it**.

---

## 2. Who is affected, and at which step

The bed question is not a preference for most of these travelers; it is a
precondition. A wrong arrangement is not a worse stay, it is an unusable one.

| Traveler | Where it breaks | What breaks |
|---|---|---|
| **Couple** | Expanded `HotelCard` → detail → handoff | Needs one shared bed. A twin-bed room at the same price satisfies "sleeps 2" and fails the trip. Nothing on any expaify surface distinguishes them. |
| **Family with children** | Same | Needs enough *separate* sleeping surfaces, plus knowing whether a sofa bed or rollaway counts. `guest-room-fit` established occupancy is never captured (`lib/hotels/searchCriteria.ts:120,182` — `occupancy: { state: 'not_captured' }`), so even the headcount denominator is absent. |
| **Colleagues / two travelers sharing on business** | Same | Needs two *separate* beds and cannot accept one. This is the inverse of the couple, and it is the case where a "sleeps 2" signal is actively misleading — it reads as a pass when it is a fail. |
| **Solo traveler** | Results | Unaffected by arrangement; affected only by paying a double-occupancy rate. Out of scope here, owned by `guest-room-fit`. |

**The precise step:** the pain lands at the **handoff boundary**, the moment between
"expaify convinced me this is a good price" and the provider's room list. Today the
traveler crosses that boundary carrying no bed information and no way to express a
bed need. `HotelCard` routes through `/book` (`app/components/HotelCard.tsx:828-841`,
`:976`), so `HotelHandoffReview` in `app/book/BookingFlow.tsx` is the single, and
last, expaify surface before the provider — and its Special requests prompt reads
*"Need a quiet room, high floor, or early check-in?"* (`BookingFlow.tsx:1220`).
Beds are absent from a list of three examples that a traveler will reasonably read
as the set of things expaify supports asking for.

---

## 3. Measurable signals that the problem exists

### Signal A — The evidence contract has a bed-shaped hole, and it is deliberate-looking

`lib/providers/hotelAmenityEvidence.ts:18-25` defines the canonical fact list:

```
elevator | on_site_parking | step_free_route
room_pref_ground_floor | room_pref_high_floor
room_pref_near_elevator | room_pref_connecting
```

Four of the seven are `kind: 'room_request'` facts. Each carries
`scope: 'room' | 'selected_stay'` and `certainty: 'guaranteed' | 'requestable'`
(`lib/types.ts:136,147`), validated by `validConfirmedCombination`
(`hotelAmenityEvidence.ts:69+`) and rendered in `HotelCard.tsx:148-198` with two
distinct copy families:

- requestable → *"You can request a room near the elevator."* + non-guarantee clause
- guaranteed → *"The provider guarantees a room near the elevator for this selected stay."*

**This is exactly the preference-versus-guarantee separation the ticket asks for,
already built, already tested, already shipping — with `room_pref_bed_configuration`
missing from a list that contains "room near the elevator."** The bed question is
higher-stakes than three of the four preferences already modelled.

### Signal B — No supplier bed data reaches the app, and the ingress already handles that honestly

`HotelOffer` (`lib/types.ts:552-576`) has no `bedConfig`, `roomType`, `maxOccupancy`,
or room collection. The single provider, `lib/providers/hotellook.ts`, wraps the
Hotellook `cache.json` price index, whose entries carry
`hotelId, hotelName, stars, location, address, distance, priceFrom, photoUrl,
propertyType` — no room dimension to map from, and the file map records the API as
dead (returns empty).

But the adapter does **not** hardcode absence: `normalizeHotelAmenityEvidence(value.amenityEvidence, …)`
(`hotellook.ts:382,504`) normalizes whatever evidence a supplier sends against
expaify's fact list, and any fact not returned falls through to `not_returned`
(`hotelAmenityEvidence.ts` precedence map; `HotelCard.tsx:137-144`). **So the
"supplier-supported only" constraint is already enforced structurally.** Adding a
bed fact does not require a live provider — it inherits the honest-absence path on
day one and populates automatically when a supplier that returns bed data is
connected.

### Signal C — Room-detail expansion is measured; bed-driven expansion is not distinguishable

`hotel_result_card_opened` fires at `app/deals/DealFeed.tsx:1349` with
`current_sort, previous_sort, sort_transition, premium_eligible,
loaded_result_count, viewport_band, filter_state, card_position`
(`app/api/analytics/route.ts:27`). Expansion volume is therefore known. What is not
known is **why**: there is no per-fact exposure or per-section engagement property,
so "opened the card to look for bed information and found none" is
indistinguishable from any other expansion. There is no collapse event and no
re-expansion counter, so repeated hunting is invisible.

### Signal D — Selection reversals are captured and then silently discarded

`HOTEL_RETURN_REASONS` (`app/book/BookingFlow.tsx:50-58`) is a real reversal
instrument on the return-from-provider path, offering six reasons including
`smoking_policy_or_room_mismatch` ("Smoking policy or room did not match") and
`room_availability_mismatch`. On submit, `handleReturnFeedback`
(`BookingFlow.tsx:989-995`) emits `hotel_handoff_return_reason_selected`.

**That event is not in the allow-list.** `app/api/analytics/route.ts` registers no
`return_reason` event (`grep -n "return_reason" app/api/analytics/route.ts` → no
match), and `app/api/analytics/route.ts:246-247` does
`const allowedProperties = EVENT_PROPERTIES[body.event]; if (!allowedProperties) return null` —
the payload is rejected before storage. **Every reversal reason a traveler has ever
submitted has been dropped.** The one instrument that could quantify this ticket's
primary metric is disconnected, and none of its six reasons names beds — the closest,
`smoking_policy_or_room_mismatch`, conflates two unrelated causes.

*(This defect is broader than beds. It is recorded here as evidence and flagged in
§7 as out-of-scope-to-fix, but UXR must confirm whether the bed success metric can
be measured at all without it — if not, the dependency is real and must be stated,
not assumed away.)*

### Signal E — `hotel_handoff_returned` exists, so away-and-back is already observable

`BookingFlow.tsx:939` emits `hotel_handoff_returned` with
`source, partnerHost, awayDurationBucket`, and it **is** registered
(`app/api/analytics/route.ts:39`). A short away-duration bucket followed by a return
is a usable proxy for "the provider's room list did not match what I expected"
today, without any new event. Baseline measurement is therefore possible before the
fix ships — UXR should establish that baseline rather than requesting new
instrumentation first.

### Signal F — Manual reproduction

Open any hotel result, expand the card, read every panel, continue to `/book`, and
read the handoff review end to end. Then answer: *"Does this room have one bed or
two, and if I ask for two, will I get them?"* Neither question is answerable from
anything expaify displays, and the Special requests block does not offer beds as
something that can be asked.

---

## 4. Scope boundaries

**In scope:** the bed-arrangement fact itself — whether expaify can state it, how
absence is expressed, and how a bed *preference* is separated from a bed
*guarantee* at the single handoff boundary.

**Out of scope (owned elsewhere, must not be re-specified):**

- **`room-rate-clarity`** owns the `Room & bed` disclosure row and its final copy
  (`03-design.md §2.3`). If UXDES needs a display row, it must **adopt that row and
  its strings**, not mint a second one. Rate policy (refundability, cancellation,
  meal plan) stays there.
- **`guest-room-fit`** owns occupancy/party capture and the decision **not** to
  build a party intake. Bed configuration consumes occupancy as an optional input
  and must degrade honestly without it — which is the permanent state today.
- **`hotel-room-choice-clarity`** owns the price↔room binding statement in section 4
  of the detail page and the single provider-confirmation boundary. **No second
  boundary, no section reordering.**
- **`hotel-special-requests`** owns the Special requests block's four-state truth
  model (Selected / Sent / Acknowledged / Guaranteed) and its shipped copy. A bed
  request, if specced, **extends that existing block** — it does not create a new
  one, and it must not restate the non-guarantee sentence at `BookingFlow.tsx:1228`.

**Also out of scope:** a room inventory browser, a room selector, a bed filter, or
in-app room booking. expaify frames the choice and hands off.

---

## 5. Constraints the solution must respect

1. **Supplier-supported only — no inference, no defaults.** No bed count, bed size,
   or arrangement may render unless a provider returned it. A bed fact must arrive
   through `lib/providers` as `Result<T>` and normalize through
   `normalizeHotelAmenityEvidence`, inheriting the `confirmed / unavailable /
   not_returned / unknown` states. Bed configuration must **never** be derived from
   occupancy, star rating, room name, `propertyType`, or photos. "Sleeps 2" is not
   evidence of one bed or two — that inference is the exact failure mode for the
   colleagues case in §2, and it is prohibited.

2. **Preference and guarantee must be visually and semantically distinct.** Reuse
   `HotelEvidenceCertainty` (`guaranteed` | `requestable`) and the two established
   copy families (`HotelCard.tsx:148-198`). A requestable bed arrangement must carry
   the existing non-guarantee clause; a guaranteed one must be scoped to
   `selected_stay` and say so. The two must never share a treatment, and no bed
   statement may be phrased so that a request reads as a confirmation.

3. **One boundary, existing layout, existing tokens.** The work lives inside the
   already-shipped surfaces — the `HotelCard` expanded panel and/or the existing
   Special requests block in `HotelHandoffReview` — with no new confirmation
   boundary and no section reordering. Usable at 375px and 1280px, no overlap, no
   clutter, keyboard-reachable, focus ring intact, tokens from `app/globals.css`
   only. Affiliate markers and `rel="noopener noreferrer sponsored"` untouched.

---

## 6. Success statement

**This is solved when a first-time traveler who needs a specific bed arrangement
can, before leaving expaify, see either the supplier-stated bed configuration or an
explicit statement that the provider did not supply it — and can tell whether a bed
arrangement is guaranteed for their stay or only a request that may be refused —
without inferring it from occupancy, price, or room name, and without discovering
the mismatch only after arriving on the provider's room list.**

**Verification, in order of what is available today:**

- **Baseline now, no new instrumentation:** `hotel_handoff_returned`
  (`awayDurationBucket`, Signal E) segmented against `hotel_room_handoff_started`
  gives a pre-change bounce-back rate.
- **Comprehension task (5–7 participants, ≥85% pass):** shown a hotel card and the
  handoff review, *"How many beds does this room have, and can you be sure?"* →
  pass = *"the provider didn't say"* or a correct supplier-stated answer; **fail =
  any guessed number**. And *"If you ask for two separate beds, will you get them?"*
  → pass = correctly distinguishes request from guarantee.
- **Grep test:** no bed string renders on any surface without a corresponding
  provider-supplied evidence object; no code path derives a bed value from
  occupancy, stars, room name, or `propertyType`.
- **Reversal rate (dependent):** requires the Signal D defect resolved. UXR must
  state whether this is a hard dependency or whether Signal E's proxy suffices.

---

## 7. Out-of-scope findings (flagged, not fixed)

- **`hotel_handoff_return_reason_selected` is rejected by the analytics API**
  (Signal D). Emitted at `app/book/BookingFlow.tsx:992`, absent from
  `EVENT_PROPERTIES` in `app/api/analytics/route.ts`, dropped at `:246-247`. All
  reversal-reason data is lost. This affects every hotel reversal metric, not just
  beds. Belongs in its own DEV ticket.
- **`hotel_handoff_return_reason_selected`'s `smoking_policy_or_room_mismatch`
  conflates two unrelated causes**, so even once the event lands, "room did not
  match" cannot be attributed. Reason-taxonomy work, not bed work.
- **`room_state` is an alias of occupancy state and is constant.** Recorded by
  `hotel-room-choice-clarity` 02-research §5.2; still true
  (`lib/hotels/searchCriteria.ts:120,182` → always `not_captured`). Owned there.
- **The circular deferral itself** (§0) is a process defect: `room-rate-clarity`
  03-design was never implemented and `UXDES-GUEST-ROOM-FIT-01` was never created.
  Two designed-but-unshipped bed specs exist. UXR must reconcile against them rather
  than write a third.

---

## 8. Handoff requirement

Create `UXR-HOTEL-BED-CONFIGURATION-01`. The research stage must deliver:

1. **A single owner decision that ends the deferral loop.** Reconcile
   `room-rate-clarity/03-design.md §2.3` (the `Room & bed` row, copy final, never
   built) against `guest-room-fit/02-research.md` (`bed_config` as an evidence
   object, never designed). Pick one home and one string set. Do not author a third.
2. **A supplier-capability finding.** Establish whether *any* provider reachable
   under the current contract — Hotellook live/cache, or a `HotelProvider`
   implementation credentials would permit — returns a bed descriptor, and if not,
   state plainly that the shippable deliverable is the **unpopulated** form: the
   `not_returned` state plus the request/guarantee separation. That is a complete
   outcome, not a failure.
3. **A reference teardown** (Booking.com and one of Google Hotels / Expedia) at the
   level of *interaction pattern*: how bed configuration is bound to a rate, how
   "1 large double bed **or** 2 twin beds" ambiguity is presented, and how a bed
   preference is visually separated from a guaranteed configuration.
4. **The preference/guarantee model as a testable state table** mapped onto
   `HotelEvidenceStatus` × `HotelEvidenceScope` × `HotelEvidenceCertainty`, naming
   which combinations are legal for a bed fact and which the normalizer must
   downgrade to `unknown`.
5. **3–5 testable directives**, including whether the Special requests block at
   `BookingFlow.tsx:1211-1241` gains a bed option (and if so, under which
   `capabilityState`), and an explicit statement of the measurement dependency on
   Signal D.

Research brief output: `docs/pipeline/hotel-bed-configuration/02-research.md`.
