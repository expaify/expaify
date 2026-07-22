# UX Research: Hotel Destination Disambiguation

**Ticket:** UXR-DESTINATION-DISAMBIGUATION-01 · **Stage:** UXR · **Priority:** P0  
**Upstream:** `docs/pipeline/destination-disambiguation/01-discovery.md`  
**Audited surfaces:** hotel availability search, premium natural-language deal search, deal-feed destination filter, shared provider/location types, and analytics.

## 0. Evidence boundary

The assigned branch did not initially contain the discovery file, although repository history contains the completed UXD artifact at commit `e9db201`. The unchanged upstream report has been restored to this worktree so the required pipeline input exists. This brief separates three evidence classes:

- **Current-code evidence:** what expaify can represent and submit today.
- **Reference-pattern guidance:** what official Booking.com and Expedia Group interfaces establish as useful geography contracts; these are not configured expaify providers.
- **Research hypotheses:** mobile comprehension and behavioral outcomes that require prototype or production measurement. No user study or production event baseline exists in this ticket.

## 1. Executive finding

Expaify cannot currently disambiguate a hotel destination because it has no normalized hotel-destination entity and no hotel location-suggestion path. The live availability flow submits a flight IATA or metro code as an opaque hotel `area`; the deal flow submits one of 20 bare city names. Neither carries a hotel-search location ID, type, hierarchy, or selection provenance into the provider call, cache key, results heading, or analytics.

The minimum viable repair is therefore not a copy-only dropdown adjustment. Before a suggestion UI can truthfully distinguish `City`, `Airport area`, or `Neighborhood`, the configured location/provider layer must return those fields. Under the discovery constraint, UXDES should specify the interaction and honest unsupported states, but UI/DEV must not fabricate types or parent geography from labels, IATA codes, hotel result addresses, or third-party reference schemas.

## 2. Current implementation audit

### 2.1 Location identity, type, and hierarchy

| Path | Current input/identity | Type available? | Parent hierarchy available? | What survives |
|---|---|---:|---:|---|
| Premium natural-language deals | `DealSearchFilters.city` from a fixed 20-city enum (`lib/ai/dealSearchFilters.ts:1-35`) | No; `destination_type` only says the inventory is `hotel` | No | Bare city string; rendered as `City: {name}` (`app/components/ui/SearchBar.tsx:73-82`) |
| Deal-feed filter | `city: string`, chosen from the same tracked names (`app/deals/DealFeed.tsx:463-481`) | No | No | Bare city string in URL/API/filter chip (`app/deals/DealFeed.tsx:246-265`, `394-397`) |
| Tracked-market catalog | `{ city, country, iata }` (`lib/trackedMarkets.ts:1-29`) | Implicitly a tracked market, not an explicit hotel geography type | Country only; no state/region, parent city, district, or provider location ID | UI options use only `city`; `country` and `iata` are dropped |
| Live hotel availability | Selected flight `destIATA` (`app/api/search/route.ts:395-400`) | No | No | The code itself becomes `area: string` |
| Hotel provider contract | `searchHotels(area: string, range)` (`lib/types.ts:179-184`) | No | No | One opaque string |
| Hotellook request/cache | Uppercased `area` in `location=...` and `hotellook:search:{location}:...` (`lib/providers/hotellook.ts:409-438`) | No | No | The same opaque string |
| Hotel result | Stable **property** `hotelId`; optional result `location.name`, address, coordinates, and distance (`lib/providers/hotellook.ts:10-28`, `448-486`) | Property type is present in the local raw shape but not mapped; no search-scope type | No search-scope hierarchy | Property-level location evidence only, after the destination has already been chosen |

The `HotelLocation` type grades a returned property's precision (`exact`, `coordinates`, `area`, `search_area`, `missing`) but does not identify the selected search geography (`lib/types.ts:119-151`). A property ID or property address cannot serve as the destination ID: it identifies a hotel result, not the city/airport/neighborhood boundary used to retrieve inventory.

`lib/providers/bookingComRapidApi.ts` is a flight adapter only. It does not provide Booking.com lodging destination lookup despite its filename. There is no repository endpoint analogous to `/api/hotel-locations`, no provider method for location suggestions, and no hotel destination type in `lib/types.ts`.

**Answer to research question 1:** the configured hotel path exposes no stable search-location ID, location type, or hierarchy for any city, airport, district, neighborhood, landmark, or namesake query. The only stable location-adjacent identifiers are flight IATA/metro strings and tracked-market names; neither is sufficient to assert hotel search scope. A live payload audit cannot fill this gap because the current Hotellook call is an availability endpoint after selection, not a location-suggestion endpoint.

### 2.2 Selection, persistence, and recovery

- Natural-language search immediately applies a parsed city string to the feed; the confirmation chip has no type beyond the word `City`, no country, and no edit-in-place scope control (`SearchBar.tsx:44-56`, `73-82`).
- The feed's active destination cue is a pill containing only the city label. A same-name place cannot be distinguished after the menu closes (`DealFeed.tsx:394-397`, `463-481`).
- Live hotel availability inherits the flight destination. There is no separate hotel destination selection or message that states whether hotels are city-wide or near the selected airport (`app/api/search/route.ts:395-423`).
- The current analytics helper accepts primitive properties, but no destination suggestion, selection, edit, backtrack, or revision event exists (`lib/analytics.ts:1-7`; repository-wide event audit).
- The airport combobox is a useful local interaction precedent—not a reusable hotel data source. It already uses `combobox`, `listbox`, `option`, `aria-activedescendant`, keyboard navigation, live status, wrapped two-line rows, and a persistent selected-scope helper (`app/components/AirportInput.tsx:155-257`). Hotel destination design can reuse this behavior while requiring a different normalized entity.

## 3. Reference-pattern comparison

### Booking.com Demand API: location type is explicit and singular

Booking.com's official accommodation search requires exactly one location filter and supports `region`, `city`, `district`, `airport`, or `landmark`, each obtained from a location endpoint as an ID. Landmark radius is separately explicit. The relevant pattern is not Booking.com's visual styling; it is that the committed search scope is a typed identifier, not a display string or silently broadened substitute. [Booking.com: Search for accommodation](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties)

### Expedia Group Rapid: suggestion rows carry identity, type, and hierarchy

Expedia's official typeahead supports city, airport, metro vicinity, neighborhood, point of interest, station, address, and property types. Its documented `chicago` response distinguishes an airport, the city, and Downtown Chicago with `related_id`, `type`, `name`, `name_full`, country code, and coordinates. Selection then uses the returned ID to retrieve regional inventory. [Expedia Group: Typeahead API](https://developers.expediagroup.com/rapid/lodging/typeahead/typeahead)

Expedia's geography model also warns against assuming a universal strict hierarchy: regions can have multiple ancestors, an airport can have an associated city, and neighborhood boundaries are touristic rather than necessarily administrative. The UI should therefore display provider-returned ancestry without inventing a fixed `neighborhood → city → state → country` truth model. [Expedia Group: Geography API](https://developers.expediagroup.com/rapid/lodging/geography/about-geography-api?locale=en_US)

### Accessible combobox behavior

WAI-ARIA's combobox pattern keeps DOM focus on the input, exposes a controlled popup and active option, uses arrow keys to move through suggestions, Enter to accept the focused suggestion, and Escape to dismiss without changing the prior committed value. This matches the interaction foundation already present in `AirportInput`. [W3C WAI-ARIA APG: Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)

### Exact delta

| Reference contract/pattern | Expaify today | Delta |
|---|---|---|
| Typed, stable search-location ID | Bare city or flight IATA/metro string | Introduce a provider-scoped hotel destination identity before UI claims disambiguation |
| City, airport, neighborhood, landmark are distinct scopes | All hotel availability collapses to `area: string` | Preserve `locationType` end to end and never infer it from copy |
| Full display label and hierarchy accompany suggestion | City-only labels or airport code | Show minimum parent context in every row and retain it after selection |
| Narrow scope is explicitly selected | Airport code is silently reused for hotels | Do not claim airport-vicinity inventory unless the provider supports that typed scope |
| Selected ID drives inventory | Cache/search key uses a display-like string | Key request, cache, URL/state, and analytics by provider + type + stable ID |
| Combobox selection is explicit and reversible | No hotel combobox exists | Add an accessible manual-selection model; typed text alone is not a committed scope |

## 4. Ambiguity and content model

### Required normalized selection

The design should depend on a provider-returned object equivalent to:

```ts
type HotelDestinationSelection = {
  provider: string
  locationId: string
  locationType: 'city' | 'airport' | 'airport_area' | 'district' | 'neighborhood' | 'landmark' | 'region'
  name: string
  parentLabel: string
  fullLabel: string
}
```

This is a research-level content contract, not authorization to add a vendor. `locationId` must be namespaced by `provider` and interpreted with `locationType`; a raw numeric/string ID is not globally stable. `parentLabel` and `fullLabel` must be returned or deterministically composed from provider hierarchy—not mined from the query.

### When added context is required

Use a consistent two-line suggestion anatomy for **every** result:

1. Primary: place name.
2. Secondary: human-readable type + minimum distinguishing parent geography.

Examples: `Paris` / `City · France`; `Charles de Gaulle Airport` / `Airport area · Paris, France`; `Downtown Chicago` / `Neighborhood · Chicago, Illinois, United States`.

Do not show context only after a duplicate appears. A conditional layout makes rows harder to scan and leaves users unable to verify whether an apparently unique match is a city or airport. Add another provider-returned hierarchy level only when the first parent label does not distinguish two options. Never use provider result rank or confidence alone to auto-commit a choice.

Define an **ambiguous suggestion set** for measurement when any of these are true:

- two results share the same normalized primary name;
- the set mixes `city`/`region` with `airport`/`airport_area` or `district`/`neighborhood`/`landmark` under the same parent;
- two results have the same primary name and type but different parent IDs; or
- the user's expressed narrow type is unsupported but a broader parent is available.

### 375px fit assessment

No current hotel suggestion UI exists, so this is a content-fit assessment, not a usability-test result. At a 375px viewport, a typical 16px page gutter leaves 343px; a suggestion row with 12px internal padding leaves about 319px for text. `name + type + parent` is viable if rendered as two wrapping lines with the primary name separate from the secondary metadata. It is not reliably viable as one line or as a no-wrap pill.

Stress cases such as `Charles de Gaulle International Airport` and `Downtown Chicago · Neighborhood · Chicago, Illinois, United States` will wrap. That is acceptable: preserve the distinguishing place and parent; cap visual rows by layout rather than truncating the only unique geography. Country codes alone are insufficient for unfamiliar users, while continent and postal code are normally redundant. UXDES should validate at least these cases at 375px: same-name cities in different US states, same-name cities in different countries, city versus airport, neighborhood versus parent city, and a 35+ character airport name.

**Answer to research question 3:** name + explicit type + provider-returned parent geography is the minimum semantically sufficient set for the common ambiguity classes and can fit 375px in a two-line wrapping row. This remains a prototype hypothesis until tested with first-time travelers and assistive technology; it cannot resolve two provider entities whose displayed name, type, and parent are all identical, in which case one additional provider-returned level or code is required.

## 5. Persistent selected-scope cue

The selected destination must remain visible in three places using the same identity:

- **Collapsed field, before search:** primary value `{name}`; helper `{Type} in/near {parentLabel}`. Examples: `Downtown Chicago` + `Neighborhood in Chicago, Illinois, United States`; `Charles de Gaulle Airport` + `Airport area near Paris, France`.
- **Loading:** results heading `Hotels in {name}` with the same helper line and an `Edit destination` action. Do not replace it with a generic skeleton.
- **Results/empty/error:** retain that heading and helper above the state message so a user can diagnose scope without reopening the field.

The cue must be text, not icon/color alone. Editing should restore the full selected label in the input, preserve the prior committed selection until a new option is chosen, and let Escape cancel exploration. Any query change marks the field uncommitted; Search must not silently reuse the old hidden ID with new visible text.

## 6. Unsupported narrow intent recovery

Never silently broaden a district, neighborhood, landmark, or airport-area request to its city. Use one of these exact recoveries:

- If a stable supported parent is supplied: `We can’t search {name} as a {type} yet. Search hotels across {parentName} instead?` Actions: `Search {parentName}` and `Edit destination`. The broader scope is committed only after the first action.
- If no stable supported parent is supplied: `We don’t support that destination yet. Try a nearby city or airport.` Action: `Edit destination`.
- If lookup fails: `Destination search is unavailable right now. Try again.` Actions: `Try again` and `Edit destination`. Do not show a broader match as if it were selected.
- If a valid narrow scope returns zero inventory: retain the selected scope and say `No hotels were returned in {name} for these dates.` Offer date editing first; offer a broader parent search only as an explicit secondary action if its stable ID is known.

An airport IATA code may label or help find an airport option, but it must not be presented as `Airport area` unless the configured hotel provider's location data explicitly defines that scope and its inventory mapping.

## 7. Design directives

1. **Require a typed, stable selection before hotel search.** A destination is committed only after the user taps/clicks an option or presses Enter on the visibly focused option. The persisted key is provider + `locationId` + `locationType`; raw input, display name, tracked city string, and flight IATA alone are invalid substitutes. Test: typing `Springfield` and submitting without selecting does not request hotel inventory.

2. **Use the same two-level anatomy for every suggestion.** Render `{name}` as primary and `{Type} · {parentLabel}` as secondary, wrapping within the row at 375px. Add an extra provider-returned state/region/country/code only when two options remain indistinguishable. Test: city/country namesakes, city-versus-airport, and neighborhood-versus-city can be distinguished without horizontal scrolling, tooltip dependence, or truncated unique context.

3. **Keep the committed hotel scope visible through all states.** The collapsed field, loading heading, results, empty state, and error state must repeat `{name}` plus `{Type} in/near {parentLabel}` and expose `Edit destination`. Test: after selecting Downtown Chicago, a user can identify that neighborhood scope while results load and after an empty response without reopening the control.

4. **Make broadening an explicit recovery choice.** Unsupported narrow intent and narrow-scope empty results must never replace the selected ID with a parent ID automatically. Use the exact recovery copy/actions in §6 and record the parent as a new selection only after activation. Test: choosing an unsupported airport area leaves the original scope visible until the traveler explicitly selects `Search {parentName}`.

5. **Implement the combobox as one accessible manual-selection model.** Keep focus on the input; expose `combobox`, `listbox`, `option`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`; announce loading, result count, focused option's full accessible name, no matches, and errors. Arrow keys move focus, Enter accepts the focused option, Escape closes without changing the committed selection, and touch targets are at least 44px high. Test: the entire flow works by keyboard and a screen reader hears name, type, and parent for each option and the selected-scope cue.

## 8. Measurement plan

Instrument only after a stable destination identity exists. Prefer coarse query classification over raw query text unless analytics privacy rules explicitly allow collection.

| Event | Required properties |
|---|---|
| `hotel_destination_suggestions_viewed` | `lookup_id`, `result_count`, `location_types`, `ambiguity_class`, `latency_ms` |
| `hotel_destination_selected` | `lookup_id`, `selection_id`, `provider`, `location_id`, `location_type`, `parent_location_id` when supplied, `position`, `selection_method`, `selection_time_ms`, `ambiguity_class` |
| `hotel_destination_edited` | `selection_id`, `elapsed_ms`, `results_seen`, `hotel_card_opened`, `outbound_clicked` |
| `hotel_results_backtracked` | `selection_id`, `elapsed_ms`, `hotel_card_opened`, `outbound_clicked` |
| `hotel_destination_revised` | `prior_selection_id`, `new_selection_id`, `same_parent`, `type_changed`, `elapsed_ms`, `recovery_source` |

Primary metric: percentage of selections followed within 120 seconds by an edit, pre-engagement backtrack, or revision to a different stable ID/type. Compare ambiguous with unambiguous sets, and separately report same-name, mixed city/airport, and narrow-versus-parent classes.

Guardrails: median/p90 selection time, suggestion abandonment, lookup errors, keyboard selection completion, and hotel-result engagement. Do not declare success merely because correction falls; a slower or abandoned selector can suppress corrections by preventing searches.

Start with baseline instrumentation on the current flow only if events can honestly identify its coarse selection (`tracked_market` or `flight_iata`) without relabeling it as a typed hotel geography. Then evaluate the designed treatment against that baseline. No production rate or numerical improvement target is justified before baseline volume and variance are known.

## 9. Scope and dependencies for UXDES

UXDES should specify default, typing, loading, mixed-type suggestions, no matches, lookup error, selected, editing, unsupported narrow intent, narrow empty results, mobile 375px, desktop 1280px, keyboard, focus/blur, and screen-reader announcement states. It must provide exact visible strings and distinguish `in` for contained scopes from `near` for explicitly provider-defined airport vicinity.

The design has a hard data dependency: current code cannot populate the required destination identity. A later UI stage can reuse the existing airport combobox interaction vocabulary, but logic/API/provider work will require a DEV ticket after UI. Adding Expedia, Booking.com, or any new location vendor is not authorized by this research ticket. If Hotellook cannot return typed stable location suggestions under the existing agreement, the implementation must stop at an honest unsupported state or obtain separate feature/provider approval.

## 10. Handoff

Create `UXDES-DESTINATION-DISAMBIGUATION-01` to turn these directives into an implementation-ready state/copy/accessibility specification while preserving the provider and repair-scope constraints above.
