# Development blocker: hotel destination disambiguation

**Ticket:** `DEV-DESTINATION-DISAMBIGUATION-01`  
**Stage:** DEV  
**Status:** Blocked at the approved-provider gate

## Blocking conditions

Implementation cannot proceed without violating the approved design and ticket contract:

1. The only configured production hotel provider is `HotellookProvider`. Its public contract is `searchHotels(area: string, range, context?)`, and its adapter calls the Hotellook availability cache endpoint with an opaque `location` string. It does not expose a destination-suggestion method or return the required stable `provider`, `locationId`, `locationType`, `name`, `parentLabel`, and `fullLabel` fields.
2. No approved configured provider adapter in `lib/providers/` exposes stable typed hotel destination suggestions. `bookingComRapidApi.ts` is a flight adapter, and the design explicitly prohibits substituting Booking.com, Expedia, or another reference vendor without separate approval.
3. The required UI contract files, `app/components/HotelDestinationCombobox.tsx` and `app/components/HotelDestinationSearchState.tsx`, are absent from this assigned worktree. They exist on the separate `UI-DESTINATION-DISAMBIGUATION-01` branch but have not been integrated into this branch.

## Why development stopped

The design's hard implementation gate requires DEV to stop when the configured provider layer cannot return the complete normalized destination identity through a `Result<T>` adapter. Deriving these fields from an IATA code, query text, tracked city, property result, or provider rank would fabricate data and break the non-negotiable provider contract.

No application code, endpoint, cache key, URL state, analytics event, or hotel-search behavior was changed.

## Required unblock

- Approve and configure a hotel location provider whose existing agreement and API return stable typed destination suggestions with every required field, then define its supported location types and minimum query length.
- Integrate the completed UI-stage contract into this ticket's base branch before DEV wiring begins.
- Re-run this DEV ticket after both prerequisites are present.
