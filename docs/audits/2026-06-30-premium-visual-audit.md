# AUDIT-PREMIUM-VISUAL-01: Premium Visual QA Audit

Date: 2026-06-30  
Reviewer: Senior QA Engineer  
Scope: homepage, search controls, results, flight cards, hotel cards, booking review, alert signup, colors, fonts, accessibility, 375px mobile, usability.

## Verdict

Not premium enough to show a user yet.

The app is usable in pieces, but the current presentation does not meet a premium travel-product bar. It feels like a polished prototype rather than a trustworthy travel product: dark-purple visual treatment dominates the experience, low-contrast microcopy is everywhere, cards are cramped, important trust details are either missing or de-emphasized, and booking language openly tells users the flow is paused or sandboxed. This undermines the core value proposition of "is this actually a good price?"

Live browser verification was blocked in this sandbox because `next dev` could not bind to either `0.0.0.0:3001` or `127.0.0.1:3010` (`listen EPERM`). The findings below are source-level UX QA with explicit file references and 375px risk review from responsive classes and layout structure.

## Findings

### P0: Booking review destroys purchase trust

Repro steps:
1. Open any internal Duffel booking deeplink from a flight card.
2. Review the booking page states and copy.
3. Compare against a premium booking review expectation: clear fare, traveler requirements, refund/change/baggage disclosures, final price confidence, and action confidence.

Evidence:
- Flight cards label internal fares as `Review availability`, then immediately show `In-app booking is paused` under the CTA, which makes the primary conversion path feel non-functional. See `app/components/FlightCard.tsx:182` to `app/components/FlightCard.tsx:185` and `app/components/FlightCard.tsx:249` to `app/components/FlightCard.tsx:265`.
- The booking page explicitly says `In-app booking is paused` and "not collecting passenger details or creating orders" when disabled. See `app/book/BookingFlow.tsx:206` to `app/book/BookingFlow.tsx:214`.
- Even the enabled review page has minimal reassurance: no baggage, fare rules, cancellation/change policy, payment security, provider handoff, or final-price disclaimer near the submit CTA. See `app/book/BookingFlow.tsx:241` to `app/book/BookingFlow.tsx:309`.
- The success state says `Booking confirmed!` and `Check your email for ticket details` without showing itinerary, traveler, provider, or next-step confidence. See `app/book/BookingFlow.tsx:176` to `app/book/BookingFlow.tsx:190`.

Impact:
Users will not trust expaify with a travel purchase. The product currently signals "we are not ready to book" in the same place it asks users to review or confirm.

Concrete fix:
Make booking review a trust-first page: show selected fare, exact price scope, provider, baggage disclosure, terms/refund/change placeholders, what happens next, and a clear disabled state that does not look like a broken checkout. If booking remains paused, do not use purchase-like confirmation language.

### P0: Search and results rely on low-contrast text for critical information

Repro steps:
1. Review the homepage search form and results page at 375px.
2. Look for labels, date metadata, price labels, disabled tabs, hotel notices, and helper copy.
3. Check whether users can scan the trip, confidence, and next action without squinting.

Evidence:
- Homepage labels use `text-[10px]` and `text-gray-600` for From, To, Depart, Return, Passengers. See `app/page.tsx:575` to `app/page.tsx:599`, `app/page.tsx:613` to `app/page.tsx:630`, and `app/page.tsx:661` to `app/page.tsx:662`.
- Disabled hotel tab and count use `text-gray-700`, making "Unavailable" barely visible on the dark background. See `app/page.tsx:871` to `app/page.tsx:898`.
- Result count passenger copy uses `text-gray-600`, making party size easy to miss. See `app/page.tsx:835` to `app/page.tsx:839`.
- Flight card date and price-scope labels use `text-gray-600` at 10px. See `app/components/FlightCard.tsx:116` to `app/components/FlightCard.tsx:124` and `app/components/FlightCard.tsx:206` to `app/components/FlightCard.tsx:239`.
- Hotel card price qualifiers, source note, area, and unavailable reasons use 10px to 12px low-contrast gray. See `app/components/HotelCard.tsx:62` to `app/components/HotelCard.tsx:74`, `app/components/HotelCard.tsx:203` to `app/components/HotelCard.tsx:209`, and `app/components/HotelCard.tsx:235` to `app/components/HotelCard.tsx:243`.

Impact:
The app hides key trust information in the weakest visual tier. Premium travel products let users confidently compare price, dates, route, availability, and restrictions. This UI makes users work too hard.

Concrete fix:
Raise critical metadata to at least `text-gray-400` or stronger, stop using 10px for decision-critical labels, and create a consistent "supporting metadata" token with verified contrast on `#07091A` and `#0C1122`.

### P1: The visual language feels cheap for travel due to decorative effects and emoji

Repro steps:
1. Open the homepage.
2. Review the first viewport and destination shortcuts.
3. Compare against the expected restraint of a premium travel search tool.

Evidence:
- The homepage uses multiple large blurred radial decorative fields and a faint grid background. See `app/page.tsx:524` to `app/page.tsx:535`.
- The brand headline uses a huge gradient wordmark with tight tracking. See `app/page.tsx:546` to `app/page.tsx:548`.
- Destination shortcuts are emoji-led cards (`🎡`, `⛩️`, `🗼`, etc.) with marketing tags like `Romantic`, `Luxury`, and `Beach`. See `app/page.tsx:700` to `app/page.tsx:720`.
- Result summary uses fire emoji for great deals. See `app/page.tsx:840` to `app/page.tsx:843`.
- Hotel fallback uses a hotel emoji instead of a real placeholder treatment. See `app/components/HotelCard.tsx:181` to `app/components/HotelCard.tsx:185`.

Impact:
The app reads closer to a consumer demo than a serious travel decision product. The decoration competes with the search task and cheapens the Deal Score differentiator.

Concrete fix:
Replace decorative gradients, grid, and emoji shortcuts with restrained travel-specific surfaces: clean search panel, location chips, real or neutral image treatment, and data-led quick routes. Keep the product focused on confidence, not personality.

### P1: 375px mobile layout is too cramped for comparison

Repro steps:
1. Review mobile layout at 375px width.
2. Search a route with multiple results.
3. Scan top summary, filters, cards, and alert signup.

Evidence:
- Homepage mobile starts with large brand, search card, horizontal destination chips, and a fake results teaser. This pushes useful content down and adds clutter before the user has results. See `app/page.tsx:538` to `app/page.tsx:769`.
- Results header reserves right padding for the floating theme toggle (`pr-16`) and compresses route text into a single small search/edit button. See `app/page.tsx:781` to `app/page.tsx:808`.
- Sort and stop filters are a single wrapping row with small labels and pills; on 375px the result count can wrap awkwardly and compete with filter controls. See `components/flights/FlightResults.tsx:133` to `components/flights/FlightResults.tsx:170`.
- Flight cards fit carrier, logo, stop/cabin chips, and a large price in one row, then use fixed `w-16` route columns. Long carrier names, three-digit prices, and multi-passenger labels have little room. See `app/components/FlightCard.tsx:190` to `app/components/FlightCard.tsx:240`.
- Hotel cards place price and booking CTA in one row with `justify-between`; `Price unavailable` plus `Booking unavailable` is likely crowded on 375px. See `app/components/HotelCard.tsx:218` to `app/components/HotelCard.tsx:248`.

Impact:
The app may technically fit, but it is not comfortable. Mobile users need quick comparison and decisive CTAs; current density makes the product feel compressed and less reliable.

Concrete fix:
Create mobile-specific card hierarchy: top row route/price, second row carrier/stops/cabin, Deal Score panel, then CTA. For hotel cards, stack price and CTA on mobile. Make filters a two-row segmented area with clear labels.

### P1: Deal Score is present but not explained with enough confidence

Repro steps:
1. Search a route with scored fares.
2. Review each Deal Score panel.
3. Decide whether the UI answers "is this actually a good price, and what would I normally pay?"

Evidence:
- Flight Deal Score shows percentile and explanation, but does not show usual/median price or percent versus median in the card. See `app/components/FlightCard.tsx:129` to `app/components/FlightCard.tsx:158`.
- Hotel Deal Score includes usual and vs median, but the whole panel is visually small and buried below the hotel name. See `app/components/HotelCard.tsx:98` to `app/components/HotelCard.tsx:147`.
- Low-confidence language is clear in code, but uses the same cramped panel pattern as real scores. See `app/components/FlightCard.tsx:138` to `app/components/FlightCard.tsx:140` and `app/components/HotelCard.tsx:107` to `app/components/HotelCard.tsx:109`.
- The results page says rankings update as scores finish, but this appears as small text below filters rather than a clear state for ranking stability. See `components/flights/FlightResults.tsx:162` to `components/flights/FlightResults.tsx:169`.

Impact:
The core differentiator is not yet strong enough visually. Premium confidence requires the score to feel audited, comparable, and stable, not like a badge decoration.

Concrete fix:
Promote Deal Score into a structured comparison module: verdict, percentile, usual price, savings/overage, confidence, and one sentence. Make low confidence visually distinct and never adjacent to celebratory styling.

### P2: Alert signup language is hesitant and fragmented

Repro steps:
1. Search a route with at least three fares.
2. Review the inline route alert card.
3. Compare it with the standalone alert component.

Evidence:
- Inline alert copy says `Get an email when prices drop below today's level`, but it has no route threshold, frequency, unsubscribe, or provider confidence. See `components/flights/FlightResults.tsx:212` to `components/flights/FlightResults.tsx:246`.
- Standalone `AlertSignup` says "best-effort email notifications" and "notifications only; fares can change before booking", which is honest but reads low-confidence. See `app/components/AlertSignup.tsx:40` to `app/components/AlertSignup.tsx:43` and `app/components/AlertSignup.tsx:121` to `app/components/AlertSignup.tsx:163`.
- There are two alert UX patterns with different inputs: inline route alert only asks for email and derives today's cheapest fare; standalone alert asks for a target price. See `components/flights/FlightResults.tsx:224` to `components/flights/FlightResults.tsx:240` and `app/components/AlertSignup.tsx:124` to `app/components/AlertSignup.tsx:155`.

Impact:
The alert feature feels bolted on and uncertain. Users will not know what they signed up for or why it is reliable.

Concrete fix:
Unify alert signup into one pattern: route, threshold, email, clear promise, limitations, and success state. Avoid "best-effort" in the headline; put limitation copy below in plain language.

### P2: Accessibility and keyboard confidence need refinement

Repro steps:
1. Navigate the homepage with keyboard only.
2. Use airport autocomplete.
3. Review focus, disabled states, hidden status messaging, and color-only indicators.

Evidence:
- Airport autocomplete has combobox roles and keyboard handling, which is good, but loading and error state announcements are incomplete: the live region only announces no results, not loading or unavailable. See `app/components/AirportInput.tsx:70` to `app/components/AirportInput.tsx:83` and `app/components/AirportInput.tsx:220` to `app/components/AirportInput.tsx:222`.
- Several controls use color as the primary active/disabled signal: trip type, tabs, pills, score states, and hotel availability. See `app/page.tsx:555` to `app/page.tsx:570`, `app/page.tsx:871` to `app/page.tsx:905`, and `components/flights/FlightResults.tsx:133` to `components/flights/FlightResults.tsx:156`.
- Global focus is present, but many low-contrast controls make focus recovery difficult in dense areas. See `app/globals.css:62` to `app/globals.css:65` and the low-contrast tokens in `app/globals.css:9` to `app/globals.css:23`.
- Card hover translates every card upward. On dense mobile and keyboard contexts, motion is ornamental and not tied to task success. See `app/globals.css:69` to `app/globals.css:81`.

Impact:
The app is not inaccessible across the board, but it is not premium-accessible. Assistive tech users and low-vision users get less confidence than sighted mouse users.

Concrete fix:
Add loading/error live announcements, strengthen disabled and active labels beyond color, reduce ornamental hover motion, and audit contrast for every `text-gray-600`/`text-gray-700` use on dark backgrounds.

## Recommended Repair Tickets

1. **REPAIR: Booking review trust pass**
   Scope: `app/components/FlightCard.tsx`, `app/book/BookingFlow.tsx`. Replace paused/sandbox purchase language with a coherent review state, add final-price/provider/baggage/terms disclosures, and remove false confirmation copy when real booking is not active.

2. **REPAIR: Contrast and typography accessibility pass**
   Scope: `app/globals.css`, `app/page.tsx`, `components/flights/FlightResults.tsx`, `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/AlertSignup.tsx`. Raise critical labels and metadata above low-contrast 10px gray treatment.

3. **REPAIR: Mobile result card hierarchy**
   Scope: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `components/flights/FlightResults.tsx`. Redesign 375px layout for scan order, stacked CTA rows, stable filters, and less cramped route/price comparison.

4. **REPAIR: Deal Score presentation upgrade**
   Scope: `app/components/FlightCard.tsx`, `app/components/HotelCard.tsx`, `app/components/DealBadge.tsx`. Make Deal Score the visual anchor with usual price, percent vs median, percentile, confidence, and explanation.

5. **REPAIR: Homepage restraint and trust pass**
   Scope: `app/page.tsx`, `app/globals.css`. Remove decorative radial/grid treatment and emoji shortcut cards; replace with a restrained search-first layout and data-led route shortcuts.

6. **REPAIR: Unified alert signup UX**
   Scope: `components/flights/FlightResults.tsx`, `app/components/AlertSignup.tsx`. Consolidate alert patterns into one route/threshold/email component with consistent copy, clear limitations, and accessible status updates.

## Out-of-Scope Findings

- Hotel inventory depends on an unavailable/dead provider path per project briefing, so this audit judges the visible hotel UX and empty/unavailable states, not provider correctness.
- Live visual screenshots were blocked by the sandbox server bind restriction. A follow-up pass should run in an environment that allows `next dev` and capture desktop plus 375px screenshots before release.

## Final Gate

Do not show this to users as a premium travel product yet. The search mechanics are close enough for internal testing, but visual trust, mobile scanability, and booking confidence are below the bar for a product asking users to compare and potentially book travel.
