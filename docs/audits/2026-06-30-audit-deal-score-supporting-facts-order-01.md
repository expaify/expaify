# AUDIT-DEAL-SCORE-SUPPORTING-FACTS-ORDER-01: Deal Score Supporting Facts Order

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Deal Score display order, labels, supporting facts, nearby price/itinerary/provider evidence, loading/empty/error states, mobile 375px and desktop fit observations.

## Verdict

Not ready for fully trustworthy Deal Score evidence hierarchy.

The flight card has the right basic score states and avoids strong low-confidence claims, but it does not expose the same supporting facts as hotel cards. Hotels expose richer score facts when scores exist, but silently omit Deal Score when score evidence is unavailable. The result is an inconsistent trust model: flights explain less than the product promises, hotels explain more but can disappear, and some score summary copy can conflict with the visible result set.

## Ticket File Mismatch

The assigned ticket asked to inspect `components/TicketCard.tsx`, `components/TicketSlideOver.tsx`, and `app/api/run/[id]/route.ts`. Those files do not exist in this repo. The actual inspected result surfaces were:

- `app/page.tsx`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `app/api/search/route.ts`
- `app/api/score/route.ts`
- `lib/providers/*`
- `lib/scoring/scoreDeal.ts`
- `lib/search/sortFlights.ts`

## Visible Deal Score States

| State | Flight presentation | Hotel presentation | QA result |
| --- | --- | --- | --- |
| High-confidence Great | Badge `Great`, semantic success panel, percentile text, explanation (`app/components/FlightCard.tsx:164`) | Badge `Great`, percentile, usual price, vs median, explanation (`app/components/HotelCard.tsx:117`) | Present, but flights omit discrete usual price and vs-median facts. |
| High-confidence Good | Badge `Good`, brand panel, percentile text, explanation (`app/components/FlightCard.tsx:164`) | Badge `Good`, percentile, usual price, vs median, explanation (`app/components/HotelCard.tsx:117`) | Present, but hierarchy differs between flights and hotels. |
| High-confidence Typical | Badge `Typical`, neutral panel, percentile text, explanation (`app/components/FlightCard.tsx:164`) | Badge `Typical`, percentile, usual price, vs median, explanation (`app/components/HotelCard.tsx:117`) | Present. Honest, but flight supporting facts are thinner. |
| Low confidence | Badge changes to `Limited history`; flight text says not enough route history (`app/components/DealBadge.tsx:14`, `app/components/FlightCard.tsx:173`) | Badge changes to `Limited history`; hotel text says not enough hotel history plus rough-comparison warning (`app/components/HotelCard.tsx:126`, `app/components/HotelCard.tsx:161`) | Present and generally honest. Hotels provide stronger caution. |
| Unavailable | Explicit flight panel: `Unavailable right now` with live-price caveat (`app/components/FlightCard.tsx:197`, rendered at `app/components/FlightCard.tsx:344`) | No panel when `score` is null (`app/components/HotelCard.tsx:240`) | Inconsistent. Hotel unavailable score state is missing. |
| Loading | Flight score shimmer with `aria-label="Loading deal score"` (`app/components/FlightCard.tsx:344`) | Hotel score shimmer (`app/components/HotelCard.tsx:240`) | Present. Hotel shimmer lacks an accessible label. |
| Medium confidence | No Deal Score medium state exists in `DealScore`; only `high` and `low` are typed (`lib/types.ts:34`). | Same. | Not applicable in this codebase; ticket language does not match current contract. |

## Findings

### P0 - Flight Deal Score does not present the full supporting fact hierarchy promised by the product

Evidence: The homepage promises comparison against `recent route history, median price, and deal percentile` (`app/page.tsx:963`). Flight cards show only `Deal Score`, percentile or limited-history copy, verdict badge, and a sentence explanation (`app/components/FlightCard.tsx:164` to `app/components/FlightCard.tsx:193`). They do not separately show `Usual`/median price or `Vs median`, even though those fields exist on `DealScore` (`lib/types.ts:28`) and are used in ranking (`lib/search/sortFlights.ts:32`) and hotel cards (`app/components/HotelCard.tsx:147` to `app/components/HotelCard.tsx:159`).

Why it matters: Deal Score is supposed to answer "is this actually a good price, and what would I normally pay?" On flights, the normal-price answer is buried inside one sentence and can be absent from low-confidence/no-history explanations. Users cannot scan the score evidence in a consistent order across cards.

Repro:
1. Run a flight search that returns scored fares.
2. Inspect any scored flight card.
3. Compare the facts shown beside the score to a scored hotel card.
4. Observe flights show percentile plus explanation only; hotels show percentile, usual price, vs median, and explanation.

Expected: Flight and hotel Deal Score panels should expose equivalent score evidence hierarchy when the same fields exist: verdict/confidence, percentile, usual/median, vs median, explanation.

Actual: Flight cards omit the discrete usual-price and vs-median evidence.

### P1 - Hotel Deal Score disappears entirely when score evidence is unavailable

Evidence: Flight cards render an explicit unavailable score panel when `score` is null (`app/components/FlightCard.tsx:197` to `app/components/FlightCard.tsx:214`, `app/components/FlightCard.tsx:344` to `app/components/FlightCard.tsx:350`). Hotel cards render a loading skeleton or a score panel, but render nothing when `score` is null (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`).

Why it matters: The user cannot tell whether a hotel is unscored, score loading failed, or the card is not meant to be score-ranked. That is materially weaker than flights and fails the unavailable-state requirement.

Repro:
1. Return hotel inventory while `/api/score?type=hotel` fails or returns non-OK.
2. Inspect the hotel cards after loading stops.
3. Observe no Deal Score unavailable panel or explanation appears.

Expected: Hotels should use an explicit unavailable state comparable to flights.

Actual: Hotel score evidence silently disappears.

### P1 - Hotel score facts are visually disconnected from the visible hotel price

Evidence: Hotel cards render the Deal Score panel before the visible nightly price/CTA block (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:250`). Flight cards render the visible fare price first, then itinerary, then Deal Score (`app/components/FlightCard.tsx:270` to `app/components/FlightCard.tsx:350`).

Why it matters: The hotel score explanation includes the current price and usual price, but the visible nightly rate it explains appears below the panel. On desktop grids this still scans, but at 375px mobile the user reads score evidence before the primary price evidence.

Expected: Supporting facts should sit in a consistent relationship to the result they explain.

Actual: Flight score explains a price already shown above; hotel score can precede the primary price.

### P2 - Flight percentile ordinal labels are inconsistent and can be unpolished

Evidence: Flight score uses `${Math.round(score.percentile)}th percentile` for all values (`app/components/FlightCard.tsx:173` to `app/components/FlightCard.tsx:175`). Hotel score uses `formatOrdinal`, producing `1st`, `2nd`, `3rd`, etc. (`app/components/HotelCard.tsx:82` to `app/components/HotelCard.tsx:102`).

Why it matters: Values like `1th percentile`, `2th percentile`, and `23th percentile` make the score feel mechanically generated and less credible.

Expected: Flights and hotels should use the same ordinal formatting.

Actual: Flights hardcode `th`; hotels format ordinals correctly.

### P2 - Result header score summary can conflict with the currently visible result set

Evidence: `greatCount` counts all scores in `scores`, not the currently filtered/displayed flights (`app/page.tsx:915`). Stops filtering can hide a Great fare while the header still says there are Great deals. The header also uses a fire symbol before the count (`app/page.tsx:1299` to `app/page.tsx:1302`), which weakens the otherwise factual score tone.

Why it matters: Score evidence beside a filtered result set should match what the user can see. A hidden Great fare should not be summarized as visible support for the current list.

Expected: The summary should reflect displayed results or explicitly say it is route-wide.

Actual: It reflects all scored fares in state, regardless of the active stops filter.

## State Review

Loading: Flight loading state shows result-level provider loading plus card skeletons (`components/flights/FlightResults.tsx:324` to `components/flights/FlightResults.tsx:337`). Score-specific loading is represented by a fixed-height shimmer (`app/components/FlightCard.tsx:344`). Hotel loading uses skeletons in the Hotels tab (`app/page.tsx:1436` to `app/page.tsx:1449`) and a score shimmer (`app/components/HotelCard.tsx:240`). No unsupported score facts are shown while loading.

Empty: Missing dates and no-inventory states are coherent and avoid fake score claims. Flight empty copy says Deal Scores need complete provider data when the departure date is missing (`components/flights/FlightResults.tsx:165`). Hotel skipped/unavailable copy is explicit in the disabled-tab explanation (`app/page.tsx:1399` to `app/page.tsx:1403`) and hotel empty panel (`app/page.tsx:1451` to `app/page.tsx:1470`).

Error: Search errors do not fabricate score evidence. The error panel keeps route context but no score claims (`app/page.tsx:1328` to `app/page.tsx:1357`).

Provider evidence: Provider notices come from `/api/search` as `notice` and are shown above flight results (`app/api/search/route.ts:177` to `app/api/search/route.ts:196`, `components/flights/FlightResults.tsx:178` to `components/flights/FlightResults.tsx:205`). Flight cards show carrier/source beside the route (`app/components/FlightCard.tsx:283`). Hotel cards show HotelLook only on CTA, not inside the score panel (`app/components/HotelCard.tsx:257` to `app/components/HotelCard.tsx:270`).

Ranking evidence: Flight default deal sort defers to price while scores are loading, with a visible "Updating deal ranking as scores finish" notice (`components/flights/FlightResults.tsx:256` to `components/flights/FlightResults.tsx:261`). Once settled, sorting uses confidence, verdict, percentile, pct-vs-median, then fallback price (`lib/search/sortFlights.ts:25` to `lib/search/sortFlights.ts:43`). Hotels are not visibly sorted by score and have no hotel sort control; this remains a trust caveat when hotel score cards appear in provider order.

## Mobile 375px and Desktop Observations

Live screenshots are blocked in this sandbox because `npm run dev -- --hostname 127.0.0.1 --port 3000` fails with `listen EPERM: operation not permitted 127.0.0.1:3000`. Precise observations from responsive layout inspection:

Mobile 375px:
- Flight and hotel results use one-column grids (`components/flights/FlightResults.tsx:339`, `app/page.tsx:1472`), so score panels should not be squeezed into multi-column cards.
- Flight card header stacks price below route at mobile because the two-column layout only applies at `sm` (`app/components/FlightCard.tsx:273`). This is usable and keeps the price above score.
- Hotel cards keep score above the nightly price at mobile (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:250`), which is the main hierarchy problem.
- Long score explanations use wrapping text and fixed card padding; no obvious class-level overlap risk was found.
- Tab labels and count badges are horizontally scrollable (`app/page.tsx:1363`), so the Hotels unavailable label should fit but may be visually low-contrast due to gray-on-dark disabled styling.

Desktop:
- Flight and hotel results use up to three columns (`components/flights/FlightResults.tsx:339`, `app/page.tsx:1472`), making score-panel density important.
- Flight score panels are compact and scannable but omit discrete median/percentage facts.
- Hotel score panels are denser but better support the score claim with `Usual` and `Vs median`.
- Result controls and provider notices sit above the grid, which keeps score context close enough to results.

## Manual Verification Flow Attempted

1. Attempted to start the app locally with `npm run dev -- --hostname 127.0.0.1 --port 3000`.
2. Blocked by sandbox bind failure: `listen EPERM: operation not permitted 127.0.0.1:3000`.
3. Completed static and unit-level verification against the rendered component code, score/ranking logic, provider state handling, and score presentation tests.

Because the server could not bind, I could not capture actual browser screenshots or run a live provider-backed search in this environment. The absence of screenshots is an environment blocker, not a product pass.

## Self-Review Against UX Bar

Hierarchy: Fails consistency. Flights show less evidence than hotels; hotels can show score before visible price and can omit unavailable score entirely.

Contrast: Semantic score panel colors are present. Disabled hotel tab text may be too muted on dark background, but this is secondary to score evidence gaps.

Spacing: Card score panels use stable padding and gaps. No class-level overlap risk found for normal score copy.

Mobile fit: One-column layouts are structurally usable at 375px. Main mobile risk is hotel score-before-price order, not overflow.

Focus states: Score panels are informational and not focusable. Result sort/filter controls and CTAs have focus-visible or button styling; score panels are not programmatically grouped as summaries, which weakens assistive tech context.

Cheap decorative effects: The fire symbol in the result header Great-deal count is decorative hype around score evidence and should be avoided in a trust-critical score surface.

## Out of Scope Noted

- No score formula or ranking logic was changed.
- No feature code was changed.
- Existing broader trust gaps remain: hotel score sorting/order, booking handoff dropping Deal Score, and server/browser verification being blocked by the sandbox bind failure.

## Verification

- `npx tsc --noEmit --incremental false`: passed.
- `npx jest --runInBand`: passed, 20 suites / 168 tests.
- `npm test -- --passWithNoTests`: passed, 20 suites / 168 tests.
- `npm run dev -- --hostname 127.0.0.1 --port 3000`: failed due environment bind permission (`listen EPERM`).

## Return Note

- What changed and why: Added this narrow QA audit report for Deal Score supporting-facts order and trust consistency. No product behavior changed.
- Files changed: `docs/audits/2026-06-30-audit-deal-score-supporting-facts-order-01.md`.
- Verification commands and results: TypeScript and Jest passed; local dev server failed to bind in the sandbox.
- Out-of-scope findings or blockers: Browser screenshots and live manual search were blocked by the sandbox server bind failure; ticket-referenced files do not exist in this repo.
