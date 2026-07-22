# UXR-HOTEL-FILTER-RECOVERY-01: Hotel Filter Recovery

**Ticket:** UXR-HOTEL-FILTER-RECOVERY-01 · **Stage:** UX Research · **Priority:** P0  
**Date:** 2026-07-22 · **Feature slug:** hotel-filter-recovery

## Inputs and evidence boundary

- Discovery: docs/pipeline/hotel-filter-recovery/01-discovery.md. The file was absent from this worktree's checked-out commit but exists in monitor commit 70a3460; it was restored byte-for-byte before this audit.
- Current implementation: app/deals/DealFeed.tsx, app/api/deals/route.ts, app/deals/page.tsx, lib/pipeline/dealDetection.ts, and lib/analytics.ts.
- Reference guidance: Google Hotels' documented constraint model and Baymard's cross-site filtering research. These sources validate interaction principles, not expaify-specific traveler priorities.
- No moderated traveler sessions or production analytics were available. Any ordering among budget, quality, and deal-depth constraints therefore remains a test hypothesis, not a proven preference.

## Research conclusion

The discovery problem is confirmed. expaify already gives users reversible controls, but it cannot truthfully identify the most useful single relaxation because its deals response contains neither a full filtered count nor per-filter counterfactual counts. The present “clear all” primary action is more visually prominent than the intent-preserving removals, and the interface has no post-recovery undo.

The safest recovery priority is behavioral rather than a universal ranking of filter types:

1. Preserve destination and date bounds as trip context in any promoted recommendation.
2. If the most recently changed non-context filter has a server-proven one-removal result, promote that exact reversal; it restores the user's immediately previous view and has the clearest causal explanation.
3. Otherwise, show up to three server-proven one-filter relaxations for discount, hotel class, and maximum price, each with its resulting total. Do not label one “best” based only on filter type.
4. Keep manual removal of destination/date available in Review filters, but do not promote it as the default recovery.
5. Keep Clear all as a tertiary escape hatch, never the primary recovery.

For short non-empty lists, 1–3 results is the defensible MVP test band because the discovery defines it and it avoids interrupting users with a broader viable set. The code and desk research do not validate 1–3 as a permanent threshold. The short-list treatment must be a passive aid, while zero results warrants a full recovery panel.

## Current implementation audit

### Filter model and interaction

DealFeed keeps destination, minimum discount, maximum nightly price, minimum stars, and two date bounds in client state (lines 225–230). Applying a change immediately fetches a replacement page while retaining every criterion not included in that change (lines 287–321). This is already the correct one-change interaction primitive.

Each active non-default criterion becomes a removable chip in the filtered-empty state (lines 394–412 and 634–650). The default deal threshold is 20% off, so Clear all does not literally remove every constraint: it restores the page baseline of the default city, 20% minimum discount, no maximum price, no star minimum, and no dates (lines 339–343). On a destination page, the default city is deliberately retained.

The empty recovery hierarchy is inverted. The explanatory copy tells users to remove one filter or clear all, but Clear all filters is the only primary-styled button; individual reversals are visually secondary and unranked (lines 625–658). See all destinations can also abandon destination intent without explaining what else remains.

There is no separate short-list state. Any successful response with one or more results renders the normal grid (lines 662–719). The client cannot distinguish “three total matches” from “three currently loaded matches” on first paint.

There is no undo after a removal. applyFilter mutates the active state immediately, and no original filter snapshot is retained (lines 287–321).

### Count and metadata contract

DealFeed is typed to accept total and optional unfilteredTotal, but it only uses the page array length to infer whether more may exist; unfilteredTotal is displayed only if returned (lines 264–269 and 626–630).

The endpoint never returns unfilteredTotal. It returns total: source.length, which is the number in the requested page after LIMIT and OFFSET, not the total matching set (app/api/deals/route.ts lines 136–160; lib/pipeline/dealDetection.ts lines 277–297). There is no COUNT query and no per-filter impact query.

The initial server render prefetches up to 20 items and passes only initialDeals, so DealFeed initializes hasMore to false and receives no result metadata on first paint (app/deals/page.tsx lines 46–87; DealFeed lines 220–235). A short initial grid is therefore not evidence of a short total list.

The current database query can apply every relevant predicate independently: minimum discount, market, price, stars, date-from, and date-to (lib/pipeline/dealDetection.ts lines 213–297). This makes same-snapshot, one-predicate-removed counts feasible through the existing deals data path, but no such helper exists today.

### State distinctions

| State | Current code signal and treatment | Recovery implication |
| --- | --- | --- |
| Initial/replacement loading | loading renders six skeletons; controls remain present | Do not show counts or recovery until the latest query resolves. |
| Fetch/API failure | error renders “Couldn't load deals right now.” and Retry | Retry the same criteria. Never suggest filter relaxation because inventory is unknown. |
| Filtered empty | zero deals plus hasActiveFilters renders removal chips and Clear all | Eligible for metadata-backed recovery only when comparable one-filter counts exist. |
| Filtered empty, metadata absent | This is every current filtered-empty response | Show neutral Review filters with individual removals; make no hidden-result or expected-count claim. |
| Short filtered list | No explicit state; normal grid | Eligible only after a trustworthy full filteredTotal exists. Use a quiet helper, not an empty-state takeover. |
| No live baseline supply | Unfiltered zero results are replaced by three mock deals | Present sample-feed honesty; filter recovery must not imply live inventory. |
| Cold/sample feed | all visible deals are mock; labeled “Example deals” | Exclude from recovery counts and experiments. |
| Personalized preference empty | Separate PersonalizedEmpty component | Preferences are not ad hoc feed filters; keep this flow separate. |
| Non-Premium/locked | Controls disabled and filter params ignored server-side | Show entitlement messaging only; never classify as filtered empty. |
| Flight tab | Static coming-soon state | Out of scope for hotel-filter recovery. |

The states are visually distinguishable today, but the API response does not explicitly label live versus sample inventory or carry a query identity. That omission makes stale-response and measurement attribution harder when filters are changed quickly.

### Analytics audit

The recovery path emits only:

- feed_empty_filtered_viewed, with no properties;
- feed_filter_chip_removed, with only the filter name;
- feed_clear_all_clicked, with no prior state.

There is no filter-applied event, result-band event, recommended-versus-manual removal distinction, result count, undo, card-open-after-recovery, or abandonment proxy. lib/analytics.ts logs only in development, so the hypotheses below define an event contract but do not authorize an analytics vendor or production plumbing.

No DealFeed tests were found for empty, short, failure, locked, sample, or recovery behavior.

## Reference-pattern guidance

### Google Hotels: separate trip criteria from result refinement

Google's current hotel-search help describes dates and party size as adjustments alongside filters for price, user rating, hotel class, amenities, and location. It also describes results as a list and map for the specified stay. Source: https://support.google.com/travel/answer/6276008?hl=en-CA

Pattern guidance: keep trip context visible while users refine result attributes. The implication for expaify is an inference: destination and date bounds should not be silently treated as equivalent to discount, class, or price when promoting recovery. Google does not document an automatic “remove this filter” recovery ranking, so it does not validate a universal type priority.

### Baymard: visible applied filters, result impact, and contextual recovery

Baymard's updated applied-filter research reports that visible applied-filter overviews give users confirmation, a quick removal path, and context on both desktop and mobile. Source: https://baymard.com/blog/how-to-design-applied-filters

Baymard's filtering guidance recommends result counts for filter choices and calls zero-result filtering a dead end unless the interface prevents it or offers a contextual removal such as “Try removing X.” Source: https://baymard.com/learn/ecommerce-filter-ui

Baymard also reports that generic no-results help is weak compared with contextual suggestions that retain part of the original query. Source: https://baymard.com/blog/no-results-page

Pattern guidance: expaify's removable chips are directionally correct, but a count-backed, context-preserving single relaxation should outrank a destructive reset. Counts must describe the same live dataset and must not be inferred from a paginated page.

## Exact gap

| Concern | Current expaify behavior | Reference guidance | Delta |
| --- | --- | --- | --- |
| Applied-filter visibility | Empty state repeats removable chips; normal short lists only show active pills in the toolbar | Keep applied criteria visible and removable in the result context | Preserve the existing controls, and repeat the relevant current-versus-proposed change in recovery. |
| Result impact | Page-length total; unreachable unfilteredTotal; no counterfactual counts | Preview or explain the impact of a filter choice with counts | Add full current total and same-query one-removal totals before making recommendations. |
| Recovery hierarchy | Clear all is primary; all individual removals are equal | Offer contextual recovery that retains useful query context | Promote one reversible change; demote destructive reset. |
| Intent protection | Destination, dates, price, class, and discount are structurally equivalent client fields | Trip criteria and refinement attributes remain user-controlled | Preserve destination/dates in promoted recovery; never infer that budget or class is unimportant. |
| Short-result help | No short state and no trustworthy full count | Too-few results can create dead ends, but focused lists can also be useful | Test a passive aid at a server-confirmed 1–3 total; do not interrupt the grid. |
| Reversibility | A removal cannot be restored in one action | Filter changes behave like distinct user-perceived result views | Retain an undo snapshot and restore only if no later filter edit superseded it. |

## Required result metadata

The existing deals response needs a recovery metadata block computed from the same active-deal dataset and query snapshot as the returned page:

| Field | Requirement and reason |
| --- | --- |
| queryId or normalizedQueryKey | Identifies which filter state the response describes and prevents late responses from attaching recovery guidance to newer controls. It must contain no raw personal data. |
| inventoryKind | live or sample. Recovery recommendations are valid only for live inventory. |
| filteredTotal | Full match count before LIMIT/OFFSET. Drives zero versus 1–3 versus 4+ state distinctions. |
| baselineContextTotal | Count after restoring only feed defaults while preserving the page's fixed destination context. This replaces ambiguous unfilteredTotal wording. |
| recoveryOptions[] | One entry for each currently active removable criterion evaluated by relaxing exactly that criterion and retaining all others. |
| recoveryOptions[].filterKey | Stable enum: minDiscount, minStars, maxPrice, city, dateFrom, or dateTo. |
| recoveryOptions[].from and relaxedTo | Typed values used to state the exact change. Price values must remain integer cents plus currency; dates remain ISO dates. |
| recoveryOptions[].resultingTotal | Full count for the exact relaxed query. |
| recoveryOptions[].addedCount | resultingTotal minus filteredTotal, calculated server-side or verified against both full counts. |
| recoveryOptions[].contextPreserved | Explicit list or mask of unchanged criteria so copy can truthfully name what stays the same. |
| generatedAt or dataVersion | Demonstrates that current and counterfactual counts are comparable; all recovery counts must use the same active inventory cutoff. |

Return no promoted option when resultingTotal is not greater than filteredTotal, when the comparison uses sample inventory, when the current query failed, or when the result belongs to an older query key. Do not call a count “hotels available”; this feed counts currently tracked deals, not market-wide hotel inventory.

The response does not need property arrays for every counterfactual. Counts and typed change metadata are enough for the recovery choice; selecting one option should use the existing /api/deals request path.

## Recovery priority and copy rules

### Zero results

- Primary: one promoted reversal only when recoveryOptions proves resultingTotal is greater than zero.
- Selection rule: prefer the most recently changed non-context filter if it restores results. If it does not, present up to three non-context options ordered by resultingTotal, but use neutral wording rather than “recommended” or “best.”
- Exact copy pattern: “Remove [current filter label] to see [N] current deals. [Destination/date summary] stays the same.”
- Secondary: Review filters, exposing every active criterion as a separately removable control.
- Tertiary: Clear all filters.
- When metadata is absent: “No current deals match this filter combination.” / “Review one filter at a time. Your other filters will stay the same.” No count and no causal claim.

### One to three results

- Keep the result cards primary.
- Show a non-modal, non-sticky helper after the result count: “Only [N] current deals match.” If a proven option exists, add “Remove [filter] to see [M].”
- Do not auto-scroll, steal focus, hide the cards, or show Clear all as a primary button.
- Treat 1–3 as an experiment band, segmented from zero. Do not extend to 1–5 without evidence that card-open success is lower in the 4–5 band.

### Restore original

After a promoted or manual single-filter removal succeeds, offer “Undo filter change” adjacent to the updated result status. It restores the immediately previous complete filter set only while no subsequent filter edit has occurred. A later edit invalidates or confirms-overwrites the undo snapshot; it must never silently discard later intent.

## Event hypotheses and measurement contract

### Required events

| Event | Minimum properties |
| --- | --- |
| hotel_filter_result_viewed | anonymousSessionId, queryId, resultBand (0, 1-3, 4+), filteredTotal, activeFilterKeys, activeFilterCount, metadataAvailable, inventoryKind, viewportBand, fixedDestinationContext |
| hotel_filter_recovery_option_shown | queryId, filterKey, fromValueBand, relaxedTo, resultingTotal, addedCount, optionRank, selectionReason (last_change or count_order), contextPreserved |
| hotel_filter_recovery_selected | queryId, filterKey, optionRank, source (promoted, review_filters, clear_all), priorTotal, expectedTotal |
| hotel_filter_recovery_resolved | priorQueryId, resultingQueryId, expectedTotal, actualTotal, resultBand, countMatchedExpectation |
| hotel_filter_recovery_undone | priorQueryId, resultingQueryId, timeSinceRemovalMs, interveningEdit |
| hotel_deal_opened_after_recovery | resultingQueryId, recoveredFilterKey, resultPosition, timeSinceRecoveryMs |

Do not send raw free-text natural-language searches, account identifiers, exact budget values, or dates unless the existing privacy contract explicitly permits them. Use stable enums and value bands where exact values are unnecessary.

### Testable hypotheses

1. **Promoted single reversal versus current hierarchy.** In server-confirmed zero-result sessions, a count-backed one-filter action will reduce clear-all use and increase at least-one-result recovery versus the current unranked chips plus primary Clear all. Primary metric: recovery_resolved with actualTotal greater than zero. Guardrail: destination/date retention and no rise in immediate undo.
2. **Preserved-context copy.** Naming the unchanged destination/date context will improve comprehension of the proposed change. Moderated task measure: user correctly states what changes and what remains before selecting. Product proxy: lower immediate reapplication of unchanged context fields.
3. **Undo safety.** One-action undo will increase willingness to test a relaxation without increasing refinement churn. Measure recovery selection plus subsequent card opens; guard against repeated remove/undo loops and never overwrite an intervening edit.
4. **Short-list assistance.** A passive prompt at a verified 1–3 total will improve recovery or card-open rate without suppressing direct card opens. Compare 1–3 with a holdout and observe the 4–5 band before expanding the threshold.
5. **State honesty.** Suppressing filter recovery during error, sample, personalized-empty, and entitlement states will reduce futile filter actions. Audit event-state mismatches; the target is zero recovery options emitted outside live successful filtered queries.

### Recommended evaluative study

Run six to eight task-based sessions split between 375px and desktop, including budget-led, quality-led, and deal-led travelers. Test: zero results with a proven most-recent reversal; zero results with several count-backed alternatives; metadata unavailable; 1–3 useful results; API failure; sample feed; and Premium lock. Require participants to explain what will change before acting and identify how they would restore the original set.

This study should decide whether users prefer a single promoted action or a neutral set of two to three count-backed options. It should not ask participants to choose an abstract universal order for price, stars, and discount; use realistic trip tasks because constraint importance changes by intent.

## Design directives

1. **Gate recovery by explicit state.** UXDES must specify separate treatments for replacement loading, fetch error, live filtered zero, live filtered zero without metadata, verified 1–3 total, 4+, sample feed, personalized preference empty, and non-Premium lock. Only successful live filtered zero/short states may show filter recovery.
2. **Make one reversible change primary.** For zero results, promote at most one server-proven removal using the most-recent-change rule; name the exact filter, resulting full count, and preserved destination/date context. Keep Review filters secondary and Clear all tertiary. Never auto-apply a relaxation.
3. **Require comparable metadata before count copy.** UXDES must define loading and absent/stale-metadata fallbacks and must not use unfilteredTotal, page length, or client-side card count as evidence. Any expected count must come from recoveryOptions for the same queryId/dataVersion.
4. **Protect and restore intent.** Promoted recovery must retain every non-selected criterion. Provide Undo filter change after a successful single relaxation, invalidate it after a later manual edit, and define keyboard focus plus aria-live result announcements at 375px and 1280px.
5. **Instrument the decision chain.** The spec must map the six required events to view, option exposure, selection, resolved response, undo, and first deal open; distinguish zero from 1–3; and exclude error/sample/locked states from recovery-success denominators.

## Acceptance criteria for UXDES

- Covers default, initial and replacement loading, zero with and without metadata, short 1–3, 4+, error/retry, sample, personalized-empty, non-Premium, mobile 375px, desktop 1280px, focus/keyboard, stale response, and undo-invalidated edge cases.
- Provides final copy for promoted removal, neutral Review filters, no-metadata fallback, short-list helper, result announcement, undo, and clear-all confirmation hierarchy.
- Defines primary, secondary, and tertiary hierarchy without relying on color alone or horizontal overflow.
- Preserves current component/API boundaries: UI changes use /api/deals; any count aggregation belongs in the existing deals data path.
- Explicitly identifies a DEV handoff for the count/query metadata and analytics contract. UI must not fabricate recovery metadata.

## Blockers and out-of-scope findings

- **Implementation blocker:** trustworthy promoted suggestions and short-list detection require a full-count and counterfactual-count data contract that does not exist. UXDES can specify it, but UI-only work cannot truthfully implement it.
- **Measurement blocker:** analytics currently has no production sink. Event definitions can proceed; vendor selection and production plumbing are outside this UXR ticket.
- The initial server-prefetch pagination boundary, mock fallback behavior, and lack of DealFeed tests affect validation but are not repaired here.
- No new provider, broader hotel search, auto-relaxation, entitlement change, or ranking change is recommended.

## Recommended handoff

Proceed to UXDES-HOTEL-FILTER-RECOVERY-01 for an implementation-ready component and copy spec. The design must mark full-count/recoveryOptions work for a later DEV stage and provide an honest no-metadata UI state that can ship independently.
