# UXDES-HOTEL-SUSTAINABILITY-CREDENTIALS-01: Hotel sustainability credential confidence

Date: 2026-08-03  
Stage: UX Design (UXDES)  
Priority: P0  
Upstream: `docs/pipeline/hotel-sustainability-credentials/02-research.md`  
Status: implementation-ready presentation spec; positive production claims blocked by the launch gates in §12

## 1. Design decision and release boundary

expaify will treat a sustainability credential as a traceable evidence record,
not as a green attribute, score, endorsement, or hotel ranking. The comparison
surface may eventually show one short text cue for qualifying current evidence.
Saved detail always owns the complete state, provenance, validity, and
limitation before the traveler reaches **Check rooms with provider**.

The current production provider path supplies no credential evidence. The safe
release state today is therefore:

- no sustainability cue, badge, icon, ranking effect, or filter on result cards;
- one **Sustainability credential evidence** region in **Hotel fit** with the
  state **Sustainability credential evidence has not been checked for this
  property.**; and
- no change to Deal Score, price order, hotel order, or provider handoff.

All positive examples in this document are prototype fixtures. They may be
implemented in a research harness and component tests, but must be visibly
identified outside the component as **Prototype evidence — fictional hotel**.
They must not be attached to a real property or rendered in production until
both the provider-validation gate (§12.1) and applicable comprehension gate
(§12.2) pass.

This ticket does not authorize a provider integration, a sustainability filter,
an analytics pipeline, or a positive production credential claim. UI must not
derive credential evidence from amenities, marketing copy, chain programs,
photos, hotel class, guest rating, price, or Deal Score.

### Prohibited language and treatments

Do not use **eco-friendly**, **green hotel**, **sustainable hotel**, **verified
by expaify**, **environmentally better**, **best**, **stronger credential**,
**uncertified**, or **no credential**. Do not use a leaf, medal, checkmark badge,
green-specific color, star scale, tier, percentage, sustainability score, or a
credential logo. Do not combine the evidence with Deal Score or discount copy.

## 2. Information architecture and hierarchy

```text
/deals
  DealCard
    hotel identity and stay metadata
    optional qualifying credential cue (prototype until gates pass)
    price, usual price, discount / Deal Score-adjacent value
    photo
    View deal
      → /deals/[dealId]
        Saved hotel deal
        Price and Deal Score
        Hotel fit
          hotel class and guest rating
          disruption and quiet-stay evidence
          Sustainability credential evidence  ← new
        Check rooms with provider
        Supporting evidence
```

The credential region is the final evidence region inside **Hotel fit**, after
the existing class/rating and other evidence, and immediately before the next
top-level **Check rooms with provider** section. It is not placed in
**Supporting evidence**, hidden in an accordion, or promoted above price.

### Results hierarchy

1. **Primary:** hotel name, observed nightly price, price comparison / Deal
   Score information, and **View deal**.
2. **Secondary:** location, hotel class, dates, and one qualifying credential
   cue when permitted.
3. **Tertiary:** price observation and evidence methodology disclosures.

Missing, failed, expired, incomplete, or conflicting credential evidence is
silent on results. Silence means only that no qualifying positive cue is
available; it is not negative evidence about the hotel.

### Saved-detail hierarchy

1. **Primary page decisions:** property/stay, price and Deal Score, and provider
   continuation.
2. **Secondary:** **Hotel fit**, including credential evidence as a peer of
   other sourced hotel-fit evidence.
3. **Primary within the credential region:** the plain-language record state.
4. **Secondary within a qualifying record:** scheme, issuer, provenance,
   property scope, status, level, and validity.
5. **Tertiary:** checked/observed date and a permitted evidence link.
6. **Required boundary:** the non-comparability limitation, always visible for
   any returned record.

## 3. Normalized presentation contract

Credential data requires its own contract; it must not be stored as
`HotelAmenityEvidence`. All external retrieval stays behind `lib/providers` and
returns `Result<T>`. This UXDES stage does not implement the contract.

```ts
type HotelCredentialState =
  | 'current_issuer_linked'
  | 'current_provider_reported'
  | 'expired'
  | 'incomplete'
  | 'conflicting'
  | 'not_returned'
  | 'not_checked'
  | 'check_failed'

type HotelCredentialConflictDimension =
  | 'status'
  | 'property_match'
  | 'validity'
  | 'level'

type HotelCredentialRecord = {
  id: string
  schemeName?: string
  issuerName?: string
  sourceClass?: 'issuer_linked' | 'provider_reported'
  sourceLabel?: string
  scope?: 'property'
  statusLabel?: string
  levelLabel?: string
  validFrom?: string
  validThrough?: string
  observedAt?: string
  evidenceUrl?: string
  evidenceUrlDisplayPermitted?: boolean
  propertyMatch?: 'stable_id' | 'approved_crosswalk' | 'strict_composite'
  displayRightsConfirmed?: boolean
  freshnessPolicyPassed?: boolean
  missingFields?: Array<
    | 'scheme'
    | 'issuer'
    | 'property_match'
    | 'scope'
    | 'status'
    | 'validity'
    | 'source'
  >
  conflictDimension?: HotelCredentialConflictDimension
}

type HotelCredentialEvidence = {
  loadState: 'loading' | 'ready' | 'refreshing'
  state: HotelCredentialState
  records: HotelCredentialRecord[]
  evidenceRevision: string
  retryable?: boolean
}
```

The actual DEV contract may rename fields, but it must preserve every semantic
distinction above. `state` describes the resolved evidence set; raw provider
records are normalized and validated before reaching a component.

### Contract invariants

- `current_issuer_linked` requires the same physical property to match through
  a stable ID, approved crosswalk, or strict name-plus-full-address composite;
  property scope; named scheme and issuer; issuer-linked provenance; explicit
  current status plus a valid-through date or issuer observation allowed by the
  source contract; passed freshness policy; confirmed display rights.
- `current_provider_reported` requires a stable provider property ID, property
  scope, named item categorized by the provider as a certification, explicit
  reported status, source label, observed time, passed freshness policy, and
  display rights. It never becomes issuer-linked through UI wording.
- Name-only, chain-only, city-only, coordinate-only, chain-program, amenity, and
  practice matches do not qualify. They resolve to `incomplete` or
  `conflicting` according to the normalized cause.
- `validThrough` controls expiry. Fetch time cannot extend validity. A date-only
  record counts as current only when the source contract defines that date as
  credential validity.
- Missing optional `levelLabel` or `validFrom` does not invalidate a record.
  Missing a field required for the applicable evidence class does.
- Unknown, malformed, future-impossible, or inverted dates never render. If a
  required validity field is malformed, resolve to `incomplete`.
- A refresh failure must not leave a silently current record. Resolve to
  `check_failed`; do not render the previous positive result cue.
- An evidence URL renders only when it is HTTPS, contractually displayable,
  associated with the same normalized record, and passes the application's URL
  allowlist. Otherwise omit the link without replacing it with raw URL text.
- Multiple qualifying records are equal peers sorted by `schemeName` using a
  stable locale-aware alphabetical sort. Never sort by level, presumed rigor,
  expiry, issuer, or visual prominence.
- A credential state never changes price, Deal Score, ranking, result order,
  filter order, or provider CTA behavior.

## 4. Result-card specification

Add at most one ordinary text line inside the existing identity block, after
the class/city/check-in line and after any supplier disruption cue, but before
the price block. It is not a pill, badge, link, button, or separate focus stop.
The entire existing card remains the detail link.

### Exact result copy

| Eligible input | Visible copy | Release status |
|---|---|---|
| One issuer-linked record with valid-through | **Credential: {schemeName} · current through {Mon YYYY}** | Prototype; production only after §12.1 and issuer-linked cue study pass |
| One issuer-linked record with issuer-confirmed current status but no permitted validity date | **Credential: {schemeName} · current** | Prototype; allowed only if provider contract explicitly supports currentness |
| One provider-reported record | **Credential reported: {schemeName}** | Prototype; detail-only in production until the exact provider-reported cue passes §12.2 |
| Two or more qualifying issuer-linked records | **{n} sustainability credentials** | Prototype; detail names every record |
| Two or more records where any displayed result set is provider-reported | **{n} sustainability credentials reported** | Prototype; suppress from production until provider-reported cue gate passes |
| `expired`, `incomplete`, `conflicting`, `not_returned`, `not_checked`, `check_failed`, loading, refreshing | No line | Shipping behavior |

Use `Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone:
'UTC' })` after strict date validation. Example: **Dec 2026**. Do not say
**valid**, **verified**, or **certified through**.

If records contain a mix of qualifying and non-qualifying entries, the count
includes only qualifying current records. A single qualifying record may render
even when another independent record is expired, but a conflict about the same
scheme/property suppresses that scheme. If the normalized evidence-set state
is `conflicting`, suppress the entire cue.

### Result layout and accessibility

Visible line classes:

```text
mt-2 break-words text-caption font-medium leading-5
text-[color:var(--text-2)]
```

Do not use `line-clamp-*`, `truncate`, `whitespace-nowrap`, an icon, or a custom
color. At 375px it may wrap to two lines. Long unbroken provider strings must be
normalized before display; normal long scheme names use `[overflow-wrap:anywhere]`.

Append the exact visible cue to the existing card `aria-label`, after supplier
and quiet-stay cues and before the closing sentence. Do not add hidden claims.
Example: **View deal: Alder House. Credential: Green Key, current through
December 2026.** The accessible form expands the separator and month; the
visible form stays compact. With no visible cue, add nothing to the accessible
name.

Credential presence does not add a tab stop. Hover, focus, Enter, Space, click,
and tap behavior remain the existing card-link behavior.

## 5. Saved-detail component anatomy

Use a shared `HotelSustainabilityCredentialEvidence` renderer inside **Hotel
fit**. It receives normalized data only.

```text
section[aria-labelledby="hotel-sustainability-credential-title"]
├── h3 “Sustainability credential evidence”
├── p StateMessage
├── ul (when one or more returned records exist)
│   └── li per record, alphabetical peer styling
│       ├── h4 scheme name or “Credential record”
│       ├── dl
│       │   ├── dt “Issuer” / dd
│       │   ├── dt “Evidence source” / dd
│       │   ├── dt “Scope” / dd
│       │   ├── dt “Status” / dd
│       │   ├── dt “Level” / dd (only when returned)
│       │   ├── dt “Valid from” / dd (only when returned)
│       │   ├── dt “Valid through” / dd or explicit missing validity
│       │   └── dt “Evidence checked” / dd
│       └── a “View {schemeName} credential evidence” (eligible URL only)
├── p fixed limitation (for every returned record state)
└── button “Try again” (check_failed and retryable only)
```

The outer section is always rendered when the normalized feature is mounted, so
its heading and state remain discoverable. Do not use `<details>`, a tooltip,
modal, popover, or hover-only disclosure. Keep each `dt` and `dd` inside a
wrapping `<div>`. The record list has no ordinal numbering.

### Exact field copy

| Label | Value grammar |
|---|---|
| **Issuer** | `{issuerName}`; if required but absent in an incomplete record: **Issuer not provided** |
| **Evidence source** | Issuer-linked: **Issuer-linked record from {sourceLabel}**; provider-reported: **Reported by {sourceLabel}; not confirmed through the issuer** |
| **Scope** | **This property** only |
| **Status** | Preserve safe supplier status as a value after state lead; do not translate levels or invent a verdict |
| **Level** | `{levelLabel} (scheme wording)`; omit the entire row when absent |
| **Valid from** | `{Month D, YYYY}`; omit row when absent |
| **Valid through** | `{Month D, YYYY}`; if current provider-reported status is contractually allowed without a date: **Validity date not provided** |
| **Evidence checked** | `{Month D, YYYY}` from `observedAt` |

Dates use UTC and English month names. Status and level values wrap without
truncation. Never expose a raw enum, record ID, certificate ID, property-match
algorithm, or raw provider payload.

### Fixed limitation

Show once after all record cards, for every state with a returned partial,
expired, conflicting, provider-reported, or issuer-linked record:

> **A credential reports participation in that scheme. It is not an
> environmental impact score or a comparison with other schemes.**

Do not collapse, tooltip, or visually hide this copy. `not_returned`,
`not_checked`, and `check_failed` have no record and therefore do not add the
limitation.

## 6. Complete state and copy matrix

Every state below preserves the page, Deal Score, and provider handoff. Unless
specified, the region uses `role="status"`, not `role="alert"`.

| State | Result | Exact detail lead | Detail body and behavior |
|---|---|---|---|
| `loading` | No cue | **Checking sustainability credential evidence…** | Keep heading; three non-animated skeleton rows, `aria-busy="true"`; no retry; handoff enabled |
| `refreshing` | Suppress prior cue | **Checking sustainability credential evidence…** | Same as loading; do not expose cached positive evidence while currentness is unresolved |
| `current_issuer_linked` | Eligible prototype cue | **Current credential evidence was found for this property.** | Render complete record fields, optional safe link, and fixed limitation |
| `current_provider_reported` | Prototype cue only; detail-only production fallback | **A booking provider reports credential evidence for this property.** | Render source line immediately after scheme; show **not confirmed through the issuer**; optional fields and limitation |
| `expired` | No cue | **This credential record expired {Mon YYYY}.** | Render scheme, issuer/source, scope, status, valid-through, checked date, eligible evidence link, and limitation; use the latest expired date only in the lead when one record; for multiple records each card carries its own lead |
| `incomplete` | No cue | **We could not verify this credential record.** | Render only safe returned facts. Then **Missing evidence: {plain-language list}.** Never show raw `undefined`, an empty row, or a positive status treatment |
| `conflicting` | No cue | **Sources disagree about this credential's {status / property match / validity / level}.** | Render scheme when agreed, each source label, and only non-disputed facts. Do not choose a winner. Show limitation |
| `not_returned` | No cue | **No verifiable credential evidence was returned for this property.** | Supporting sentence: **That does not mean the hotel has no credential or performs poorly.** No blank record card |
| `not_checked` | No cue | **Sustainability credential evidence has not been checked for this property.** | No supporting claim and no retry. This is the current production state |
| `check_failed`, retryable | No cue | **We couldn't check sustainability credential evidence right now.** | Supporting sentence: **You can still check rooms and current terms with the provider.** Button: **Try again** |
| `check_failed`, not retryable | No cue | Same lead | Same supporting sentence; no button |
| Empty/unknown state, missing evidence object | No cue | Treat as `not_checked` | Never render a blank region or throw |

### Missing-evidence labels for `incomplete`

Use only these user-facing terms, in this order when multiple apply: **property
match, scheme name, issuing organization, property scope, credential status,
validity, evidence source**. Example: **Missing evidence: issuing organization
and validity.** Do not list display rights, cache keys, or internal validation
errors.

### Conflict labels

Map the bounded dimension to visible copy exactly:

- `status` → **status**
- `property_match` → **property match**
- `validity` → **validity**
- `level` → **level**

Unknown or multiple conflict dimensions use: **Sources disagree about this
credential record.**

### Load completion announcement

When an in-view load or retry completes, update a dedicated polite live region
once with one of:

- **Sustainability credential evidence loaded.**
- **Sustainability credential evidence is not available.**
- **Sustainability credential evidence could not be checked.**

Do not move focus or announce every field.

## 7. Interaction rules

### Detail entry

- The evidence region does not auto-focus or scroll into view.
- Browser back/forward behavior and result-card link behavior remain unchanged.
- A credential state never gates **Check rooms with provider**.
- The provider handoff remains enabled during loading, failure, and retry.

### Retry

- Render a real `<button type="button">` only for a retryable `check_failed`.
- Click, tap, Enter, or Space starts only the credential-evidence request.
- On activation, keep focus on the button, change the region to loading, set
  `aria-busy="true"`, and disable the button to prevent duplicate requests.
- Visible disabled label: **Checking…**. Preserve button width; no spinner is
  required.
- On success, remove the button and announce the atomic completion result.
  Focus stays at the former button position in document flow; do not force it
  onto a heading or provider CTA.
- On another failure, restore **Try again** and announce the failure once.
- Retry must not refresh price, Deal Score, the page, or other evidence ledgers.

### Evidence link

- Visible label: **View {schemeName} credential evidence**.
- Accessible label: **View {schemeName} credential evidence from {sourceLabel}
  (opens in a new tab)**.
- Open in a new tab with `target="_blank"` and
  `rel="noopener noreferrer"`; use `sponsored` only if the destination is also
  an affiliate link under the existing link contract.
- It is a normal link in DOM order after that record's facts. It does not claim
  issuer verification unless `sourceClass === 'issuer_linked'`.
- Unsafe, absent, disallowed, mismatched, or malformed URLs produce no link and
  no dead placeholder.

### Multiple records

- Each record is a sibling list item with identical type, border, background,
  spacing, and DOM structure.
- Alphabetical scheme order is the same at 375px and 1280px.
- No “top”, “primary”, “highest”, “best”, numbered rank, or selected default.
- A level change must not change ordering, card styling, result order, or result
  count except when it invalidates currentness under the data contract.

## 8. Responsive behavior

### Mobile — 375px

- The page keeps its current single-column layout and `p-4` section padding.
- Credential records are one column. Field pairs are stacked; do not place `dt`
  and `dd` in side-by-side fixed columns.
- Scheme, issuer, source, level, and link text wrap. Apply `min-w-0` and
  `[overflow-wrap:anywhere]` to user-visible provider strings.
- Result cue may use two lines. It must not overlap price, photo, or **View
  deal**, and must not add more than two text lines relative to a silent fixture.
- Retry is `min-h-11 w-full`. Evidence links are `inline-flex min-h-11
  items-center` so wrapped link text retains a 44px target.
- No horizontal scroll at 320px minimum or 375px target. No tooltip, hover-only
  content, sticky element, or fixed overlay.

### Desktop — 1280px

- Keep the existing saved-detail content width and section rhythm.
- Record cards use one column. They may not become ranked-looking tiles.
- Within each record, facts may become two columns at `sm` using equal peer
  cells; source and evidence-link rows span the available width.
- Multiple records remain a vertical list. A grid of competing cards would
  imply scheme comparison and is prohibited.
- Result cards retain the existing feed grid and card height behavior; do not
  reserve empty credential space on silent cards.

## 9. Accessibility and semantics

- Region heading is `h3` because it sits inside the `h2` **Hotel fit** section.
  Use `section aria-labelledby`, not ARIA `region` without a label.
- Returned records use `<ul role="list">`; record headings use `h4`; facts use
  `<dl>`. Do not encode records as a table because mobile stacking and variable
  missing fields are required.
- State meaning is always in text. Color may reinforce but never replace it.
- Loading uses `aria-busy` and a polite status; skeleton shapes have
  `aria-hidden="true"` and no pulse animation.
- `check_failed` is a polite status, not an assertive alert, because booking can
  continue and there is no immediate danger.
- Result cue is part of the card link's accessible name only when visible.
- Evidence links and retry follow natural tab order. There is no focus trap,
  roving tabindex, custom keyboard handler, or automatic focus movement.
- Global `:focus-visible` and `--focus-ring` remain visible. Do not suppress an
  outline without the tokenized replacement.
- Touch targets are at least 44px. Link meaning is clear out of context and does
  not rely on **Learn more** or **here**.
- Long zoomed text at 200% reflows without clipping, overlap, or lost actions.
- The literal source distinction **Issuer-linked record** versus **Reported by
  …; not confirmed through the issuer** must survive screen-reader output and
  text-only rendering.

## 10. Tailwind class patterns

Use only existing tokens from `app/globals.css`. No new color, radius, shadow,
or font-size token is needed.

### Outer region

```text
root section:
mt-5 border-t border-[color:var(--border)] pt-5

h3:
text-h3 text-[color:var(--text-1)]

state lead:
mt-3 text-sm font-medium leading-6 text-[color:var(--text-1)]

supporting copy:
mt-1 text-sm leading-6 text-[color:var(--text-2)]
```

Do not add a nested `--radius-card` container around the whole region; **Hotel
fit** already supplies the outer card.

### Record list and facts

```text
list:
mt-4 grid list-none gap-3 p-0

record:
min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-3.5 sm:p-4

record h4:
min-w-0 [overflow-wrap:anywhere] text-sm font-medium leading-6
text-[color:var(--text-1)]

dl:
mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2

fact label / dt:
text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]

fact value / dd:
mt-1 min-w-0 [overflow-wrap:anywhere] text-sm leading-6
text-[color:var(--text-2)]

full-width fact:
sm:col-span-2
```

### Limitation, no-data, and error

```text
limitation:
mt-4 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3.5 py-3
text-sm leading-6 text-[color:var(--text-2)]

incomplete / expired / conflict lead:
text-[color:var(--warning)]

check-failed lead:
text-[color:var(--error-text)]

not-returned / not-checked:
text-[color:var(--text-1)]
```

Warnings and errors still include exact state text. Never use `--error` for
text; it does not meet the documented contrast requirement.

### Links, retry, and loading

```text
evidence link:
mt-3 inline-flex min-h-11 max-w-full items-center rounded-[var(--radius-control)]
font-medium text-sm leading-6 text-[color:var(--brand)] underline
decoration-1 underline-offset-4 hover:text-[color:var(--brand-hover)]
focus-visible:shadow-[var(--focus-ring)]

retry:
btn btn-outline mt-4 min-h-11 w-full sm:w-auto

skeleton row:
h-5 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]
```

Skeleton widths may be `w-2/3`, `w-full`, and `w-4/5`. Do not use `animate-pulse`;
the status text already communicates progress and reduced-motion behavior stays
simple.

## 11. Non-ordinal comparison rules

The UI permits comparison of evidence presence and inspection of each named
record. It does not compare scheme rigor or hotel impact.

- Render supplier-provided scheme names, status, and levels verbatim after
  display sanitization.
- Add **(scheme wording)** to a displayed level so it cannot be mistaken for an
  expaify tier.
- Do not map levels across schemes, calculate a shared score, convert them to
  leaves/stars, assign good/better/best language, or use level as sort weight.
- Green Key and EarthCheck records receive byte-equivalent structure and class
  hierarchy. Alphabetical order is the only record ordering rule.
- Result presence must not alter default sort or Deal Score. An unlabeled hotel
  must not be described or styled as less sustainable.
- No production filter is included. If a separately approved future ticket
  adds one after all gates pass, its only allowed concept is binary
  **Credential evidence available**, matching qualifying current evidence. It
  must explain that excluded hotels may have unchecked or unreturned evidence.

## 12. Launch gates

### 12.1 Provider-validation gate — required before any positive production data

The provider/DEV owner must produce a reviewable validation artifact covering
at least 20 representative properties across at least two markets. The sample
must include positive, absent, malformed, duplicate-name, near-duplicate,
expired, and conflicting examples. Every item below must be recorded and pass:

1. Raw provider field path and a redacted representative payload.
2. Provider property ID and deterministic physical-property match outcome.
3. Scheme, issuer, status, level, scope, validity, source, observed time, and
   evidence reference exactly as returned, including explicit missing fields.
4. Contract definition separating certifications from practices, amenities,
   awards, and chain programs.
5. Provider/cache refresh cadence, maximum display age, expiry transition, and
   refresh-failure behavior.
6. Contractual permission to display every field, source name, and evidence
   link in each intended market.
7. Normalization behavior for empty, omitted, stale, malformed, duplicated,
   unmatched, expired, and conflicting records.
8. HTTPS/allowlist behavior for evidence URLs and confirmation that URLs do not
   expose credentials, private certificate IDs, or unsafe redirects.
9. Passing automated mutation tests for property match, scope, classification,
   provenance, currentness, freshness, and display rights; failure of any one
   suppresses the result cue and resolves to the correct detail state.
10. Legal/compliance review of the exact production strings and source/logo
    rights in intended markets. This design intentionally uses no logos.

If the source provides only a named certification attribute, its maximum state
is `current_provider_reported`. If it lacks lifecycle/current-status evidence,
do not use **current**, **valid**, or a positive result cue. If display terms,
property identity, or freshness policy are unresolved, normalize to
`not_checked`; do not launch a filter.

### 12.2 Comprehension gate — required for result cues

Use 12–15 moderated participants, at least four unfamiliar with the fictional
scheme names; split sessions between 375px and 1280px and counterbalance order.
Only fictional hotels may carry prototype evidence.

A result cue ships only if that exact wording passes every gate:

- at least 80% correctly distinguish issuer-linked from provider-reported after
  detail inspection;
- at least 80% correctly identify current, expired, and unknown-currentness;
- at least 80% state that a credential is not an impact score or proof that one
  hotel is environmentally better;
- at least 80% interpret both absence states as unknown evidence, not “not
  sustainable” or “not certified”;
- at least 80% refuse an unsupported ranking of unlike schemes/levels; and
- no more than 20% select solely from the cue while misstating source, scope, or
  limitation.

If detail comprehension passes but the issuer-linked result cue fails, ship
detail-only evidence with no result cue. Provider-reported evidence is
detail-only unless its exact result cue independently passes. If source classes
remain confused, suppress provider-reported cues even if issuer-linked cues
pass. If `not_returned` copy fails, test only this research-approved alternative:
**Credential evidence wasn't provided for this property; this isn't a rating of
the hotel.** No result filter ships under this ticket.

## 13. Prototype fixtures and traceability matrix

All hotel names below are fictional and every prototype screen must show the
page-level label **Prototype evidence — fictional hotel**. Fixture data never
enters production caches, saved deals, or provider deeplinks.

| Fixture | Fictional hotel / input | Result expectation | Detail expectation | Study answer to validate |
|---|---|---|---|---|
| `cred-issuer-current` | Alder House; Green Key; issuer-linked; current through 2026-12-31 | **Credential: Green Key · current through Dec 2026** | Current issuer-linked lead, full facts, limitation | User identifies issuer linkage, property scope, currentness, and no impact score |
| `cred-provider-current` | Beacon Rooms; Green Key; reported by Research Rooms; current status; no issuer link | Prototype **Credential reported: Green Key**; production silent until gate | Provider-reported lead and **not confirmed through the issuer** | User distinguishes provider report from issuer link |
| `cred-multiple` | Cedar Hotel; EarthCheck Silver + Green Key, both qualifying | **2 sustainability credentials** | EarthCheck before Green Key; equal peer cards; Silver shown as **Silver (scheme wording)** | User refuses to rank hotels/schemes from unlike levels |
| `cred-expired` | Drift Hotel; Green Key; valid through 2025-11-30 | Silent | **This credential record expired Nov 2025.** plus facts and limitation | User identifies expired, not current |
| `cred-incomplete` | Elm Court; scheme only; issuer and validity absent | Silent | Could-not-verify lead; **Missing evidence: issuing organization and validity.** | User treats as incomplete, not positive or negative proof |
| `cred-conflict-status` | Finch Lodge; two sources disagree on status | Silent | Status-conflict lead, both sources, no chosen winner | User identifies uncertainty and does not select the positive source |
| `cred-not-returned` | Grove Stay; capable source checked; none returned | Silent | No-verifiable-evidence lead and non-condemnation sentence | User does not infer “uncertified” or poor performance |
| `cred-not-checked` | Harbor Hotel; no capable source queried | Silent | Not-checked lead only | User distinguishes not checked from checked/none returned |
| `cred-check-failed` | Iris Inn; capable request failed; retryable | Silent | Failure lead, continuation sentence, **Try again** | User can continue or retry without losing booking path |
| `cred-loading` | Juniper Place; request pending | Silent | Heading-preserving loading state; handoff enabled | User understands work is in progress and can continue |
| `cred-property-mismatch` | Kingfisher Hotel versus same-name property at another address | Silent | Incomplete; missing **property match** | No claim transfers between same-name properties |
| `cred-malformed-date` | Linden Rooms; impossible validity date | Silent | Incomplete; missing **validity**; malformed value suppressed | User sees uncertainty, never a raw or misleading date |
| `cred-unsafe-url` | Moss House; valid record; non-HTTPS or unapproved evidence URL | Eligible cue if all other fields pass | Full facts, no link, no dead placeholder | User receives no unsafe navigation or implied missing record |
| `cred-long-strings` | North Quay; 90-character scheme and issuer names | Cue wraps without truncation | All values wrap at 375px/200% zoom | No overlap, clipping, or horizontal scroll |
| `cred-cue-removed-pair` | Same controlled pair as issuer/current fixture, evidence removed | Both cards silent | Corresponding absence state | Measures selection change without treating click as comprehension |

Mutation coverage must start from `cred-issuer-current` and independently break
property match, scheme classification, scope, provenance, status/currentness,
freshness, and display permission. Every mutation suppresses the result cue.
None may fall back to **green**, **eco**, or a generic positive badge.

## 14. Analytics boundary for a later approved implementation

This spec does not authorize persistence or instrumentation. If separately
approved after evidence contracts exist, events may use bounded values only:

- `surface=result|detail`
- `state=current_issuer_linked|current_provider_reported|expired|incomplete|conflicting|not_returned|not_checked|check_failed`
- `interaction=detail_open|evidence_link_open|retry|back_to_results|provider_handoff`
- `viewport=mobile_375|desktop_1280|other`
- non-identifying experiment variant

Do not log scheme names, issuer names, certificate IDs, evidence URLs, raw
provider data, free-text preferences, or inferred traveler identity. An
evidence-link open is inspection, not proof of trust or a lower-impact choice.

## 15. UI acceptance checklist

- Current production data resolves to `not_checked`; no positive real-property
  claim is visible.
- All eight resolved states plus loading and refreshing have fixtures and exact
  copy; no blank, throw, placeholder, or raw enum is possible.
- Result cues appear only for qualifying prototype states and are silent for
  every suppressed state.
- Detail region sits inside **Hotel fit** before **Check rooms with provider**.
- Issuer-linked and provider-reported source lines remain explicitly different.
- Multiple records are alphabetical equal peers; changing level has no visual,
  score, sort, or rank effect.
- Missing, malformed, expired, conflicting, stale, and unsafe-link inputs never
  retain a positive cue.
- Retry affects credential evidence only and never disables provider handoff.
- 320px minimum, 375px mobile, 1280px desktop, and 200% zoom have no clipping,
  overlap, horizontal scroll, or lost action.
- Keyboard order is card link on results; on detail, evidence links/retry then
  provider handoff. Enter and Space work natively; focus is never moved.
- Focus rings are visible; state is not color-only; status announcements are
  polite and atomic; touch targets meet 44px.
- No green token, logo, leaf, badge, tier, score, filter, Deal Score change, or
  environmental-performance claim is introduced.
- `npx tsc --noEmit --incremental false` and
  `npm test -- --passWithNoTests` exit 0 before UI handoff.

## 16. Handoff and dependencies

The UI stage may implement the normalized renderer, the honest current
`not_checked` production state, and all clearly isolated prototype/test
fixtures. It must preserve existing component props and provider actions. It
must not attach prototype records to real hotels or expose positive production
copy.

Positive production data requires a later DEV ticket for provider adapter,
normalized types, cache/freshness policy, property identity, persistence, APIs,
saved-deal continuity, and URL/display-right validation. That DEV work must pass
§12.1 before positive UI is enabled. Result cues additionally require §12.2.

Out of scope remains provider selection, provider API calls, sustainability
filtering, environmental impact estimates, scheme ranking, Deal Score changes,
hotel sorting, affiliate-link repair, and legal interpretation.

**Next stage:** `UI-HOTEL-SUSTAINABILITY-CREDENTIALS-01`.
