# 01 — Discovery: Hotel result loading and retry recovery

**Ticket:** UXD-HOTEL-RESULT-LOAD-RECOVERY-01
**Stage:** UX Discovery
**Surface:** `/deals` and `/destinations/[city]` hotel results — submitted search → first result paint → retry
**Date:** 2026-07-31

---

## 1. Problem statement

**When a hotel result load is slow or fails, expaify tells the traveler nothing about how long it will take, why it broke, or whether their search was even received — so an unbounded skeleton grid and a generic "check your connection" error are indistinguishable from an app that has silently lost their search.**

---

## 2. Who is affected, and where

| User | Step in flow | What they experience today |
|---|---|---|
| First-time visitor landing on `/deals` | Submitted search → first paint | Six skeleton cards with no visible text, no elapsed-time feedback, and no cancel. If the request hangs, this is the terminal state — forever. |
| Returning user changing destination or dates | Criteria apply → re-render | Skeleton grid over dimmed prior results. If the apply fails, results revert with a status line but the traveler cannot tell whether prices moved or the request never landed. |
| Any user whose server render failed | Initial page load | Immediate error card. The client never attempts its own fetch; the traveler is blamed for their connection before a single client request was made. |
| Any user searching a city expaify does not track | Initial page load | Identical "Couldn't load hotel deals. Check your connection and try again." — a data-coverage fact is presented as a technical failure. |
| Screen-reader user | Throughout | Loading state is announced (`aria-live` copy at `DealFeed.tsx:580`) but has no visible equivalent, and no announcement escalates if the wait runs long. |

---

## 3. Measurable signal that the problem exists

Evidence read directly from the current implementation:

1. **No timeout exists on any hotel result request.** `fetch(\`/api/deals?${params}\`, { signal: controller.signal })` (`app/deals/DealFeed.tsx:610`) passes only an `AbortController` used for supersession by newer requests — never a deadline. There is no `AbortSignal.timeout` anywhere in the feed, the sort path (`:1082`), or the API route. A hung provider or database call renders skeletons indefinitely with no upper bound and no exit.

2. **The loading state carries zero visible copy.** `SkeletonCard` (`:212`) renders `aria-hidden="true"` shape placeholders only. The reassurance sentence "Finding current expaify hotel deals." (`:580`) is written to a `sr-only` live region. A sighted user sees grey rectangles and nothing else — at 1 second and at 40 seconds, the screen is identical.

3. **Server-render failure produces an error without a client attempt.** `app/deals/page.tsx:88–115` sets `initialError` on a database failure and passes it down; `DealFeed` seeds `error`/`initialLoadError` from it (`:472–473`) and the mount effect skips fetching because `initialDeals` is a non-null `[]` (`:730–735`). The traveler must manually press Retry to make the browser try even once.

4. **Error copy misattributes cause.** The initial-load branch always reads "Couldn't load hotel deals." / "Check your connection and try again." (`:1824–1825`). It fires for a Postgres failure, a provider failure, *and* an untracked destination (`page.tsx:93` sets `initialError = true` when `tracked_markets` has no row for the requested city). Three unrelated causes, one message, and the only one the user can act on is the one that is usually false.

5. **Retry has no memory and no escalation.** `retryFilters` (`:1036`) replays the last request with identical copy on every attempt. There is no attempt count, no backoff, and no alternative offer (browse all destinations, set an alert) after repeated failure — the traveler's only modelled option is to press the same button again.

6. **Partial success is not modelled at all.** The one genuinely good pattern in the codebase is pagination failure: `continuationError` keeps already-loaded cards on screen, says "We couldn't load more deals. The deals already shown are still available to compare." (`:705`), and offers a scoped retry at the exact failed offset (`:1941–1944`). Nothing equivalent exists for the *first* page — that path is strictly all-or-nothing, so one degraded upstream call discards everything.

7. **The stated success metrics cannot currently be measured.** Every `track()` call in the feed covers filters, sort, card opens, and empty states (`:904`, `:988`, `:1013`, `:1305`, `:1349`, `:1360`, `:1373`, `:1422`, `:1437`). There is **no** event for load start, load duration, timeout, load error, retry click, or retry outcome. Loading-state abandonment, retry completion, recovered result views, and booking starts after recovery are all currently unobservable — this ticket's own signals cannot be reported on before instrumentation exists.

8. **Degraded loads can be mistaken for real inventory.** When a default, unfiltered query returns no rows, `page.tsx:125–154` substitutes `generateMockDeals(3)`. That is a deliberate cold-start affordance, but it means "we have nothing right now" and "the pipeline is having a bad day" can both render as populated cards — a trust hazard the recovery states must not deepen.

---

## 4. Constraints the solution must respect

1. **Never promise inventory that has not been confirmed.** Provider latency and partial data are normal; a recovery state may show what loaded and say so, but must not imply a price or a room is available when the response did not confirm it. Existing coverage vocabulary (`confirmed_end`, `more_available`, unconfirmed) is the precedent to extend, not replace.

2. **MVP-weight only — no new infrastructure or new features.** Repair mode is active. This is bounded to feedback and recovery states over the existing `/api/deals` contract: a request deadline, visible loading copy, cause-accurate error states, a scoped retry, and telemetry. No new providers, no streaming/partial-response API, no polling architecture.

3. **Accessible and usable at both ends.** Every state must work at 375px and 1280px with no overlap or clutter, keep the existing `role="status"` / `aria-live` / `aria-busy` wiring intact, preserve focus behaviour on retry (`gridRef` focus target at `:1824`), and give every retry control a ≥44px touch target. Visible copy and announced copy must say the same thing.

4. **Contract-safe.** Money stays `{ priceCents, currency }`; provider access stays behind `lib/providers`; adapters keep returning `Result<T>`; `DealFeed`'s existing props and exports are preserved. Telemetry uses the existing `track()` sink and its `^[a-z][a-z0-9_]{1,79}$` event-name rule (`lib/analytics.ts`).

---

## 5. Success statement

**This is solved when a first-time user who submits a hotel search that is slow, partial, or failing always knows within a bounded, visible time whether results are still coming, what specifically did not load, and what one action recovers it — without ever facing an unbounded skeleton grid, an error that blames their connection for expaify's failure, or a retry that repeats itself with no way forward.**

Supporting conditions:
- Every result request has a deadline and a defined state at that deadline.
- The loading state is visibly self-describing and escalates once a wait becomes unusual.
- Failure copy distinguishes *we couldn't reach the data*, *we don't track this destination*, and *nothing matches* — three different user actions.
- Partial results survive a partial failure, labelled as incomplete.
- Repeated failure offers a second path, not a louder version of the same button.

---

## 6. Explicitly out of scope

- Empty/no-match recovery and filter loosening — owned by `hotel-no-results-recovery` and `hotel-filter-recovery`; this ticket must not redesign them, only stop error states from impersonating them.
- Price freshness and staleness labelling — owned by `hotel-price-freshness` / `provider-freshness-timestamp-clarity`.
- Result coverage/pagination boundary — already shipped in `ResultCoverageBoundary`; reuse its pattern, do not rebuild it.
- Any change to the deal detection pipeline, scoring, or provider adapters.

---

## 7. Open questions for research

1. What deadline do travellers actually tolerate before a skeleton reads as broken, and what is the right intermediate ("still working") threshold?
2. Should the client auto-retry once on a server-render failure before showing an error, or is a visible manual retry more trustworthy?
3. On repeated failure, what is the highest-value second path — browse all destinations, or set an alert for this search?
4. Should a timeout preserve the skeleton with a message, or replace it with a distinct timeout state?

---

## 8. Handoff

Next stage: **UXR-HOTEL-RESULT-LOAD-RECOVERY-01** (UX Research).

Research must deliver:
- **Failure-state prototypes to test:** (a) unbounded/slow load with elapsed-time escalation, (b) hard timeout at deadline, (c) partial first page — some cards, incomplete set, (d) server-render failure on arrival, (e) repeated retry failure with an escalation path, (f) untracked destination disambiguated from technical failure.
- **Telemetry requirements:** event names, properties, and success criteria for loading-state abandonment, time-to-first-result, timeout rate, retry click, retry completion, recovered result views, and booking starts after recovery — since none of these are instrumented today.
- Reference-pattern comparison (Booking.com / Google Flights progressive result loading and retry) at interaction-pattern level.
