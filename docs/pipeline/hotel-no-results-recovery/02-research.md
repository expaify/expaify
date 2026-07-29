# UXR-HOTEL-NO-RESULTS-RECOVERY-01: Hotel No-Results Recovery — Research Brief

**Ticket:** UXR-HOTEL-NO-RESULTS-RECOVERY-01 · **Stage:** UX Research · **Priority:** P1
**Date:** 2026-07-29 · **Feature slug:** `hotel-no-results-recovery`
**Upstream:** `docs/pipeline/hotel-no-results-recovery/01-discovery.md`

---

## 1. Summary for the designer

The discovery finding is correct in its core claim and wrong about its cause. There **is** a permanent dead-end: a hotel search that cannot be answered renders "Couldn't load hotel deals. / Check your connection and try again." with a Retry button that returns the same failure forever. But it is not produced by a traveler typing an untracked city — **they cannot**. The destination field is already a constrained `<select>` over the 20 tracked markets (`app/components/HotelSearchCriteria.tsx:199-210`), and `resolveHotelSearchCriteria` rejects any city outside `TRACKED_MARKET_NAMES` before a request is built (`lib/hotels/searchCriteria.ts:56-58`).

The dead-end is instead produced by **three unrelated failures collapsed into one boolean**, on both the server-render and client-fetch paths. Two of them are terminal (retry is futile), one is transient (retry is correct), and all three render byte-identical UI. The highest-value fix is not a new picker or a nearby-city feature — it is **making the client stop discarding a reason the server already computed**.

Three of discovery's five open questions resolve to *delete / don't build*. One new blocking finding was uncovered: `/api/deals` never emits `resultMetadata`, which means the client's entire result-metadata and filter-recovery machinery is inert by data starvation, not merely unmounted.

---

## 2. What the current code actually does

### 2.1 The three causes, and where they merge

`/api/deals` distinguishes its failures precisely and returns a machine-readable reason in the body:

| Cause | Server behaviour | Retry correct? |
|---|---|---|
| City has no `tracked_markets` row | `400 { ok: false, reason: 'Unsupported hotel destination' }` (`app/api/deals/route.ts:149`) | **No — terminal** |
| Market lookup query threw (DB unreachable) | `503 { ok: false, reason: 'Hotel destinations unavailable' }` (`:148`) | **Yes — transient** |
| Criteria/view params malformed | `400 { ok: false, reason: 'Invalid hotel search criteria' }` (`:111`) | **No — terminal** |
| Zero deals matched (any criteria) | `200 { deals: [], coverage: 'confirmed_end' }` (`:175-182`) | n/a — real empty state |

The client destroys that distinction twice:

**Client fetch path.** `DealFeed.tsx:611` — `if (!res.ok) throw new Error('fetch failed')`. The response body is never read, so the reason string never reaches the UI. The catch at `:713-714` sets `initialLoadError` + `error`, and `:1823-1832` renders the connection-failure copy with a **Retry** primary that calls `retryFilters()` (`:1036`) — which re-issues the identical request, including the identical unsupported `city`. Deterministic infinite futility.

**Server-render path — worse, because no fetch is involved at all.** `app/deals/page.tsx:86-113` and `app/destinations/[city]/page.tsx:98-128` each compute a single `let initialError = false` that is set to `true` by *any* of: the market query throwing (`page.tsx:89`), the city having no market row (`:93`), or `getActiveDeals` throwing (`:112`). That boolean is passed straight into `<DealFeed initialError={...}>` (`destinations/[city]/page.tsx:176`), which seeds `error`/`initialLoadError` at `DealFeed.tsx:472-473`. The traveler sees "check your connection" on first paint, with a Retry that then hits the client path above and fails again.

### 2.2 The reachable dead-ends, ranked

Discovery ranked "first-time visitor names an untracked city" as the highest-risk path. That path does not exist. The actually reachable ones:

1. **Indexed destination page whose market row is missing.** `CITY_SLUGS` (`lib/cities.ts:1-22`) and `TRACKED_MARKETS` (`lib/trackedMarkets.ts:9-30`) are **code constants — 20 cities**; `tracked_markets` rows come from a **SQL seed** (`lib/db/schema.sql:81-102`). Any deployment where the constants ship ahead of the migration turns a public, SEO-indexed, canonical-tagged page (`destinations/[city]/page.tsx:55-64` advertises it) into "check your connection" with a futile Retry. Drift is not hypothetical: **Tulum's IATA is `TQO` in the constant and `TUL` in the seed** (`trackedMarkets.ts:24` vs `schema.sql:96`). City-name lookup still matches today, so this is latent rather than live — but it is proof the two sources are not kept in lockstep.
2. **Shared or hand-edited `/deals?city=…` links.** `app/api/deals/route.ts:141-145` falls back to the raw `searchParams.get('city')` when no criteria envelope is present, so a legacy or pasted URL with any city string reaches the 400 path. Same for the server render (`page.tsx:88`).
3. **Transient DB failure.** Renders identically to (1) and (2), so the one case where Retry *works* is indistinguishable from the two where it never will.
4. **Genuine zero-after-date-window.** Reaches `200` and the real empty state — the only cause today that is handled honestly, and the only one with no recovery affordance for the criterion that caused it (see §2.3).

### 2.3 Date-window zero-results has no date affordance

`date_from`/`date_to` filter `d.check_in_date` on already-detected deal rows (`lib/pipeline/dealDetection.ts:267-273`). When a window returns nothing, the filtered empty branch (`DealFeed.tsx:1837-1853`) renders `ResultCoverageBoundary state="confirmed_empty"` — *"No current expaify deals match your filters" / "Remove one filter to expand this expaify result set."* — plus **Edit search** and, on a destination page, **See all destinations**. Neither action is date-specific, and nothing tells the traveler that check-in date is the criterion that emptied the set.

The data to fix this is already in the payload: **every `ApiDeal` carries `checkInDate` and `checkInWindow`** (`app/api/deals/route.ts:23-24, 46-47`). A same-criteria-minus-dates request is a call the client can already make with the shipped contract.

### 2.4 No geographic axis exists — and country widening is worse than discovery assumed

Discovery finding 6 is confirmed: no adjacency, region, or parent-area table anywhere in `lib/`; `tracked_markets` holds `city`, `country`, `iata`, `active` only (`schema.sql:73-79`). Two further constraints discovery did not surface:

- **`getActiveDeals` has no country parameter.** It filters by `marketId` (single integer) only (`dealDetection.ts:189-273`). Country widening would require a new API filter — a DEV-stage contract change, not a UI change.
- **Country widening is degenerate for most of the catalogue.** Of 20 markets: US 6, MX 2, and **12 countries with exactly one tracked city**. So for 12 of 20 destinations, "see other deals in France" resolves to the same single city the traveler just searched. It is noise 60% of the time and would need a per-country count to avoid offering an empty branch — a count nothing currently computes.

### 2.5 The unmounted destination components model a product that does not exist

`HotelDestinationSearchState.tsx` and `HotelDestinationCombobox.tsx` are imported by nothing but each other (verified by grep across `app/` and `lib/`). Their `HotelDestination` type is **provider-shaped**: `provider`, `locationId`, `locationType` (city / airport / airport_area / district / neighborhood / landmark / region), `parent` (`HotelDestinationCombobox.tsx:23-32`). That is a live hotel-search autocomplete API's response shape. expaify has none: the hotel provider is dead (`lib/providers/hotellook.ts`), and the feed's destination domain is a 20-item constant.

Two of the strings in that file are actively untruthful against this repo: *"We don't support that destination yet. Try a nearby city or airport."* (`:139`) and the `Search {parent.name}` primary action (`:144-147`) — neither has a data source, per §2.4.

### 2.6 New finding: `resultMetadata` is never emitted (out of scope, must be flagged)

`DealFeed` declares `resultMetadata?: unknown` on the response type (`:177`) and parses it in four places (`:624, :886, :946, :1087`). **No route in the repo ever sets it** — grep for `resultMetadata` outside tests returns only `DealFeed.tsx`. Therefore `resultMetadata` is permanently `null`, `trustedMetadata` (`:1191`) is permanently `false`, and `HotelFilterRecoveryPanel` (`HotelRecoveryUI.tsx:97`) could not render meaningful content even if it were mounted, because its `recoveryOptions` and `filteredTotal` inputs never arrive.

This answers discovery's open question 5 more precisely than "is it a regression": the panel is **dead by data starvation**, and mounting it is not sufficient. **Owner: `hotel-filter-recovery`. Not fixed here.** It matters to this ticket only as a hard constraint: **no recovery option on this surface may be specified as depending on a server-computed result count, because that channel does not exist.**

### 2.7 Telemetry blind spot

`feed_empty_filtered_viewed` / `feed_empty_cold_viewed` (`DealFeed.tsx:1360, :1366`) fire only on successful zero-result responses. **No event fires anywhere on the error branch.** Discovery's correction is confirmed: `lib/analytics.ts` posts to `/api/analytics` and persists to Postgres, so instrumentation is shippable — the dead-end has simply been invisible, which is why it survived.

---

## 3. Reference patterns

Compared at the level of interaction contract, not visual style.

**Booking.com — an unanswerable destination is prevented, never explained after the fact.** The destination field submits only an autocomplete-resolved entity; free text cannot reach a results page. When results are legitimately zero, the response is a *0-count results page* with a relaxation ladder, never an error card, and never a Retry. Their error surface is reserved strictly for transport failures.
*Delta:* expaify already has half of this — the `<select>` prevents user-authored unsupported destinations. What it lacks is the other half: a URL-borne or drift-borne unanswerable destination is currently rendered as a transport error instead of an explained terminal state.

**Google Hotels — never offer a date change you have not already evaluated.** Its date-flexibility affordances (price grid, flexible-dates view) show real prices for the alternative dates *before* the traveler commits to one. It does not offer an unqualified "try nearby dates".
*Delta:* expaify's date-window empty state offers no date affordance at all, and — per §2.6 — cannot pre-compute a count for one. The honest middle path available to expaify is a *bounded* offer: change the one criterion, describe what the widened search returned from data actually received, and never quantify beyond the page that was returned.

**Both references, on error taxonomy:** a "try again" affordance appears only where trying again can change the outcome. Neither product renders a retry against a deterministic 4xx. This is the single most transferable rule for this ticket.

---

## 4. Answers to discovery's open questions

**Q1 — Constrain destination at input, or explain at results?** *Both are already decided by the code: input is constrained; the results step must therefore explain the residual cases.* Input constraint is shipped (`<select>` over `TRACKED_MARKET_NAMES`) and must be preserved. Design must cover the paths that bypass it — URL-borne cities and constant/DB drift — at the results step. **No new destination input is in scope.**

**Q2 — Is date-widening honest?** Yes, under two conditions. Widening only re-filters already-detected deal rows; it never queries a provider. So copy may describe **what the current search returned** and **what a wider search returned**, and may never imply a live availability check or use the word "available". Combined with §2.6, the widened count may only be stated from rows actually received, and must be qualified when `page.hasMore` is true (page size is 12, `lib/deals/feedContract.ts:3`).

**Q3 — Adopt or delete `HotelDestinationSearchState` / `HotelDestinationCombobox`?** **Delete both.** They model a provider-backed destination taxonomy that does not exist, their two most prominent strings are untruthful against this repo (§2.5), the input constraint they would provide is already shipped, and `onSearchParent` has no data source and no route to one. Deleting is safe: their only importers are each other. Their reusable idea — a terminal panel with an explicit alternative action, and pairing an empty state with a *date-specific* action — is carried into D2 and D3 below rather than preserved as code.

**Q4 — Is country-level widening useful recovery?** **No. Do not build it.** It needs a `getActiveDeals` parameter that does not exist, and it degenerates to the searched city itself for 12 of 20 markets (§2.4). The truthful geographic axes are exactly two: **the specific supported destination list**, and **all destinations**.

**Q5 — Is the unrendered `HotelFilterRecoveryPanel` a regression?** It is worse than unrendered — it is unfeedable (§2.6). Flagged to `hotel-filter-recovery`; not fixed here.

---

## 5. Design directives

Five directives. Each is testable and scoped to the existing `/api/deals` contract.

### D1 — Carry the server's reason to the client; delete the merged `initialError` boolean

The client must stop discarding a classification the server already computed.

- Replace `if (!res.ok) throw new Error('fetch failed')` (`DealFeed.tsx:611`) with: read the JSON body, map `{ ok: false, reason }` to a typed cause, and store it. The four causes the design must name are `destination_unsupported` (400 `Unsupported hotel destination`), `criteria_invalid` (400 `Invalid hotel search criteria`), `lookup_unavailable` (503 `Hotel destinations unavailable`), and `feed_unavailable` (any other non-2xx, network throw, or criteria-version mismatch).
- Replace the single `let initialError = false` in **both** `app/deals/page.tsx:86` and `app/destinations/[city]/page.tsx:98` with the same typed cause, so the missing-market case (`page.tsx:93`, `[city]/page.tsx:108`) is no longer indistinguishable from the query-threw case (`:89`, `:104`) or the `getActiveDeals`-threw case (`:112`, `:125`). `DealFeed`'s `initialError` prop becomes that cause. The prop rename is a breaking signature change on an internal component and is permitted; `HotelResultStatus` and every exported component contract must be preserved.
- **Test:** every one of the four causes renders a distinguishable state, and a cause is never inferred from HTTP status alone without the body reason.

### D2 — Terminal states carry no Retry; transient states carry only Retry

Design must specify two visually distinct panels with a strict rule: **the Retry affordance appears if and only if repeating the identical request could succeed.**

- **Terminal** (`destination_unsupported`, `criteria_invalid`): not styled as an error alert — this is a no-results state, not a fault. Must name the destination, state plainly that expaify does not track it, and offer exactly two actions drawn from real data: pick from the tracked destination list (source: `TRACKED_MARKETS` / `TRACKED_MARKET_NAMES`, already client-safe and already imported into `lib/hotels/searchCriteria.ts`), and see all destinations (`/deals`). **No Retry. No "nearby city". No "try again later".**
- **Transient** (`lookup_unavailable`, `feed_unavailable`): keeps the existing `role="alert"` error styling and the Retry primary, and must state that the traveler's destination and dates are unchanged. Copy must not blame the traveler's connection when the failure was a 503 from expaify.
- Preserve the shipped focus and announcement mechanics: `gridRef` focus target (`:1824`), `aria-live` status region (`:1776`), `statusMessageId` wiring. Terminal state should announce via `role="status"`, matching `ResultCoverageBoundary`'s treatment of `confirmed_empty` (`ResultCoverageBoundary.tsx:208`), not `role="alert"`.
- **Test:** a `/deals?city=Atlantis` request renders zero Retry buttons; a 503 renders exactly one; neither renders the string "Check your connection" for a server-side failure.

### D3 — Name the date window as the cause, and offer one bounded date change

For the `200`-with-zero-deals case where `dateFrom` or `dateTo` is set:

- The empty state must name check-in date as the criterion that emptied the result set, echoing the applied window using the existing `formatHotelCriteriaDates` formatter (`lib/hotels/searchCriteria.ts:78-94`) so the phrasing matches the criteria summary the traveler already read.
- Offer exactly one date action — **drop the check-in window, keep the destination** — implemented as a same-criteria-minus-dates `/api/deals` request. This is a one-criterion change consistent with the surface's established pattern, and it changes nothing else.
- Grounding rules for the result of that action, which the designer must encode as copy rules, not as a single string:
  - Quantify only from rows actually received. Page size is 12; when `page.hasMore` is true the count must be expressed as a floor ("more than 12"), never as a total.
  - Date ranges shown to the traveler must be derived from the returned deals' `checkInDate` values, and must be attributed to *the deals expaify found*, never presented as the destination's availability.
  - Forbidden vocabulary on this surface: "available", "sold out", "nearby dates", "we checked". Nothing here queries a provider.
  - If the dateless request also returns zero, fall through to the existing destination-level empty state — do not chain a second widening.
- **Test:** with a check-in window applied and zero results, the empty state names the date window and offers a date action; with no date criteria applied, that action is absent.

### D4 — Delete `HotelDestinationSearchState.tsx` and `HotelDestinationCombobox.tsx`

Both files, in full, along with their tests if any exist. Rationale in §2.5 and Q3. A grep for both module names must return zero importers before and after. This is not a refactor — no behaviour moves — and it removes two untruthful strings from the repo before a future stage adopts them.

### D5 — Instrument the dead-end and each recovery path

Using the existing `track()` helper (`lib/analytics.ts`), fire on the states above with a `cause` dimension of exactly the four D1 values plus `zero_after_date_window` and `zero_no_criteria`, and with the segmentation discovery specified (viewport bucket, premium, entry point `/deals` vs `/destinations/[city]`):

- `hotel_no_results_viewed` — on entering any zero-result or terminal state, including the server-rendered first paint, which today fires nothing.
- `hotel_no_results_recovery_clicked` — with the chosen action (`pick_destination`, `all_destinations`, `drop_dates`, `edit_search`, `retry`).
- `hotel_no_results_retry_outcome` — for transient states only, recording whether the repeat request succeeded. **Any event with a terminal cause is a defect by construction after D1/D2 ship**, which makes the futile-retry metric self-policing.
- **Test:** the futile-retry rate is measurable and expected to be identically zero post-fix; the silent dead-end rate becomes measurable for the first time.

---

## 6. Out-of-scope findings raised for other owners

1. **`/api/deals` never emits `resultMetadata`, so `HotelFilterRecoveryPanel` is unfeedable, not merely unmounted** (§2.6). Owner: `hotel-filter-recovery`. Mounting alone will not fix it; the API must emit the metadata.
2. **`TRACKED_MARKETS` (code) and `tracked_markets` (SQL seed) drift with no guard**, evidenced by Tulum `TQO` vs `TUL` (§2.2). A test asserting the constant and the seed agree on city and IATA would eliminate the highest-severity path into this ticket's terminal state at its root. No existing ticket owns it; recommend a DEV ticket.
3. **`app/api/search`'s hotel `empty` / `unavailable` states are well-formed and unreachable** — no client fetches it, and `HotelCard.tsx` is mounted by no page (discovery finding 7, confirmed). Dead surface; separate cleanup decision.

---

## 7. Success criteria for the design stage

The design spec passes when: each of the four D1 causes maps to exactly one specified state with final copy; Retry appears in the transient states only; every recovery action names a real data source in this repo; no string on any specified state claims availability, nearby geography, or a provider check; and the date-window state names check-in date as the cause and offers exactly one bounded date change.

**Handoff:** `UXDES-HOTEL-NO-RESULTS-RECOVERY-01`.
