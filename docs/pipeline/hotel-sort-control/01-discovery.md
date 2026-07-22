# UXD-HOTEL-SORT-CONTROL-01: Hotel Result Sorting Control

**Ticket:** UXD-HOTEL-SORT-CONTROL-01 · **Stage:** UX Discovery · **Date:** 2026-07-22  
**Feature slug:** `hotel-sort-control`

## Problem statement

Travelers reviewing expaify hotel deals cannot confidently choose an ordering that matches their immediate intent because the live hotel feed offers only Premium-gated, unlabeled-in-context choices for **Newest** and **Biggest discount**; it has no way to prioritize the lowest nightly price, stronger available quality evidence, or more convenient location, forcing people to scan too many cards or distrust the default order before selecting a property.

## Who is affected and where in the flow

- **Affected users:**
  - Price-led deal hunters who want the lowest cash nightly rate within the returned deal set.
  - Value-led travelers who want the strongest price drop versus usual price, even when the absolute nightly price is not lowest.
  - Fit-led travelers who are willing to pay more for better-supported hotel quality or a more convenient location.
  - First-time visitors in particular, who do not yet know what the feed's default ordering represents.
- **Flow step:** the live hotel-results grid on `/deals`, after a visitor has set any city, discount, price, stars, or date filters and before they open a deal card or provider handoff.

## Current implementation evidence

- The shipped hotel-results UI is `app/deals/DealFeed.tsx`, rendered as a `DealCard` grid. `app/components/HotelCard.tsx` is not imported by the live product surface and must not be used as the design target for this ticket.
- `DealFeed` initializes `sort` to `newest`; its only sort values are `newest | discount`. The segmented control has an accessible group name, **Sort deals**, but no visible label that says what the current default ordering means.
- Both choices are disabled for non-Premium users. The only explanatory copy appears below the control: “Filters and sorting are included with Premium.” A visitor can see the labels but cannot test whether a different order helps them.
- A sort change refetches `/api/deals` and resets pagination, rather than simply reordering cards already loaded. This makes accurate, explicit ordering language and stable result feedback important to trust.
- The card provides fields that can support some future ordering intents: current nightly price, usual/median nightly price, discount percentage, hotel stars, city, check-in window, price-check recency, and snapshot count. It does **not** provide guest ratings, exact location/convenience data, amenities, cancellation terms, or a present Deal Score on the live card.

## Measurable signal

The problem should be validated and measured with both qualitative comprehension and post-implementation events:

- In moderated first-use tasks at 375px and 1280px, ask a participant to find (a) the least expensive stay and (b) the strongest value compared with usual price. Record whether they find and accurately describe the sort choices before opening or scanning more than three cards.
- Instrument `hotel_sort_control_viewed`, `hotel_sort_changed`, and `hotel_result_card_opened`, with `sort_from`, `sort_to`, active filters, viewport band, Premium eligibility, result count, and card position. Do not collect hotel names or provider URLs in analytics events.
- Compare median card depth before the first card/detail click for users who do and do not change sort; a useful sorter should reduce unnecessary scanning for intent-led users without suppressing property-detail click-through.
- Measure property-detail click-through after a sort change, segmented by destination/filter context and selected order. A decline alone is not failure if the user finds a better-fit option with less scanning; pair it with task success and outbound/provider-handoff conversion where available.
- Track disabled-sort attempts separately from successful sort changes. High attempted interaction by non-Premium users is an entitlement/friction signal, not evidence that the labels are understood.

## Constraints

1. **One sensible, explainable default.** Preserve a single default order. The UI must state it in plain language; it must not suggest that “recommended,” “best,” or “top” reflects hidden quality or convenience judgments when the current feed actually defaults to recency.
2. **MVP simplicity.** Expose only the smallest set of distinct, data-backed intents. Do not add a multi-factor ranking builder, a long dropdown, or competing “smart” defaults.
3. **Data honesty.** Do not expose **Best rated**, **Closest**, **Best location**, **Most convenient**, or a quality/convenience composite until the live deal contract carries reliable, comparable evidence for those concepts. Stars alone are hotel class, not guest satisfaction; city alone is not proximity.
4. **Price clarity.** If a price-led ordering is researched, its label must say whether it means current nightly price and retain the existing “/ night” and before-fees context. It must not imply total-stay price when the feed does not have it.
5. **Trust, access, and layout.** The control must remain understandable at 375px and desktop, keyboard reachable with a programmatically clear selected state, and must communicate the Premium entitlement without making a disabled control look broken. It must not change provider calls, money representation, or the underlying deal data contract.

## Success statement

This is solved when a first-time traveler can tell what the hotel feed is currently ordered by and can choose the few supported intents—freshly found deals, biggest savings versus usual price, and, if the research confirms the data and user need, lowest current nightly price—without mistaking an unsupported quality or convenience claim for a trustworthy ranking or scanning cards just to infer the order.

## Handoff: research questions, target segments, and event hypotheses

### Research questions

1. Do travelers interpret **Newest**, **Biggest discount**, and **Lowest nightly price** consistently enough to use as the three MVP intents? Test whether “Newest” is understood as recently found/checked versus a newer hotel or newer travel date; identify the clearest truthful replacement if it is not.
2. When choosing between an absolute low rate and a large reduction from usual price, which label and supporting explanation help users predict the resulting order correctly?
3. Is a price sort valuable enough in the current deal feed to justify an API-supported `price` sort, given that the exact displayed value is per night before taxes and fees?
4. Do users expect **quality** to mean hotel class, guest reviews, or amenities, and do they consider any of those trustworthy enough to sort by when the live deal card only has stars? Establish whether quality must remain a filter/scan cue until guest-rating evidence arrives.
5. What does **convenience** mean for the target trip (distance to a selected landmark, neighborhood, transit, airport), and can any one interpretation be honest without origin/landmark data? If not, document why it must stay out of the MVP sort control.
6. Does the Premium gate cause users to regard sort as a core decision tool they expect before paying, or a reasonable advanced control? Evaluate disabled-state comprehension separately from sort-label comprehension.

### Target segments

- **Budget-led leisure traveler:** has a flexible destination/date window and wants the lowest cash outlay.
- **Value-led deal hunter:** is motivated by how exceptional a price is versus normal, not only the lowest sticker price.
- **Fit-led trip planner:** has a fixed purpose or area and says quality/location convenience matters; use this segment to define data requirements, not to authorize unsupported sorting.
- **First-time visitor and returning Premium member:** recruit both at mobile 375px and desktop 1280px; compare discoverability, label comprehension, and the effect of the entitlement gate.

### Event hypotheses for UXR validation

| Hypothesis | Expected observable signal | Interpretation guardrail |
| --- | --- | --- |
| A visible current-order label plus supported choices will increase intentional sort changes among users with 3+ results. | `hotel_sort_changed / hotel_sort_control_viewed` rises, especially after a task that names a distinct intent. | Do not treat raw changes as success unless participants can state what changed. |
| A truthful lowest-nightly-price option reduces scanning for budget-led users. | Lower median `card_position` at first open after selecting price, with stable-or-better detail click-through. | Segment by result count and price spread; no benefit is expected where prices are nearly tied. |
| Biggest-discount ordering remains useful for value-led users and should not be renamed as “best deal.” | Value-led participants predict its outcome from the label and select it for relative savings tasks. | Never infer that a larger discount is better overall property quality or total trip value. |
| “Quality” and “convenience” labels create false expectations with today's fields. | Participants ask for reviews, distance, neighborhood, or amenities after seeing those labels. | Treat this as evidence to omit those orders until comparable data exists, not as a copywriting issue. |
| The Premium lock may suppress learning about sort intent. | Non-Premium `hotel_sort_disabled_attempted` is high or participants cannot evaluate choices. | Separate monetization decisions from the interaction/design recommendation. |

## Required next-stage audit

UXR should inspect `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, `app/api/deals/route.ts`, and `lib/pipeline/dealDetection.ts` to verify which orders can be implemented without inventing data, how pagination remains deterministic, and whether a current-order/result-count announcement already exists. Compare the interaction pattern—not visual style—against one or two travel-result references that make the active order explicit and keep the number of sort intents small.
