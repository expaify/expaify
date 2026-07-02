# UXR-HOMEPAGE-COPY-DENSITY-01: UX Research Brief

## Upstream Input

Discovery report: `docs/pipeline/homepage-copy-density/01-discovery.md`

Problem statement: The homepage asks first-time users to process too much explanatory and secondary copy before committing to search, which makes expaify feel less direct and less confident as a premium travel deal finder.

## Scope Audited

- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `app/globals.css`
- `docs/pipeline/mobile-search-form-clutter/02-research.md`
- `docs/pipeline/trip-inspiration-paid-intent/02-research.md`
- `docs/pipeline/search-form-field-clarity/02-research.md`

## Current Implementation Audit

### Active homepage search surface

`app/page.tsx` is the active homepage. The initial form state defaults to `searchIntent = 'trip'` and `tripType = 'roundtrip'` (`app/page.tsx:879` to `app/page.tsx:882`), so the first experience is already the broadest product mode and the longest date shape.

The first viewport renders a compact brand row, a short hero, and a large search card (`app/page.tsx:1555` to `app/page.tsx:1578`). The hero itself is not verbose: `Find flight deals.` and `Fares scored against 90-day route history.` (`app/page.tsx:1568` to `app/page.tsx:1575`). The copy-density issue starts in the search card and adjacent modules.

Before the submit button, the active form exposes these visible strings in default round-trip state:

1. Brand lockup: `expaify`, `Travel deal intelligence`.
2. Hero: `Find flight deals.`, `Fares scored against 90-day route history.`
3. Card heading: `Search`.
4. Search intent labels and descriptions: `Flights`, `Rank current fares`, `Hotels`, `Check stays for the trip dates`, `Flight + hotel`, `Review both when available`.
5. Trip type labels: `Round trip`, `One way`.
6. Field labels and placeholders: `From`, `City or airport`, `To`, `City or airport`, `Depart`, `Return`.
7. Secondary settings: `Flexible dates`, `Search nearby dates when possible`, `Passengers`, `1 traveler`.
8. Submit: `Search flights and hotels`.

That is roughly 25 visible strings before the default submit action, excluding any airport autocomplete helper/status text, validation messages, or price-calendar content. At 375px, the three intent choices stack as full-width options (`grid-cols-1` until `sm:grid-cols-3`), and each option carries both label and explanatory text (`app/page.tsx:1583` to `app/page.tsx:1605`). This makes explanatory inventory copy the first dense block inside the form.

At 1280px, the layout has enough room for the hero and form side by side (`lg:grid-cols-[minmax(0,0.86fr)_minmax(620px,1.14fr)]`), but the search card still gives equal visual weight to the intent descriptions, trip type, route fields, date fields, flexible-date helper, passenger helper, and submit (`app/page.tsx:1568` to `app/page.tsx:1795`). The first desktop viewport prioritizes the card, but it does not distinguish required search input from explanatory support copy as strongly as premium search patterns do.

### Search intent copy repeats what control state already says

The three search intent controls repeat product meaning through microcopy:

- `Flights` / `Rank current fares`
- `Hotels` / `Check stays for the trip dates`
- `Flight + hotel` / `Review both when available`

The selected intent already changes the submit copy through `submitLabelForIntent` (`app/page.tsx:63` to `app/page.tsx:68`) and loading copy through `loadingLabelForIntent` (`app/page.tsx:71` to `app/page.tsx:75`). The design can therefore reduce or remove always-visible descriptions without losing action clarity, as long as selected-state and CTA copy remain explicit.

### Secondary modules add pre-results explanation

After the form, `TripInspirationHomeRail` renders before the footer (`app/page.tsx:1799` to `app/page.tsx:1809`). The rail adds another set of pre-results strings:

- Heading: `Trip inspiration` or `Trip inspiration from major hubs`.
- Body: `Pick an idea to prefill a live search. Prices are historical hints until you search.` or `Add your origin for more relevant ideas. These are examples that become live searches after you choose dates.`
- Support note: `Live fares checked after search.`
- Per-card metadata such as theme, destination, month, night range, `Past low hint`, `Checks flights and hotels`, and `Use this trip` (`app/page.tsx:754` to `app/page.tsx:845`).
- Optional `Recent searches` chips (`app/page.tsx:858` to `app/page.tsx:874`).

This rail is useful, and prior research already made its price basis more honest. For this ticket, the issue is placement and density: it introduces another explanation-heavy route into the same task immediately after the primary form, before the user has received a result.

`SiteFooter` then adds three trust notes directly beneath the rail on the form page (`app/page.tsx:395` to `app/page.tsx:442`): final provider price/availability, Deal Score confidence, and affiliate/provider support language. All three statements are true and important, but showing all of them in the pre-search flow makes the homepage feel more defensive than direct.

### Separate SearchPanel variant

`components/search/SearchPanel.tsx` is not mounted by `app/page.tsx`, but it contains the same copy pattern in a compact dark panel. It renders search intent labels with descriptions (`Flights` / `Rank fares`, `Hotels` / `Check stays`, `Flight + hotel` / `Review both`) before route and date inputs (`components/search/SearchPanel.tsx:93` to `components/search/SearchPanel.tsx:119`). It also places `TripInspirationRail` inside the form before the flexible-date checkbox and submit button (`components/search/SearchPanel.tsx:208` to `components/search/SearchPanel.tsx:232`).

If this component is reused later, it should follow the same copy-density rules as the active homepage. Otherwise the repo will keep two search-entry variants with different copy weight and hierarchy.

## Reference Pattern Comparison

### Google Flights

Google Flights keeps the search entry task centered on concrete inputs: departure, destination, trip type, passengers/class, dates, and search. Its support documentation describes date grid and price graph as tools for finding fares after the search shape is established, not as repeated explanatory copy inside every control.

Source: https://support.google.com/travel/answer/2475306

Pattern takeaway for expaify: the first screen should make the route/date/action path obvious first. Deal Score explanation can be present, but it should not require a user to read multiple helper strings before they can start.

### Booking.com Flights

Booking.com's flights entry point uses familiar search controls and short commercial reassurance around them. The interaction pattern is that users can begin by entering flight details and searching; comparison, price breakdown, and provider confidence become more relevant once options exist.

Source: https://www.booking.com/flights/index.html

Pattern takeaway for expaify: premium trust copy works best when attached to the decision moment it supports. Homepage copy should orient; results and handoff copy should explain scoring, availability, final price, and affiliate/provider behavior.

## Exact Gap

| Area | Current code behavior | Reference pattern | Delta |
| --- | --- | --- | --- |
| First mobile form block | Three full-width intent controls each show a label plus explanation before route fields. | Product scope is selectable, but the search task is the dominant path. | Users must parse inventory explanations before entering `From`, `To`, or dates. |
| Pre-submit string count | Default path shows roughly 25 visible strings before `Search flights and hotels`. | Core search entry relies on concise labels and CTA copy. | Repeated helper text makes the form feel heavier than the task requires. |
| Trust copy timing | Footer trust notes explain provider changes, Deal Score confidence, affiliate markers, and provider support before any result. | Trust details are attached to results, price claims, and handoff. | Accurate but premature caveats can dilute confidence on first landing. |
| Inspiration placement | Trip inspiration and recent searches add heading, body, support note, card copy, and chips immediately after the form. | Discovery shortcuts are secondary to the primary search path. | Secondary modules compete with the first search instead of clearly following it. |
| Component consistency | Unmounted `SearchPanel` repeats the same intent-description pattern and places inspiration inside the form. | Reusable search entry should share one copy hierarchy. | Future reuse risks reintroducing dense copy even if `app/page.tsx` is repaired. |

## Design Directives

1. Reduce the default pre-submit copy to required labels, selected mode, and one concise value proposition. At 375px, the default path before submit should expose no more than: brand, one hero headline, one support sentence, form heading if needed, search mode labels, trip type labels, field labels/placeholders, compact secondary setting labels, and CTA. Remove always-visible search-intent descriptions unless UXDES proves they are needed for comprehension.

2. Make the selected intent and submit button carry inventory meaning. The CTA must remain explicit for all modes: `Search flights`, `Search hotels`, and `Search flights and hotels`. If explanatory copy is kept, show it only for the selected mode or as a compact secondary line below the segmented control, not repeated under all three options.

3. Move pre-search trust notes to the moments they support. Keep one short pre-search Deal Score value statement near the hero or form. Move provider final-price caveats, affiliate marker disclosure, and provider support language to results, booking handoff, or footer positions that do not compete with the first search action.

4. Treat trip inspiration and recent searches as secondary modules. At 375px, they must remain after the primary submit action and must not add explanatory copy above or inside the form. At 1280px, they may appear in the same first-page experience only if the search card remains the dominant visual target and the module copy is shortened to one heading plus one action-oriented line.

5. Apply the same copy-density contract to `components/search/SearchPanel.tsx` if UXDES keeps it in scope. The design spec should either explicitly mark the component as out of active homepage scope or provide matching copy rules so the unmounted variant does not drift further from the active surface.

## Acceptance Criteria For UXDES

- The design spec covers default, loading, empty/validation-error, mobile 375px, desktop 1280px, focus/keyboard, and edge cases for homepage copy hierarchy.
- The spec lists final visible strings for the hero, search card, selected intent states, secondary settings, trip inspiration heading/body, recent searches, trust notes, loading, and validation errors.
- At 375px, the user can see the brand, search purpose, first route field, and a clear route toward submit without reading repeated descriptions for all inventory modes.
- At 1280px, the search card and primary CTA have clear priority over trip inspiration, recent searches, and trust notes.
- No copy removal may remove programmatic labels, native control semantics, `aria-pressed`, validation `role="alert"`, loading state, focus visibility, or screen-reader-only descriptions that are needed for accessibility.
- The spec requires no provider, API, scoring, cache, money, Result, or affiliate-link contract changes.

## QA Notes For Later Stages

- Count visible strings before submit at 375px and 1280px after implementation and compare against this brief.
- Keyboard tab order must still reach intent controls, trip type, origin, destination, dates, flexible dates, passengers, and submit in a logical order.
- Error messages must remain specific and visible even if default helper copy is reduced.
- Loading copy must remain explicit enough to identify whether flights, hotels, or both are being checked.
