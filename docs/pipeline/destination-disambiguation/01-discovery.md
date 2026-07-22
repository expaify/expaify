# UX Discovery: Hotel Destination Disambiguation

## Problem Statement

Travelers can silently enter the wrong hotel geography because expaify reduces a destination to an unqualified city label or airport-area code before results, without confirming whether the intended place is a city, airport vicinity, district, or similarly named location.

## Who Is Affected and Where

This primarily affects first-time and occasional travelers who cannot rely on local knowledge to recognize the right match, with elevated risk for:

- travelers searching a city name shared across states or countries;
- travelers using an airport name or code when they mean the surrounding city, or vice versa;
- travelers whose stay intent is a district, neighborhood, landmark, or airport vicinity rather than the whole city; and
- mobile users scanning short suggestion labels under time or space constraints.

The failure occurs between entering a hotel destination and committing the selection that scopes inventory. It becomes visible only after results load, when the traveler notices irrelevant properties and edits, immediately returns, or runs a revised search.

## Current Product Signal

The repository shows three incompatible destination representations, none of which preserves enough identity to disambiguate a hotel search:

- The premium natural-language search parses destination intent into a `city` string and confirms it only as a chip such as `City: Miami`; the schema accepts only 20 tracked city names and carries no location ID, location type, country/region, parent city, or district (`app/components/ui/SearchBar.tsx`, `lib/ai/dealSearchFilters.ts`).
- The deal-feed destination control offers the same 20 city labels. Its choices do not expose country or region at selection time, even though onboarding cards separately hold a city, country code, and IATA/metro code (`app/deals/DealFeed.tsx`, `lib/trackedMarkets.ts`).
- The availability path calls `HotelProvider.searchHotels(area, range)` with the selected flight destination IATA/metro code. The provider cache and request key only that string, so a hotel search cannot retain whether the traveler intended an airport vicinity, its parent city, or a narrower district (`app/api/search/route.ts`, `lib/types.ts`, `lib/providers/hotellook.ts`).

No current analytics event records the typed destination, suggestions shown, stable selected-location identity, location type, correction, or result-page backtrack. The ticket's proposed behavioral signals therefore remain hypotheses to instrument and validate, not evidence of a measured production rate.

## Measurable Problem Signal

Use **wrong-location result sessions** as the primary failure measure: the share of hotel result sessions followed within two minutes by a destination edit, immediate backtrack to destination entry, or revised destination search.

Supporting measures should distinguish ambiguity from ordinary refinement:

- destination selection-to-edit rate within two minutes, segmented by query, selected location type, and number of plausible matches;
- immediate result-to-entry backtrack rate, before any hotel-card or outbound-provider click;
- revised-search rate where the next selected location differs in stable ID, type, or parent geography;
- hotel-card engagement and outbound click-through after ambiguous versus unambiguous selections; and
- suggestion abandonment rate when multiple plausible locations are shown.

The first benchmark should compare these rates across unambiguous city selections, same-name place selections, airport-versus-city selections, and district-versus-city selections. A reduction target should be set only after baseline instrumentation establishes volume and variance.

## Minimum Context to Validate

Research should determine whether the smallest reliable confirmation set is:

1. the primary place name;
2. the location type (city, airport area, district/neighborhood, or other provider-supported type); and
3. enough parent geography to distinguish the match—normally city plus state/region and country, without showing redundant levels.

A stable provider location ID must remain attached to the selection even if the visible confirmation is shortened for mobile. Proximity or airport-code context should appear only when present in existing provider data; expaify must not infer unsupported boundaries or distances.

## Constraints

1. **Existing data only:** use location identities, types, hierarchy, codes, and labels already returned by the configured location/provider layer. Do not introduce a new vendor or invent geographic precision in this repair ticket.
2. **Lightweight mobile interaction:** preserve quick type-and-select behavior at 375px, with scannable suggestions, a clear selected state, and accessible keyboard/screen-reader operation; confirmation must not become a separate mandatory step for every unambiguous query.
3. **Search and data integrity:** retain a stable selected-location identity through query, cache, results, and analytics; never silently substitute an airport, city, district, or namesake, and keep all external calls behind `lib/providers` with existing `Result<T>` contracts.

## Success Statement

This is solved when a first-time traveler can distinguish and confirm the intended city, airport area, district, or namesake before viewing hotel results, without entering a wrong-location result session or adding a heavy confirmation step on mobile.

## UXR Handoff

### Research Questions

1. Which location fields and hierarchies does the existing hotel/location provider return for city, airport, district, neighborhood, landmark, and same-name queries, and which stable identifier can survive the full search flow?
2. At what ambiguity threshold do travelers need explicit context: for every suggestion, only duplicate names, airport-versus-city pairs, or any result below a provider confidence threshold?
3. Is name + type + parent geography sufficient for first-time travelers to choose correctly at 375px, and which hierarchy levels become redundant noise?
4. After selection, what lightweight persistent cue lets travelers verify search scope before and while results load without requiring an extra confirmation screen?
5. How should unsupported district or airport-vicinity intent recover without silently broadening to a city or producing an empty, misleading search?

### Target Segments

- First-time or occasional travelers searching an unfamiliar destination.
- Travelers entering a same-name city across different states, regions, or countries.
- Travelers deciding between an airport vicinity and its parent city or metro area.
- Travelers expressing district, neighborhood, or landmark intent within a large city.
- Mobile travelers at 375px using touch, plus keyboard and screen-reader users whose selection context cannot depend on visual layout alone.

### Event Hypotheses

- `hotel_destination_suggestions_viewed`: ambiguity risk increases with `result_count`, repeated primary names, and mixed `location_types`.
- `hotel_destination_selected`: selections carrying `location_id`, `location_type`, `parent_geography`, `query`, `position`, and `selection_method` establish the denominator for correction analysis.
- `hotel_destination_edited`: an edit within 120 seconds of selection is more common for same-name and mixed-type suggestion sets than for unique city matches.
- `hotel_results_backtracked`: a return to destination entry within 120 seconds, before `hotel_card_opened` or an outbound click, is a strong wrong-scope proxy.
- `hotel_destination_revised`: changing to a different stable location ID or location type within 120 seconds is a stronger disambiguation failure signal than changing dates, price, or other filters.
- If minimum context and a persistent selected-scope cue work, ambiguous-query sessions should approach the unambiguous-city baseline for edits, backtracks, and revisions without materially increasing selection time or suggestion abandonment on mobile.

All event payloads should use stable location identifiers and coarse place metadata; do not send raw free-text queries if analytics privacy rules prohibit them.
