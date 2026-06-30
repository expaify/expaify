# AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01

Date: 2026-06-30
Scope: Search results, flight cards, hotel cards, result states, and booking review surfaces for truncation, wrapping, and overflow risk.

## Verdict

Fail for premium trust polish.

No app code was changed. Source inspection found several places where compact truncation is acceptable, but also multiple user-visible truncation risks that can hide decision-critical facts: route context during errors, airline/provider attribution, hotel location, CTA destination, and hotel price basis when currencies or provider strings get long. Browser screenshot verification was blocked by the sandbox because Next.js could not bind a local port.

## Manual Verification Attempt

Target flow for 375px mobile:

1. Use a long realistic route context: `New York (John F. Kennedy International Airport) -> Bangkok Suvarnabhumi International Airport`, dates `2026-09-22 - 2026-10-04`, `3 passengers`.
2. Inspect loading state while search starts.
3. Inspect flight result cards with a long carrier/provider pair such as `American Airlines operated by Envoy Air via Duffel sandbox partner handoff`.
4. Inspect hotel card strings such as `The Grand Riverside Hotel & Residences Bangkok Sukhumvit Executive Collection` and `Bangkok Riverside, Phra Nakhon / Old City near Grand Palace`.
5. Inspect hotel unavailable/empty state and booking review handoff.

Environment result:

- `npm run dev`: failed, `listen EPERM: operation not permitted 0.0.0.0:3001`.
- `npm run dev -- -H 127.0.0.1 -p 4000`: failed, `listen EPERM: operation not permitted 127.0.0.1:4000`.
- Browser screenshots could not be captured because the app could not be served in this sandbox. Written observations below are from source-level layout inspection of the actual rendered classes and component states.

## Findings

### P1: Flight card hides airline and provider attribution

Evidence: [FlightCard.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/components/FlightCard.tsx:283)

Viewport/state: 375px mobile and desktop card grids, normal results.

Observed risk: `{carrierLabel} via {sourceLabel}` is a single `truncate` line inside a card. A long operating carrier, codeshare label, or provider source can be clipped. This can hide who operates the flight or where the user will be handed off, which is decision-critical for trust and booking destination.

Suggested fix direction: Allow this attribution to wrap to two lines, or split carrier and provider into separate rows where provider remains visible. Avoid truncating provider destination.

### P1: Flight result CTA can truncate provider destination

Evidence: [FlightCard.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/components/FlightCard.tsx:365)

Viewport/state: 375px mobile and desktop cards, normal results.

Observed risk: The primary action label is rendered as `truncate`. Current labels like `Check with ${fare.source}` or `Review paused booking` fit, but a longer provider/source label can clip the booking destination. Hiding the provider name in the primary action weakens handoff trust.

Suggested fix direction: Keep the button full-width but let the label wrap to two lines, or normalize provider display labels before rendering so the destination never clips.

### P1: Results error summary truncates route/date/passenger context

Evidence: [page.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/page.tsx:1289)

Viewport/state: 375px mobile, search error state.

Observed risk: `resultContext` is truncated in the top summary only when the search needs attention. That context can include long city/airport display names, dates, and passenger count. In an error state, clipping the searched route or dates makes it harder for the user to verify whether the failed request was for the intended trip.

Suggested fix direction: In error states, wrap the route/date context below the title instead of truncating it in the header summary.

### P1: Hotel area/location truncates to one line

Evidence: [HotelCard.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/components/HotelCard.tsx:217)

Viewport/state: 375px mobile and desktop card grids, hotel results.

Observed risk: `hotel.area` uses single-line `truncate`. Hotel neighborhood, district, landmark, or city context can be clipped. This is decision-critical because location is a primary hotel selection factor.

Suggested fix direction: Allow hotel area to wrap to two lines or use a compact structured location row where the neighborhood/city remains visible.

### P2: Hotel name line clamp can hide differentiating property facts

Evidence: [HotelCard.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/components/HotelCard.tsx:208)

Viewport/state: 375px mobile and desktop card grids, hotel results.

Observed risk: Hotel name is clamped to two lines. Two-line clamping is generally acceptable for card density, but it becomes trust-damaging when the clipped suffix contains differentiators like `Airport Terminal`, `All Suites`, `Resort Fee Included`, or brand sub-property names.

Suggested fix direction: Treat two-line clamp as acceptable only if full name is exposed in accessible text and/or detail/booking handoff. If no detail surface exists, consider a three-line clamp for hotel cards or show full name in the booking/provider handoff context.

### P2: Flight card route title truncation is acceptable only for IATA routes

Evidence: [FlightCard.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/components/FlightCard.tsx:280)

Viewport/state: 375px mobile and desktop flight cards.

Observed risk: The card route title is single-line `truncate`. Current data uses 3-letter IATA codes, so `JFK to BKK` fits and this truncation is acceptable today. If city or airport display names are later used, this becomes a P1 because route identity would clip.

Suggested fix direction: Keep IATA-only title or switch to a wrapping route label before introducing city/airport names in this field.

### P2: Hotel Deal Score two-column facts can squeeze long money and percentage strings

Evidence: [HotelCard.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/components/HotelCard.tsx:147)

Viewport/state: 375px mobile hotel results with Deal Score.

Observed risk: The hotel Deal Score panel uses a fixed `grid-cols-2` for `Usual` and `Vs median`. Long non-USD formatted amounts or large percentage strings can wrap awkwardly in very narrow cards. This does not hide data by default, but it can produce cramped price basis presentation.

Suggested fix direction: Let the two facts stack on narrow cards or add `min-w-0` plus wrapping rules that keep each value readable.

### P2: Header route truncation is acceptable for navigation, not as sole context

Evidence: [page.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/page.tsx:1260)

Viewport/state: 375px mobile and desktop results header.

Observed risk: The sticky results header intentionally truncates `routeLabel`. This is acceptable as a compact edit affordance because the page also has result cards and state panels. It would become trust-damaging if the header is the only visible searched-route context during empty/error states.

Suggested fix direction: Keep header truncation, but ensure empty/error panels always show full route/date context with wrapping.

### Pass: Loading, empty, and booking review copy generally wraps safely

Evidence: [FlightResults.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/components/flights/FlightResults.tsx:289), [page.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/page.tsx:1452), [BookingFlow.tsx](/Users/admin/dev/agent-worktrees/AUDIT-RESULTS-TRUNCATION-AND-LINE-WRAP-01/app/book/BookingFlow.tsx:72)

Viewport/state: loading, flight empty, hotel empty/unavailable, invalid booking, paused booking, booking error, and booking success states.

Observation: State panels use flexible column layouts on mobile and do not apply truncation to main explanatory copy. Booking facts use `break-words`; technical reference and booking reference use `break-all`. Primary booking buttons use full-width `.btn-primary`, so current labels fit at 375px.

Residual risk: Fare review headline and price block are side-by-side only at `md` and above, so mobile is safe. Very long carrier names in the fare review summary can wrap, which is acceptable and does not hide provider, price, or price basis.

## Surface Matrix

| Surface | State checked | 375px written observation | Desktop written observation | Classification |
| --- | --- | --- | --- | --- |
| Flight card | Normal result | Price stacks above CTA; route IATA fits; carrier/provider and CTA provider may truncate | Grid cards still constrain attribution; same risk | Trust-damaging for provider attribution |
| Flight card | Deal Score loading/unavailable | Skeletons and unavailable copy do not hide price | Same | Pass |
| Flight controls | Results and ranking update | Sort/stop labels fit; controls summary wraps | Controls summary wraps below controls | Pass |
| Flight empty/error | No inventory/provider unavailable/error | Empty copy wraps; top error summary truncates searched context | Error summary can truncate long route context | P1 for error summary |
| Hotel card | Normal result | Name clamps to two lines; area truncates one line; price basis wraps | Same card grid risk | P1 for location, P2 for name |
| Hotel card | Deal Score | Long usual price/percent can squeeze in 2-column grid | Lower risk on desktop but still constrained cards | P2 |
| Hotel empty/loading | Loading and unavailable | Skeletons avoid text; unavailable copy wraps | Same | Pass |
| Booking review | Invalid/paused/error/success | Facts wrap; refs break; sticky CTA fits | Two-column layout has wrapping facts | Pass |

## Out Of Scope Findings

- `components/TicketCard.tsx` and `components/TicketSlideOver.tsx` do not exist in this worktree. Current equivalents inspected were `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `components/flights/FlightResults.tsx`, `app/page.tsx`, and `app/book/BookingFlow.tsx`.
- No feature code or styling repair was implemented because the ticket is audit-only.

## Verification Commands

- `npm run dev`: failed, sandbox blocked local port binding with `EPERM`.
- `npm run dev -- -H 127.0.0.1 -p 4000`: failed, sandbox blocked local port binding with `EPERM`.
- `npm run tsc`: failed because `package.json` does not define a `tsc` script.
- `npx tsc --noEmit --incremental false`: passed with no output.
- `npm test -- --runInBand`: passed. 20 test suites passed, 172 tests passed.
