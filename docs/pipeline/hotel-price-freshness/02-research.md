# UXR-HOTEL-PRICE-FRESHNESS-01 — Hotel Price Freshness Confidence

**Stage:** UX Research
**Feature slug:** `hotel-price-freshness`
**Priority:** P0
**Date:** 2026-07-29
**Upstream:** `docs/pipeline/hotel-price-freshness/01-discovery.md`

---

## 1. Research Question

The discovery report asks downstream stages to land on **one** shared hotel freshness model — one state set, one threshold set, one copy system — used by all four hotel surfaces. This brief answers three questions:

1. What does each of the four surfaces actually do today, at line level?
2. Where does the existing flight implementation (`lib/providerFreshness.ts`) give us a pattern to align with rather than reinvent?
3. Can a single flat threshold pair serve all four surfaces — and if not, what is the single rule that does?

The short answer to (3) is **no, and the reason is the deliverable**: hotel prices on expaify come from two different refresh cadences, and one flat threshold pair would either warning-flood the deal feed or under-warn live search results. The fix is one shared state machine whose bands are derived from a declared per-source refresh cadence — not two threshold systems.

---

## 2. Current Implementation Audit

Read from source in this worktree. Every claim below is line-verified.

### 2.1 The data contract — the timestamp exists everywhere except on the price

| Layer | File:line | State today |
|---|---|---|
| Flight fare | `lib/types.ts` (`NormalizedFare.fetchedAt`) | Price-level timestamp present and populated. |
| Hotel offer | `lib/types.ts:474-495` | **No** price-level timestamp. `hotelClass`, `guestRating`, `amenityEvidence`, `fundsPolicy`, `rateEligibility` each carry `fetchedAt`; `pricePerNight` does not. |
| Hotel provider | `lib/providers/hotellook.ts:492` | `const fetchedAt = new Date().toISOString()` is computed, then consumed only at `:525` (`buildHotelClassEvidence`) and `:530` (`buildGuestRatingEvidence`). The same fetch that produced `priceCents` discards its own timestamp for the price. |
| Cache replay | `lib/providers/hotellook.ts:18` (`CACHE_TTL = 21600`), `:458-470`, `:336-362` | `normalizeCachedHotelOffer` is a strict allow-list validator: it reconstructs the offer field by field. Any field it does not explicitly copy is dropped on cache replay. A price up to 6h old replays with no age marker. |
| Booking handoff context | `lib/booking/config.ts:71` | **`priceCheckedAt?: string` already exists on `BookingHotelContext`.** |

**The most important finding in this audit:** the handoff transport for a hotel price timestamp is already built and unused. `lib/booking/config.ts` already declares `priceCheckedAt` (`:71`), validates it as a date (`:701`, `:726`), serializes it into the inline booking href (`:1023`), parses it back (`:865`), exposes it on `BookingHotelContinuity` (`:942`), and threads it through `buildBookingHotelContext` (`:971`).

Nothing populates it. Both call sites — `app/components/HotelCard.tsx:812` and `lib/booking/config.ts:1060` — invoke `buildBookingHotelContext(hotel)` with no continuity argument, and there is no field on `HotelOffer` that could supply one. `BookingFlow` then never reads it (`app/book/BookingFlow.tsx:353` is a hardcoded string).

This materially shrinks the DEV-stage change the discovery report flagged as an upstream dependency. The pipe exists; three connections are missing: (a) a field on `HotelOffer`, (b) the provider writing it plus `normalizeCachedHotelOffer` preserving it, (c) the two `buildBookingHotelContext` call sites passing it and `BookingFlow` rendering it.

### 2.2 Surface 1 — Deal feed card (`app/components/ui/DealCard.tsx`)

- `:63` — `const checked = deal.isMock ? null : timeAgo(deal.updatedAt)`.
- `:108-115` — renders `Price checked {checked}` in `--ink-soft` (i.e. `--text-2`), with `title={absoluteCheckedAt(deal.updatedAt)}` as the only path to the absolute time.
- **Silent omission:** the whole `<p>` is wrapped in `{checked ? … : null}`. When `updatedAt` is null or unparseable, the card renders a price with **no freshness statement at all**. This is a direct violation of the discovery report's "silent-omission rate: target zero".
- **No upper bound:** `lib/timeAgo.ts:16` returns `${days}d ago` with no ceiling. A 40-day-old price renders as `Price checked 40d ago` in ordinary secondary-text styling, visually identical to `Price checked 12m ago`. Age is stated; risk is not.
- `title` attribute is the only absolute-time affordance and is unreachable by touch and by most screen-reader flows.

### 2.3 Surface 2 — Hotel result card (`app/components/HotelCard.tsx`)

Freshness appears in **five** places on this component, all hardcoded. The discovery report cited four; `PriceUnavailable` is the fifth.

| Line | Context | String |
|---|---|---|
| `:361` | `Price` component, right-hand price column | `Last-checked time unavailable` in `text-[color:var(--warning)]` |
| `:379` | `PriceUnavailable` component | `Last-checked time unavailable` in `text-[color:var(--warning)]` |
| `:746` → `:1049` | `rateCheckCopy`, expanded "Rate check" block | `Rate from {providerName}. Last-checked time unavailable.` |
| `:763` | `reviewAriaLabel` on the primary CTA | `… Last-checked time unavailable. …` |
| `:765-766` | `unavailableAriaLabel` | `… Last-checked time unavailable.` |

Three problems beyond the missing data:

1. **Colour-only warning.** `:361` and `:379` render a permanent amber line inside the price column. Amber is the component's warning tone (`--warning` = `--gold-text`, `app/globals.css:69`), and it is applied here to a condition that is universal and constant. Every hotel result is permanently in a visual warning state, which trains users to ignore the tone — so when a genuinely stale price appears, the amber will carry no information. Constraint 4 (never colour-alone) is violated in the strictest sense: the colour *is* the entire signal, and it is meaningless.
2. **375px pressure is real and already tight.** `Price` (`:351`) is a fixed `min-w-[6.75rem] max-w-[9.5rem] text-right` column, dropping to `@max-[351px]:col-span-2` full-width (`:894`). At 375px the column is ~108–152px wide holding four stacked lines: label, amount, price scope, provider, plus the freshness line. "Last-checked time unavailable" wraps to three lines in that column today.
3. **Hierarchy is inverted.** The Deal Score chip and CTA share a row at `:939-969`, *below* the price block. The freshness statement sits above both, inside the price column, at the same visual weight as the price basis — so the weakest, least-informative line gets adjacency to the number.

### 2.4 Surface 3 — Deal detail (`app/deals/[dealId]/page.tsx`)

The only surface with a real state model, and it is correct in structure:

- `:273-277` — `updatedAgeHours`; `isAging` = `>= 30 && < 48`; `isStale` = `>= 48`. Both suppressed when `isExpired`.
- `:381-391` — five rendered branches: expired → `--error-text`; stale → `--warning`; aging → `--warning`; fresh → `--text-2`; unknown → `--warning`. **No branch is silent.** This is the model to generalize.
- `:296-304` — `priceFreshnessState` is already typed as `HotelDecisionPriceFreshnessState = 'fresh' | 'aging' | 'stale' | 'unknown' | 'expired'` (`app/components/HotelDecisionAnalytics.tsx:8`) and emitted on `hotel_detail_viewed` (`:58`).
- Weaknesses: the 30/48 constants are inline literals, exported nowhere; the copy is written inline per branch; the aging/stale distinction reaches a screen reader only through the sentence text, which is adequate — but the sentence is the *only* differentiator, so it must stay explicit when generalized.

**The five-state vocabulary and the analytics enum already exist.** The shared model should adopt them verbatim rather than invent a parallel set.

### 2.5 Surface 4 — Booking review before handoff (`app/book/BookingFlow.tsx`)

- `:352` — `Rate observed from {rateSource}.` in `--text-2`.
- `:353` — `Last-checked time not provided.` in `--warning`. Hardcoded; ignores `hotelContext.priceCheckedAt`, which the type already provides.
- Note the copy drift: `HotelCard` says "unavailable", `BookingFlow` says "not provided", deal detail says "not provided", `providerFreshness` says "unavailable". Four surfaces, three phrasings for one state.
- This is the highest-commitment screen in the hotel flow and it carries the weakest claim, exactly as discovery states.
- `:37, :42-48` — `price_or_fees_mismatch` is one of five `HotelReturnReason` values collected when a user comes back. This is the falsification signal for the whole feature, and it currently carries no freshness attribute.

### 2.6 The instrumentation gap, precisely

| Event | Where | Freshness dimension today |
|---|---|---|
| `hotel_detail_viewed` | `HotelDecisionAnalytics.tsx:50-59` | ✅ `price_freshness_state` — deal detail only |
| `hotel_provider_handoff_clicked` | `CompareRow.tsx:124-133` | ❌ none |
| `hotel_room_handoff_started` | `HotelDecisionAnalytics.tsx:125-129` | ❌ none |
| Hotel card impression / review CTA click | `HotelCard.tsx` | ❌ no impression event exists at all |
| Hotel return reason (`price_or_fees_mismatch`) | `BookingFlow.tsx:37` | ❌ none |

Three of the four discovery measures are currently uncomputable. Only "coverage" can be derived post-hoc, and only once the field exists.

---

## 3. Alignment Target — `lib/providerFreshness.ts`

Discovery is explicit: align with the flight implementation, do not duplicate it. What is directly reusable:

| Export | Reuse for hotels |
|---|---|
| `validFreshnessDate` (`:39`) | **Reuse as-is.** Single definition of "is this a usable timestamp". |
| `formatRelativeFreshness` (`:46`) | **Reuse as-is.** `just now / N min ago / N hr ago / yesterday / N days ago / on Mon D`. Note it *does* bound long ages by falling back to an absolute date — better than `lib/timeAgo.ts`, which never does. |
| `formatAbsoluteFreshness` (`:66`) | **Reuse as-is** for tooltip/expanded/detail absolute times. |
| `providerDisplayName` / `hasProviderName` (`:19`, `:35`) | **Already used by hotels** — `HotelCard.tsx:744-745`, `BookingFlow.tsx:318`. `providerLabels` already includes `hotellook` and `bookingcomrapidapi` (`:8-9`). |
| `flightPriceCheckCopy` (`:87`) | **Reuse the sentence *shape*, not the function.** Its structure — `Last checked by {provider} on {absolute}. Final price and availability are confirmed by the provider.` — is the correct pattern and its trailing clause is the same boundary `HotelCard.tsx:747` draws. Hotels need a band-dependent middle clause it does not have. |
| `fareFreshnessSummary` (`:108`) | **Precedent, not reuse.** Line `:135-136` already warns at `> 6 hours`: `Recheck provider price before booking.` This is the existing in-repo precedent for a 6h boundary tied to the cache TTL. |

What is *missing* from the flight module and must be added for hotels: a **banded state** (`fresh | aging | stale | unknown | expired`). Flights have a binary older-than-6h flag on the summary only; individual fares have no band. Hotels need the band because hotel prices persist across two refresh cadences (§5) and because the deal-detail surface already depends on one.

**Recommendation:** a new `lib/hotelPriceFreshness.ts` that imports the four formatters above from `lib/providerFreshness.ts` and adds only the band logic and hotel copy. No duplicated date handling. If a future ticket wants flight fares banded too, the band function is generic enough to lift — but that is not this feature's job.

---

## 4. Reference Patterns

Two external references, compared at the level of interaction pattern.

### 4.1 Google Hotels — bounded claim, no timestamp

Google's traveler-facing hotel search states the change risk in plain language rather than displaying a last-checked time: *"However, hotel prices can change quickly, so if you select to book with one of our partners, check the final cost of your room carefully."* Behind that, Google's partner-side price accuracy programme treats mismatch between cached and live price as a measurable partner failure with penalties, and explicitly attributes inaccuracy to stale cached data. As of 29 Sept 2025 Google removes more inaccurate prices from display outright.

**Pattern:** the *user-facing* commitment is deliberately modest ("prices change, verify at the provider"), while the *system* holds itself to a hard accuracy standard internally and suppresses prices it cannot stand behind.

**Delta vs expaify:** expaify's copy already draws the same boundary (`HotelCard.tsx:747`, "Provider confirms final total, taxes, fees, room availability…") — that clause is correct and must survive. What expaify additionally has, and Google does not surface, is a *verified* fetch timestamp per offer. Showing it is a strict improvement over the Google pattern **only if** the age is stated with a risk posture attached; a bare relative time with no posture (current `DealCard.tsx:113`) is weaker than Google's sentence, because it invites the reader to treat any stated age as endorsement.

### 4.2 Booking.com Demand API — cache duration is the disclosure trigger

Booking.com's accommodation pricing guidance to integrators: *"Avoid storing or caching availability prices for too long. Inventory and pricing can change quickly, and using stale data may lead to mismatches."* It prescribes a final `/orders/preview` re-check before confirming, recommends presenting availability-endpoint prices as *"estimated or starting from"*, and supplies model traveler-facing copy: *"Final price may vary slightly due to taxes, currency rounding, or policy conditions."*

**Pattern:** the length of time a price has been cached is the thing that determines how the price must be framed. Short cache → present as a price. Long cache → present as an estimate, and re-check before commitment.

**Delta vs expaify:** expaify cannot re-check before handoff (constraint 3 forbids it, and the handoff is outbound to a third party). We therefore **cannot** import the `/orders/preview` half of the pattern. What we can and must import is the first half: **cache age determines framing.** expaify's own `priceBasis: 'per_night_before_taxes_fees'` and "Provider confirms final total…" already do Booking's "estimated / starting from" work. The missing half is the age-dependent framing.

**Synthesis for expaify:** Google says "state the risk, don't overclaim". Booking says "let age drive the framing". expaify's differentiator is that it has the verified timestamp both references lack a display for — so: **state the age, and let the age pick the framing, and never let either read as a guarantee.**

Sources:
- [Search for hotels on Google — Travel Help](https://support.google.com/travel/answer/6276008?hl=en)
- [Price Accuracy Policy — Hotel Center Help](https://support.google.com/hotelprices/answer/6064419?hl=en)
- [Improve Price Accuracy — Hotel Center Help](https://support.google.com/hotelprices/answer/6069469?hl=en)
- [Accommodation pricing guide — Booking.com Developers](https://developers.booking.com/demand/docs/accommodations/prices-accommodations)

---

## 5. The Central Finding — Two Cadences, One Model

Discovery proposes a single flat band table: fresh ≤6h, aging >6h–<48h, stale ≥48h. **That table is wrong for two of the four surfaces, and the reason it is wrong is the key research result.**

Hotel prices reach expaify's UI through two independent refresh mechanisms with different designed intervals:

| Cadence | Mechanism | Designed refresh interval | Surfaces |
|---|---|---|---|
| **Live search** | `HotellookProvider.searchHotels` with `CACHE_TTL = 21600` (`hotellook.ts:18`) | **6h** — after which the next search refetches | Hotel result card + expanded detail; booking review reached from a hotel result |
| **Nightly snapshot** | `scripts/snapshot-job.ts`, cron 04:00 UTC (`.github/workflows/snapshot.yml`) | **24h** | Deal feed card; deal detail; booking review reached from a saved deal |

Apply discovery's flat table to the deal feed: a saved deal refreshed on schedule at 04:00 UTC is, by design, between 0h and 24h old whenever you look at it — averaging 12h. Under a flat >6h "aging, reconfirm with the provider" rule, **roughly three-quarters of correctly-functioning deal cards would render a warning.** That is warning fatigue manufactured by the threshold, not by any real risk, and it would degrade the one surface (deal detail, `page.tsx:381-391`) that is currently right.

Apply it in the other direction to hotel results: because the cache is 6h, a live-search price can essentially never exceed 6h. Under the flat table, `HotelCard` would render `fresh` for 100% of offers that have a timestamp. Its aging and stale branches would be dead code — and the honest reading is that **`HotelCard`'s real problem is not staleness at all; it is that 100% of its prices are in the `unknown` state.** Any design that spends its effort on stale styling for the hotel card is optimising the wrong branch.

Both observations point to the same rule: **the band boundary is a function of how often that price is supposed to refresh.** One shared state machine, one shared copy system, one shared component — parameterised by a declared cadence, not by the surface.

**The proposed formula, and why it is not arbitrary:**

```
fresh:   age ≤ 1.25 × expectedRefreshHours
aging:   1.25 × expectedRefreshHours < age < 2 × expectedRefreshHours
stale:   age ≥ 2 × expectedRefreshHours
```

Read plainly: **fresh** = the refresh cycle is working (with a 25% grace margin for job latency); **aging** = one refresh cycle has been missed; **stale** = two or more have been missed, so the pipeline itself is not functioning and the price is unsupported.

Substituting `expectedRefreshHours = 24` (nightly snapshot) yields **30h and 48h** — reproducing the existing deal-detail constants at `page.tsx:276-277` exactly. Those numbers were chosen independently and the formula recovers them; that is the strongest available evidence that the formula describes the product's actual intent rather than a post-hoc rationalisation. It also means deal detail's rendered behaviour is unchanged, which makes this a low-regression-risk generalisation.

Substituting `expectedRefreshHours = 6` (live search) yields **7.5h and 12h** — bands that are, correctly, almost unreachable while the cache is healthy, and which fire only when it genuinely is not.

---

## 6. Design Directives

Five testable directives. Each states the exact behaviour and the test that falsifies it.

---

### D1 — One shared module; every surface reads it; no surface computes freshness

Create `lib/hotelPriceFreshness.ts`. It must import `validFreshnessDate`, `formatRelativeFreshness`, `formatAbsoluteFreshness`, `providerDisplayName`, and `hasProviderName` from `lib/providerFreshness.ts`. It must not redefine date parsing or relative formatting.

It exports exactly one state type, reusing the existing analytics enum verbatim:

```
type HotelPriceFreshnessState = 'fresh' | 'aging' | 'stale' | 'unknown' | 'expired'
```

(identical to `HotelDecisionPriceFreshnessState`, `app/components/HotelDecisionAnalytics.tsx:8` — the design spec must specify which module owns the canonical definition and which re-exports, so there is one declaration, not two.)

It exports one resolver taking a verified timestamp, a cadence, an optional `expiresAt`, and `now`, and returning `{ state, ageHours | null, shortClause, sentence, ariaSentence, absolute | null }`.

Required consumers, replacing the listed local logic:

| File:line | Replaces |
|---|---|
| `app/components/ui/DealCard.tsx:63, 108-115` | `timeAgo(deal.updatedAt)` + the `{checked ? … : null}` guard |
| `app/components/HotelCard.tsx:361, 379, 746, 763, 765-766` | all five hardcoded literals |
| `app/deals/[dealId]/page.tsx:273-277, 296-304, 381-391` | the inline 30/48 arithmetic and the five inline copy branches |
| `app/book/BookingFlow.tsx:353` | the hardcoded literal; reads `hotelContext.priceCheckedAt` |

**Precedence rule (must be in the module, not in each surface):** `expired` (past `expires_at`) outranks every other state — matching the existing `!isExpired &&` guards at `page.tsx:276-277`. Below that, absence of a valid timestamp yields `unknown` regardless of cadence.

**Test that falsifies:** grep the four files for `30`, `48`, `timeAgo(`, `Last-checked`, `Last checked` — zero hits outside the shared module. Second test: a unit test asserting `page.tsx`'s rendered strings for ages 1h / 29h / 31h / 49h / null are byte-identical before and after the refactor.

---

### D2 — Bands derive from a declared refresh cadence, never from the surface

The module exports exactly two cadence constants and no other threshold numbers:

```
HOTEL_PRICE_CADENCE = {
  live_search:      { expectedRefreshHours: 6,  agingAtHours: 7.5, staleAtHours: 12 },
  nightly_snapshot: { expectedRefreshHours: 24, agingAtHours: 30,  staleAtHours: 48 },
}
```

`agingAtHours = 1.25 × expectedRefreshHours`; `staleAtHours = 2 × expectedRefreshHours`. Boundaries are `state = fresh if age ≤ agingAt; aging if age < staleAt; else stale` — inclusive at the aging boundary and at the stale boundary, matching `page.tsx:276-277` (`>= 30`, `>= 48`).

Cadence assignment per surface:

| Surface | Cadence | Source of timestamp |
|---|---|---|
| Deal feed card | `nightly_snapshot` | `deal.updatedAt` |
| Deal detail | `nightly_snapshot` | `deal.updated_at` |
| Hotel result card + expanded | `live_search` | new `HotelOffer` price timestamp (D5) |
| Booking review — from a hotel result | `live_search` | `hotelContext.priceCheckedAt` |
| Booking review — from a saved deal | `nightly_snapshot` | `hotelContext.priceCheckedAt` |

Booking review must therefore carry the cadence alongside the timestamp. `BookingHotelContext.entrySource` (`lib/booking/config.ts:65`) already distinguishes entry paths; the design spec must state whether cadence is derived from `entrySource` or added as its own field. **Recommendation: its own explicit field**, because deriving a data-integrity claim from a navigation attribute is exactly the kind of inference constraint 1 forbids — if the field is absent, the state is `unknown`, not a guess.

**Test that falsifies:** a table test over `{cadence} × {age: 0, agingAt−0.1, agingAt, agingAt+0.1, staleAt−0.1, staleAt, staleAt+1, null}` asserting the exact state. Plus: for `nightly_snapshot`, ages 0–29.9h must return `fresh` — proving the deal feed is not warning-flooded.

---

### D3 — Exact copy per state, three lengths, zero silent branches

Every state renders in all three registers. No state renders nothing. Copy is fixed strings, not composed at call sites.

`{rel}` = `formatRelativeFreshness` output (`2 hr ago`, `yesterday`, `3 days ago`, `on Mar 14`). `{abs}` = `formatAbsoluteFreshness`. `{provider}` = `providerDisplayName`.

| State | Short clause (≤22 chars, price column / feed card) | Sentence (expanded detail, deal detail, booking review) | Screen-reader sentence (appended to CTA aria-label) |
|---|---|---|---|
| `fresh` | `Checked {rel}` | `Last checked by {provider} on {abs}. Final price and availability are confirmed by the provider.` | same as Sentence |
| `aging` | `Checked {rel} — recheck` | `Last checked by {provider} {rel}. Recheck the current rate with the provider before you book.` | `Price is aging. Last checked by {provider} {rel}. Recheck the current rate with the provider before you book.` |
| `stale` | `Checked {rel} — may differ` | `We have not rechecked this rate since {abs}. It may no longer match what the provider charges.` | `Price may be out of date. We have not rechecked this rate since {abs}. It may no longer match what the provider charges.` |
| `unknown` | `Check time unknown` | `Last-checked time unavailable for {provider}. Final price and availability are confirmed by the provider.` | `Last-checked time unknown. Last-checked time unavailable for {provider}. Final price and availability are confirmed by the provider.` |
| `expired` | `Expired {rel}` | `This saved rate expired {abs}. It is shown for reference only.` | `Rate expired. This saved rate expired {abs}. It is shown for reference only.` |

Rules binding on the design spec:

1. **No branch may render null.** The `{checked ? … : null}` pattern at `DealCard.tsx:108-115` is removed; a missing timestamp renders the `unknown` copy.
2. **When `hasProviderName` is false**, fall back to the provider-less variants already established in `flightPriceCheckCopy` (`providerFreshness.ts:97, 102`) — `Provider name unavailable.` — rather than emitting an empty name. One additional row per state; the design spec must enumerate them.
3. **The provider-confirmation clause survives verbatim.** `Final price and availability are confirmed by the provider.` (flights, `providerFreshness.ts:93`) and `Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.` (`HotelCard.tsx:747`) are the constraint-2 boundary. Freshness copy is added beside them, never in place of them.
4. **Banned phrasings** (constraint 2 — no hold or guarantee): "price locked", "guaranteed until", "valid for", "expires in", "hurry", "price held", any countdown, and any future-tense claim about what the price *will* be. Also banned: the word "live" applied to a cached price.
5. **One phrasing per state across all four surfaces.** The current three-way drift ("unavailable" / "not provided" / "unavailable for") is eliminated; the table above is the single source.
6. **Never a bare relative time with no posture.** `Price checked 40d ago` in neutral styling (today's `DealCard.tsx:113`) is prohibited; at that age the state resolves `stale` and the stale copy applies.

**Test that falsifies:** snapshot test rendering all five states × both provider-name conditions × all four surfaces = 40 cases, asserting a non-empty freshness string in every one. Second test: assert none of the banned strings appears in any rendered output.

---

### D4 — Hierarchy and 375px layout

Hierarchy on every hotel surface, unchanged by state:

1. **Primary:** the nightly rate.
2. **Secondary:** the Deal Score / verdict.
3. **Tertiary:** the freshness statement.
4. **Action:** the CTA.

Freshness never outranks price or Deal Score, and never displaces the CTA.

Layout rules:

- **Fresh and unknown** render the short clause only, in the existing price column (`HotelCard.tsx:351`, `min-w-[6.75rem] max-w-[9.5rem]`), at `text-xs` in `--text-3` (fresh) or `--text-2` (unknown). Both clauses are ≤22 chars and wrap to at most two lines in that column at 375px. The full sentence goes to the aria-label (`:763`) and the expanded "Rate check" block (`:1048-1049`).
- **Aging, stale, and expired** must **not** render inside the narrow price column. They render as a **full-width row placed directly above the Deal Score + CTA row** (`HotelCard.tsx:939`), so the sentence has the full card width and cannot be clipped or wrapped into the price. At 375px this adds one row above the CTA row and must not push the CTA below the fold on a 375×667 viewport with the card at the top of results.
- **Colour is never the only signal** (constraint 4). Amber `--warning` may be used for `aging`/`stale` and `--error-text` for `expired`, but each must also carry a lexical marker in the visible string — the `— recheck` / `— may differ` suffixes and the "Expired" word in the table above. **The permanent amber lines at `HotelCard.tsx:361` and `:379` are removed**: `unknown` is a neutral-tone state (`--text-2`), not a warning tone, because a state that applies to 100% of offers cannot function as a warning.
- **`PriceUnavailable` (`:367-383`) keeps its freshness line** with the same state resolution. A price that could not be read still has a fetch attempt with a time, and the aria-label at `:369` must carry the same sentence as the visual line.
- **Absolute time must not be `title`-only.** `DealCard.tsx:110` and the tooltip pattern are supplementary; the absolute time must appear in visible text on deal detail and booking review, and in the aria-label on cards.

**Test that falsifies:** render each surface at 375×667 in each of the five states; assert (a) no text overlaps or clips, (b) the CTA remains within the first viewport for the first result card, (c) the freshness element's computed order in the accessibility tree falls after price and Deal Score and before the CTA, (d) with CSS colour forced to a single value, every state is still distinguishable from `fresh` by text alone.

---

### D5 — Data dependency and instrumentation, specified now

**Data (DEV stage — hand these to `DEV-HOTEL-PRICE-FRESHNESS-01` if the UI stage cannot cover them):**

1. Add `priceCheckedAt?: string` to `HotelOffer` (`lib/types.ts:474-495`). **Use this exact name** — it already exists on `BookingHotelContext` (`lib/booking/config.ts:71`) with validation and URL round-tripping; a second name would fork the vocabulary.
2. Populate it in `lib/providers/hotellook.ts` from the `fetchedAt` already computed at `:492` — the same value already passed to `buildHotelClassEvidence` at `:525`.
3. **Preserve it across cache replay.** `normalizeCachedHotelOffer` (`:336-362`) is a strict allow-list; it must explicitly copy `priceCheckedAt` (validating with `validFreshnessDate`) or every cached offer silently degrades to `unknown` — which would leave up to 6h of every result set unmarked and quietly reproduce the bug this feature exists to fix.
4. Pass it through both `buildBookingHotelContext` call sites — `app/components/HotelCard.tsx:812` and `lib/booking/config.ts:1060` — via the existing `BookingHotelContinuity` (`config.ts:940-942`), and render it at `BookingFlow.tsx:353`.
5. **`unknown` is permanent, not transitional.** `lib/providers/bookingComRapidApi.ts` returns no hotel offers today, and no provider contract can be assumed to supply a timestamp. `unknown` must never be treated as a defect state to be styled away.
6. **Never infer.** No `?? new Date()`, no render-time default, no reuse of the `fetchedAt` from `hotelClass`/`guestRating` evidence as a proxy for the price — those are separate evidence records and may diverge under future providers. Absent a price-level timestamp, the state is `unknown`.

**Instrumentation** — add `price_freshness_state` (the five-value enum) and `price_age_hours` (number or null) to:

| Event | File | Purpose |
|---|---|---|
| `hotel_provider_handoff_clicked` | `CompareRow.tsx:124-133` | handoff conversion by band |
| `hotel_room_handoff_started` | `HotelDecisionAnalytics.tsx:125-129` | handoff conversion by band |
| new `hotel_card_impression` | `HotelCard.tsx` (reuse the `IntersectionObserver` pattern at `HotelDecisionAnalytics.tsx:78-108`) | denominator for conversion by band; also yields the coverage metric |
| hotel review CTA click | `HotelCard.tsx:943-959` | the band shown at the moment of commitment |
| hotel return-reason submit | `BookingFlow.tsx:37, 42-48` | joins `price_or_fees_mismatch` to the band shown at handoff — **the falsification test for D2's thresholds** |

Two derived counters, both from `hotel_card_impression`:
- **Coverage** = impressions with `price_freshness_state != 'unknown'` ÷ all impressions. Today 0% on `HotelCard` and `BookingFlow`.
- **Silent-omission rate** = impressions where no freshness string was rendered. Target and expected value: **zero**, enforced by D3 rule 1.

**Test that falsifies D2's threshold choice:** once instrumented, `price_or_fees_mismatch` rate must be materially higher in `aging` + `stale` than in `fresh`. If it is flat across bands, the bands are drawn in the wrong place and the cadence multipliers in D2 must be revisited — that is the intended, falsifiable outcome, and it is why D5 is a directive and not a follow-up.

---

## 7. Open Questions for UXDES

1. **Booking-review cadence field.** D2 recommends an explicit cadence field on `BookingHotelContext` rather than deriving it from `entrySource`. The design spec must decide and state the `unknown` fallback when it is absent.
2. **Canonical enum ownership.** `HotelDecisionPriceFreshnessState` lives in `app/components/HotelDecisionAnalytics.tsx:8`; the shared module needs the same type. Spec must name the owner and the re-exporter.
3. **Feed-card short clause at the narrowest width.** `DealCard` uses `text-caption` full-width (`:108-115`), so it is less constrained than `HotelCard`'s price column — but the design spec should confirm whether the feed card shows the short clause or the sentence in the `aging`/`stale` states.

---

## 8. Scope Confirmations

- **No conflict with the non-negotiable contract found.** No provider call moves out of `lib/providers`; money handling is untouched; no new secrets; affiliate markers on `CompareRow` links (`:35-81`) are unaffected.
- **Constraint 3 respected:** every directive computes from data already in the payload. `CACHE_TTL = 21600` is unchanged, and the 6h cache is *load-bearing* for D2 — it is what makes `live_search` bands meaningful.
- **Out of scope, confirmed untouched:** flight freshness (`lib/providerFreshness.ts` is imported, not modified), rate holds, provider re-check on render.
- **Out-of-scope observation, logged not fixed:** `lib/timeAgo.ts:16` has no upper bound and is used by `DealCard.tsx:63` and `app/deals/[dealId]/page.tsx:275, 278`. D1 removes both hotel-price uses; `foundAgo` (`page.tsx:278`, "first seen") remains on `timeAgo` and is outside this feature.

---

## 9. Handoff

Next stage: **UXDES-HOTEL-PRICE-FRESHNESS-01** — produce the implementation-ready spec from D1–D5: every state × every surface × every viewport, final copy for all 40 render cases plus the provider-name-absent variants, Tailwind class patterns per state using `--text-2` / `--text-3` / `--warning` / `--error-text`, and the resolved answers to the three open questions in §7.
