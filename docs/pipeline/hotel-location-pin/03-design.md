# UX Design: Hotel Location Pin Confidence

**Ticket:** `UXDES-HOTEL-LOCATION-PIN-01`  
**Stage:** UX Design  
**Priority:** P1  
**Date:** 2026-07-22

## Source and scope

- Research: `docs/pipeline/hotel-location-pin/02-research.md` on the completed upstream `agent/UXR-HOTEL-LOCATION-PIN-01` branch. The artifact was read from Git because it is not integrated into this worktree.
- Current surfaces audited: `app/components/HotelCard.tsx`, `app/components/hotelLocationContext.ts`, `app/book/BookingFlow.tsx`, `lib/booking/config.ts`, `lib/types.ts`, `lib/analytics.ts`, and `app/globals.css`.
- This is a repair to location confidence, not a map-planning feature. It adds one honest orientation comparison and one bounded pin-inspection action. It does not add a map thumbnail, routing, travel times, walkability claims, multi-anchor selection, sorting, or a new provider call.

The current unconditional `city center` distance is not verified by the provider contract. It must be suppressed on the result card, expanded details, and booking review until its reference point, unit, and method are proven. The UI must never relabel that value.

## 1. Experience model and hierarchy

The three surfaces answer progressively deeper questions:

| Surface | User question | Primary | Secondary | Tertiary |
| --- | --- | --- | --- | --- |
| Collapsed result | “Is this plausibly oriented to my trip?” | Hotel identity, price, Deal Score, `Review hotel` | Evidence label/value | One valid named-anchor distance | 
| Expanded details | “What location evidence can I verify?” | Location evidence and one named-anchor comparison | `View property pin` when coordinates are valid | Accuracy/method caveat |
| Booking review | “Is this still the same hotel and location I chose?” | Hotel identity, selected price, location evidence | Same anchor comparison and pin action | Provider-confirmation reminder |

The collapsed card remains dense and comparison-oriented. It contains no map, thumbnail, pin button, disabled pin control, disclosure tooltip, or secondary location menu. Pin inspection is deliberate and lives only in expanded details and booking review.

Only one anchor may be shown for a hotel. Anchor precedence is:

1. a user-selected venue or landmark with valid coordinates and recorded provenance (future approved input only);
2. an explicitly selected or search-linked arrival airport with valid coordinates and a full display name;
3. a provider-declared landmark or city center only when the provider contract documents its identity, coordinates, units, and measurement semantics;
4. no distance.

Do not infer an anchor from hotel copy, choose an arbitrary nearby attraction, or use arrival-airport distance when the system cannot prove the search was linked to that airport. The distance is orientation evidence, not a ranking claim: never prepend “near,” “close,” “convenient,” or “walkable.”

## 2. Evidence contract and display-state derivation

### 2.1 Required normalized evidence

The design needs a provenance-bearing contract before a distance can render. Exact field names may follow repository conventions, but the normalized data must carry these semantics:

```ts
type HotelLocationEvidence = {
  address?: string
  lat?: number
  lng?: number
  providerLocationName?: string
  area?: string
  source: 'provider' | 'search_fallback' | 'unavailable'
  anchor?: {
    kind: 'airport' | 'venue' | 'landmark' | 'city_center'
    id: string
    name: string
    lat: number
    lng: number
    source: 'user_selected' | 'search_linked' | 'provider_declared'
  }
  distance?: {
    value: number
    unit: 'mi' | 'km'
    method: 'straight_line'
    source: 'expaify_calculated' | 'provider_documented'
  }
}
```

Validation gates:

- A property pin exists only when both property coordinates are finite and in range: latitude `-90…90`, longitude `-180…180`.
- A computed distance exists only when property and anchor coordinate pairs pass the same validation, the anchor has a non-empty name/kind/source, and the measurement method/source are recorded.
- Address text does not prove a pin. Coordinates do not prove a street address or guest entrance.
- A single missing member of a coordinate pair invalidates the entire pair; do not partially render.
- Empty and whitespace-only labels are absent.
- Legacy `precision: 'exact'` is not user-facing evidence. It must not produce “Exact location.”
- The existing bare provider `distance` with hardcoded `referencePoint: 'city center'` fails these gates and is suppressed.

This contract is a DEV dependency: the current `HotelLocationDistance` has no anchor kind, anchor coordinates, source, or method, and the search path discards whether airport context was explicit. UI must not make up those fields.

### 2.2 Six property evidence states

Derive one mutually exclusive state in this order:

| State | Trigger | Collapsed label | Collapsed value | Pin action |
| --- | --- | --- | --- | --- |
| Address + pin | non-empty address + valid property coordinates | `Address` | provider address | Yes |
| Address only | non-empty address, no valid coordinate pair | `Address` | provider address | No |
| Provider pin | valid coordinates, no address | `Provider map pin` | provider location name, else provider area, else `Map position provided` | Yes |
| Area only | provider area/name, no address or valid coordinates | `Area only` | provider location name, else provider area | No |
| Search area only | only searched destination fallback exists | `Search area only` | searched destination label | No |
| Unavailable | none of the above | `Location unavailable` | `Confirm location with provider` | No |

“Address + pin” and “Address only” share the visible label because the pin is an available action, not a confidence adjective. Never show `Exact location`, `Map position` as the evidence label, or a property pin for an area/search-area state.

## 3. Final copy by surface

### 3.1 Collapsed hotel card

Render at most three lines under hotel identity, in this order:

1. evidence label;
2. evidence value;
3. one valid anchor distance, if available.

Final templates:

- evidence labels/values: exactly as §2.2;
- valid distance: `{formatted distance} from {full anchor name}`;
- example: `2.4 mi from Los Angeles International (LAX)`.

No explanatory absence copy appears in the collapsed card. If an anchor or distance is unavailable, omit the third line and preserve the evidence label/value. Do not reserve blank vertical space. Never display the legacy city-center value.

Long values wrap; the evidence value and anchor are never ellipsized because truncation could hide which location is being compared. The existing hotel title and price hierarchy remain unchanged.

### 3.2 Expanded Location section

Section title: `Location`

Render in this order:

1. evidence label and value;
2. named-anchor comparison, when valid;
3. straight-line caveat, only when a comparison is shown;
4. `View property pin`, only when valid property coordinates exist;
5. evidence note.

Final copy:

| State | Evidence note |
| --- | --- |
| Address + pin | `Provider-supplied address and map pin. Confirm the entrance and final address before payment.` |
| Address only | `Provider-supplied address. A property map pin is not available.` |
| Provider pin | `Provider-supplied map pin. Confirm the entrance and final address before payment.` |
| Area only | `Provider supplied an area, not a property address or map pin.` |
| Search area only | `Only the searched destination is available. Confirm the property location with the provider.` |
| Unavailable | `No property location details were returned. Confirm the location with the provider.` |

Distance caveat: `Straight-line distance; travel distance and time may differ.`

Pin action visible text: `View property pin`  
Accessible name: `View property pin for {hotel name}. Opens map in a new tab.`

When valid property coordinates exist but an expected search-linked anchor cannot be calculated, omit the distance by default. If product needs an explanation after validation, expanded details alone may show `Distance to your search point unavailable.` Do not show that copy when no anchor was expected, and never show it on the collapsed card.

### 3.3 Booking review continuity

The `Hotel review` summary must preserve the same property evidence state, exact displayed value, anchor name, formatted distance, measurement method, and caveat from the selected card. It must not recompute against a new anchor or downgrade to a generic city-center label.

Within `HotelSummary`:

- keep hotel name and selected nightly rate as primary;
- replace the current loose location paragraph with the same evidence label/value;
- directly below it, show the same valid distance and `Straight-line distance; travel distance and time may differ.`;
- show `View property pin` when coordinates are valid;
- keep `Location` and `Location evidence` facts in the review grid (replace `Location precision`, because internal precision vocabulary is not user copy).

Booking-review pin accessible name: `View property pin for {hotel name}. Opens map in a new tab.`

Update the “Before you continue” copy to: `Compare the hotel name, location, provider, selected rate, currency, and price basis on the provider page before entering payment details.` (existing copy remains valid). Location uncertainty never blocks `Continue to provider`; the provider-confirmation message remains visible.

## 4. Distance formatting rules

- Use the locale unit selected by the supported product locale: miles for US locale, kilometers otherwise. Do not expose a unit toggle in this ticket.
- Convert from a single canonical computation; do not round before conversion.
- `< 0.1`: `<0.1 mi` / `<0.1 km`.
- `0.1` through `< 10`: one decimal, including a trailing decimal only when required by the rounded value (for example `2.4 mi`, `3 mi`).
- `>= 10`: nearest whole unit (`12.6` → `13 mi`).
- Never render `0 mi`, more than one decimal place, a drive/walk time, or a route distance.
- The anchor name must be human-readable and specific. Airport format is `{full airport name} ({IATA})`; never `airport`, an IATA code alone, or `city center` without a proper named locality and documented source.

## 5. Responsive and visual specification

Use only existing tokens from `app/globals.css`: `--bg-raised`, `--bg-surface`, `--bg-muted`, `--border`, `--border-hover`, `--border-focus`, `--brand`, `--brand-soft`, `--text-1`, `--text-2`, `--text-3`, `--warning`, `--error`, `--radius-card`, and `--radius-control`.

### Collapsed location block

Reuse the current position under property quality:

```txt
mt-2 min-w-0 text-xs leading-5
label: font-bold text-[color:var(--text-2)]
value: break-words font-medium text-[color:var(--text-2)]
distance: break-words font-medium text-[color:var(--text-1)]
warning label: text-[color:var(--warning)]
```

Use warning color only for `Search area only` and `Location unavailable`; the copy carries the meaning without color. `Area only` is honest but not an error.

At 375px, retain the existing `grid-cols-[4.5rem_minmax(0,1fr)_minmax(6.75rem,auto)] gap-3`. Location copy wraps within `minmax(0,1fr)` and may increase card height. Do not reduce the photo, price type, or tap targets to fit it. Do not truncate the anchor. At 1280px, retain the same information order and current card width; do not create a side-by-side map region.

### Expanded Location panel

Container:

```txt
rounded-[var(--radius-card)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] px-3.5 py-3
text-xs font-medium leading-5 text-[color:var(--text-2)]
```

- title: `font-bold text-[color:var(--text-1)]`;
- evidence: `mt-1 break-words`;
- distance: `mt-2 break-words font-bold text-[color:var(--text-1)]`;
- caveat: `mt-1 text-[color:var(--text-3)]`;
- note: `mt-2`, with `text-[color:var(--warning)]` only for search-area/unavailable;
- pin action:
  `mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 text-sm font-bold text-[color:var(--text-1)] transition-colors hover:border-[color:var(--border-hover)] hover:bg-[color:var(--brand-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]`.

At 375px, make the pin action `w-full`; every line wraps with `break-words`, no horizontal scroll. At `sm` and above it becomes `w-auto`. At 1280px, keep the panel in the existing details stack; no fixed height and no second column.

### Booking review

Reuse the current summary typography and panel tokens. The location group stays in the left identity column; price remains in the right column at desktop and below identity on mobile. Pin action uses the same style and `w-full sm:w-auto`. The summary fact grid stays `grid gap-3 sm:grid-cols-2`.

## 6. Interaction, keyboard, and focus

- `Details` behavior remains unchanged. Opening it reveals the Location section in document order; do not automatically move focus or open a map.
- `View property pin` is an `<a>` only when a safe, allowlisted `https:` map URL can be constructed from the validated coordinate pair. It uses `target="_blank"` and `rel="noopener noreferrer"`.
- Tap/click, `Enter`, and standard link activation open the same coordinate-backed target. Space retains native link/page behavior; do not add button keyboard emulation to a link.
- Focus order on a card remains `Review hotel` → `Details` → `View property pin` after expansion, matching current DOM order. Do not use positive `tabIndex`.
- The visible `--border-focus` outline must not be clipped by the Location panel.
- Returning from the map leaves the result card expanded. Booking review is a separate page and does not need to restore result focus.
- The external map receives property coordinates only. It must not receive hotel price, Deal Score, provider URL, user identity, or free-form search text.
- If no safe URL exists, omit the control. Never render a disabled `View property pin`.

## 7. Loading, empty, error, and edge states

Location evidence is part of the hotel offer, not an independent blocking fetch in the current flow.

| State | Collapsed | Expanded | Booking review |
| --- | --- | --- | --- |
| Hotel result loading | Preserve the existing card skeleton/layout; no fake address, distance, anchor, map tile, or pin control | Details unavailable until result resolves | Not reachable |
| Location fields absent after success | `Location unavailable` / `Confirm location with provider` | Unavailable note; no distance or pin | Same unavailable state; provider handoff remains usable |
| Area/search-area only | Render exact §2.2 state | Note from §3.2; no distance or pin | Preserve same evidence wording |
| Anchor missing or invalid | Show property evidence only | Pin remains available if property coordinates are valid; omit distance | Preserve evidence; omit comparison |
| Property coordinates invalid or partial | Treat coordinates as absent | No pin; address/area may still render | No pin; handoff remains usable |
| Unknown distance semantics | Suppress value entirely | Do not relabel or explain it as city center | Do not serialize/render it |
| Map target construction fails | No impact before action | Omit pin action if detected before render | Omit pin action |
| Map navigation fails after activation | Existing page remains intact in its original tab | No inline error is fabricated because the external tab owns the failure | Same |
| Optional map URL resolver fails asynchronously | Keep evidence and comparison text; replace action region with `Map link unavailable. You can still confirm the location with the provider.` in `text-[color:var(--warning)]` | Same | Same; provider handoff remains enabled |

Loading copy, if an approved asynchronous map-link resolver is later introduced: `Preparing map link…` in `text-[color:var(--text-3)]` with `aria-live="polite"`. Do not reserve a map thumbnail or show a spinner. Error copy is not `role="alert"` because map inspection is optional and booking remains usable.

Edge rules:

- If address and provider area disagree, show the address but do not merge the strings. Preserve provider area only as metadata; flag the inconsistency for provider diagnostics.
- If the same hotel reaches booking review without the anchor fields serialized, omit the distance rather than recomputing from search state.
- If anchor text exceeds the card width, wrap it; do not shorten the proper name to an ambiguous category.
- If a formatted distance would be non-finite, negative, or lacks a unit, suppress it.
- Exactly `0.1` uses `0.1`; exactly `10` uses `10`.
- A zero coordinate is valid when within range; do not reject it using truthiness checks.
- Duplicate location impressions caused by React development rendering must be deduplicated by `hotelId + evidenceState + anchorId` per result-list render/session view.

## 8. Analytics specification

Analytics must measure confidence progression for the same property, not map engagement alone. Do not send raw coordinates, full street addresses, hotel price, or free-form user text.

Shared properties:

```ts
{
  hotelId: string
  evidenceState: 'address_pin' | 'address_only' | 'provider_pin' | 'area_only' | 'search_area_only' | 'unavailable'
  anchorKind: 'airport' | 'venue' | 'landmark' | 'city_center' | 'none'
  anchorId: string | 'none'
  hasDistance: boolean
  distanceBucket: 'lt_1' | '1_5' | '5_10' | '10_25' | 'gte_25' | 'none'
}
```

Events and triggers:

| Event | Trigger | Additional properties |
| --- | --- | --- |
| `hotel_location_impression` | location block first enters the rendered results list for that property; once per result-list view | shared |
| `hotel_location_details_opened` | `Details` changes from collapsed to expanded; fire on every deliberate open | shared |
| `hotel_location_pin_opened` | immediately before a valid pin link navigates | `mapTarget: 'external_coordinate_map'`, shared |
| `hotel_review_opened_after_location` | booking review loads for a property whose result location was previously inspected in the same session | `sameProperty: true`, shared |
| `hotel_provider_handoff_after_location` | `Continue to provider` activates after prior location inspection for the same property | `sameProperty: true`, shared |

“Inspected” means either details opened or pin opened; retain which action occurred in session-scoped correlation. Area-only, search-area-only, unavailable, invalid-coordinate, and failed-link states never emit `hotel_location_pin_opened`. A pin-open increase alone is not success. Primary measure is same-property provider handoff after inspection; guardrails are repeated inspection across properties and exit without review.

Analytics failure is silent and non-blocking. It never prevents detail expansion, pin navigation, review, or provider handoff.

## 9. Acceptance criteria

1. The collapsed card renders one of the six evidence states and, at most, one provenance-valid named-anchor distance. It contains no pin action or map preview.
2. `Exact location` is removed from user-facing copy. Address evidence and coordinate evidence are represented independently.
3. Address + coordinates and coordinates-only states expose `View property pin` only in expanded details and booking review; all other states omit it.
4. The unverified current city-center distance is absent from collapsed cards, expanded details, booking review, and booking URL serialization.
5. A valid comparison requires property coordinates, anchor coordinates, typed anchor provenance, a full anchor name, and a recorded measurement method/source.
6. Distance formatting and the straight-line caveat match §4 and §3 exactly. No travel time, “near,” “walkable,” or routing claim appears.
7. The booking review preserves the selected card’s evidence state, anchor, distance, method, and pin target; it never silently changes the reference point.
8. At 375px, long addresses/anchor names wrap without overlap, truncation, horizontal scroll, or collision with image, price, Deal Score, `Review hotel`, or `Details`. Pin actions are full-width.
9. At 1280px, location remains in the existing card/details hierarchy; no thumbnail or new map column is introduced.
10. Tab order, native link behavior, accessible names, external-tab disclosure, and visible focus treatment match §6.
11. Loading, absent, invalid-coordinate, unknown-provenance, link-error, and external-navigation states degrade without blocking hotel review or provider handoff.
12. All five analytics events use the specified property-safe payload; raw coordinates and addresses are not sent; analytics failures do not affect UX.

## 10. Implementation split and constraints

### UI stage

- Update `hotelLocationContext` presentation semantics and `HotelCard`/`HotelSummary` rendering for all six evidence states.
- Add the pin link only behind a validated, safe coordinate/map-target input.
- Implement responsive, focus, copy, loading/error presentation, and analytics calls without changing existing `HotelCard` props or exports.
- Add fixtures/tests covering every evidence combination and long-copy layout semantics.

### Required DEV follow-up

The UI cannot honestly populate named-anchor distance from the current contract. DEV must:

- extend normalized hotel location data with anchor identity/type/source/coordinates and distance method/source;
- preserve explicit/search-linked anchor context through `app/api/search` and provider normalization;
- calculate straight-line distance only from validated coordinates, or accept a provider distance only with documented semantics;
- suppress/remove the adapter’s current invented `city center` reference;
- preserve the same validated fields through booking serialization/parsing without putting unverified values back into the URL.

All provider calls remain in `lib/providers`, adapters return `Result<T>`, secrets remain environment-only, and affiliate markers remain on the provider handoff. No implementation may claim airport intent if the current normalized search context cannot prove it.

## Out of scope

- Embedded maps or map thumbnails.
- Directions, route distance, traffic, drive/walk/transit time, entrance accuracy, or walkability.
- User-created anchors, an anchor picker, arbitrary nearby landmarks, location sorting/filtering, and multi-property map comparison.
- Repairing airport-coordinate coverage or selecting a new hotel/map provider.
- Changing Deal Score, hotel ranking, pricing, booking eligibility, or affiliate behavior.

