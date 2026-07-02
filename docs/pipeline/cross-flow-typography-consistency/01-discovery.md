# UXD-CROSS-FLOW-TYPOGRAPHY-CONSISTENCY-01: Cross-Flow Typography Consistency

## Pain Point

Typography hierarchy changes across search, results, and booking review, so paid-intent users must relearn which text represents the primary decision at each step instead of carrying confidence from search to selection to handoff.

## Affected Users And Flow Step

- **Who is affected:** First-time and returning users comparing flight fares or hotel rates, especially paid-intent users moving from search results into `/book` to verify a selected offer.
- **Flow step:** Cross-flow transition from the homepage search form, to results cards, to booking review or provider handoff.
- **Affected source inspected:** `app/page.tsx` renders the search hero, form, tabs, loading/error states, and results shell; `app/components/FlightCard.tsx` renders flight result price, route, Deal Score, CTA, and details hierarchy; `app/components/HotelCard.tsx` renders hotel result price, name, quality evidence, Deal Score, CTA, and details hierarchy; `app/book/BookingFlow.tsx` renders flight and hotel review summaries, status panels, traveler form, and recovery states; `app/globals.css` defines global font families, design tokens, field controls, card styles, and primary button typography.

## Measurable Signal

This problem exists when the same commercial decision object changes visual weight, font family, or label treatment as the user moves through the funnel.

Observable implementation signals:

- Search uses oversized display typography for the homepage promise (`font-display text-5xl ... lg:text-6xl`) and a dark custom CTA style, while downstream booking review uses non-display `text-2xl ... sm:text-4xl` page headings and `btn-primary` tokenized buttons.
- Result cards make prices the dominant scan object with `font-display text-xl ... sm:text-4xl`, but booking review restates selected prices as `text-2xl font-bold` without `font-display`, reducing continuity between chosen result and reviewed offer.
- Flight and hotel result cards both use compact uppercase micro-labels for price (`text-[10px] font-bold uppercase tracking-wide`), while booking review uses `text-[11px] font-semibold uppercase tracking-wide`; the labels are similar enough to imply a system but differ in size, weight, and color token use.
- Route, hotel, and review headings move between `font-display`, plain sans, `text-sm`, `text-base`, `text-2xl`, `text-3xl`, and `text-4xl` depending on surface, without a shared role-based hierarchy for primary decision, secondary context, and tertiary metadata.
- `app/globals.css` provides shared `--font-sans`, `--font-display`, color tokens, `.field-input`, `.btn-primary`, and `.card`, but the affected surfaces still compose many one-off text scales and tracking values directly in component class strings.
- At 375px, the user sees dense micro-labels, score chips, route/hotel names, prices, CTAs, and trust copy in close proximity; inconsistent type roles increase the chance that price basis, provider freshness, or selected-offer review copy is missed.

## Constraints

1. **Trust and money clarity:** Preserve price, price basis, Deal Score, provider freshness, unavailable states, and mutable booking/provider terms; typography changes must not imply a price is locked, refreshed, or more certain than the data supports.
2. **Design-system compatibility:** Use existing tokens and font definitions from `app/globals.css` (`--font-sans`, `--font-display`, `--text-*`, `--brand`, `--bg-*`, `--radius-*`) rather than inventing new colors, fonts, or one-off visual language.
3. **Responsive accessibility:** Any future hierarchy must remain readable at 375px mobile and 1280px desktop, preserve keyboard focus visibility, avoid overlapping or clipped text, and keep tap targets stable across loading, empty, error, and booking review states.

## Success Statement

This is solved when a first-time user can move from search to results to booking review and immediately recognize the primary decision text, supporting context, and trust metadata without the typography making the selected paid offer feel visually different from the result they chose.

## Handoff Notes For UXR

- Audit type roles across `app/page.tsx`, `FlightCard`, `HotelCard`, `BookingFlow`, and `app/globals.css`: primary decision, price, price basis, route/name, section heading, metadata, warning, CTA, and status copy.
- Compare against travel checkout patterns where search, result comparison, and review pages preserve price and selected-offer hierarchy across the funnel.
- Produce testable directives for typography roles at mobile 375px and desktop 1280px, including loading/error/unavailable states and both flight and hotel booking handoff paths.
