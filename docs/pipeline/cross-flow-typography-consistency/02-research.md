# UXR-CROSS-FLOW-TYPOGRAPHY-CONSISTENCY-01: Cross-Flow Typography Consistency

## Source Inputs

- Discovery: `docs/pipeline/cross-flow-typography-consistency/01-discovery.md`
- Audited implementation:
  - `app/page.tsx`
  - `components/flights/FlightResults.tsx`
  - `app/components/FlightCard.tsx`
  - `app/components/HotelCard.tsx`
  - `app/book/BookingFlow.tsx`
  - `app/globals.css`
- Reference patterns:
  - Google Flights: search/result pattern emphasizes price comparison, date/price tools, tracking, and option comparison while keeping route, dates, price, and booking action visually legible across the decision path. Reference: https://www.google.com/travel/flights and Google Travel Help, "Track flights & prices" at https://support.google.com/travel/answer/6235879
  - Booking.com: accommodation results preserve the property/rate decision path through search results, filtering/sorting, offer selection, and booking-option review. Reference: Booking.com "How we work" at https://www.booking.com/content/how_we_work.html

## Research Summary

The current UI has the right commercial objects but lacks a role-based typography system across the funnel. The user sees the same decision object in three states: search intent, result comparison, and booking/provider review. Today those states are styled as separate local compositions instead of one hierarchy.

The most trust-sensitive break is the selected price. Flight and hotel cards make price the strongest scan object with `font-display text-xl font-black ... sm:text-4xl`, but booking review restates the same selected fare/rate as `text-2xl font-bold` without `font-display`. That makes the review page feel like a different object, even though the copy says it is preserved from search.

## Current Implementation Audit

### Search Form And Results Shell

- Homepage brand/promise uses a large display hierarchy: `font-display text-5xl ... lg:text-6xl` for "Find flight deals." in `app/page.tsx:1570`.
- Search controls use local slate colors and one-off sizes instead of global tokens: examples include the search card shell at `app/page.tsx:1578`, tab labels at `app/page.tsx:1598`, form labels at `app/page.tsx:1631`, and the custom submit button classes near `app/page.tsx:1780`.
- Results switch to a dark shell with separate gray/indigo classes and smaller summary text: route/status at `app/page.tsx:1821-1883`, inventory tabs at `app/page.tsx:1946-1989`, and inactive inventory helper at `app/page.tsx:1994-2022`.
- Empty/error states are closer to a system pattern: `ResultsStatePanel` uses uppercase eyebrow, display title, and body text in `app/page.tsx:473-489`, and hotel empty/error states consume that panel at `app/page.tsx:2088-2152`.

### Flight Results

- Flight cards establish price as the dominant paid decision: `Passenger total` or `Traveler fare` label at `app/components/FlightCard.tsx:270`, price at `app/components/FlightCard.tsx:273`, and price basis/freshness at `app/components/FlightCard.tsx:276-279`.
- Route is secondary and visually much smaller: `text-sm font-bold ... sm:text-base` in `app/components/FlightCard.tsx:483-488`.
- Deal Score is tertiary chip evidence in `app/components/FlightCard.tsx:360-392`, with loading and unavailable states using the same chip shape.
- CTA hierarchy is inconsistent by destination: external provider CTAs use brand styling, but internal "Review fare" uses a neutral raised button in `app/components/FlightCard.tsx:527-531`, even though it is the next paid-intent step.
- Flight state panels in `components/flights/FlightResults.tsx:454-489` use a similar eyebrow/title/body pattern, but the title uses `font-display text-xl`, unlike booking state panels.

### Hotel Results

- Hotel cards mirror the flight card price hierarchy for valid rates: `Nightly rate` label at `app/components/HotelCard.tsx:37`, price at `app/components/HotelCard.tsx:40`, and rate basis/provider freshness at `app/components/HotelCard.tsx:42-46`.
- Hotel name and quality evidence are secondary and tertiary scan objects in `app/components/HotelCard.tsx:445-476`.
- Hotel CTA uses `.btn-primary` for "Review hotel" in `app/components/HotelCard.tsx:490-500`, unlike the neutral internal flight review CTA.
- Unavailable hotel pricing keeps the display face but drops to `text-lg` in `app/components/HotelCard.tsx:55-66`; flight unavailable pricing does the same at `app/components/FlightCard.tsx:284-296`.

### Booking Review

- Booking review uses a different hierarchy for the same selected object. The shell page title is `text-2xl ... sm:text-4xl` without `font-display` in `app/book/BookingFlow.tsx:326-328`.
- Selected fare review title is `text-2xl ... sm:text-3xl` without `font-display` in `app/book/BookingFlow.tsx:125-136`; selected hotel review repeats this at `app/book/BookingFlow.tsx:166-180`.
- Selected price is smaller and lighter than result-card price: `text-2xl font-bold leading-none` at `app/book/BookingFlow.tsx:135` and `app/book/BookingFlow.tsx:179`, compared with result-card `font-display text-xl font-black ... sm:text-4xl`.
- Micro-labels differ from result cards: result cards use `text-[10px] font-bold uppercase tracking-wide`; booking uses `text-[11px] font-semibold uppercase tracking-wide` via `factLabelCls` and selected-price labels in `app/book/BookingFlow.tsx:10-13`, `app/book/BookingFlow.tsx:134`, and `app/book/BookingFlow.tsx:178`.
- Status panels and form panels use plain sans headings in `app/book/BookingFlow.tsx:217-223`, `app/book/BookingFlow.tsx:250-265`, and `app/book/BookingFlow.tsx:682-688`.

### Design System Baseline

- Global tokens already support a consistent implementation: fonts at `app/globals.css:3-6`, color tokens at `app/globals.css:41-71` and `app/globals.css:74-102`, `.font-display` at `app/globals.css:165-168`, `.card` at `app/globals.css:183-194`, `.field-input` at `app/globals.css:196-227`, and `.btn-primary` at `app/globals.css:229-253`.
- The affected surfaces frequently bypass those tokens with raw slate/gray/indigo values in `app/page.tsx`, creating a separate visual language for search/results compared with booking.

## Reference Pattern Comparison

### Google Flights Pattern

Google Flights keeps the comparison task anchored on route, dates, price, and follow-up actions such as tracking or choosing a flight. Its interaction pattern separates:

- Primary decision: route/option and price.
- Secondary context: dates, duration, stops, provider/airline.
- Tertiary metadata: price tracking, caveats, trend/history affordances.

Delta: expaify has those objects but changes their type roles across surfaces. The price is unmistakable in result cards, then visually demoted in booking review. Deal Score, freshness, and price basis are present but can compete with route and CTA labels because micro-label sizing and weight vary per component.

### Booking.com Pattern

Booking.com keeps accommodation selection anchored on property, rate, filters/sorting, and provider/booking conditions. Its interaction pattern makes the selected accommodation and selected rate recognizable when a user moves from result comparison to the booking-option path.

Delta: expaify hotel cards preserve "Review hotel" as a primary CTA and carry rate-basis copy into review, but the typography changes enough that "Selected nightly rate" looks like a booking-page fact box instead of the same rate the user chose.

## Exact Gap

The code has semantic continuity but not typographic continuity.

- Current code: result cards define price with display face, black weight, tabular numerals, and large desktop scale; booking review defines the same selected price with plain sans, bold weight, and smaller scale.
- Reference pattern: result and review paths preserve the selected offer's identity by keeping primary commercial objects visually stable while allowing layout to change.
- Delta: expaify needs a shared type-role system for paid-decision surfaces, not isolated component-local text scales.

## Design Directives For UXDES

1. Define a role-based type hierarchy for all paid-decision surfaces:
   - `Decision price`: use `font-display`, `tabular-nums`, `leading-none`, and the same weight across flight card, hotel card, and booking selected-price blocks.
   - `Decision title`: route or hotel name; use one consistent heading family/weight across result cards and booking summaries.
   - `Decision basis`: price basis, provider freshness, taxes/fees, passenger count; use one consistent metadata treatment.
   - `Evidence`: Deal Score, quality evidence, stops, duration, provider warnings; keep below price/title hierarchy.
   - `Action`: review/provider/verify buttons; use one primary action style for the next paid-intent step unless disabled.

2. Preserve selected-offer continuity from results to booking:
   - The booking selected fare/rate block must visually match the result-card price role: same font family, same numeric weight, same label treatment, same tabular numerals.
   - Desktop booking review may scale down only if the price block remains at least as prominent as the page title's supporting body copy.
   - Mobile 375px must show route/hotel name, selected price, price basis, and primary action without truncating the price or hiding the basis.

3. Standardize micro-labels:
   - Use one label class for commercial labels such as `Traveler fare`, `Passenger total`, `Nightly rate`, `Selected fare`, `Selected nightly rate`, `Price basis`, and `Provider`.
   - Required treatment: uppercase, consistent tracking, consistent size, and tokenized color. Do not mix `text-[10px] font-bold` and `text-[11px] font-semibold` for the same role.
   - Labels must never be the only place where money scope is communicated; keep plain-language basis copy directly under the price.

4. Align state panels across search, results, and booking:
   - Loading, empty, unavailable, and error panels should use the same eyebrow/title/body/action hierarchy in `ResultsStatePanel`, `FlightStatePanel`, and booking `StatusPanel`.
   - Error and unavailable states must not use a stronger price style than valid selected offers.
   - Disabled/unavailable CTAs must keep the same footprint as enabled CTAs to prevent mobile layout shift.

5. Tokenize the search/results typography pass:
   - Replace raw slate/gray/indigo type color decisions on the affected cross-flow elements with `--text-*`, `--brand`, `--warning`, `--error`, and existing surface tokens unless the design spec explicitly scopes a dark-results variant.
   - Do not introduce new fonts, colors, or new one-off text sizes. Use existing `--font-sans`, `--font-display`, `.btn-primary`, `.field-input`, and `.card` patterns.

## Acceptance Criteria For Downstream Design

- A designer can map every visible text element in search, result cards, result state panels, and booking review to a named role.
- Flight and hotel selected prices keep the same role styling from result card to booking review.
- At 375px, result cards and booking review do not clip price, route/hotel name, selected basis, CTA text, or warning copy.
- At 1280px, result and booking pages preserve a clear hierarchy: price/title first, basis/context second, evidence/warnings third.
- Loading, empty, error, unavailable, and low-confidence states are specified with exact typography and copy hierarchy.

## Handoff

Create `UXDES-cross-flow-typography-consistency-01` for an implementation-ready typography hierarchy and state spec covering homepage search, result cards, results state panels, hotel handoff review, and fare booking review.
