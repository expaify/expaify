# UXD-HOTEL-NOSHOW-POLICY-01 — Hotel No-Show & Late-Arrival Forfeiture Clarity

**Stage:** UX Discovery · **Priority:** P1 · **Flow:** hotel detail (`app/deals/[dealId]/page.tsx`) → booking handoff (`app/book/BookingFlow.tsx`)
**Scope:** same-day arrival guarantee and no-show forfeiture only. Pre-stay cancellation windows are owned elsewhere (see §4).

---

## 1. Pain point

**A traveler who expects to arrive late — or is not certain which day they will arrive — cannot learn whether the property will hold the room, release it, or charge a no-show forfeiture, because expaify has no field, no copy, and no evidence model for the arrival guarantee; the one policy statement it does show on these surfaces ("Cancellation choices unavailable") answers a different question and implies the arrival question was covered.**

The distinguishing feature of this pain is not the missing fact. It is that the traveler cannot act on the answer *after* the deadline has passed. A cancellation question is asked while the traveler still has a choice. A no-show question is asked when the only remaining choice is to keep travelling and hope.

---

## 2. Who is affected, and at what step

The affected population is narrower than "hotel bookers" and its failure is more expensive per head:

| Segment | Why the arrival guarantee is the deciding fact |
|---|---|
| **Late arrivals** — arriving after ~22:00 on the check-in date, most often on the day a long-haul or last-leg flight lands | Needs to know whether the room survives an arrival after the desk closes, and whether it is charged if it does not |
| **Arrival-date-uncertain travelers** — connecting itineraries, drive-in trips, unconfirmed onward legs | Needs to know what a one-day-late arrival costs: the whole stay, one night, or nothing |
| **Prepaid bookers** | Has already paid; forfeiture is the entire downside and is invisible at the moment of payment |

**Where in the flow, source-verified:**

| # | Surface | Source | What is shown today about no-show or late arrival |
|---|---|---|---|
| 1 | Hotel offer card (collapsed + expanded Details) | `app/components/HotelCard.tsx` | Nothing. The expanded panel carries Deal Score, quality, location, parking, pet, smoking, access, price scope, funds policy. No arrival or forfeiture content. |
| 2 | **Hotel detail** | `app/deals/[dealId]/page.tsx:423` | One block: `HotelCancellationChoicesUnavailable` (h2). Its body — *"Cancellation choices are not available for this observed price. Compare room rates and cancellation terms with the booking partner."* Check-in is rendered as a bare date at `:378-379` with no time and no arrival term. |
| 3 | **Booking handoff review** | `app/book/BookingFlow.tsx:1175`, `:1199` | Prose sentence lists "cancellation policy" as one of five things *the provider* shows, plus the same `HotelCancellationChoicesUnavailable` block. Last internal screen before the traveler leaves. |

The traveler decides to click through at step 1 or 2. Nothing at any step names arrival, lateness, or forfeiture.

---

## 3. Measurable signal that the problem exists

### 3.1 The requested signal cannot be produced — and why that itself is the finding

The ticket asks to "measure frequency of no-show-related charge disputes or support tickets versus cancellation-related ones." **That measurement is not obtainable from this product, now or after any UI change, and downstream stages must not wait for it.**

expaify is an affiliate handoff product. The reservation is created on the partner's site after the traveler leaves via the deeplink (`HotelOffer.deeplink`, partner resolution at `BookingFlow.tsx:132-155`). expaify never holds the booking, never sees the arrival, and never sees the charge. There is no post-stay channel in the codebase — no booking record, no reservation table, no support-ticket surface — in which a no-show dispute could appear. A dispute-volume comparison would require data expaify structurally does not have.

I am flagging this as a conflict between the ticket's stated signal and the product's data contract, per the briefing, rather than inventing a number.

### 3.2 What *is* measurable, and what it currently shows

The only structured "something was wrong" channel is the post-handoff return survey, `HOTEL_RETURN_REASONS` (`BookingFlow.tsx:55-70`), emitted as `hotel_handoff_return_reason_selected` (`app/api/analytics/route.ts:41`). Its nine options are:

```
smoking_policy_or_room_mismatch · tax_amount_changed_or_appeared
mandatory_property_charge_changed_or_appeared · displayed_total_other_mismatch
pay_at_property_amount_unexpected · room_availability_mismatch
other_hotel_details_mismatch · loyalty_or_points_uncertainty · prefer_not_to_say
```

**Neither no-show nor cancellation appears in this taxonomy.** Both currently fall into `other_hotel_details_mismatch` or `prefer_not_to_say`, which is why neither can be sized today and why *neither* ticket can claim volume evidence. This survey fires at handoff — pre-payment, pre-stay — so it can only ever measure *pre-booking confusion*, never post-stay forfeiture. That is the correct scope for this ticket anyway: the harm we can prevent is a traveler booking a rate whose arrival terms they could not see.

### 3.3 Source-verified evidence that the gap is total

1. **Zero occurrences of `no-show` / `noShow` / `no_show` in `app/` and `lib/`.** The only hits repo-wide are two design docs that explicitly *exclude* the concept (`hotel-checkin-time-fit/01-discovery.md:42`, `hotel-checkin-time-fit/03-design.md:411`). The concept has been named and deferred repeatedly; it has never been owned.
2. **`HotelOffer` (`lib/types.ts:751-778`) has no field that can carry an arrival guarantee.** It carries `fundsPolicy`, `smokingPolicy`, `rateEligibility`, `admissionPolicy`, `taxEvidence`, `mandatoryPropertyChargeEvidence` — six policy-shaped evidence models, none of which is about arrival or forfeiture. `admissionPolicy` covers `checkin_age` and `checkin_identity` only (`lib/types.ts:643-644`) — who may check in, not when, and not what happens if they don't.
3. **The provider returns nothing.** `HotellookProvider` parses `HotelLookCacheEntry` (`lib/providers/hotellook.ts:23-42`): hotel id, name, stars, location, address, distance, `priceFrom`, photo, property type, optional `smokingPolicy`. No arrival, guarantee, or forfeiture field is fetched or parsed. `fundsPolicy` is hardcoded `not_returned` (`:407`) and admission capability hardcoded unsupported (`:410`).
4. **The one policy block on both surfaces answers the wrong question with a confident heading.** `HotelCancellationChoicesUnavailable` is scoped to "cancellation terms" and instructs the traveler to compare "room rates and cancellation terms." A traveler asking "will they hold my room if I land at 1am?" reads an authoritative-looking policy block, sees their question is not in it, and has no signal whether that means *unknown* or *not applicable*.

---

## 4. Distinctness: is this genuinely separate from the cancellation ticket?

This is the question the ticket asks me to settle. **Yes — with one binding condition.**

### Where the pains diverge

| | Pre-stay cancellation | Same-day arrival guarantee / no-show |
|---|---|---|
| **Question asked** | "If I change my mind, what do I get back?" | "If I arrive late or a day late, is the room still mine, and am I charged?" |
| **When asked** | Any time between booking and the deadline | On the arrival date, in transit |
| **Traveler's remaining agency** | Can cancel, rebook, choose a flexible rate | None — cannot cancel a stay that has begun |
| **Deciding variable** | A deadline and a penalty amount | A hold time (e.g. "held until 18:00"), a guarantee mechanism (card guarantee / late-arrival notice), and a forfeiture basis (first night vs full stay) |
| **Failure mode** | Money lost on a stay not taken | Money lost *and* no room, at night, in an unfamiliar city |

These are different fields with different units. A cancellation deadline cannot express a hold time; a penalty percentage cannot express "call the property before 18:00 to hold the room." That is why one field could not have served both, and why `docs/pipeline/hotel-cancellation-clarity/01-discovery.md` — which names no-show in its pain sentence — produced no place to put it: its own analysis (§1, §2) is built entirely on cancellation deadlines and penalty amounts.

### Where they must not diverge — the binding condition

Both are provider-sourced rate terms with the same evidence problem (nothing returned today) and both currently render into the same slot on the same two surfaces. **They must share one evidence/confidence shape and one visual container.** Shipping a second standalone "…unavailable" card next to the existing one would give the traveler two adjacent warning blocks about absent policy — a worse detail page than today, especially at 375px where they stack.

**Directive for UXR/UXDES:** treat the arrival guarantee as a *named dimension inside the rate-terms surface*, not as a new sibling panel. Follow the precedent already established by `HotelAdmissionPolicyEvidence` (`lib/types.ts:633-655`), which models several independent families under one panel with per-family capability flags — that is the shape this belongs in.

### Adjacent scopes to stay out of

- **`docs/pipeline/hotel-cancellation-clarity/`** — pre-stay cancellation deadlines, penalty amounts, refundability labelling. Owns everything before the arrival date. Out of scope here.
- **`docs/pipeline/hotel-checkin-logistics/`** — check-in window, front-desk hours, late-arrival *process* (how you get in). Owns the locked-door problem; explicitly does **not** own the charge. This ticket owns only the money and the room-release consequence. A published late-arrival instruction may be *referenced* as evidence that ticket owns; do not re-model it.
- **`docs/pipeline/hotel-checkin-time-fit/`** — arrival-time-vs-standard-window fit. Explicitly disclaims no-show at `03-design.md:411`.
- **`docs/pipeline/hotel-payment-timing/`** and `HotelFundsPolicyPanel` — prepayment timing, deposits, authorization holds. A no-show charge's *amount basis* may reference the stay price; do not re-open deposit modelling.

---

## 5. Constraints the solution must respect

1. **Data integrity — never infer a forfeiture term.** A no-show consequence is a financial claim against the traveler. It may be stated only in the provider's own returned terms, with source and scope attached, following the `state: 'complete' | 'partial' | 'explicit_none' | 'not_returned' | 'conflicting'` vocabulary already used by `HotelFundsPolicyEvidence` (`lib/types.ts:386-392`). Industry defaults ("hotels usually hold until 18:00") must never be rendered. `explicit_none` — the property confirms no forfeiture — must be distinguishable from `not_returned`, because they lead to opposite booking decisions.
2. **Provider-feed reality bounds what can ship.** Hotellook returns no arrival or forfeiture field (§3.3). A UI stage can honestly deliver: the evidence type, the dimension inside the existing rate-terms surface, every state including the honest unavailable state, and the analytics. Populating real values requires a provider/pipeline change and must be scoped as its own DEV ticket. Research fixtures live under `app/components/research/` and must never reach a production path.
3. **No net increase in policy blocks.** The detail page already renders a stack of evidence sections (`Hotel fit`, Deal Score, cancellation-unavailable, criteria summary). At 375px this ticket must add a dimension, not a card. If UXDES concludes a standalone panel is unavoidable, that is a conflict to report — not to absorb.
4. **Preserve existing contracts.** `HotelCancellationChoicesUnavailable` and its two exported copy constants are consumed at `deals/[dealId]/page.tsx:423` and `BookingFlow.tsx:1199`. Its heading may need to widen to cover arrival terms; any such change must keep the exports and the `headingLevel` prop.
5. **Accessibility and money contract.** Any forfeiture amount is `{ priceCents, currency }` — never a float, never a bare number. Any new interactive element carries a label and visible focus ring.

---

## 6. Success statement

**This is solved when a first-time user who knows they will arrive after midnight — or does not yet know their arrival day — can tell, before leaving expaify, whether the property holds the room, until when, and what a no-show costs, using only terms the provider actually returned; and when, in the expected common case where the provider returns nothing, that user is told plainly that the arrival guarantee is unconfirmed instead of reading a cancellation-scoped block that leaves them unable to distinguish "no forfeiture" from "we don't know."**

---

## 7. Handoff requirements for UXR

1. **Answer the feed question first.** Does Travelpayouts/Hotellook, or any candidate `HotelProvider`, expose an arrival-guarantee, hold-time, or no-show field on any endpoint? Audit `lib/providers/hotellook.ts` and check for a richer endpoint. If none does, say so explicitly and direct UXDES to an honest-absence pattern — consistent with the `hotel-rating-source-confidence` and funds-policy precedents — rather than a fabricated badge.
2. **Define the field set.** Hypothesis for UXR to validate or reject against reference patterns (Booking.com's "your room is held until X / late arrival" line; Expedia's arrival-guarantee row): `holdUntilTime` · `guaranteeMechanism` (card-guaranteed / late-notice-required / none) · `forfeitureBasis` (first night / full stay / other, as `Money` or percentage) · `lateArrivalNoticeRequired`. Confirm which of these travelers actually act on; drop the rest.
3. **Resolve the container decision explicitly.** Recommend where this lives relative to `HotelCancellationChoicesUnavailable` and produce the merged heading and copy rules. Do not leave this to UXDES.
4. **Specify the instrumentation.** Propose the concrete additions needed to size this pain going forward: an arrival/no-show reason value in `HOTEL_RETURN_REASONS` and a cancellation one alongside it (so the two can finally be compared, closing §3.1's gap for the *pre-booking* case), plus the exposure event name. TEST must be able to verify the signal exists, not only that copy renders.

**Do not restate the cancellation problem.** If research concludes the arrival guarantee cannot be modelled coherently without re-opening cancellation deadlines, report that as a conflict.
