# UXDES-HOTEL-POWER-OUTAGE-RESILIENCE-01: Research prototype design

Date: 2026-07-22  
Stage: UX Design  
Priority: P2  
Decision: **NARROW — research prototype and data-gated state model only**

## 1. Inputs and scope

- Discovery: `docs/pipeline/hotel-power-outage-resilience/01-discovery.md`
- Research: `docs/pipeline/hotel-power-outage-resilience/02-research.md`
- Prototype surface: saved hotel detail, represented by `app/deals/[dealId]/page.tsx`
- Existing hierarchy and tokens: `app/components/ui/DealCard.tsx` and `app/globals.css`

This specification defines a controlled research prototype for testing whether travelers understand current destination disruption context and property-level continuity evidence. It is not an approved production feature.

Do not add any of the following from this ticket:

- a resilience badge, score, filter, sort, ranking, recommendation, or comparison winner;
- any Deal Score input or change;
- card-level resilience content in the live `/deals` feed;
- a destination safety rating, emergency alert, prediction, or property-impact claim;
- a provider integration, persistence migration, alert matcher, or production analytics sink.

The prototype must use fixtures or a research-only data boundary. It must not infer evidence from Wi-Fi, stars, brand, price, photos, reviews, ordinary amenities, destination history, or marketing copy.

## 2. Design objective

In an otherwise realistic hotel-detail task, determine whether a first-time traveler can:

1. identify why the continuity disclosure is relevant to the selected stay;
2. identify the exact property fact that is documented, its source, scope, and age;
3. distinguish undocumented, partial, stale, conflicting, and failed-to-load evidence;
4. understand that destination context does not prove hotel impact;
5. understand that property evidence does not guarantee uninterrupted service for their room, dates, or an entire outage;
6. make a choice without the disclosure displacing price or the provider handoff.

## 3. Information architecture and hierarchy

### 3.1 Prototype placement

Add one `Power and connectivity continuity` research region to the saved hotel detail prototype:

1. Existing hotel identity and stay window.
2. Existing price, Deal Score, and price freshness.
3. Existing photo.
4. Existing provider handoff or provider-unavailable state.
5. **Prototype continuity region.**
6. Existing price history, `Why this is a deal`, and `Stay details`.

This placement deliberately keeps price and the provider handoff primary. Do not place the continuity region above the price, inside Deal Score, over the photo, or inside the primary booking action.

For the no-context control and every ineligible context, render no region and preserve the current page spacing. Do not leave a heading, divider, skeleton, empty card, or explanation for why it is absent.

### 3.2 Hierarchy within an eligible region

1. **Primary:** exact current destination context and its time boundary.
2. **Secondary:** property evidence state and atomic continuity facts.
3. **Tertiary:** source links, verification method, recency, scope, limitations, and the `Confirm with the hotel` research action.

This hierarchy communicates relevance before property evidence while keeping the two claims separate. A destination alert must never visually merge with a property fact or imply that the named hotel is disrupted.

### 3.3 Region structure

The expanded eligible region contains, in order:

- heading: `Power and connectivity continuity`;
- destination-context summary and authority link;
- separation rule;
- property-evidence state summary;
- zero or more atomic fact sections;
- fact-adjacent scope and non-guarantee text;
- secondary `Confirm with the hotel` action when property identity/contact routing exists;
- research disclaimer: `Research prototype — this information is not part of hotel ranking or Deal Score.`

Do not use a shield, checkmark seal, score ring, green badge, warning triangle, or emergency icon. State is conveyed through headings, copy, borders, and status semantics—not an implied certification.

## 4. Research-only data contract

The prototype fixture must preserve the source claim rather than derive display text from generic amenities.

```ts
type PrototypeContextState = 'ineligible' | 'loading' | 'eligible' | 'error'

type ContextIneligibilityReason =
  | 'source_not_authoritative'
  | 'impact_not_explicit'
  | 'geography_no_match'
  | 'stay_no_overlap'
  | 'missing_expiry'
  | 'resolved_or_cancelled'
  | 'fetch_too_old'

type PrototypePropertyEvidenceState =
  | 'loading'
  | 'missing'
  | 'partial'
  | 'confirmed'
  | 'stale'
  | 'conflict'
  | 'error'

type ContinuitySignal =
  | 'backup_power'
  | 'connectivity_continuity'
  | 'essential_service'
  | 'current_operating_status'
  | 'selected_stay_confirmation'

type EvidenceScope = 'property' | 'room' | 'rate' | 'selected_stay'

type PrototypeDestinationContext = {
  state: PrototypeContextState
  ineligibilityReason?: ContextIneligibilityReason
  eventId?: string
  exactArea?: string
  impactType?: 'electricity' | 'connectivity' | 'electricity_and_connectivity'
  authorityName?: string
  authorityUrl?: string
  effectiveAt?: string
  expiresAt?: string
  fetchedAt?: string
  lifecycle?: 'active' | 'updated' | 'resolved' | 'cancelled'
}

type PrototypeContinuityFact = {
  id: string
  signal: ContinuitySignal
  title: string
  documentedClaim: string
  scope: EvidenceScope
  supportedServices: string[]
  unsupportedOrUndocumentedServices: string[]
  runtimeOrCapacity: string | null
  powerDependency?: string
  verificationMethod: string
  verifiedAt: string
  expiresAt?: string
  sourceName: string
  sourceClass: 'property' | 'provider' | 'auditor' | 'authority'
  sourceUrl: string
  supersededAt?: string
  contradictionIds?: string[]
}

type PrototypeContinuityDisclosure = {
  context: PrototypeDestinationContext
  propertyState: PrototypePropertyEvidenceState
  facts: PrototypeContinuityFact[]
  hotelContactHref?: string
}
```

Contract rules:

- Dates are ISO 8601 instants. Display absolute dates, times, and named timezone or UTC offset; do not use only `today`, `current`, or relative time.
- `fetchedAt` is retrieval time only and can never substitute for `effectiveAt` or `verifiedAt`.
- Every rendered positive fact requires a source URL, source name, verification method/date, valid scope, and signal-specific required fields from section 5.3.
- `supportedServices` and `unsupportedOrUndocumentedServices` must be explicit. An empty list cannot be converted to `all services`.
- Source URLs must be allowlisted `https` URLs. Provider affiliate markers remain required on booking links; authority/evidence links are informational and must not be rewritten as booking links.
- Ineligible reasons are retained for research/debugging but never shown to travelers.

## 5. Gating, validity, and state precedence

### 5.1 Destination eligibility: all five gates are required

The region can render only when all are true:

1. Source is a public authority, regulated utility/telecom operator, or recognized alert aggregator that identifies the originating authority.
2. Source explicitly names an electricity outage, planned shutoff, telecommunications disruption, or likely/observed power or communications impact.
3. Alert area intersects the deal market at locality, polygon/circle, or service-area precision. Property impact is not inferred.
4. Effective/onset-to-expiry period overlaps the selected stay, or an explicit recovery notice says disruption may persist into the stay.
5. Lifecycle is live; expiry exists; newer update/cancellation messages supersede older ones.

Additional freshness gate: operational context must have been fetched no more than **15 minutes** before display. If any gate fails, the state is `ineligible` and the entire region is absent. A loading or error state must not be shown for context that is already known to be ineligible.

### 5.2 Destination-context state

Precedence is:

1. `ineligible` — render nothing.
2. `loading` — only after locally available inputs show that the stay may be eligible and a fresh context check is pending.
3. `error` — eligibility could not be established from a fresh authority response; render nothing in the product-shaped prototype condition. Record the error for the researcher. Do not fall through to property evidence.
4. `eligible` — render the complete region and then evaluate property evidence.

The research moderator may present a labeled context-error test fixture outside the product-shaped choice task, but an unverified context must never trigger a traveler-facing production-like disruption claim.

### 5.3 Claim inclusion windows

Preserve these research inclusion gates exactly until provider audit results justify revision:

| Evidence type | Required evidence | Maximum age | Immediate invalidation |
|---|---|---:|---|
| Backup-power infrastructure | Verification method/date; property scope; supported loads or named services; runtime/capacity or explicit `not documented` | 180 days | Contradictory incident report, removal, failed test, or material system change |
| Connectivity continuity | Two independent upstream paths/carriers or documented failover design; power dependency; scope | 90 days | Topology/provider change or contradictory incident report |
| Named essential service continuity | Exact service, dependency, scope, and duration/capacity | 90 days | Facility/system change or contradictory report |
| Current property operating status | Direct property/provider/authority update with effective time | 24 hours and overlaps stay | Superseded, resolved, or cancelled |
| Selected-stay confirmation | Property/provider confirmation tied to dates and, where possible, room/rate | Reconfirm within 7 days of check-in | Any later contrary update |

If a claim misses any required content, it cannot be `confirmed`; use `partial`. If its age exceeds the applicable window, use `stale` and suppress the claim as a current positive statement.

### 5.4 Property-state derivation and precedence

Evaluate only after context is `eligible`. Use this precedence:

1. `loading` while the evidence request is unresolved and no cached in-window evidence can be safely shown.
2. `error` when the evidence check fails and there is no retained valid evidence.
3. `conflict` when two retained, applicable sources disagree or a valid fact has an immediate invalidation. Do not choose the more favorable source.
4. `stale` when evidence exists but every potentially qualifying fact is outside its inclusion window and there is no conflict.
5. `missing` when the provider returned no continuity evidence and no request error occurred.
6. `partial` when evidence exists but no fact meets every decision-grade requirement, or when at least one decision-grade fact exists alongside a material undocumented dependency that prevents the compact claim from standing alone.
7. `confirmed` only when at least one atomic fact is decision-grade and all displayed qualifiers remain attached to that fact.

Mixed-state rule: conflict outranks stale; stale outranks missing; a valid fact plus an unrelated missing signal may be `partial` rather than `confirmed` if the prototype asks users to reason across both signals. Never average facts into a score or resolve them into a hotel-level verdict.

## 6. Final UI copy by state

All strings below are final. Fixture variables are enclosed in braces.

### 6.1 Ineligible/default and no-context control

- Visible copy: none.
- Behavior: no region, label, reserved space, or hidden teaser.
- Research interpretation: absence means the five destination gates were not met; it says nothing about the hotel.

### 6.2 Eligible destination context

- Region heading: `Power and connectivity continuity`
- Context heading:
  - electricity: `Current electricity disruption reported for {exact area}`
  - connectivity: `Current connectivity disruption reported for {exact area}`
  - both: `Current electricity and connectivity disruption reported for {exact area}`
- Metadata: `Source: {authorityName} · Applies through {date, time, timezone}`
- Source link label: `View disruption source`
- Boundary statement: `This destination report does not confirm that {hotelName} is affected.`

Never shorten the context heading to `At risk`, `Outage area`, `Unsafe`, or `{hotelName} may lose power`.

### 6.3 Context loading fixture

This state is used only when provisional local eligibility is established and the prototype is checking a fresh source.

- Heading: `Checking current disruption information`
- Body: `We’re checking an authority source for your area and stay dates.`
- Accessible status: `Checking current electricity or connectivity disruption information.`
- No source link, property evidence, or confirm action appears.

### 6.4 Context error fixture

For a dedicated error-comprehension fixture only; in the product-shaped choice condition, suppress the entire region.

- Heading: `Current disruption information could not be checked`
- Body: `We couldn’t verify a current authority source for this area and stay. No hotel continuity claim is shown.`
- Action: `Try context check again`

### 6.5 Property evidence loading

Render below a fully eligible destination context.

- Heading: `Checking hotel continuity details`
- Body: `We’re checking source, scope, and verification dates for this property.`
- Accessible status: `Checking power and connectivity continuity details for {hotelName}.`

Keep the destination boundary statement visible while this loads.

### 6.6 Missing

- Heading: `Continuity details not documented by this provider`
- Body: `The provider did not return qualifying backup-power, connectivity-continuity, or essential-service details for this property.`
- Clarification: `Not documented does not mean the hotel lacks these capabilities.`
- Secondary action: `Confirm with the hotel`
- Non-guarantee: `The destination report does not confirm that this hotel is affected.`

Do not use `No backup power`, `No reliable internet`, `Not resilient`, or `Unavailable`.

### 6.7 Partial

- Heading: `Some continuity details are documented`
- Body: `The source documents part of the property’s continuity setup, but important scope or operating limits are not documented.`
- For each retained fact, use the atomic template in section 6.12.
- Missing-field line: `{fieldLabel}: Not documented by this source.`
- Secondary action: `Confirm missing details with the hotel`
- Non-guarantee: `Property-level information; it does not guarantee service for your room, dates, or the full outage.`

Examples of `{fieldLabel}` are `Supported guest services`, `Generator runtime`, `Independent network paths`, and `Power dependency`.

### 6.8 Confirmed

- Heading: `Continuity details documented`
- Body: `At least one source-attributed property fact meets the research inclusion rules.`
- For each fact, use the atomic template in section 6.12.
- Secondary action: `Confirm with the hotel`
- Default non-guarantee: `Property-level information; it does not guarantee service for your room, dates, or the full outage.`
- Selected-stay non-guarantee: `Confirmed for the selected stay dates; uninterrupted service during an outage is not guaranteed.`

The `confirmed` label applies to the documented fact, never to the hotel as a whole.

### 6.9 Stale

- Heading: `Continuity information is out of date`
- Body: `The latest source was verified on {date, timezone}, outside the research inclusion window for {signalLabel}.`
- Suppression line: `We are not presenting it as a current hotel capability.`
- Secondary action: `Confirm current details with the hotel`
- Optional source link: `View older source`
- Non-guarantee: `Older property information does not confirm service for your room, dates, or an outage.`

Do not repeat the stale claim in positive present tense.

### 6.10 Conflict

- Heading: `Sources disagree — confirm with the hotel`
- Body: `Applicable sources report different information about {signalLabel}. We are not choosing one as current.`
- Source list label: `Sources reviewed`
- Each source line: `{sourceName} · {source date, time, timezone} · {neutral source summary}`
- Link label per source: `View source from {sourceName}`
- Secondary action: `Confirm with the hotel`
- Non-guarantee: `Conflicting sources cannot confirm service for your room, dates, or an outage.`

Source summaries must be neutral and parallel; do not visually endorse the more favorable claim.

### 6.11 Property evidence error

- Heading: `Continuity details could not be checked`
- Body: `We couldn’t retrieve qualifying hotel evidence. This does not mean the property lacks backup power or connectivity continuity.`
- Primary-in-region action: `Try hotel details again`
- Secondary action: `Confirm with the hotel`
- Non-guarantee: `The destination report does not confirm that this hotel is affected.`

Retry is primary only inside this subordinate region; it must not visually compete with the page’s provider handoff.

### 6.12 Atomic fact template

Each fact is a `section` with an accessible heading. Display fields in this order:

1. Signal heading:
   - `Backup power`
   - `Connectivity continuity`
   - `{exactServiceName} continuity`
   - `Current operating status`
   - `Selected-stay confirmation`
2. Documented claim: `{documentedClaim}`. This must be a bounded paraphrase of the retained source, not a generated guarantee.
3. `Scope: {scopeLabel}`
4. `Documented services: {comma-separated supportedServices}` or `Documented services: Not documented by this source.`
5. `Not covered or not documented: {comma-separated limitations}`
6. `Runtime or capacity: {runtimeOrCapacity}` or `Runtime or capacity: Not documented by this source.`
7. Connectivity only: `Power dependency: {powerDependency}` or `Power dependency: Not documented by this source.`
8. `Verification: {verificationMethod} · {verified date, time, timezone}`
9. `Source: {sourceName}` followed by link `View evidence source`
10. Fact-adjacent limitation:
    - property: `Property-level information; it does not guarantee service for your room, dates, or the full outage.`
    - room: `Room-level information; it does not guarantee this room type, rate, or service through the full outage.`
    - rate: `Rate-level information; confirm that the selected room and stay dates are covered.`
    - selected stay: `Confirmed for the selected stay dates; uninterrupted service during an outage is not guaranteed.`

Scope labels are `Property`, `Room`, `Rate`, and `Selected stay`. Do not show internal enum names.

### 6.13 Research disclaimer

- Copy: `Research prototype — this information is not part of hotel ranking or Deal Score.`

It appears at the end of every visible eligible region, including loading and error fixtures.

## 7. Interaction specification

### 7.1 Disclosure

For the compact-disclosure study condition, the eligible region initially shows:

- region heading;
- complete destination context heading and metadata;
- boundary statement;
- one property-state heading;
- button: `Show continuity details`.

The button uses a native `button`, `aria-expanded`, and `aria-controls`. On activation by pointer, Enter, or Space, it reveals the complete state content inline and changes to `Hide continuity details`. Content remains in document flow; do not use a modal, tooltip, hover-only disclosure, or horizontal carousel.

For missing, stale, conflict, and error conditions, the compact heading must name that state before expansion. Do not hide the distinction behind `Learn more`.

The research condition may also render the region initially expanded. Record the assigned condition; do not personalize it from traveler behavior.

### 7.2 Authority and evidence source links

- Authority link accessible name: `View disruption source from {authorityName}`.
- Evidence link accessible name: `View {signalLabel} evidence from {sourceName}`.
- Conflict links use the final copy in section 6.10.
- Open in a new tab only if that is the existing external-link convention. If using `target="_blank"`, add `rel="noopener noreferrer"` and an accessible suffix: `(opens in a new tab)`.
- Source links must remain visible text links with an underline; do not make the whole region clickable.
- On activation, record the research event before navigation. Never block navigation if instrumentation fails.

### 7.3 Confirm with the hotel

- Use a text-styled secondary link or outline button. It appears after facts/limitations, never beside or above the provider booking handoff.
- If a trusted hotel contact route exists, label it `Confirm with the hotel` or the state-specific variant above.
- If no trusted contact route exists, render static copy: `Contact the hotel through the booking provider to confirm current details.` Do not invent a phone number, email, or deeplink.
- The action must not imply that expaify records or verifies the hotel’s reply.

### 7.4 Retry

- `Try context check again` retries only the context request. While pending, disable it and announce `Checking current disruption information.`
- `Try hotel details again` retries only property evidence. Keep the already verified destination context visible.
- One activation triggers one request; prevent duplicate requests while pending.
- On success, replace the status in place. On failure, keep the error copy and return focus to the error heading.

### 7.5 State updates

- A cancellation/resolution makes context ineligible immediately and removes the region. If removal follows a user-triggered refresh, announce `The current disruption context no longer overlaps this stay.`
- A new contradiction moves property state to `conflict` immediately.
- Expired evidence moves to `stale`; it must not remain rendered as confirmed while a refresh runs.
- Do not animate state color or use celebratory motion. Respect `prefers-reduced-motion`; disclosure can open without animation.

## 8. Visual and Tailwind specification

Use only existing tokens from `app/globals.css`. Do not add colors or a resilience-specific design token.

### 8.1 Eligible region shell

```tsx
<section
  aria-labelledby={titleId}
  className="card mt-4 p-4 min-[680px]:p-5"
>
```

Heading:

```tsx
<h3 id={titleId} className="text-h3 text-[color:var(--text-1)]">
  Power and connectivity continuity
</h3>
```

Destination context block:

```tsx
<div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-base)] p-3.5">
  <p className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">...</p>
  <p className="mt-1 text-caption font-medium leading-5 text-[color:var(--text-2)]">...</p>
  <a className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-[color:var(--brand)] underline underline-offset-4">...</a>
  <p className="mt-2 text-caption leading-5 text-[color:var(--text-2)]">...</p>
</div>
```

Do not use `--error` for eligible disruption context; the region communicates current relevance, not an emergency severity level.

### 8.2 State blocks

- Loading and missing: `border-[color:var(--border)] bg-[color:var(--bg-surface)]`
- Partial and stale: `border-[color:var(--gold)] bg-[color:var(--warning-soft)]`
- Conflict and error: `border-[color:var(--error)] bg-[color:var(--error-soft)]`
- Confirmed: `border-[color:var(--border-strong)] bg-[color:var(--bg-surface)]`; do not use a green success fill.

Shared pattern:

```tsx
<div className="mt-4 rounded-[var(--radius-control)] border p-3.5" role={statusRole}>
  <p className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">{stateHeading}</p>
  <p className="mt-1 text-[13px] leading-5 text-[color:var(--text-2)]">{stateBody}</p>
</div>
```

Use `role="status"` for loading and successful retry updates. Use `role="alert"` only when a user-triggered request becomes an error; initial server-rendered error content is an ordinary region to avoid unsolicited announcement.

### 8.3 Atomic facts

```tsx
<section className="mt-3 border-t border-[color:var(--border)] pt-3" aria-labelledby={factTitleId}>
  <h4 id={factTitleId} className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">...</h4>
  <p className="mt-1 text-[13px] leading-5 text-[color:var(--text-2)]">...</p>
  <dl className="mt-3 grid gap-2 text-caption leading-5 min-[680px]:grid-cols-2">...</dl>
  <p className="mt-3 text-caption font-medium leading-5 text-[color:var(--text-2)]">{limitation}</p>
</section>
```

Metadata values use `break-words`. Do not truncate claims, source names, limitations, dates, or scope.

### 8.4 Buttons and links

- Disclosure and retry: `btn btn-outline mt-3 w-full min-[680px]:w-auto`
- Confirm action: `mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-[color:var(--brand)] underline underline-offset-4`
- Source links use the same text-link pattern.
- All controls keep the global three-pixel `:focus-visible` outline and four-pixel focus ring. Do not remove outlines.

### 8.5 Loading treatment

Use text plus at most three fixed skeleton lines inside the state block:

```tsx
<div aria-hidden="true" className="mt-3 space-y-2">
  <div className="skeleton h-3 w-full rounded" />
  <div className="skeleton h-3 w-4/5 rounded" />
  <div className="skeleton h-3 w-2/3 rounded" />
</div>
```

Skeletons never replace the destination boundary statement once context is eligible.

## 9. Responsive behavior

### 9.1 Mobile at 375px

- Use the existing page `px-5`; the region is full width with no viewport overflow.
- Use `p-4`; facts remain a single column.
- Destination heading, exact area, authority name, source metadata, claims, and limitations wrap without truncation.
- Buttons are full width, at least 44px high, and stack with 8px minimum separation.
- Source and confirm links each have a 44px minimum target height but may wrap to two lines.
- Do not use side-by-side source/recency columns, sticky controls, accordions nested inside accordions, or horizontal scrolling.
- The compact region must not alter the provider handoff above it or push price metadata into another column.
- On expansion, content grows downward and preserves scroll position at the disclosure button.

### 9.2 Desktop at 1280px

- The region stays inside the current `max-w-[760px]` detail column; do not create a right rail or map panel.
- Use `p-5`; atomic fact metadata may use two equal columns.
- Keep line length bounded by the detail container.
- Actions may size to content and remain left aligned.
- Multiple atomic facts stack vertically. Do not create comparison cards or a grid that implies a hotel ranking.

## 10. Accessibility, focus, and keyboard

- Heading order is page `h2`, region `h3`, atomic facts `h4`; do not skip levels.
- The region is a named `section`. Static copy is not focusable.
- Tab order within the region is: authority source, disclosure toggle, evidence source links in reading order, retry when present, confirm action. The next tab stop returns to the existing page sequence.
- Enter and Space activate disclosure/retry buttons. Enter activates links. Escape has no behavior because the disclosure is inline, not modal.
- Collapsed content is removed from the accessibility tree with conditional rendering or `hidden`; do not use visually clipped but focusable content.
- On expansion, keep focus on `Show continuity details`; update its name and `aria-expanded`. Do not force focus into the content.
- On a retry failure, focus the error heading using temporary `tabIndex={-1}`; on success, announce the new state through a polite status region.
- Every external link has a descriptive accessible name including authority or source. Do not use `Source` or `Learn more` alone.
- Dates must be readable without color. State meaning must not depend on border/background color.
- Loading announcements occur once per request, not on every skeleton pulse.
- The global focus treatment in `app/globals.css` is required. Verify text and link contrast against `--bg-base`, `--bg-surface`, `--warning-soft`, and `--error-soft`.

## 11. Edge cases and content rules

- **Long exact area:** wrap the full locality/service-area name. Do not replace it with country or region text.
- **Missing timezone:** eligibility fails; do not describe the source as current.
- **Missing expiry:** context is ineligible and the region is absent.
- **Stay changes:** re-evaluate all five gates; remove the region if overlap no longer exists.
- **Cancelled/resolved event:** ineligible immediately, even if the old expiry is later.
- **Six-hour cached alert:** ineligible for the prototype because it fails the 15-minute fetch gate.
- **Property address inside event area:** still do not say the property is affected.
- **Generator only:** never infer rooms, elevators, HVAC, water, kitchens, charging, medical devices, or network equipment are supported.
- **Ordinary Wi-Fi:** never treat it as connectivity continuity.
- **Brand policy:** never apply it to a property without property-specific evidence and method/date.
- **Multiple valid facts:** render each atomically with its own source, scope, recency, and limitation. Do not merge verification dates.
- **Duplicate facts:** deduplicate only when signal, claim, scope, source, verified time, and limitations match.
- **Multiple currencies or price states:** irrelevant to this region; preserve existing money contracts and price hierarchy.
- **Unavailable capability:** this prototype does not define a broad unavailable state. A negative statement may appear only as a neutral, atomic source summary when decision-grade evidence explicitly reports unavailability; it must still carry source, scope, date, and limitation.
- **No contact route:** show the static booking-provider confirmation sentence from section 7.3.
- **Source URL failure:** preserve source name and date, show `Source link unavailable`, and classify the fact as partial for the study; do not expose an unsafe URL.
- **Very long source claim:** use a researcher-authored bounded paraphrase plus the source link; do not line-clamp.
- **Non-English source:** show a reviewed English paraphrase and source name; do not use unreviewed machine translation in a decision-grade fixture.
- **Locked/sample deal:** do not attach the prototype to locked or sample cards. The detail prototype requires known hotel identity and dates.
- **Provider handoff unavailable:** the region may still be tested, but `Confirm with the hotel` becomes the static booking-provider sentence unless a trusted contact route exists.

## 12. Prototype fixtures and test matrix

Create deterministic fixtures rather than live operational claims. Every fixture must name itself only in researcher controls, never in traveler-facing UI.

| Fixture | Context | Property state | Required assertion |
|---|---|---|---|
| Control | Ineligible/no context | Not evaluated | No continuity region or reserved space |
| Eligible confirmed | Eligible, fresh, exact area, stay overlap | Confirmed | One atomic fact; source, scope, recency, limits, and non-guarantee visible |
| Eligible missing | Eligible | Missing | `Not documented` is not presented as absence |
| Eligible partial | Eligible | Partial | Missing fields are named; no hotel-level positive claim |
| Eligible stale | Eligible | Stale | Old claim suppressed from present-tense summary |
| Eligible conflict | Eligible | Conflict | Parallel sources shown; neither endorsed |
| Eligible property error | Eligible | Error | Destination context retained; hotel evidence retry is scoped |
| Context loading | Provisional and checking | Not evaluated | No hotel evidence shown before eligibility |
| Property loading | Eligible | Loading | Context and boundary remain visible |
| Context error | Error research fixture | Not evaluated | No property evidence or implied disruption claim |
| Resolved/cancelled | Ineligible | Not evaluated | Region removed immediately |
| No stay overlap | Ineligible | Not evaluated | Region absent |

Run every visible fixture at 375px and 1280px. Run compact-collapsed and expanded variants where applicable. Keyboard and screen-reader review are mandatory for eligible confirmed, missing, stale, conflict, and both error states.

## 13. Research instrumentation

Instrumentation is a prototype requirement, not authorization for a production analytics implementation. Use the event names and dimensions from research:

- `resilience_context_impression`: context source class, event ID, effective/expires, market, stay overlap, viewport.
- `resilience_summary_impression`: hotel/deal ID, evidence state, signal types, oldest source age, scope.
- `resilience_disclosure_opened`: the summary dimensions plus entry surface.
- `resilience_source_opened`: signal type and source class.
- `resilience_hotel_selected`: evidence state and whether the disclosure was opened.
- `resilience_comprehension_submitted`: aggregate correctness only; never traveler-need free text.

Also record assigned prototype condition, viewport (`375` or `1280`), time to choice, disclosure open, choice reversal after expansion, five-point pre/post confidence, perceived alarm, and trust in the research dataset. Open rate is diagnostic, not success.

Instrumentation must not contain full source claim text, property contact content, accessibility/medical needs, or other sensitive traveler-need text. Instrumentation failure must never block a source link, retry, confirm action, or provider handoff.

## 14. Research protocol and comprehension checks

Test the current detail-page hierarchy first. Use otherwise comparable hotel pairs and randomize:

1. no disruption context/no disclosure;
2. eligible context plus one decision-grade property fact;
3. eligible context plus partial/mixed evidence;
4. eligible context plus `not documented`;
5. stale/conflicting evidence, correctly suppressed or labeled.

Include travelers who say electricity/connectivity is trip-critical and ordinary leisure travelers. After choice and disclosure use, ask:

- Which exact fact was documented?
- Who supplied or verified it, and when?
- Does it apply to the property, room, rate, or selected stay?
- Which services or loads are and are not covered?
- Does `not documented` mean the hotel lacks the capability? Correct answer: no.
- Is uninterrupted service guaranteed? Correct answer: no.
- Does destination disruption evidence prove this hotel is affected? Correct answer: no.

Confidence improvement counts only for participants who pass the critical comprehension checks.

## 15. Preserved go, narrow, and stop thresholds

Production design remains blocked until a representative evidence audit covers at least **12 eligible destination-events**, at least three disruption types, at least three regions, and **30 bookable properties per event** (or every property when fewer than 30), preserving properties with no evidence in the denominator.

Advance from research prototype to production design only when **all** are met:

- **Coverage:** any qualifying signal on at least 60% of sampled properties; decision-grade evidence on at least 40%; at least two decision-grade properties in 70% of eligible destination-events; unknown/stale/conflicting rate no more than 40%.
- **Comprehension:** at least 80% correctly distinguish `not documented` from absence, identify scope/recency, and reject a service guarantee; no more than 10% interpret the summary as `power/internet guaranteed`.
- **Decision value:** among participants who comprehend correctly, median confidence improves by at least 1 point on the five-point scale or the disclosure changes a choice for an evidence-grounded reason without materially increasing decision time.
- **Relevance:** eligible context improves confidence more than no context and does not create a material alarm/trust penalty among travelers for whom the criterion is not trip-critical.
- **Freshness:** alert and property sources meet expiry rules without presenting six-hour-cached operational claims as current.

Decision logic remains:

- **GO:** all thresholds pass; a later ticket may specify a compact fact-level production disclosure.
- **NARROW:** destination relevance and comprehension pass but property coverage does not; use a destination-level source link/confirmation prompt, not property differentiation.
- **STOP:** eligibility cannot be sourced reliably, guarantee misread exceeds 10%, `not documented` is routinely read as absence, or evidence is too sparse/incomparable to distinguish properties.

Current decision is **NARROW for research only**. No prototype outcome automatically authorizes production UI.

## 16. Acceptance criteria

- Ineligible, expired, resolved, cancelled, coarse, generic-impact, missing-expiry, non-overlapping, and more-than-15-minute-old context renders no product-shaped disclosure.
- Eligible context names exact area, authority, absolute expiry with timezone, source link, and the boundary that hotel impact is not confirmed.
- Loading, missing, partial, confirmed, stale, conflict, and error are different in heading, body, semantics, and actions.
- `Not documented` and retrieval error never display as capability absence.
- Stale and conflicting facts never render as current positive claims.
- Every positive fact maps to source, verification method/date, scope, supported service/load, limitation, and applicable inclusion window.
- Property-, room-, rate-, and selected-stay limitations use the correct scope copy.
- The source and non-guarantee remain available at 375px without moving price or provider handoff below the region.
- At 1280px the region remains within the existing detail column and does not become a comparison/ranking surface.
- Disclosure, retry, source, and confirm actions work with keyboard, preserve focus, and expose descriptive accessible names.
- No badge, filter, sort, ranking, resilience score, Deal Score change, production card treatment, or production provider integration is specified or implied.
- Section 15 thresholds and the blockers below remain explicit in the UI handoff.

## 17. Blockers and handoff boundary

The following blockers are intentionally unresolved and must prevent production implementation:

- no representative destination/property evidence sample or provider credentials;
- no current-disruption provider, authority allowlist, geographic matcher, or alert lifecycle;
- the six-hour cache policy conflicts with the 15-minute context freshness gate and current operational claims;
- the evidence type cannot represent supported loads, runtime, redundancy, verification method, source-effective time, expiry, stale, conflict, or revocation;
- the live deal pipeline drops amenity evidence before persistence/API delivery;
- production resilience impressions, comprehension, and confidence cannot be measured with the current analytics stub.

The next ticket may implement **only a fixture-backed research prototype** and its explicit states on the hotel detail hierarchy. It must not wire live alerts or vendors, persist claims, alter ranking/Deal Score, or expose the prototype as a production hotel differentiator.

## 18. Handoff

Create `UI-HOTEL-POWER-OUTAGE-RESILIENCE-01` with this spec path and the following instruction:

> Build a fixture-backed, research-only hotel-detail prototype covering ineligible, eligible, context/property loading, missing, partial, confirmed, stale, conflict, context/property error, mobile 375px, desktop 1280px, keyboard/focus, source links, scope, recency, and non-guarantee states. Preserve the NARROW decision and section 15 thresholds. Do not add production badges, filters, sorts, ranking, a resilience score, Deal Score changes, live provider integration, or persistence.
