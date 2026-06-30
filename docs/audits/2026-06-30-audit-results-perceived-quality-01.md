# AUDIT-RESULTS-PERCEIVED-QUALITY-01: Results Perceived Quality Gaps

Date: 2026-06-30
Role: Senior QA Engineer
Scope: Audit only. No product behavior changed.

## Executive Decision

Not ready for P1 perceived-quality bar.

The results surface has the right state categories in code: loading, empty, provider notice, partial results, successful results, and hotel unavailable/skipped states. The gaps are trust and consistency: Deal Score can silently disappear, provider notices can duplicate the empty state without saying what still worked, the successful-result summary uses fake-urgency styling, and live mobile/desktop visual confirmation is blocked by the sandbox server bind failure.

## Surfaces Inspected

- `app/page.tsx`
- `app/api/search/route.ts`
- `components/flights/FlightResults.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `app/components/DealBadge.tsx`
- `lib/types.ts`

Requested file not present in this worktree:

- `app/components/SearchForm.tsx` - search form is implemented inline in `app/page.tsx`.

## Prioritized Findings

### P1. Deal Score can disappear from successful result cards with no explanation

Route: `/` results view.

Viewport: mobile 375px and desktop.

User action:

1. Run any search that returns at least one flight.
2. Force `/api/score` to fail or return non-OK while `/api/search` succeeds.
3. Review the flight result card after score loading completes.

Observed issue: `fireScore` stores `null` on score failure (`app/page.tsx:459` to `app/page.tsx:464`). `FlightCard` renders the Deal Score panel only while `loading` is true or when `score` exists; when score is `null`, it renders no score state at all (`app/components/FlightCard.tsx:278` to `app/components/FlightCard.tsx:282`).

Trust impact: A successful fare can lose expaify's differentiator without telling the user whether the route has thin history, score service failed, or the provider returned incomplete data. Price and booking action remain visible, but the "is this actually good?" context is missing.

Recommended repair ticket shape: Add an explicit unavailable Deal Score state for flight cards when scoring fails or is unavailable. Keep it factual, e.g. "Deal Score unavailable for this fare right now." Do not alter scoring math.

### P1. Partial-provider state does not clearly separate "some providers failed" from "no providers worked"

Route: `/` results view, flights tab.

Viewport: mobile 375px and desktop.

User action:

1. Run a search where one provider returns fares and another provider returns a notice.
2. Run a search where all configured providers fail or are unavailable.
3. Compare the notice panel and the empty panel.

Observed issue: provider notices are streamed as sanitized messages (`app/api/search/route.ts:144` to `app/api/search/route.ts:153`) and displayed under the generic title "Provider coverage may be incomplete" (`components/flights/FlightResults.tsx:148` to `components/flights/FlightResults.tsx:168`). When no fares exist, the page can also render the empty title "Flight providers unavailable" with another generic explanation (`components/flights/FlightResults.tsx:127` to `components/flights/FlightResults.tsx:144`, `components/flights/FlightResults.tsx:248` to `components/flights/FlightResults.tsx:258`).

Trust impact: In partial results, users see fares but do not get a concise "results are from X; Y/Z unavailable" context. In all-failed results, the notice and empty panel can feel duplicative. This makes provider limitations look like implementation leakage instead of a coherent inventory state.

Recommended repair ticket shape: Consolidate provider status into one results-level coverage summary that distinguishes partial inventory from no usable inventory. Keep provider messages sanitized; do not expose adapter reasons.

### P2. Successful results use fake-urgency visual language

Route: `/` results view, flights tab.

Viewport: mobile 375px and desktop.

User action:

1. Run a search where at least one scored fare has verdict `Great`.
2. Review the result count summary above tabs.

Observed issue: the header displays a fire symbol before the great-deal count (`app/page.tsx:1113` to `app/page.tsx:1116`). The underlying count is legitimate, but the icon reads like urgency/heat rather than price-quality evidence.

Trust impact: expaify's trust pitch is data-backed scoring. The fire treatment can make the successful state feel promotional, especially when users are also told prices can change on provider handoff (`app/components/FlightCard.tsx:196` to `app/components/FlightCard.tsx:200`).

Recommended repair ticket shape: Replace urgency-styled summary with factual text tied to Deal Score, e.g. "N Great by Deal Score." No ranking or scoring change.

### P2. Loading state is coherent, but primary action context is temporarily split

Route: `/` results view immediately after search submit.

Viewport: mobile 375px and desktop.

User action:

1. Enter origin, destination, and dates.
2. Submit search.
3. Observe the first loading state before any fare streams.

Observed issue: the results header says "Scanning deals across providers..." (`app/page.tsx:1087` to `app/page.tsx:1095`) while the flight state panel says "Checking live flight inventory" and "Fare cards will appear as providers return usable prices for this route" (`components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:247`). This is not broken, but the same state uses two different nouns: deals vs inventory.

Trust impact: Low. The loading state avoids fake data and skeletons are clearly placeholders, but the copy could be tighter for perceived polish. Search action remains available only via the sticky header edit control during results loading (`app/page.tsx:1064` to `app/page.tsx:1080`); no booking action is expected before results.

Recommended repair ticket shape: Harmonize loading copy around one plain concept, such as "Checking live fares." Do not add a new skeleton system or animation.

### P2. Hotel unavailable/skipped state is present but easy to miss as provider context

Route: `/` results view after a flight search with no hotel supply, missing hotel dates, or unavailable hotel provider.

Viewport: mobile 375px and desktop.

User action:

1. Search one-way or omit destination/return date.
2. Search round trip with destination and dates when HotelLook is unavailable or empty.
3. Review the disabled Hotels tab and the inline hotel notice.

Observed issue: hotels are disabled with the tab badge "Unavailable" (`app/page.tsx:1144` to `app/page.tsx:1175`), then a separate "Hotels were not included" panel gives the reason (`app/page.tsx:1180` to `app/page.tsx:1184`). If the user scans only the tab row, the limitation is not understandable until they read the panel below.

Trust impact: Medium for hotel expectations. The app does not fake hotel inventory, but the provider limitation is split across controls. Primary flight actions remain usable; hotel booking action is correctly absent when hotel results are unavailable.

Recommended repair ticket shape: Keep the disabled tab, but make the adjacent state copy more directly tied to why Hotels cannot be opened. Do not add hotel features or new filters.

## State Coverage

Loading state: covered in `FlightResults` with a status panel and six flight skeleton cards (`components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:247`). Hotel loading uses cards plus hotel skeletons (`app/page.tsx:1216` to `app/page.tsx:1230`). No fake fare data observed.

Empty state: covered for incomplete dates, filters hiding results, provider unavailable, and no inventory (`components/flights/FlightResults.tsx:124` to `components/flights/FlightResults.tsx:144`, `components/flights/FlightResults.tsx:248` to `components/flights/FlightResults.tsx:258`). Hotel empty/unavailable/skipped states are covered (`app/page.tsx:751` to `app/page.tsx:769`, `app/page.tsx:1231` to `app/page.tsx:1239`).

Provider-error state: provider adapter reasons are classified and converted into sanitized notices before streaming (`app/api/search/route.ts:144` to `app/api/search/route.ts:153`). Top-level request errors are displayed with Retry (`app/page.tsx:1096` to `app/page.tsx:1105`). No raw HTTP/provider secret details were found in the rendered provider notice path.

Partial-results state: supported because the API streams each provider chunk as it resolves (`app/api/search/route.ts:167` to `app/api/search/route.ts:210`) and the client appends fares while preserving provider notices (`app/page.tsx:598` to `app/page.tsx:635`). Finding P1 covers the unclear partial-provider summary.

Successful results state: flight cards preserve route, carrier/source, stops, cabin, integer-cent price display, price basis, Deal Score when available, and provider CTA context (`app/components/FlightCard.tsx:187` to `app/components/FlightCard.tsx:311`). Hotel cards preserve hotel name, area, class/rating, nightly price, score when available, and HotelLook CTA context (`app/components/HotelCard.tsx:197` to `app/components/HotelCard.tsx:305`).

Mobile 375px: source-level responsive review shows result grids collapse to one column (`components/flights/FlightResults.tsx:242`, `components/flights/FlightResults.tsx:261`; `app/page.tsx:1217`, `app/page.tsx:1241`), card CTAs are full-width on mobile (`app/components/FlightCard.tsx:291` to `app/components/FlightCard.tsx:297`; `app/components/HotelCard.tsx:271` to `app/components/HotelCard.tsx:299`), and tabs scroll horizontally (`app/page.tsx:1144`). Live viewport confirmation was blocked by local server bind failure.

Desktop: source-level responsive review shows the results grid expands to two columns at `sm` and three at `lg`, with controls staying above results (`components/flights/FlightResults.tsx:172` to `components/flights/FlightResults.tsx:215`, `components/flights/FlightResults.tsx:261`). Live desktop confirmation was blocked by local server bind failure.

## Manual Verification Flow

Successful search: source-traced through `runSearch` streaming `/api/search`, appending fare chunks, and firing score requests (`app/page.tsx:561` to `app/page.tsx:645`). Live execution was blocked because `npm run dev -- -H 127.0.0.1 -p 3001` failed with `listen EPERM`.

No-results/empty simulation: source-traced by the API no-supply notice when zero fares and zero provider issues are present (`app/api/search/route.ts:212` to `app/api/search/route.ts:223`) and by `FlightResults` empty rendering (`components/flights/FlightResults.tsx:248` to `components/flights/FlightResults.tsx:258`). Live execution was blocked by the same server bind failure.

Provider-error simulation: source-traced through missing credentials and provider classification. Example: Duffel returns `Duffel not configured` when `DUFFEL_KEY` is absent (`lib/providers/duffel.ts:104` to `lib/providers/duffel.ts:105`), and `/api/search` maps it to `Duffel is unavailable for this search.` (`app/api/search/route.ts:144` to `app/api/search/route.ts:153`). Live execution was blocked by the same server bind failure.

Primary actions: search submit remains visible in the form state (`app/page.tsx:972` to `app/page.tsx:988`); edit search and share remain visible in the results header (`app/page.tsx:1064` to `app/page.tsx:1139`); flight booking/provider CTAs remain visible on successful cards (`app/components/FlightCard.tsx:284` to `app/components/FlightCard.tsx:311`); hotel booking is visible only for valid hotel price/link (`app/components/HotelCard.tsx:271` to `app/components/HotelCard.tsx:305`).

## Out-of-Scope Notes

- Booking handoff trust is covered by `AUDIT-RESULTS-BOOKING-HANDOFF-06`; this audit does not reopen those issues.
- No visual or functional changes were made.
- No search ranking, Deal Score math, provider adapters, or money handling were changed.

## Verification Commands

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --passWithNoTests` - passed. 19 suites passed, 151 tests passed.

## Required Return Note

- What changed and why: Added this audit report documenting perceived-quality gaps in results loading, empty, provider-error, partial-results, and successful states for the assigned P1 ticket.
- Files changed: `docs/audits/2026-06-30-audit-results-perceived-quality-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npm test -- --passWithNoTests` passed with 19 suites and 151 tests.
- Out-of-scope findings or blockers: Live mobile/desktop/browser verification was blocked by local Next server bind failure: `listen EPERM: operation not permitted 127.0.0.1:3001`.
