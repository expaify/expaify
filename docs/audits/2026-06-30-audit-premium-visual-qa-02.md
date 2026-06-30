# AUDIT-PREMIUM-VISUAL-QA-02: Premium Visual QA Gate

Date: 2026-06-30  
Reviewer: Senior QA Engineer  
Scope: homepage, search, results, flight cards, hotel cards, booking review, baggage estimator, deal detail, loading, empty, and error states. Audit only; no product code changed.

## Gate Decision

No-go. The current app is not premium enough for a paid travel user.

The homepage has moved toward a cleaner light surface, but the paid-user journey falls back into hardcoded dark shells, weak gray metadata, purple gradient CTAs, cramped cards, and inconsistent trust copy. The product asks users to trust Deal Score and booking/review flows, but the visual system still looks split between a premium search page and an older dark prototype.

Browser screenshots were not captured because this sandbox cannot start the Next dev server: `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`. Local Playwright is also unavailable. This report is source-level visual QA with 375px and desktop layout risk assessed from responsive classes and component structure.

## Manual Verification Flow

Attempted:

1. Read Next App Router and accessibility docs from `node_modules/next/dist/docs/` before writing the report, per repo instruction.
2. Inspected the required files: `app/page.tsx`, `app/globals.css`, `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `components/flights/FlightResults.tsx`, `components/baggage/BaggageFeeEstimator.tsx`, `app/book/BookingFlow.tsx`, and `app/deals/[dealId]/page.tsx`.
3. Attempted browser run with `npm run dev`.
4. Checked for browser automation with `require.resolve('playwright')` and `require.resolve('@playwright/test')`.

Blocked:

- `npm run dev` failed before serving a page: `Error: listen EPERM: operation not permitted 0.0.0.0:3001`.
- `playwright unavailable`; `@playwright/test unavailable`.

Required follow-up manual pass in an unrestricted environment:

1. Capture 375px and desktop screenshots for `/`.
2. Run a search with missing dates, valid dates, provider failure, empty results, and multiple returned fares.
3. Capture results with flight cards, hotel unavailable state, hotel cards if available, baggage estimator, route alert, loading skeletons, and retry/error copy.
4. Open `/book` with no fare context and with a valid Duffel review link.
5. Open an existing `/deals/[dealId]` detail with image, without image, with booking URL, and without booking URL.

## P0 Findings

### P0: Results surface visually regresses from premium homepage to hardcoded dark prototype

Repro:

1. Open the homepage and note the light search-first treatment.
2. Submit any search.
3. Compare the results shell, tabs, notices, cards, and empty states against the homepage visual system.

Evidence:

- Homepage starts as a light surface with `bg-[#f5f7fb] text-slate-950` in `app/page.tsx:530`.
- Results switch to `bg-[#07091A]` with a hardcoded dark sticky header in `app/page.tsx:798` and `app/page.tsx:803`.
- Results controls use white-alpha borders and low-opacity panels instead of the shared light tokens: `app/page.tsx:816`, `app/page.tsx:893`, `app/page.tsx:930`, and `components/flights/FlightResults.tsx:134`.
- Flight and hotel cards still assume dark interiors, with `text-white`, `text-gray-100`, `border-white/*`, and `bg-white/[...]` throughout `app/components/FlightCard.tsx:123`, `app/components/FlightCard.tsx:217`, `app/components/FlightCard.tsx:231`, `app/components/HotelCard.tsx:63`, `app/components/HotelCard.tsx:226`, and `app/components/HotelCard.tsx:266`.

Impact:

Paid users experience a visual system break exactly when they reach the comparison task. It feels unfinished and undermines trust in price intelligence.

Recommended ticket:

`DESIGN-REPAIR-PREMIUM-RESULTS-SHELL-01` - Convert results, tabs, cards, notices, and empty states to the same premium light system as the homepage. Remove hardcoded `#07091A`, white-alpha panels, and dark-only text from the results path.

### P0: Booking review is below paid-user trust bar and still reads like an internal sandbox

Repro:

1. Open `/book` without fare context.
2. Open an internal booking review link from a Duffel fare.
3. Review disabled, recovery, form, error, and success states.

Evidence:

- Booking page wrapper is hardcoded dark at `app/book/page.tsx:16`.
- Form and summary surfaces are hardcoded `bg-gray-900`, `bg-[#0a0f1e]`, and white-alpha borders in `app/book/BookingFlow.tsx:10`, `app/book/BookingFlow.tsx:75`, `app/book/BookingFlow.tsx:196`, and `app/book/BookingFlow.tsx:338`.
- Disabled booking copy says expaify is not collecting details or creating orders, but the page still looks like checkout review: `app/book/BookingFlow.tsx:291` to `app/book/BookingFlow.tsx:299`.
- The active form asks for passenger data but does not visually present baggage, fare rules, cancellation/change terms, payment/security expectation, or final-price caveats near the CTA: `app/book/BookingFlow.tsx:331` to `app/book/BookingFlow.tsx:400`.
- Success copy says "Booking confirmed" and "Check your email for ticket details" without itinerary next steps or provider-specific confirmation context: `app/book/BookingFlow.tsx:257` to `app/book/BookingFlow.tsx:276`.

Impact:

The booking review surface cannot be released as paid-user premium. It is honest in places, but visually and structurally it looks like an unfinished checkout.

Recommended ticket:

`DESIGN-REPAIR-BOOKING-TRUST-02` - Redesign booking review as a trust-first review page: consistent premium surface, clear paused-vs-live state, selected fare summary, provider handoff, baggage/fare rule disclosures, no live-ticket confirmation language unless real order creation is enabled.

## P1 Findings

### P1: Critical metadata remains low contrast and too small

Repro:

1. Review result cards, filters, hotel states, calendar, and baggage estimator.
2. Focus on dates, price basis, unavailable reasons, provider caveats, and confidence copy.

Evidence:

- Calendar labels and legend use tiny gray text on transparent/dark panels: `app/page.tsx:155`, `app/page.tsx:160`, `app/page.tsx:191`, `app/page.tsx:197`.
- Flight cards use 10px/11px gray for price label, dates, route divider, price scope, and CTA note: `app/components/FlightCard.tsx:118`, `app/components/FlightCard.tsx:128`, `app/components/FlightCard.tsx:245`, `app/components/FlightCard.tsx:252`, and `app/components/FlightCard.tsx:309`.
- Hotel cards use low-contrast 10px/12px labels for rate, unavailable reasons, metadata, and provider note: `app/components/HotelCard.tsx:60`, `app/components/HotelCard.tsx:74`, `app/components/HotelCard.tsx:80`, `app/components/HotelCard.tsx:287`, and `app/components/HotelCard.tsx:300`.
- Baggage estimator puts decision-critical estimate confidence and disclaimer in `text-gray-600`/`text-gray-700`: `components/baggage/BaggageFeeEstimator.tsx:134`, `components/baggage/BaggageFeeEstimator.tsx:166`, and `components/baggage/BaggageFeeEstimator.tsx:196`.
- Results disabled hotel tab renders important availability as `text-gray-700`: `app/page.tsx:907` to `app/page.tsx:920`.

Impact:

The UI hides the exact information that paid users need to trust: date, price basis, availability, confidence, and limitations.

Recommended ticket:

`DESIGN-REPAIR-CONTRAST-TYPOGRAPHY-02` - Audit all `text-[10px]`, `text-[11px]`, `text-gray-600`, and `text-gray-700` uses on dark/result surfaces; raise critical metadata contrast and size; add a documented metadata token for both light and dark contexts.

### P1: Deal detail page mixes fake/unknown imagery behavior with dark gradient treatment

Repro:

1. Open a deal detail with `imageUrl`.
2. Open a deal detail without `imageUrl`.
3. Review price, score, provider link, metadata, and image treatment.

Evidence:

- Deal detail uses a decorative radial gradient background: `app/deals/[dealId]/page.tsx:150`.
- Hero media falls back to shimmer when there is no image, not a neutral no-image state: `app/deals/[dealId]/page.tsx:156` to `app/deals/[dealId]/page.tsx:169`.
- Image `alt` is empty even though this is the primary deal visual: `app/deals/[dealId]/page.tsx:159` to `app/deals/[dealId]/page.tsx:165`.
- Dark overlay uses hardcoded `#07091A` and text assumes dark context: `app/deals/[dealId]/page.tsx:169`, `app/deals/[dealId]/page.tsx:188`, `app/deals/[dealId]/page.tsx:199`, and `app/deals/[dealId]/page.tsx:210`.
- Metadata values truncate, which can hide route, room, or fare details users need before opening a provider: `app/deals/[dealId]/page.tsx:239` to `app/deals/[dealId]/page.tsx:247`.

Impact:

Saved deal detail does not feel like a trustworthy paid product page. Missing imagery becomes loading-like shimmer, and important metadata can be cut off.

Recommended ticket:

`DESIGN-REPAIR-DEAL-DETAIL-TRUST-01` - Replace shimmer-only image fallback with explicit no-image state, remove hardcoded dark overlay treatment, provide useful image alt text when imagery is meaningful, and let critical metadata wrap.

### P1: Mobile 375px comparison is likely cramped in result cards and controls

Repro:

1. Review a 375px results layout with multiple fares and one hotel card.
2. Use long carrier names, party-total fares, low-confidence scores, and unavailable booking links.

Evidence:

- Results header reserves `pr-16` for the fixed theme toggle and compresses route/edit into one small flex button: `app/page.tsx:803` to `app/page.tsx:830`.
- Sort and stop controls are two wrapping groups inside one panel, with result count competing for the same row: `components/flights/FlightResults.tsx:133` to `components/flights/FlightResults.tsx:176`.
- Flight card top row puts logo, route/carrier/chips, and a min-width price block in one row: `app/components/FlightCard.tsx:209` to `app/components/FlightCard.tsx:229`.
- Flight route module uses fixed `w-[4.75rem]` columns and a center label, leaving little room for time/date at 375px: `app/components/FlightCard.tsx:231` to `app/components/FlightCard.tsx:272`.
- Hotel card stacks on mobile, but the booking-unavailable reason can run under a full-width disabled CTA and small text: `app/components/HotelCard.tsx:266` to `app/components/HotelCard.tsx:303`.
- Baggage estimator puts two count controls into a two-column grid on all mobile widths: `components/baggage/BaggageFeeEstimator.tsx:139` to `components/baggage/BaggageFeeEstimator.tsx:142`.

Impact:

The layout may fit technically, but it is not comfortable enough for paid travel comparison. Scan order and decision hierarchy are weak on mobile.

Recommended ticket:

`DESIGN-REPAIR-MOBILE-COMPARISON-02` - Create mobile-specific layouts for result header, filters, flight cards, hotel cards, and baggage controls. Prioritize route, date, price basis, Deal Score, and CTA in a single clean vertical hierarchy.

### P1: Hotel UX still exposes dead-provider reality instead of premium fallback confidence

Repro:

1. Search without round-trip dates.
2. Search with round-trip dates when hotels return unavailable or empty.
3. Review hotel tab disabled, notice, empty state, and cards.

Evidence:

- Hotels are disabled when unavailable/skipped and the tab count becomes `Unavailable`: `app/page.tsx:508`, `app/page.tsx:893` to `app/page.tsx:920`.
- The app shows "Hotels were not included" in a low-contrast dark notice: `app/page.tsx:929` to `app/page.tsx:933`.
- Hotel empty state uses the same dark low-opacity panel treatment as flight empty state: `app/page.tsx:980` to `app/page.tsx:988`.
- Hotel cards have a photo-unavailable fallback that feels like missing inventory rather than a deliberate premium state: `app/components/HotelCard.tsx:206` to `app/components/HotelCard.tsx:220`.

Impact:

The project briefing says the hotel provider is dead/affiliate-first. The UI should be honest, but the current state looks like a broken product area rather than a managed limitation.

Recommended ticket:

`DESIGN-REPAIR-HOTEL-UNAVAILABLE-01` - Redesign hotel skipped/unavailable/empty states as clear premium limitations with route/date context and no broken-looking tab state. Keep it narrow to copy, hierarchy, and state treatment.

## P2 Findings

### P2: Theme toggle creates inconsistent trust and unverified states

Evidence:

- Root CSS defines light and dark token systems: `app/globals.css:41` to `app/globals.css:101`.
- Theme toggle only flips the root `.light` class and local storage: `app/page.tsx:105` to `app/page.tsx:129`.
- Major surfaces ignore tokens and hardcode their own backgrounds and text: `app/page.tsx:530`, `app/page.tsx:798`, `app/book/page.tsx:16`, `app/book/BookingFlow.tsx:10`, and `app/deals/[dealId]/page.tsx:150`.

Impact:

The theme control implies supported visual modes, but large parts of the app do not actually participate in a coherent theme.

Recommended ticket:

`DESIGN-REPAIR-THEME-CONSISTENCY-01` - Either remove the theme toggle for MVP or make every inspected paid-user surface token-driven with verified light/dark contrast.

### P2: Decorative gradients and purple CTAs cheapen the paid-product read

Evidence:

- Hotel booking CTA uses a purple gradient: `app/components/HotelCard.tsx:280`.
- Deal detail uses a radial gradient page background: `app/deals/[dealId]/page.tsx:150`.
- Booking submit uses an indigo gradient CTA: `app/book/BookingFlow.tsx:395`.
- Results tab underline uses a purple gradient: `app/page.tsx:922`.

Impact:

The dominant visual language remains generic SaaS/crypto-style dark purple instead of restrained travel intelligence. It reads less premium than the homepage.

Recommended ticket:

`DESIGN-REPAIR-CTA-VISUAL-LANGUAGE-01` - Replace decorative gradients with restrained brand tokens and state-specific button variants across hotel booking, booking review, tabs, and deal detail.

### P2: Loading and unavailable states are coherent but not premium

Evidence:

- Flight skeletons are generic shimmer cards: `components/flights/FlightResults.tsx:188` to `components/flights/FlightResults.tsx:193`.
- Hotel skeletons are generic shimmer blocks: `app/page.tsx:86` to `app/page.tsx:102` and `app/page.tsx:976` to `app/page.tsx:978`.
- Baggage unavailable state is honest but visually low hierarchy: `components/baggage/BaggageFeeEstimator.tsx:145` to `components/baggage/BaggageFeeEstimator.tsx:152`.
- Flight empty state copy is useful, but it sits in the same low-opacity dark panel as other states: `components/flights/FlightResults.tsx:194` to `components/flights/FlightResults.tsx:201`.

Impact:

The app does not fail functionally here, but loading/empty/error states do not yet signal a polished paid product.

Recommended ticket:

`DESIGN-REPAIR-STATES-POLISH-01` - Standardize loading, empty, warning, provider-unavailable, and error states with premium light surfaces, route/date context, and clear next actions.

## Required Follow-Up Tickets

1. `DESIGN-REPAIR-PREMIUM-RESULTS-SHELL-01` - Convert results shell, tabs, notices, cards, and empty states to the premium light system; remove hardcoded dark shells.
2. `DESIGN-REPAIR-BOOKING-TRUST-02` - Redesign booking review as a trust-first paused/live review surface with provider, fare, baggage, terms, and final-price context.
3. `DESIGN-REPAIR-CONTRAST-TYPOGRAPHY-02` - Raise contrast and size for critical metadata across results, cards, baggage, hotel states, and deal detail.
4. `DESIGN-REPAIR-MOBILE-COMPARISON-02` - Create 375px-specific hierarchy for result header, filters, flight cards, hotel cards, and baggage estimator.
5. `DESIGN-REPAIR-DEAL-DETAIL-TRUST-01` - Fix deal detail image fallback, hardcoded dark overlay, metadata truncation, and trust hierarchy.
6. `DESIGN-REPAIR-HOTEL-UNAVAILABLE-01` - Make hotel unavailable/skipped/empty states look deliberately managed, not broken.
7. `DESIGN-REPAIR-THEME-CONSISTENCY-01` - Remove unsupported theme toggle or make inspected surfaces fully token-driven.
8. `DESIGN-REPAIR-STATES-POLISH-01` - Standardize loading, empty, warning, unavailable, and error state presentation.

## Out-of-Scope Findings / Blockers

- I did not implement UI changes; this ticket is a gate and explicitly out of implementation scope.
- I did not verify live vendor inventory or provider correctness.
- Browser screenshot verification is blocked by sandbox server bind restrictions.
- Playwright is not installed in this workspace, so automated screenshot capture is unavailable.
- Package metadata shows Next `16.2.9`, while the ticket briefing says Next.js 15. I followed the repo instruction and read the local `node_modules/next/dist/docs/` guidance before auditing.

## Final Gate

No-go for paid users. The product is internally testable, but it is not ready to present as a premium travel deal app until the results, booking review, deal detail, mobile comparison, and state treatments are visually consistent, high-contrast, and trust-led.
