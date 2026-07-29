# UXR-HOTEL-AVAILABILITY-SIGNAL-01 — Hotel Availability Confidence

**Stage:** UX Research
**Feature slug:** `hotel-availability-signal`
**Priority:** P0
**Date:** 2026-07-29
**Upstream:** `docs/pipeline/hotel-availability-signal/01-discovery.md`

---

## 1. Summary

The discovery problem statement holds: **expaify renders an unverified property-level minimum price with the visual and copy treatment of a bookable rate, and labels it `available` in the API stream on the strength of `offers.length > 0`.** That is confirmed in code and is the correct thing to fix.

Three discovery findings did not survive the code audit and change what the fix must target:

1. **There is no discarded availability signal to recover.** `bookingComRapidApi.ts` and `duffel.ts` are `FlightProvider` implementations. Neither contains a hotel code path. `HotellookProvider` is the only `HotelProvider` in the repo. Audit result: zero recoverable fields. (§3)
2. **`HotelCard.tsx` is not mounted in any route, and nothing in the repo consumes the `/api/search` NDJSON stream.** The `hotel-status: 'available'` defect is real but is an **API-contract** defect with no rendered blast radius today. The surfaces users actually see hotel prices on are `/deals`, `/deals/[dealId]`, and `/book`. (§4)
3. **The user-visible hotel price has *weaker* provenance than discovery describes.** `/deals` renders `latest_price_cents` from `price_snapshots` — a nightly snapshot observation, not the 6h Hotellook cache. `/deals/[dealId]` synthesises a `HotelOffer` with `source: 'expaify'` and `deeplink: ''`. Neither is even `indicative` in discovery's sense. (§4.3)

The proposed three-state model is **validated with four amendments** (§6), and the `fetchedAt` dependency is **resolved: do not add a field — the `hotel-price-freshness` line already owns it** (§5).

---

## 2. Method

Read-only audit of the current worktree. Every claim below cites a file and line read directly. Reference-pattern claims are labelled as pattern knowledge and are kept at the interaction-pattern level, per the ticket. Scarcity and urgency patterns are excluded by constraint 1 and are not analysed.

---

## 3. Task 1 — Adapter audit: `bookingComRapidApi.ts` and `duffel.ts`

**Result: no availability- or rate-scoped field is discarded in normalization, because neither adapter normalizes hotels at all.**

| Adapter | Interface | Hotel path | Availability fields |
|---|---|---|---|
| `lib/providers/bookingComRapidApi.ts:39` | `implements FlightProvider` | none | none |
| `lib/providers/duffel.ts` | flight offers only | none | none |
| `lib/providers/hotellook.ts:425` | `implements HotelProvider` | the only one | none |

Detail:

- **`bookingComRapidApi.ts` returns no offers of any kind.** `searchFares` reaches `:108` and returns `{ ok: false, reason: 'Booking.com RapidAPI response mapping not finalized; provide a sample JSON response body' }` on every successful HTTP response. `priceTrends` returns `[]` (`:59`). The cache write is deliberately deferred (`:112-113`). A grep for `avail|room|rate_?id|soldout|block|is_?bookable|refundable|fetchedAt` over the file returns **zero hits**. There is no hotel endpoint configured — only `/api/v1/flights/getMinPriceMultiStops` (`:7`).
- **`duffel.ts` is flight-only.** It maps `total_amount` (`:219`), `cabin_class` (`:235`), and slice/segment structure. No hotel or stay type is declared or consumed.
- **Hotellook confirms discovery §2.** `HotelLookCacheEntry` (`:22-41`) is the full set of fields read; `priceFrom` (`:412-423`) is the only money field and is a property minimum in major units. `coverage: 'unconfirmed'` on all three return paths (`:466`, `:489`, `:547`). `checkDocumentReadiness` (`:555-561`) returns `notProvidedHotelDocumentReadiness('Hotellook')` with the comment *"Preserve that supplier omission instead of inferring availability"* — the adapter layer is already honest; the loss happens above it.

**One usable pattern precedent found, on the flight side.** Duffel *does* perform a rate-scoped availability recheck for flights, and the product already has copy for it:

> `BookingFlow.tsx:450` — "Duffel rechecks price, currency, passenger count, and availability before any order is created."
> `BookingFlow.tsx:1417` — "Keeping the selected fare visible while Duffel checks price, currency, passenger count, and availability."

This is the `rate_confirmed` shape expaify already ships — for flights. Hotels have no analogue and cannot have one from Hotellook. **The vocabulary and interaction shape for a future confirmed hotel state should be borrowed from these two strings rather than invented**, so a traveler who has seen the flight flow reads the hotel flow the same way.

**Consequence for this feature:** the MVP output is not a recovery of hidden signal. It is a permanent, correctly-labelled honest state, with the confirmed slot reserved and provably unreachable. That is exactly what discovery §6 predicted, and the audit confirms it rather than softening it.

---

## 4. The surface map is wrong in discovery — corrected

This is the most consequential research finding and it changes where the work lands.

### 4.1 `HotelCard.tsx` is not rendered by any route

`grep -rn "HotelCard" app lib` outside the component file returns **test files only** (`app/components/__tests__/scorePresentation.test.tsx`, `HotelCard.petPolicy.test.tsx`, and siblings). No `page.tsx` imports it. The component is a fully-built, heavily-specced surface with no mount point.

Discovery §2 describes it as "Surface 1 — Deal feed / search results." It is not. That does not make the work invalid — `HotelCard` is the canonical hotel-offer presentation and is where multiple pipelines (`hotel-price-freshness`, `rate-eligibility`, `hotel-smoking-policy`, `hotel-parking-fit`) have already landed spec — but **the design spec must state plainly that these directives specify a component that is currently unmounted**, so TEST does not fail the ticket for an unverifiable-in-browser state, and so nobody claims a user-visible fix that no user can see.

### 4.2 Nothing consumes the `/api/search` stream

`app/api/search/route.ts:400` is the only caller of `searchHotelAvailability` (`:172`). A grep for `api/search` across `app` and `lib`, excluding tests and `/api/search/parse`, finds **no streaming client**. `app/components/ui/SearchBar.tsx:44` calls `/api/search/parse` only. The four `hotel-status` emissions (`:407`, `:429`, `:446`, `:471`) are asserted by `app/api/search/__tests__/route.test.ts:172, 478-565` and by nothing else.

So `status: 'available'` is currently a **contract lie with no reader**. Two implications, both pointing the same way:

- It is **not** the highest user-impact item in this feature, contrary to discovery §3 signal 1 ("the single most misleading line in the hotel path"). No user sees it.
- It is the **cheapest and least risky** item — one string, one payload field, one test file, zero UI regression surface. It should ship first precisely because a wrong contract that nothing reads yet is the last moment it is free to fix. Once a client is built against `'available'`, the fix becomes a breaking change.

### 4.3 What users actually see, and its provenance

| Surface | Component | Price origin | Availability semantics today |
|---|---|---|---|
| `/deals` | `app/components/ui/DealCard.tsx` | `latest_price_cents` from `price_snapshots` (`lib/pipeline/dealDetection.ts:52-54`) | none. Age only: `Price checked {ago}` (`DealCard.tsx:108-115`). `Sample hotel — not bookable` for `is_mock` (`:121`). |
| `/deals/[dealId]` | `app/deals/[dealId]/page.tsx` | `deal.deal_price_cents`, wrapped in a synthetic `HotelOffer` with `source: 'expaify'`, `deeplink: ''` (`:212-223`) | none pre-expiry. `Saved rate expired` / `shown for reference only` post-expiry (`:382`, `:418`). |
| `/book` | `app/book/BookingFlow.tsx` | carried context | deferral only (`:1094`), plus post-hoc `room_availability_mismatch` (`:39`, `:47`). |

**The nightly-snapshot price on `/deals` is a weaker claim than Hotellook's 6h cache**, and it is the price the most users see. It is an observation of what a price was on some past night, rendered next to a `View deal` CTA. Discovery's `indicative` state does not describe it accurately — a snapshot-derived figure is a *historical observation*, not a *supplier-quoted starting price*.

**Scope call:** I am **not** widening this ticket to respec `/deals`. `real-deal-inventory` owns the mock/quota problem and `sold-out-recovery` owns post-expiry recovery on `/deals/[dealId]`. But the *model* in D2 must be able to express a snapshot-derived price, or the feed will later be forced to mislabel itself as `indicative`. D2 therefore adds a fourth basis value for it, with no UI directive attached in this ticket. This is a type-surface decision, not a scope expansion, and it is the cheapest possible accommodation.

---

## 5. Task 4 — `fetchedAt` dependency: RESOLVED, and there is a live collision to avoid

**Do not specify a new timestamp field. `hotel-price-freshness` already specified it, by exact name, with population and cache-replay rules.**

`docs/pipeline/hotel-price-freshness/02-research.md` directive D5 states:

> 1. Add `priceCheckedAt?: string` to `HotelOffer` (`lib/types.ts:474-495`). **Use this exact name** — it already exists on `BookingHotelContext` (`lib/booking/config.ts:71`) with validation and URL round-tripping; a second name would fork the vocabulary.
> 2. Populate it in `lib/providers/hotellook.ts` from the `fetchedAt` already computed at `:492`.
> 3. **Preserve it across cache replay.** `normalizeCachedHotelOffer` (`:336-362`) is a strict allow-list; it must explicitly copy `priceCheckedAt`.

Verified against code: `normalizeCachedHotelOffer` (`hotellook.ts:336-399`) is indeed a strict allow-list that returns a rebuilt object — any field not explicitly copied is dropped on cache replay. `fetchedAt` is computed at `hotellook.ts:519` and passed only to `buildHotelClassEvidence` (`:522`) and `buildGuestRatingEvidence` (`:528`).

**Four collisions this ticket must avoid.** Each is a place where following discovery literally would land a conflicting shape on the same file:

| # | Discovery proposed | Conflict | Resolution |
|---|---|---|---|
| C1 | a rate-scoped `fetchedAt` on `HotelOffer` (§8) | `priceCheckedAt?: string` already specified | **consume** `priceCheckedAt`; add no timestamp field |
| C2 | fix the hardcoded `Last-checked time unavailable` (§3.3, `HotelCard.tsx:361, 379`) | price-freshness D3 already removes both amber lines and reassigns the tone to `--text-2` | **out of scope here.** This ticket must not respec `:361`/`:379` |
| C3 | `rateAgeBucket` analytics prop (§7) | price-freshness D5 adds `price_age_hours` + `price_freshness_state` to the same events | **drop `rateAgeBucket`.** Join on `price_age_hours` |
| C4 | new `hotel_availability_state_shown` impression event (§7) | price-freshness D5 adds a new `hotel_card_impression` event on the same `IntersectionObserver` | **reuse `hotel_card_impression`.** Two impression events for one card doubles payload for one prop |

Discovery §6's "rate age is a separate axis" instruction is correct and is what makes all four resolutions clean: **this ticket owns the bookability axis and takes a hard dependency on the freshness line for the age axis.** It specifies no timestamps, no age buckets, no relative-time copy.

**Sequencing note for DEV:** both features edit `lib/types.ts` `HotelOffer` and `normalizeCachedHotelOffer`. Whichever lands second must rebase, not re-add. Neither field is blocking for the other — `availabilityBasis` is renderable with no timestamp at all, which is deliberate.

---

## 6. Task 2 — Reference patterns, at interaction-pattern level

Two references, chosen because they sit on opposite sides of the question that matters here: *who owns the rate?* Scarcity, urgency, and inventory-count patterns are excluded by constraint 1 and are not described.

### 6.1 Booking.com — rate identity is the display unit

**The pattern:** price is never shown without the rate it belongs to. A results card surfaces the room type and the rate's binding conditions together — room name, cancellation terms, prepayment terms — and the price is presented as the price *of that named rate*. The identity persists from list to detail to checkout, so the object the user selected is the object that gets validated.

**Failure handling between list and handoff:** the dead rate is treated as a **state of the same object**, not an error. The rate is marked gone in place, and the user is re-anchored to what still exists — remaining rates at the same property, or adjacent dates — without leaving the property context.

**Applicability to expaify: largely negative, and that is the finding.** Hotellook returns no room, no rate id, and no conditions (`hotellook.ts:22-41`). expaify **cannot adopt this pattern and must not imitate its surface** — showing a nightly price with the confidence Booking.com's card carries, without the rate identity that earns it, is precisely the current defect. The transferable part is narrow: *if* a future adapter supplies rate identity, the identity must be carried through to handoff and be the thing that fails, which is why D2 scopes the confirmed state to a rate id rather than a boolean.

### 6.2 Google Hotels — the aggregator pattern, and the right comparison

Structurally this is expaify's shape: an aggregator displaying other parties' rates it does not own. Three pattern elements:

1. **Attribution is mandatory and adjacent.** Every price carries the partner it came from, in the price block, not in a footnote.
2. **The price carries an explicit accuracy boundary.** Prices are labelled as sourced from the partner, with a standing disclosure that the partner's final total may differ and may exclude taxes and fees. The disclosure is attached to the price, not deferred to the destination.
3. **The CTA verb is a visit-partner verb, not a book verb** — the handoff boundary is stated in the action itself.
4. **Rate-accuracy outcome is a first-class, instrumented product surface**, feeding partner reliability rather than sitting in an optional post-hoc prompt.

**Applicability: high. expaify already has 1 and 3, and has neither 2 nor 4.**

| Google Hotels element | expaify today | Delta |
|---|---|---|
| Partner attribution on the price | ✅ `Rate from {provider}` (`HotelCard.tsx:360`) | none — keep as-is |
| Visit-partner CTA verb | ✅ `Review hotel` (`HotelCard.tsx:943-959`); handoff sentence at `:747` | none — **do not change the CTA verb**; it is already correct and is the one element carrying the boundary |
| Accuracy boundary on the price | ❌ the boundary sentence exists only behind the `Details` toggle (`:1066-1069`) and is byte-identical for every offer | **the gap this ticket closes** — D3 |
| Outcome instrumentation | ❌ `hotel_room_handoff_started` (`HotelDecisionAnalytics.tsx:125`) has no outcome counterpart; `handleReturnFeedback` (`BookingFlow.tsx:957-969`) emits a client event and persists nothing | **D5** |

**The honest positioning conclusion.** Google Hotels shows *partner-quoted rates* and still judges an accuracy disclosure necessary. expaify shows a *property-level cached minimum* — a strictly weaker claim — with less disclosure. That asymmetry is the research finding that justifies a permanent, non-dismissible state rather than a tooltip: the disclosure obligation here is higher than Google's, not lower.

It also settles the framing of the model. "Confirmed vs indicative" is not a choice expaify gets to make per offer today. **Every Hotellook offer is indicative, permanently, until an adapter earns otherwise** — so the collapsed-card line is not a warning that fires sometimes. It is a standing property of the price, and must be toned as one (see D3 on tone).

---

## 7. Task 3 — RESOLVED: the signal does not go in the price column

**Finding: the price block cannot take a fourth line, and the row above the CTA is already claimed. Use the existing full-width evidence-line slot at `HotelCard.tsx:906`.**

Evidence:

- The price column is `min-w-[6.75rem] max-w-[9.5rem] text-right` (`HotelCard.tsx:351`) and already renders **five** elements: `Nightly rate` label, the price at `text-xl`/`sm:text-4xl`, `per night before taxes and fees`, `Rate from {provider}`, and the amber `Last-checked time unavailable` (`:352-362`). At 375px this column is ~108–152px wide. A sixth line of availability copy either truncates or wraps to three lines and pushes the CTA down.
- Below 351px the whole price block reflows to `col-span-2` (`:894`), so any line inside it changes layout role between breakpoints — the wrong home for a permanent state.
- **price-freshness D3 has already claimed both candidate slots**: the short clause goes in the price column, and the non-fresh states go in "a full-width row placed directly above the Deal Score + CTA row (`HotelCard.tsx:939`)". Putting availability there too creates two full-width rows above the CTA with no defined order, and D3 already commits to keeping the CTA in the first viewport at 375×667.

**Resolution — use the established collapsed-evidence-line pattern.** `HotelCard` already has a full-width, one-line, above-the-fold evidence slot immediately after the identity/price grid: `HotelCardEligibilityLine` at `:906`, implemented at `HotelRateRestrictions.tsx:118-152` as `mt-3 min-w-0 rounded-[var(--radius-control)] border px-3 py-2 text-xs font-medium leading-5` with a `break-words` span. `collapsedSmokingPolicy` (`:929-937`) and `ParkingSummary` (`:908-913`) follow the same one-line convention.

Availability takes a sibling line in that stack, **placed before the eligibility line** — rate provenance precedes rate restrictions, because a restriction on an unquoted rate is a second-order fact. Resulting collapsed order:

```
identity + price grid          (:857-903)
▸ availability basis line      ← new, this ticket
  eligibility line             (:906)
  parking summary              (:908)
  funds policy summary         (:915)
  pet / smoking lines          (:927-937)
  freshness row (non-fresh)    ← price-freshness D3
  score chip + CTA row         (:939)
```

This ordering contract is the deliverable of Task 3 and must be restated in the design spec so the two features do not fight at implementation time.

---

## 8. Task 5 — Directives

Five directives. Each names its file, its exact change, and the test that falsifies it.

---

### D1 — `hotel-status` must not assert availability, and the word must leave the hotel path

**Change — `app/api/search/route.ts`:**

1. `:405-407` — replace `status: 'available'` with `status: 'offers_returned'`. The gate (`hotelsResult.ok && hotelsResult.data.offers.length > 0`) is a correct test for *offers returned*; only the label is wrong. Add `availabilityBasis` to the payload as the coarsest true summary of the page (`'indicative'` for every Hotellook page today).
2. `:471` — the `skipped` message currently reads *"Enter a destination plus depart and return dates to check hotel availability."* Change to *"…to check hotel rates."* The product does not check availability; the copy must not promise it.
3. `:446` — the `unavailable` status stays. It describes **provider reachability**, which is a real and correctly-established fact. But note the vocabulary collision recorded in §9 OQ2 and do not let a later ticket "harmonise" the two meanings of the word.
4. `:188` — update the stream-type doc comment.
5. Update `app/api/search/__tests__/route.test.ts:172, 478-565`.

**Rationale:** the honest label costs nothing and, per §4.2, this is the last moment it is free — no client reads the stream yet.

**Test that falsifies:** run a hotel search that returns ≥1 offer; assert the serialised stream contains **zero** occurrences of the token `available` originating from the hotel path other than the `unavailable` provider-reachability status. Assert `offers_returned` carries `availabilityBasis`. Assert an empty result still emits `status: 'empty'` unchanged.

---

### D2 — Model: `availabilityBasis` + a declared capability, orthogonal to freshness

**Validating discovery §6:** three states are the right shape. Four amendments.

**A1 — Name it `availabilityBasis`, not `availabilityState`.** "State" reads as inventory status — *available / sold out* — which is the exact misreading this feature exists to prevent, and it collides with `accessEvidenceState`, `HotelRateFamilyState`, and `HotelDecisionPriceFreshnessState`. "Basis" names the *provenance of the price*, which is what the field actually holds.

**A2 — Add a fourth value, `snapshot_observed`.** Per §4.3, `/deals` renders a nightly-snapshot price. It is neither supplier-quoted nor absent. Without this value the feed is later forced to mislabel itself `indicative`. Type surface only in this ticket — **no UI directive, no copy, no rendering change on `/deals`**; that belongs to `real-deal-inventory` / `sold-out-recovery`.

**A3 — Declare capability, following the `HotelRateEligibilityCapability` precedent** (`lib/types.ts:466-472`, and `HOTEL_RATE_ELIGIBILITY_UNSUPPORTED` as used at `hotellook.ts:407, 538`). Without it, the absence of `rate_confirmed` is ambiguous between *the adapter cannot answer* and *the adapter answered no*. Constraint 2 requires this distinction.

**A4 — No timestamp, no age bucket, no relative-time copy in this feature.** Per §5 C1/C3.

**Shape (UXDES owns final naming of copy, not of types):**

```ts
export type HotelAvailabilityBasis =
  | 'rate_confirmed'      // supplier quoted a specific room/rate for the requested dates
  | 'indicative'          // supplier priced the property, not a bookable rate  (Hotellook priceFrom)
  | 'snapshot_observed'   // expaify's own historical observation, no supplier quote  (price_snapshots)
  | 'not_provided'        // no supplier rate data reached expaify

export interface HotelAvailabilityCapability {
  /** True only if the adapter's contract can return a room/rate-scoped quote. */
  rateScopedQuote: boolean
}
```

On `HotelOffer` (`lib/types.ts:474-496`), both fields **optional**, so `bookingComRapidApi` and the stubs compile unchanged (constraint 2).

**Population:**

| Site | Value |
|---|---|
| `hotellook.ts:519-539` fresh fetch | `availabilityBasis: 'indicative'`, `availabilityCapability: { rateScopedQuote: false }` |
| `hotellook.ts:459-470` cache replay | same — **must be copied explicitly in `normalizeCachedHotelOffer` (`:336-399`)**, which is a strict allow-list that drops unlisted fields |
| `hotellook.ts:485-489` empty result | no offers; page-level basis `'indicative'` |
| `app/deals/[dealId]/page.tsx:212-223` synthetic offer | `'snapshot_observed'` |
| any offer with no basis | resolves to `'not_provided'` at render — **never blank, never optimistic** |

**Never inferred.** No deriving basis from `deeplink` truthiness, `priceCents > 0`, `coverage`, or provider name. Absence resolves to `not_provided`, matching the `notProvidedHotelSmokingPolicy` / `createNotReturnedHotelFundsPolicy` convention already in the adapter.

**Test that falsifies:**
1. Round-trip a Hotellook offer through the Redis cache path; assert `availabilityBasis === 'indicative'` after replay. (This is the test that catches the allow-list drop — the highest-probability implementation bug in this feature, and the one that would silently un-fix up to 6h of every result set.)
2. Assert **no code path in the repo can produce `'rate_confirmed'`** — grep-level assertion, kept until an adapter earns it. If it ever passes, the reserved state has been faked.
3. An offer object with `availabilityBasis` absent renders the `not_provided` line, not an empty node.

---

### D3 — Collapsed card: one full-width line at `HotelCard.tsx:906`, above the eligibility line

**Placement:** per §7. New sibling line immediately **before** `<HotelCardEligibilityLine />` at `:906`. Reuse the `HotelRateRestrictions.tsx:142-151` container shape exactly — `mt-3 min-w-0 rounded-[var(--radius-control)] border px-3 py-2 text-xs font-medium leading-5` with a `break-words` span. No new colour, no new type scale (constraint 3).

**Copy — visible string and full-sentence `aria-label` for each basis.** `{provider}` resolves via `providerDisplayName` (`lib/providerFreshness.ts:19-32`), which already returns `'Provider unavailable'` for an empty source, so the strings are safe with no provider.

| Basis | Visible line | `aria-label` | Tone |
|---|---|---|---|
| `indicative` | `Starting rate — no room quoted` | `Starting rate for this property from {provider}. {provider} did not quote a specific room or rate for your dates. The provider confirms the room, availability, and total.` | `border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]` |
| `not_provided` | `No rate quote from a provider` | `No provider rate quote reached expaify for these dates. The price shown is not a provider quote for your dates.` | `border-[color:var(--border)] bg-[color:var(--bg-raised)] text-[color:var(--text-2)]` |
| `rate_confirmed` | `Room and rate quoted by {provider}` | `{provider} quoted this room and rate for your dates. {provider} confirms the final total, taxes, fees, and terms at handoff.` | `border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]` |
| `snapshot_observed` | not rendered on `HotelCard` in this ticket — see D2 A2 | — | — |

**Four copy rules, each with a reason:**

1. **Neutral tone, not warning tone.** No `--warning`, no `--warning-soft`, no icon. `indicative` applies to **100%** of production offers; a warning that never varies is not a warning, it is chrome. This mirrors the reasoning price-freshness D3 used to de-amber `HotelCard.tsx:361`. `--warning` stays reserved for states that discriminate between offers.
2. **Never use the words "available" / "unavailable" in this line.** Both are already load-bearing elsewhere in this component for different facts — `Price unavailable` (`:373`), `Booking unavailable` (`:738`), `getUnavailableReason` (`:385-395`). Reusing them for provenance would make two unrelated failures indistinguishable. Use *quote* / *rate* vocabulary.
3. **Never dismissible, never truncated, never `line-clamp`ed.** It is a standing property of the price. (`collapsedSmokingPolicy` uses `line-clamp-2` at `:930`; do not copy that here.)
4. **No `role="status"` / `aria-live`.** The basis is known at first render and never changes client-side, unlike the eligibility line's `loading`/`error` states (`HotelRateRestrictions.tsx:140`). A live region for static content is noise.

**Test that falsifies:** render each of the three basis values at 375×667 and 1280px. Assert (a) the line is present in all three — there is no basis for which nothing renders; (b) no clip, no overlap, `break-words` holds at 375px with the longest provider name; (c) the CTA row (`:939`) stays within the first viewport for the first card at 375×667 with the freshness row also present; (d) with all CSS colour forced to one value, the three states remain distinguishable **by text alone**; (e) the `aria-label` names the source and is a complete sentence in all three.

---

### D4 — Expanded panel: the deferral sentence must vary by basis

Today `providerConfirmationCopy` (`HotelCard.tsx:747`) is a module-level constant — *"Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms."* — rendered identically for every offer in the `Provider handoff` panel (`:1066-1069`), and `rateCheckCopy` (`:746`) is `Rate from {provider}. Last-checked time unavailable.` in the `Rate check` panel (`:1048-1049`). An offer whose room was quoted and one whose room was never quoted read word for word the same.

**Change:**

1. **`Rate check` panel (`:1045-1051`)** — add the basis sentence beneath the existing `Rate from {provider}` line, using the D3 `aria-label` sentence as the visible text. This is the one place the full sentence should be visible rather than aria-only.
   - `indicative`: `{provider} priced this property but did not quote a specific room or rate for your dates.`
   - `not_provided`: `No provider rate quote reached expaify for these dates.`
   - `rate_confirmed`: `{provider} quoted this room and rate for your dates.`
   - **Do not touch the `Last-checked time unavailable` line** at `:746` — owned by price-freshness (§5 C2).
2. **`Provider handoff` panel (`:1066-1069`)** — make the availability clause conditional. When the room was never quoted, the sentence must say the room is confirmed at the provider *for the first time*, not merely "confirmed":
   - `indicative` / `not_provided`: `{provider} selects the room, confirms availability for your dates, and sets the final total, taxes, fees, cancellation policy, and terms.`
   - `rate_confirmed`: keep the existing sentence.
3. **`app/book/BookingFlow.tsx:1094`** — the same split at the point of highest commitment. Current: *"The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms."* When basis is `indicative` or `not_provided`, it must state that no room has been selected yet. Basis must reach `BookingFlow` through the existing `BookingHotelContinuity` mechanism (`lib/booking/config.ts:940-942`) that price-freshness D5 item 4 already uses for `priceCheckedAt` — **one continuity change carrying both fields, not two.**

**Rationale:** this is the trust-arc inversion discovery §2 identified. Fixing it is a copy-conditionality change with no layout cost.

**Test that falsifies:** render two offers differing **only** in `availabilityBasis`; assert the expanded panel text differs, and that `BookingFlow` review text differs. Assert `providerConfirmationCopy` is no longer a single module constant serving all states. Assert no string in the delivered diff contains `Lorem`, `TODO`, or a placeholder brace.

---

### D5 — One denominator: add basis to the existing event set, add no new events

**Change — add a single prop `hotel_availability_basis` (the four-value enum, `'not_provided'` when absent) to the events price-freshness D5 already touches. No new event, no `rateAgeBucket` (§5 C3, C4).**

| Event | File | Why basis belongs here |
|---|---|---|
| `hotel_card_impression` (new, owned by price-freshness D5) | `HotelCard.tsx`, reusing the `IntersectionObserver` at `HotelDecisionAnalytics.tsx:78-108` | **the denominator.** Impressions by basis is the only way to compute handoff rate per basis |
| `hotel_room_handoff_started` | `HotelDecisionAnalytics.tsx:125-129` | handoff volume by basis — the numerator discovery §3 signal 5 says does not exist |
| hotel review CTA click | `HotelCard.tsx:943-959` | the basis shown at the moment of commitment |
| `hotel_provider_handoff_clicked` | `CompareRow.tsx:124-133` | the `/deals` handoff path, where `snapshot_observed` will show up |
| return-reason submit | `BookingFlow.tsx:957-969` (`handleReturnFeedback`) | joins `room_availability_mismatch` (`:39`, `:47`) to the basis that was shown — **the only outcome signal in the system** |

**Two derived metrics, both from `hotel_card_impression`:**

- **Basis coverage** = impressions with a non-null basis ÷ all impressions. Today **0%**. Target 100% — any gap is an un-populated adapter path, per D2.
- **Handoff-to-mismatch rate, split by basis.** This is the first real denominator for "how often does expaify send a user to a rate that is not there."

**Two honest limits, recorded not fixed:**

1. `handleReturnFeedback` (`BookingFlow.tsx:957-969`) emits a client analytics event and **persists nothing**. It is gated on `showReturnPrompt` (`:851`, `:1043`) and requires a voluntary return plus a radio selection. Realistic capture is low single digits, as discovery §3.5 says. Adding basis to it does not fix that — it makes the sample attributable rather than uninterpretable. **Persisting the outcome is out of scope for this ticket** and is the natural first ask of a follow-on.
2. With `rate_confirmed` unreachable (D2), the split has **one populated cell** until a rate-quoting adapter lands. That is not a reason to defer: the impression denominator and the `indicative` mismatch baseline must exist *before* a confirmed-capable adapter arrives, or the comparison can never be made.

**Test that falsifies the whole feature's premise:** once a rate-quoting adapter exists, the `room_availability_mismatch` rate must be materially lower under `rate_confirmed` than under `indicative`. If it is flat, the basis distinction carries no decision value for users and the collapsed-card line should be reduced to the expanded panel only. Stating this now is what makes D3 a claim rather than a preference.

---

## 9. Open questions for UXDES

1. **Mounting.** `HotelCard` is unmounted (§4.1). Does the design spec target it as canonical-but-dormant, or does UXDES want D3/D4 mirrored onto `/deals/[dealId]`, the nearest live hotel surface? **Recommendation: target `HotelCard` as specced, and state the dormancy explicitly in `03-design.md` §1** so TEST does not fail the ticket for an unverifiable-in-browser state and so no one claims a user-visible win.
2. **The word "available" has three meanings in the hotel path** — provider reachability (`route.ts:446`), price readability (`HotelCard.tsx:373`), and room bookability (`:747`). D1 and D3 keep them apart by avoiding the word for bookability. The spec should record this as a standing lexical rule for the hotel surface, or it will silently regress.
3. **Enum ownership.** `HotelAvailabilityBasis` should live in `lib/types.ts` beside `HotelSearchCoverage` (`:499`) and be re-exported where `HotelDecisionAnalytics.tsx:8` keeps its local freshness enum. The spec must name the owner and the re-exporter — price-freshness left the same question open (its OQ2) and the two should answer it identically.
4. **Page-level basis vs offer-level.** D1 puts `availabilityBasis` on the `offers_returned` payload. If a future page ever mixes bases, the page-level value needs a defined rule (weakest basis present is the safe default). Worth stating now; costs nothing.

---

## 10. Scope confirmations

- **No conflict with the non-negotiable contract.** No provider call leaves `lib/providers`. Money untouched — no directive reads or writes `priceCents`. Adapters keep returning `Result<T>`; both new fields are optional. No new secrets. Affiliate markers (`hotellook.ts:434-436`) untouched — no directive modifies `buildDeeplink`.
- **Constraint 1 respected.** No room count, no scarcity, no urgency, no inventory claim anywhere in D1–D5. Every state renders an explicit named absence. Reference analysis (§6) excludes scarcity patterns entirely.
- **Constraint 3 respected.** One collapsed line, existing container shape, existing tokens only, no new colour or type scale.
- **Constraint 5 respected.** No new vendor dependency. Nothing calls `checkDocumentReadiness` or proposes a per-offer recheck; `rate_confirmed` is reserved and provably unreachable.
- **Explicitly out of scope, confirmed untouched:** `HotelCard.tsx:361, 379, 746` freshness strings (price-freshness owns them); any `/deals` DealCard rendering change (`real-deal-inventory`, `sold-out-recovery`); post-expiry recovery on `/deals/[dealId]:382, 418`; persisting return-reason outcomes; `lib/providerFreshness.ts` (read for `providerDisplayName` only, not modified).
- **Out-of-scope findings, logged not fixed:**
  - `HotelCard.tsx` has no mount point (§4.1). Not this ticket's defect to fix, but it caps the user-visible value of D3/D4 at zero until a route renders it, and TEST must be told.
  - No client consumes the `/api/search` stream (§4.2). Same treatment.
  - `bookingComRapidApi.searchFares` cannot succeed — `:108` returns `ok: false` on every well-formed response (§3). Distinct feature; flagged because it means "add a second hotel provider" is further away than it looks.

---

## 11. Handoff

Next stage: **UXDES-HOTEL-AVAILABILITY-SIGNAL-01** — UX Design.

The design spec must carry forward, in addition to the five directives: the collapsed-card ordering contract (§7), the four price-freshness collisions and their resolutions (§5), the three-meanings-of-"available" lexical rule (§9.2), and the `HotelCard` dormancy disclosure (§9.1).
