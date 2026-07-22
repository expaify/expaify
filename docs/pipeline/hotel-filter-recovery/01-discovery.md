# UXD-HOTEL-FILTER-RECOVERY-01: Hotel Search Filter Recovery

**Ticket:** UXD-HOTEL-FILTER-RECOVERY-01 · **Stage:** UX Discovery · **Priority:** P1  
**Date:** 2026-07-22 · **Feature slug:** `hotel-filter-recovery`

## Problem statement

When a traveler applies hotel-deal filters that leave too few or no useful results, expaify gives them only a generic instruction to remove a filter or clear everything, without identifying a reversible, evidence-backed next relaxation or preserving enough context to recover their original trip intent confidently.

## Who is affected and where in the flow

- **Primary users:** Travelers with a destination or stay intent who narrow the live hotel-deal feed by minimum discount, hotel class, maximum nightly price, date bounds, or destination.
- **Highest-risk users:** First-time visitors who cannot tell whether their filters, expaify's currently tracked deals, or a loading/provider condition caused the short or empty list; and price-sensitive travelers who may discard an important constraint by clearing all filters.
- **Flow step:** `/deals`, after a Premium user applies or removes a filter, before opening a deal card or beginning provider handoff. The active implementation is `app/deals/DealFeed.tsx`; the date-search `HotelCard` surface is not mounted in this branch.

## Current implementation evidence

- The feed supports five reversible criteria: destination, minimum discount, stars, maximum nightly price, and date bounds. Its filter UI provides a per-pill clear control, and active selections are repeated as removable chips in the filtered-empty state.
- On an empty filtered response, the UI says **“No deals match your filters”** and **“Remove a filter, or clear them all to see everything that's live.”** It provides every individual removal plus **Clear all filters**. This preserves the ability to undo a choice but gives no hierarchy for which relaxation is most likely to restore choices while retaining trip intent.
- The empty state tries to show an evidence cue—`N deals are hidden by your filters`—only when `unfilteredTotal` is positive. `DealFeed` reads that optional value, but `/api/deals` never returns it. Consequently the count is unreachable and the user cannot know whether clearing filters is likely to help.
- `/api/deals` returns `total: source.length`, where `source` is only the requested page. It does not expose a filtered total, an unfiltered comparable total, or per-filter impact metadata. With the current response, the client cannot truthfully recommend a single filter based on how many results would return if that filter alone were removed.
- The active feed is initially server-prefetched, and `hasMore` starts false. The feed therefore has no reliable full-result count or list-boundary state on first paint. Recovery must not present a short list as proof that there are no other tracked deals.
- Analytics currently records only `feed_empty_filtered_viewed`, `feed_filter_chip_removed`, and `feed_clear_all_clicked` in this recovery path. It does not record filter application/change, the active filter combination at empty-state exposure, which suggested removal was chosen, resulting count, return-to-original-filter action, card open after recovery, or repeat refinement. `lib/analytics.ts` only logs in development, so production measurement plumbing is also not established by this ticket.
- Filters and sorting are disabled for non-Premium users and ignored server-side. The recovery path must not frame a disabled control or entitlement restriction as a no-results outcome.

## Measurable signal

The problem exists when a filtered hotel-results session reaches a short (1–3) or zero-result outcome and the traveler clears all criteria, repeatedly changes filters, repeats the same search, or exits before opening a viable property—rather than removing one clearly identified, reversible constraint and continuing.

Establish a baseline for all Premium-capable filtered sessions, segmented by viewport (375px / desktop), result band (0, 1–3, 4+), number and types of active filters, city/default-city context, and whether the feed is sample or live data:

- **Filtered empty rate:** filtered responses with zero deals divided by successful filtered fetches.
- **Short-list recovery rate:** sessions with 1–3 filtered deals that remove one filter, retain at least one original intent-defining criterion, and then open a deal.
- **Destructive reset rate:** `feed_clear_all_clicked` after a filtered empty/short result, compared with individual filter removal.
- **Recovery effectiveness:** count of deals returned and first card/detail open after a one-filter removal, plus whether the user restores the removed filter before leaving.
- **Refinement churn:** three or more filter changes, repeated equivalent filter combinations, or a repeated search/session navigation without a card open.
- **Unresolved exit:** navigation away after an empty/short filtered result without a filter-removal recovery, card open, or provider handoff.

The primary outcome is a higher share of short/empty filtered sessions that regain at least one viable deal after a single, reversible filter change while preserving the traveler’s destination/date intent where it exists. A rise in raw results alone is not success if it requires removing the user’s core trip criteria.

## Constraints

1. **Reversible, intent-preserving recovery only.** MVP suggestions may remove or relax exactly one currently active filter and must leave all other selected criteria intact. Never silently clear filters, change destination/dates, alter sort, or apply an unrequested new criterion. The original filter set must remain recoverable in one action.
2. **Metadata-backed and honest.** A suggested removal and its expected count may appear only when the available result metadata proves it. Do not claim that a criterion is “too restrictive,” that more hotels exist, or that clearing filters will restore a deal when the API has not returned comparable totals. Distinguish empty live inventory, filtered-empty, loading, API failure, initial sample feed, and locked/entitlement states.
3. **MVP/data-contract boundary.** Use existing filter state and available result metadata; do not add a provider, broaden a date search, alter ranking, invent hotel-quality data, or make external calls from UI. Any aggregate needed for a suggestion must come through the existing deals data path and retain money as integer cents.
4. **Accessible on mobile and desktop.** At 375px and 1280px, the active constraints and proposed change must be understandable without color alone; actions must be keyboard operable, announce the changed result state, preserve/focus predictably after refresh, and fit without horizontal overflow or obscured chips.

## Success statement

This is solved when a first-time traveler who filters the hotel feed down to too few or no useful deals can see which current constraint they can reverse, understand what will remain unchanged, apply that one change, and recover viable choices without losing their original trip intent or being told that unavailable inventory does not exist.

## UXR handoff

### Research questions

1. Which constraints do travelers consider intent-defining versus negotiable (destination, date bounds, maximum nightly price, hotel class, or discount), and does that priority differ for a zero-result versus a 1–3-result list?
2. When reliable count metadata is available, does an explicit suggestion such as “Remove 5★ only to see 4 more deals; your destination and price stay the same” improve recovery comprehension over a neutral list of removable chips?
3. When comparable count metadata is unavailable, is a non-ranked **Review filters** state with individual removal actions less misleading and still more effective than **Clear all filters**?
4. How should the original filter set be offered after a successful relaxation so users can safely compare or return to it without accidental loss of intent?
5. What is the smallest useful short-list threshold (test 1–3 versus 1–5) at which to offer recovery assistance without interrupting users who are satisfied with a focused result set?
6. How do users distinguish filtered-empty, no currently tracked deals, load failure, sample-feed availability, and Premium lock at 375px and desktop?

### Target segments and scenarios

- Budget-led traveler with destination and maximum nightly price retained; test whether they will relax discount before price.
- Quality-led traveler with 5★ only and a city selected; test whether removing stars is perceived as an acceptable, clearly bounded trade-off.
- Deal-led traveler with 40%+ off and date bounds; test the difference between a truly empty filtered list and 1–3 viable deals.
- First-time and returning Premium users at 375px and 1280px; include users who understand the result count only after applying a filter.
- Control/error cases: no live deals, API failure, sample-only feed, non-Premium disabled filters, and metadata unavailable. These are comparison states, not occasions to imply filter recovery will work.

### Event hypotheses for UXR validation

| Hypothesis | Expected observable signal | Guardrail |
| --- | --- | --- |
| A single metadata-backed removal recommendation reduces destructive resetting. | After `hotel_filter_recovery_viewed`, a suggested single-filter removal is selected more often than clear-all, and the recovered result/card-open rate rises. | Count a result only when the API explicitly supplied comparable metadata; do not infer it client-side from a page. |
| Naming what remains unchanged preserves intent. | Users correctly state which filters remain and fewer reapply destination/date constraints immediately after recovery. | Do not prioritize a suggested removal based on an assumed traveler preference. |
| An undo/restore-original action makes recovery safe. | A subset restores the original set without repeat manual filter edits; task confidence rises without increasing abandoned sessions. | Restoration must never overwrite later user changes without confirmation. |
| Short non-empty lists need a lighter intervention than zero results. | Suggestions are used selectively in the short-list band while card-open rate remains stable or improves. | Never interrupt a user with a useful 1–3-result set simply to maximize filter changes. |
| Clear distinctions between empty, unavailable, and entitlement states reduce futile action. | Fewer repeated clear/retry attempts occur in unavailable or locked states. | A lower removal rate is positive only when the state is genuinely not recoverable by filters. |

At minimum, research should define event properties for an anonymous session/search ID, filter types and counts (not raw personal data), prior/result counts, suggested filter and metadata availability, chosen recovery action, original-set restoration, viewport band, feed state, and first card/detail/provider-handoff outcome.

## Scope boundary

This discovery authorizes research and an implementation-ready recovery pattern only. It does not authorize a new filter, automatic filter relaxation, provider/search expansion, a guarantee of market-wide availability, a Premium entitlement change, analytics-vendor selection, or fixes to unrelated pagination and total-count contracts. The unreachable `unfilteredTotal` display and page-limited `total` are evidence that downstream work must resolve before making count-based claims.
