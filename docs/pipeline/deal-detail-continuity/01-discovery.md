# UXD-DEAL-DETAIL-CONTINUITY-01: Deal Detail Continuity

## Pain Point

Paid users who open a deal detail page can lose confidence because the page may not preserve the exact price, route or stay context, and Deal Score evidence that made the result worth inspecting.

## Affected Users And Flow Step

- **Who is affected:** Paid users and first-time subscribers who click from a saved or surfaced deal into the deal detail page to decide whether the deal is worth pursuing.
- **Flow step:** Deal detail inspection after selecting a deal, specifically `app/deals/[dealId]/page.tsx` backed by `lib/deals/dealDetail.ts` and `lib/deals/dealDetailTypes.ts`.
- **Trust risk:** The detail page is the moment where a user expects the deal to become more concrete, but optional metadata and fallback score copy can make the detail view feel less evidenced than the originating result.

## Current Implementation Signals

- `app/deals/[dealId]/page.tsx` renders the deal title, subtitle, provider, price, Deal Score panel, updated timestamp, optional metadata entries, and booking CTA when `bookingUrl` exists.
- `lib/deals/dealDetailTypes.ts` models detail price as `price: number` plus `currency: string`, while the shared money contract in `lib/types.ts` is `{ priceCents: number; currency: string }`.
- Route, stay, cabin, stops, dates, guest count, room type, and similar decision context are not required first-class fields on `DealDetail`; they are optional metadata entries filtered and rendered only when present.
- Score evidence fields are optional: `dealScore`, `scoreVerdict`, `scoreConfidence`, `scoreExplanation`, `scorePercentile`, and `scorePctVsMedian` may be absent independently.
- When score confidence or explanation data is missing, the page falls back to generic copy such as "Not enough pricing history to explain this price yet." rather than a state that distinguishes unavailable evidence from low-confidence evidence.
- The detail page does not import `app/components/DealBadge.tsx`; it recreates score-label behavior locally, so the detail verdict display can drift from result-card badge behavior.
- `lib/deals/dealDetail.ts` returns `null` for invalid rows or missing required fields and catches a missing `deals` table as `null`, which sends users to `notFound()` rather than a continuity-preserving unavailable state.

## Measurable Signal

This problem exists when the deal detail page cannot answer these questions from structured, visible content without relying on optional metadata or generic fallback copy:

1. **What exact deal did I click?** The user should see the same price, currency, provider, and route or stay identity that made the source result compelling.
2. **What trip context does this apply to?** Flight origin, destination, dates, cabin, stops, and travelers or hotel area, check-in, check-out, nights, guests, and room context should remain visible when known.
3. **Why was it considered a deal?** Deal Score verdict, confidence, percentile, percent versus usual, and plain-language explanation should remain connected to the displayed price.
4. **How fresh and actionable is it?** Updated time, expiration when available, and provider-link availability should be explicit before the user leaves expaify.

Observable QA signals:

- A valid detail row can render without route or stay fields if metadata is empty or incomplete.
- A detail row can render a price using a bare integer field rather than the shared `Money` shape used elsewhere in the app.
- Score panel fallback copy can appear without making clear whether evidence is missing, low confidence, or unavailable for this deal.
- Badge/label logic is duplicated between the detail page and `DealBadge`, increasing the chance that low-confidence or verdict language differs across surfaces.
- A missing or unmigrated `deals` table produces a 404-style path instead of a recoverable "deal unavailable" state that preserves user trust.

## Constraints

1. **Data integrity:** Price must remain integer minor units and should align with the shared `{ priceCents: number; currency: string }` money contract; the UI must not infer missing route, stay, or score facts.
2. **Brand trust:** Copy must be conservative about price freshness, booking availability, and score confidence. Missing evidence should be named plainly rather than softened into a generic explanation.
3. **Accessibility:** The detail page must keep the primary deal facts, score confidence, unavailable states, CTA state, and back navigation understandable by keyboard and assistive tech without relying on color alone.
4. **Performance:** The solution must use stored deal detail data and must not add blocking provider calls or recalculation to page render just to reconstruct context.
5. **Continuity:** The detail view must preserve the same decision hierarchy users saw before clicking: price and route or stay identity first, Deal Score evidence second, provider action third.

## Success Statement

This is solved when a first-time paid user can open a deal detail page and immediately confirm the same price, route or stay context, freshness, provider action, and Deal Score evidence that motivated the click without hitting missing-context, ambiguous-score, or unavailable-link confusion.

## Downstream Focus

The research stage should audit the current deal detail page against the result-card context that leads into it, then define testable directives for:

- Required visible flight and hotel context on detail pages.
- Handling missing metadata, missing score evidence, missing booking URL, expired deals, and missing `deals` table/data.
- Aligning detail score labels with the shared Deal Score badge and confidence rules.
- Keeping mobile 375px and desktop 1280px detail layouts scan-friendly without hiding price, context, or evidence below ambiguous imagery.
