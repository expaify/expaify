# UXD-HOTEL-DEAL-EXPIRATION-URGENCY-01 — Hotel Deal Expiration & Price-Hold Urgency

**Stage:** UX Discovery
**Feature slug:** `hotel-deal-expiration-urgency`
**Priority:** P2
**Date:** 2026-08-03
**Persona:** Senior UX Strategist

---

## 1. Problem Statement

**A shopper cannot tell how long the hotel price expaify is showing will remain the price they can book — because expaify holds nothing, re-checks nothing at handoff, and no hotel provider in the codebase returns a quote TTL — so the user manages that uncertainty by re-opening the same deal instead of booking, and discovers any change only on the partner's checkout page.**

This is a *forward-looking validity* problem, distinct from two adjacent efforts already documented:

| Feature | Question it answers | Status |
|---|---|---|
| `hotel-price-freshness` | "How old is this price?" (backward) | Discovery + research exist |
| `deal-expiry-urgency` | "Which deals are drifting back to normal price?" (deal-feed risk trajectory) | Discovery + research exist |
| **This ticket** | **"Is this price still good if I click now, and will it still be good at checkout?" (forward validity + handoff seam)** | **This doc** |

The scope boundary matters for downstream stages: freshness work fixes what we say about the past; this work must define what — if anything — we are entitled to say about the *next few minutes*.

---

## 2. Who Is Affected, And Where

Affected: any shopper who does not book on first view. That is the majority path — the flow deliberately hands off to a partner, so every hotel booking crosses a seam where expaify's number and the partner's number are produced by two different systems at two different times.

| Step | Surface | What the user sees today about validity |
|---|---|---|
| 1. Scanning deals | `app/components/ui/DealCard.tsx:77,136-141` | `Price checked {timeAgo}` — a backward age, no forward claim. Omitted entirely when `updatedAt` is null. |
| 2. Deal detail | `app/deals/[dealId]/page.tsx:284-290` | `isAging` (≥30h) / `isStale` (≥48h) warnings; plus `This saved rate expired {date}. It is shown for reference only.` (`:405-406`), driven by `deal.expires_at`. |
| 3. Live hotel results | `app/components/HotelCard.tsx` | Nothing about validity. No timestamp on the offer at all (see §3.1). |
| 4. Booking review / handoff | `app/book/BookingFlow.tsx:401` | `Last-checked time not provided.` in `var(--warning)`, directly under the nightly rate. No forward statement whatsoever. |
| 5. Return from partner | `app/book/BookingFlow.tsx:66-75,1126` | Post-hoc: "Did the partner details match?" with mismatch reasons including `tax_amount_changed_or_appeared`, `displayed_total_other_mismatch`, `room_availability_mismatch`. |

The shape of the failure: **expaify only acknowledges price validity after the user has already been burned by it.** Steps 1–4 make no forward claim; step 5 asks the user to report the mismatch we did not warn them about. The single loudest validity statement in the whole hotel flow (`This saved rate expired…`) fires on a field that is not a rate-validity signal at all (§3.2).

**Contrast — flights already do this correctly.** `BookingFlow.tsx:497` tells the user "Duffel rechecks price, currency, passenger count, and availability before any order is created," and `isChangedFareReason` (`:278-289`) handles the fare-changed error path. Flights have a real re-quote; hotels have a deeplink. Users moving between the two flows in one product meet two different implicit promises with no explanation of why.

---

## 3. Measurable Signal — Verified In Code

### 3.1 No hotel provider in this repo returns a quote TTL, rate expiry, or price-hold window

Every hotel provider was read. None emits a validity field, and `HotelOffer` (`lib/types.ts:751-778`) has no slot for one — no `expiresAt`, no `validUntil`, no `fetchedAt`, not even on the price.

- `lib/providers/hotellook.ts:492` computes `const fetchedAt = new Date().toISOString()` and attaches it only to `hotelClass` and `guestRating` evidence. The timestamp of the fetch that produced `priceCents` is computed and then dropped for the money.
- `lib/providers/hotelbeds.ts:13-19` states plainly that no booking flow exists: *"until a real Hotelbeds Booking API (checkRate + booking confirm) flow is built."* `checkRate` is precisely the call that would return a bindable, time-boxed rate. It is not wired. `deeplink` is empty and the UI falls back to "Booking unavailable."
- `lib/providers/bookingComHotelsRapidApi.ts` — affiliate search payload; no rate-validity field is parsed.

**Consequence for the whole ticket:** the ticket's own hypothesis ("e.g., quote TTL") does not hold against current integrations. There is no TTL to surface. Any downstream design that assumes one is fabricating it, which the ticket's own constraint forbids.

### 3.2 The only "expiration" the user is shown is a 90-day retention timestamp

`lib/pipeline/dealDetection.ts` sets `expires_at = check_in_date + INTERVAL '90 days'` once at insert and never recomputes it. It is a row-retention TTL. It is rendered to users as an expiry (`app/deals/[dealId]/page.tsx:405-406`) in `var(--error-text)`. This was already flagged in `docs/pipeline/deal-expiry-urgency/01-discovery.md` and is still in the code today. It is a data-integrity defect, not a copy defect, and it is the single strongest "validity" signal the hotel flow currently emits.

### 3.3 The displayed price can legitimately be up to 6 hours old, silently

All hotel providers cache normalized offers for `CACHE_TTL = 21600` (6h) — `hotellook.ts:19,545`, `hotelbeds.ts:23,284`, `bookingComHotelsRapidApi.ts:20,203`. The cache-hit branch returns offers with no age marker. Two users on the same query minutes apart see an identical price that may have been fetched five hours apart. The 6h window is a real, quantified upper bound on how wrong the forward claim could be — and it is the honest ceiling any urgency copy must respect.

### 3.4 Deal-feed prices are nightly, not live — so "how often prices change in a session" is unanswerable from our own data

`.github/workflows/snapshot.yml:5` runs at `0 4 * * *` (daily). `lib/db/schema.sql:18-25` constrains `hotel_snapshots` with `UNIQUE (hotel_id, date)`, and `price_snapshots` (`:104-118`) with `UNIQUE (hotel_id, market_id, check_in, snapshot_date)`. **The schema makes at most one price point per hotel per day storable.** Intraday volatility is structurally invisible to us.

The ticket asks for "how often prices actually change within a session." That number **cannot be produced from existing data** — not from snapshots (daily grain), not from the Redis cache (no history), not from analytics (no price value on offer-impression events). Producing it requires new measurement, and that measurement is part of this feature's deliverable, not a prerequisite someone else supplies.

### 3.5 The mismatch signal named in the ticket exists but carries no time dimension

`hotel_handoff_return_reason_selected` (`BookingFlow.tsx:1041-1046`) emits `handoffAttemptId`, `priceDisclosureState`, `reason`. `hotel_handoff_returned` (`:995-999`) additionally emits `awayDurationBucket` — time spent *at the partner*, which is the wrong interval. Neither event carries **price age at handoff** (impossible — the field does not exist, §3.1) nor **time since the offer was first shown in this session**.

So the ticket's primary signal — "rate of price-mismatch complaints between displayed and checkout price" — is collected today but **cannot be segmented by how long the user deliberated**. The core causal question ("does hesitating cause mismatch?") is currently unanswerable.

### 3.6 The ticket's second signal — repeat-view frequency — is also not instrumented

No deal-view or hotel-card-impression event carries a per-user/per-session repeat counter. `hotel_handoff_viewed` (`:825-832`) fires once per handoff attempt via `handoffViewedRef`, deliberately deduped. There is no event that increments when the *same* offer is viewed a second time in a session or across sessions. "Repeat-view frequency on the same deal without booking" is a hypothesis with no telemetry behind it.

**Instrumentation summary:** of the two signals this ticket names as evidence, zero are currently measurable. Establishing them is in scope.

---

## 4. Constraints The Solution Must Respect

1. **Data integrity — no fabricated validity.** No countdown, no "price held for N minutes," no "book within X," no scarcity claim. Nothing in `lib/providers` returns a rate-validity window (§3.1), and expaify does not hold rates. This also aligns with the existing headline-copy ban on `available|only|last chance|expires?|book now|limited` (`lib/ai/generateHeadline.ts:69`) — urgency copy must not enter through a hand-written back door the way `Expires {date}` did.

2. **The honest ceiling is 6 hours, and it is a *maximum age*, not a *validity window*.** Any forward-facing statement must be derived from a real fetch timestamp and must not imply the price is guaranteed for the remainder of the cache TTL. "Fetched within the last 6h" and "valid for the next 6h" are different claims; only the first is true.

3. **Performance — disclosure must be free.** The 6h cache and the cached-response path stay. No blocking re-check, no extra round-trip before results render. If a re-check is proposed at all, it can only be an explicit, user-initiated action on a single offer at the handoff step — never an automatic refresh of a results page.

4. **Accessibility and mobile.** Validity/urgency information must reach screen readers in the same context as the price and the CTA, must never be conveyed by colour alone (`BookingFlow.tsx:401` currently signals concern purely through `var(--warning)`), and must fit the already-dense 375px card stack without pushing the primary CTA below the fold.

5. **Repair before feature.** The mislabelled `expires_at` rendering (§3.2) is an active trust defect on a surface this feature owns. Fixing what we say wrongly today outranks adding a new signal.

---

## 5. The Honest Urgency Signal — What Can Actually Be Said

Three tiers, in descending order of defensibility. Downstream stages should treat tier 1 as required and tier 3 as explicitly out of scope until a provider contract changes.

**Tier 1 — true today, needs only plumbing:**
- *When the price was fetched* — the timestamp exists at `hotellook.ts:492` and is discarded for price; the same fix `hotel-price-freshness` needs.
- *What expaify does and does not guarantee at the seam* — "expaify does not hold this rate; the partner sets the final price at checkout." This is a factual statement about our architecture and is the single most useful thing we can tell a hesitating user.
- *Why flights differ* — Duffel re-quotes, the hotel partner does not.

**Tier 2 — true, but requires new measurement first (§3.4–3.6):**
- Observed price-change rate for this market/route, once intraday sampling exists. "Prices in this market changed N times in the last 24h" is honest urgency derived from evidence. It requires breaking the one-row-per-day schema constraint.
- Deal-risk trajectory from `dealRules.ts`'s unpersisted `'hold'` state — already scoped by `deal-expiry-urgency`; this feature should consume it, not duplicate it.

**Tier 3 — not available, do not design for it:**
- Quote TTL / rate expiry / price hold. Requires a bindable-rate provider integration (`checkRate` + booking confirm, `hotelbeds.ts:18`). That is a provider-contract change, not a UX change.

---

## 6. Success Statement

**This is solved when a first-time user looking at a hotel price on any expaify surface — feed card, deal detail, live result, or booking review — can tell in one glance when that price was fetched and that expaify does not hold it, so they act or wait deliberately, without expaify ever showing a countdown, a scarcity claim, or an "expired" label sourced from a database retention timestamp; and when a price mismatch reported after handoff can be joined to how long that price had been on screen.**

Two conditions, both required: the user gets an honest forward statement, and we can finally measure whether hesitation causes mismatch.

---

## 7. Open Questions For UXR

1. **Does hesitation actually cause mismatch, or does the 6h cache?** With no time dimension on mismatch reports (§3.5), the ticket's causal premise is unvalidated. Research must design the instrumentation that would confirm or kill it before design work assumes it.
2. **Does a "we don't hold this rate" disclosure reduce hesitation or increase abandonment?** Honest, and possibly costly. This is the central research question.
3. **How do reference products handle the affiliate seam specifically?** Booking.com owns its own checkout and can guarantee; Google Hotels hands off like we do. The Google Hotels pattern is the relevant comparison, not Booking.com's.
4. **Is intraday sampling worth the provider cost?** Tier 2 requires schema and job changes and more provider calls. Research should size the payoff before DEV is asked to build it.
5. **Scope boundary with `hotel-price-freshness`:** both need the same `fetchedAt` plumbing. Research must decide whether this feature consumes that work or owns it, so the two do not ship conflicting freshness models onto the same four surfaces.

---

## 8. Handoff

`UXR-HOTEL-DEAL-EXPIRATION-URGENCY-01` — validate the hesitation→mismatch premise with users, resolve the scope boundary against `hotel-price-freshness` and `deal-expiry-urgency`, and produce testable directives for the honest forward statement at the handoff seam.
