# UXD-HOMEPAGE-COPY-DENSITY-01: Homepage Copy Density

## Problem Statement

The homepage asks first-time users to process too much explanatory and secondary copy before committing to search, which makes expaify feel less direct and less confident as a premium travel deal finder.

## Affected Users and Flow Step

- **Users affected:** First-time paid-intent users and returning deal hunters who arrive on the homepage ready to check a route or browse current deals.
- **Flow step:** Search form entry before the first search action, especially the first viewport on desktop and the initial scroll path on 375px mobile.
- **Affected source:** `app/page.tsx` renders the active homepage search experience, hero copy, search-intent descriptions, form helper copy, trip inspiration rail, recent searches, and trust-note footer; `components/search/SearchPanel.tsx` contains a separate compact search panel variant with search-intent descriptions, trip-type controls, inspiration rail, flexibility helper copy, and submit copy.

## Current Implementation Signal

- `app/page.tsx` places brand/tagline copy, a hero headline, a supporting sentence, search card heading, search-intent descriptions, trip type controls, field labels, flexible-date helper copy, passenger helper copy, optional form error copy, and the submit button in the primary search area.
- The page also renders `TripInspirationHomeRail` and `SiteFooter` beneath the form in the same homepage view, adding recent-search, inspiration, and trust-note copy before users have received any result.
- The search-intent options repeat explanatory microcopy: "Rank current fares", "Check stays for the trip dates", and "Review both when available"; the compact `SearchPanel` variant has similar copy: "Rank fares", "Check stays", and "Review both".
- The hero message is already short, but surrounding support text and secondary modules compete with the direct action of entering route/date details and pressing "Search flights", "Search hotels", or "Search flights and hotels".

## Measurable Signal

- At 375px mobile, users should be able to see the brand, the search purpose, the first route field, and a clear path to the submit action without scrolling through repeated explanatory modules.
- At 1280px desktop, the first viewport should clearly prioritize the search card and primary action over secondary copy such as inspiration, recent searches, and trust notes.
- Instrumentable product signal: low first-search conversion, delayed first form interaction, or scroll before first field focus from homepage sessions.
- UX audit signal: visible strings before the submit action can be counted and grouped; repeated intent/helper copy should be reduced where labels or control state already communicate the same meaning.

## Constraints

1. Preserve search confidence and trust: users must still understand that expaify scores fares against route history and that final prices are confirmed by providers before booking.
2. Preserve accessibility and usability: concise copy must not remove programmatic labels, focus states, error messages, form affordances, or 375px mobile readability.
3. Preserve scope and data contracts: the solution must be copy and hierarchy only, with no provider/API changes, no new external calls, no change to money/result types, and no change to affiliate handoff behavior.

## Success Statement

This is solved when a first-time user can land on the homepage, understand that expaify searches and scores travel deals, and start a flight or hotel search without reading repeated explanatory copy or scrolling past secondary content to find the action.

## Handoff Notes for UXR

- Audit the first viewport at 375px and 1280px and count visible strings before the submit button.
- Compare homepage search-entry patterns against premium travel search products at the interaction level: what copy appears before search, what moves after results, and what is omitted because the form labels already explain it.
- Identify which trust statements are essential before search versus which can move to results, footer, or provider handoff moments.
