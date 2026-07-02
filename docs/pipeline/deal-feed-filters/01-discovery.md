---
id: UXD-DEAL-FEED-FILTERS-001
stage: UXD
---

# Discovery: Stars Filter + Flights Tab

## Problem Statement
The deal feed has no star-rating filter and no tab structure. Users cannot narrow results by hotel quality tier, and the page only shows hotels with no signposting of a future flights feature. Both gaps reduce perceived product completeness and filter utility.

## Who Is Affected
- All users browsing /deals (hotels and flights both in product roadmap)
- Users with star-rating preference (budget vs. luxury)
- Users who arrived expecting flights (referenced in landing page)

## Measurable Signal
- No stars filter control exists in DealFeed.tsx
- No tab component exists on /deals
- FlightCard.tsx exists in components but is never rendered in the deal feed
- Agent 4 spec explicitly listed stars filter and flights tab as required

## Constraints
1. Stars filter must integrate with existing fetchDeals params — server must filter, not client-side
2. Flights tab must not pretend to have data — honest empty state, no fake cards
3. Must preserve existing city/discount/sort filters unchanged

## Success Statement
A user browsing /deals can: (a) pick a star tier and see only that tier; (b) see a Hotels/Flights tab and understand Flights are coming soon without feeling misled.
