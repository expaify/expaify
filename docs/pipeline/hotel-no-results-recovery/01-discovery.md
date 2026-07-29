# UXD-HOTEL-NO-RESULTS-RECOVERY-01: Hotel No-Results Recovery

**Ticket:** UXD-HOTEL-NO-RESULTS-RECOVERY-01 · **Stage:** UX Discovery · **Priority:** P1
**Date:** 2026-07-29 · **Feature slug:** `hotel-no-results-recovery`

## Problem statement

When a traveler's *hotel search intent* — the destination and check-in window they typed — returns nothing, expaify cannot tell them which part of their query was the problem, and in the most common failure it does not present a no-results state at all: an untracked destination is rendered as a generic load error with a **Retry** button that can never succeed.

## Who is affected and where in the flow

- **Primary users:** Travelers who arrive at `/deals` or `/destinations/[city]` and set a destination and/or a check-in date window, then get zero deals back.
- **Highest-risk users:** First-time visitors naming a city expaify does not track (the seeded market set is 14+ cities: Miami, New York, Cancún, Paris, Rome, Barcelona, Lisbon, London, Tokyo, Bangkok, Dubai, Las Vegas, Orlando, San Juan — `lib/db/schema.sql:81`). Their search is structurally unanswerable, but the UI blames a connection failure.
- **Secondary users:** Premium travelers narrowing the check-in window (`date_from`/`date_to`) to specific travel dates and landing on zero deals with no date-relaxation affordance.
- **Flow step:** The search-to-feed transition — after destination/date criteria are applied, before any card open or provider handoff. Active surfaces: `app/deals/DealFeed.tsx`, `app/deals/page.tsx`, `app/destinations/[city]`, `app/api/deals/route.ts`.

## Current implementation evidence (verified in source, this branch)

1. **Untracked destination is a dead-end error, not a no-results state.** `app/api/deals/route.ts:150` resolves a city name against `tracked_markets` and returns HTTP **400 `Unsupported hotel destination`** when there is no row. `DealFeed`'s fetch collapses every non-2xx into `if (!res.ok) throw new Error('fetch failed')` (`app/deals/DealFeed.tsx:611`), so the 400 renders the `error` branch (`:1823-1832`): *"Couldn't load hotel deals." / "Check your connection and try again."* with a **Retry** primary action. Retrying the same unsupported city returns 400 forever. The API knows precisely why there are no results; the UI discards that reason and substitutes a false one.

2. **The 503 and the 400 are indistinguishable to the user.** The same route returns 503 `Hotel destinations unavailable` when the market lookup itself fails (`:148`). A transient infrastructure fault (retry is correct) and a permanently unsupported destination (retry is futile) produce byte-identical UI. Users cannot tell which they hit.

3. **A destination-scoped empty state with the right recovery affordances exists and is mounted nowhere.** `app/components/HotelDestinationSearchState.tsx` models exactly this ticket's states — `{ kind: 'empty'; onEditDates: () => void; onSearchParent?: () => void }` (`:14`) — i.e. adjust dates, or widen to the parent area. Nothing imports it. `HotelDestinationCombobox.tsx` is imported only by that same dead file. This is built, unreferenced recovery UI.

4. **Date-window no-results has no date recovery.** `date_from`/`date_to` filter `check_in_date` on already-detected deals (`app/api/deals/route.ts:125-130`, `getActiveDeals`). When a window returns zero, the shipped empty state offers **Edit search** and (on `/destinations/[city]`) **See all destinations** (`app/deals/DealFeed.tsx:1837-1853`) — no "widen to ±N days", no statement of which check-in windows *do* have inventory, though `check_in_window`/`check_in_date` are already on every deal row (`app/api/deals/route.ts:46-47`).

5. **The evidence-backed relaxation panel is also unrendered.** `HotelFilterRecoveryPanel` in `app/deals/HotelRecoveryUI.tsx:97` implements one-filter-at-a-time recovery with preserved context. `DealFeed` imports only `HotelResultStatus` from that module (`:28`, used at `:1779`). The zero-result branches render `ResultCoverageBoundary` plus plain buttons instead. UXR must confirm whether this is intentional supersession or a regression — **it is owned by `hotel-filter-recovery`, not by this ticket**, and is recorded here only because it shares the surface.

6. **No geographic data exists for "nearby area" recovery.** There is no adjacency, region, or parent-area table anywhere in `lib/`. `tracked_markets` carries `city`, `country`, `iata` only (`lib/db/schema.sql:73-79`). The only truthful widening axes available today are **country** and **all destinations** — not "hotels near you" or "nearby cities". `onSearchParent` in the dead component has no data source behind it.

7. **The date-search hotel path is not reachable by users.** `GET /api/search` emits well-formed `hotel-status` values — `available` / `empty` ("No hotels were returned for these dates") / `unavailable` with provider classification (`app/api/search/route.ts:405-465`). No client code fetches it (only `/api/search/parse` is called, from `app/components/ui/SearchBar.tsx:44`), and `HotelCard.tsx` is imported only by `HotelRateRestrictions.tsx`, never by a page. Design must target the `/deals` feed path; the `/api/search` states are a reference contract, not a live surface.

8. **Analytics has a production sink.** `lib/analytics.ts:26` posts to `/api/analytics` and persists to Postgres via `sendBeacon`/`keepalive` fetch. *(This corrects the dev-only claim in `docs/pipeline/hotel-filter-recovery/01-discovery.md`.)* Instrumentation this ticket specifies is therefore shippable. What does **not** exist today: any event on the error branch. `feed_empty_filtered_viewed` and `feed_empty_cold_viewed` (`app/deals/DealFeed.tsx:1360`, `:1366`) fire only on successful zero-result responses — the 400/503 dead-end is currently **invisible in telemetry**, which is why this failure has survived.

## Measurable signal

The problem is present when a session applies a destination and/or check-in window, receives no deals, and exits or repeats without ever changing the criterion that caused the miss.

Baseline to instrument, segmented by cause (`unsupported_destination` / `market_lookup_failed` / `zero_after_date_window` / `zero_no_criteria`), viewport (375px / 1280px), premium state, and entry point (`/deals` vs `/destinations/[city]`):

- **Silent dead-end rate:** share of zero-result sessions reaching the `error` branch from a 400, over all zero-result sessions. Expected non-zero today and currently unmeasured.
- **Futile retry rate:** `Retry` presses that return the same non-2xx status. Any value above zero is a defect.
- **Reformulation rate:** zero-result sessions that change destination or date window and then receive ≥1 deal.
- **Abandonment rate:** navigations away from a zero-result state with no criteria change and no card open.
- **Recovery-affordance efficacy:** for each offered alternative (widen dates, all destinations, pick a supported destination), take rate and resulting deal count.
- **Repeat-identical-search rate:** the same normalized destination+window submitted twice or more in a session with no material change.

Success is a higher share of zero-result sessions that make **one** targeted criterion change and get inventory — not a raw increase in results, and not retry-loop volume.

## Constraints the solution must respect

1. **Data integrity — never claim inventory that was not checked.** Recovery options may only reference what expaify actually holds: `tracked_markets` rows, and `check_in_date`/`check_in_window` on `status = 'active'` deal rows. No implied availability for an untracked city, and no "try nearby" without an adjacency source (finding 6).
2. **Honest error taxonomy.** An unsupported destination is a *terminal, user-correctable* state and must not offer Retry; a 503 is *transient* and must. The API already distinguishes them — the client must stop flattening them.
3. **No new provider integrations or component-level vendor calls.** The hotel provider is dead and `/api/search` is unmounted (finding 7). Recovery must ship against the existing `/api/deals` contract, per the `lib/providers` boundary.
4. **Accessibility and 375px usability.** Recovery actions keyboard-reachable with visible focus, state changes announced via the existing `aria-live`/`statusMessageId` pattern, no overlapping text or truncated city names at 375px.
5. **Preserve the traveler's intent.** A recovery action changes one criterion and keeps the rest, consistent with the established one-change-at-a-time pattern on this surface.

## Scope

**In scope** — no-results caused by the *search query* on the search-to-feed path:
- Untracked/unsupported destination: honest terminal state plus a path to supported destinations.
- Transient destination-lookup failure: correctly distinguished, retry preserved.
- Zero results after a check-in date window: date-widening recovery grounded in real `check_in_date` data.
- Deciding the fate of the unmounted `HotelDestinationSearchState` empty state — adopt or delete.
- Instrumentation for the causes and outcomes listed above.

**Out of scope** (owned elsewhere; do not re-solve):
- Filter-chip relaxation and one-filter promotion — `hotel-filter-recovery`.
- End-of-list / coverage-completeness signalling — `hotel-result-coverage`.
- A single deal that expired or sold out — `sold-out-recovery`.
- Cold-start feed and mock-deal disclosure — `deal-empty-state`.
- Flight empty states and the shared panel in the pre-landing `app/page.tsx` — `empty-results-recovery` (that doc's surfaces no longer match this branch; `app/page.tsx` is now marketing).
- Nearby-date Deal Score confidence — `flexible-date-deal-confidence`.

## Success statement

This is solved when a first-time user whose hotel search returns nothing is told which part of their search produced no results, and can act on one offered alternative — a supported destination, or a wider check-in window — without hitting a false "check your connection" error or a Retry button that cannot succeed.

## Open questions for UXR

1. Should an unsupported destination be prevented at input time (constrain the destination field to `tracked_markets`) or explained at the results step? The combobox that could constrain it exists but is unmounted (finding 3).
2. Is date-widening honest with the current data? Deals carry a `check_in_date`, but a widened window only re-filters *already-detected* deals — it never asks a provider. UXR must decide how to phrase this without implying a live availability check.
3. Adopt or delete `HotelDestinationSearchState.tsx` / `HotelDestinationCombobox.tsx`? Adopting means finding a data source for `onSearchParent`; the repo has none (finding 6).
4. Country-level widening is the only geographic axis the schema supports. Is "other deals in France" useful recovery, or noise?
5. Is the unrendered `HotelFilterRecoveryPanel` (finding 5) a regression? Flag to the `hotel-filter-recovery` owner — do not fix inside this ticket.
