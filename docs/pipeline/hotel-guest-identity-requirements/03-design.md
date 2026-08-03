# UXDES-HOTEL-GUEST-IDENTITY-REQUIREMENTS-01: Hotel Guest Identity Requirements

Date: 2026-08-03  
Stage: UX Design  
Priority: P0  
Feature slug: `hotel-guest-identity-requirements`

## Design decision

Extend the existing hotel admission-policy disclosure with one role-first **ID and cardholder rules** group. It is guidance only. It never asks for, stores, validates, or transmits a name, card detail, document, image, or free-text answer.

The group answers in this order:

1. **Who this applies to** — Lead guest, Cardholder, All occupants, a bounded provider-named party, Not specified by the provider, or Not established.
2. **Identification** — Required, May be required, Not required, Not established, or Provider details conflict.
3. **Cardholder name** — Must match the lead guest, May need to match, Does not have to match, Not established, or Provider details conflict.
4. **Provider wording** — bounded, attributed evidence shown verbatim when it exists.
5. **What to do** — a specific pre-payment action; unknown is never permission.

Only structured provider evidence with matching property/rate scope, supplier, locale, freshness, and exact-dimension capability may populate a normalized role or requirement. Supplier prose is evidence to display, never input for keyword parsing. The production Hotellook path therefore renders the explicit not-provided state.

This is a repair of the existing admission-policy surface, not a new policy system or identity flow.

## User outcome and hierarchy

Primary outcome: before leaving expaify, the traveler can correctly identify the affected party and requirement, or correctly say the provider did not establish them.

Secondary outcome: the traveler can act before payment and expaify can distinguish an informed exit, handoff, return, and optional fixed return reason without collecting identity or payment data.

Visual and reading hierarchy:

1. **Primary:** state title plus the affected party and requirement rows.
2. **Secondary:** pre-payment action and conflict/error warning.
3. **Tertiary:** verbatim provider wording, source, scope, locale/freshness, and omitted-statement notice.

Do not use a green success treatment for unknown, missing, stale, malformed, error, conditional, or conflicting evidence. An explicit negative is neutral evidence, not a guarantee of admission.

## Surface placement and continuity

### Results card, collapsed

Render a single compact chip only when the evidence contains a confirmed or conditional affirmative identity/cardholder restriction. Do not render a chip for not-established-only, explicit-negative-only, loading, error, or conflicting evidence.

Chip copy is derived only from structured evidence, in this precedence order:

| Structured state | Visible chip copy | Accessible name |
| --- | --- | --- |
| Payment-name match confirmed | **Cardholder name must match** | “Check-in rule: the cardholder name must match the lead guest’s name. Open hotel details for provider wording.” |
| Identification confirmed; Lead guest | **Lead guest: ID at check-in** | “Check-in rule: the lead guest must present identification at check-in. Open hotel details for provider wording.” |
| Identification confirmed; Cardholder | **Cardholder: ID at check-in** | “Check-in rule: the cardholder must present identification at check-in. Open hotel details for provider wording.” |
| Identification confirmed; All occupants | **All occupants: ID at check-in** | “Check-in rule: all occupants must present identification at check-in. Open hotel details for provider wording.” |
| More than one confirmed affirmative dimension | **ID and cardholder rules—details** | “Identification and cardholder rules are reported for check-in. Open hotel details for the full requirements and provider wording.” |
| Any conditional affirmative state with a structured role | **{Lead guest\|Cardholder\|All occupants}: ID/card rule—details** | “A conditional identification or cardholder rule is reported for {the lead guest\|the cardholder\|all occupants}. Open hotel details for the condition and provider wording.” |
| Supplier statement exists but structured role is unspecified | **Check-in ID/card rule—details** | “The provider reported an identification or cardholder rule but did not specify who it applies to in structured data. Open hotel details for provider wording.” |

Do not create “Cardholder must be present” from the proposed evidence vocabulary unless a future contracted structured field separately establishes presence. Do not use document subtypes such as “photo ID” in a chip unless a contracted enum explicitly establishes that subtype.

Chip class pattern:

```text
mt-1.5 inline-flex min-h-7 max-w-full items-center rounded-[var(--radius-control)]
border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]
px-2 py-1 text-xs font-medium leading-4 text-[color:var(--warning)]
```

The visible text may ellipsize only if the full accessible name remains available. At 375px, prefer wrapping (`whitespace-normal break-words`) over truncating the role or action.

### Results card, expanded detail

Replace only the current `checkin_identity` row inside **Check-in eligibility** with the role-first group defined below. Keep adjacent age, residency, and occupancy rows unchanged and outside this ticket.

Generic unknown identity evidence is shown here when the user expands hotel details, but it does not create a collapsed chip. Confirmed, conditional, prose-only, explicit-negative, conflict, loading, and error states all render in the expanded evidence area.

### Hotel handoff review

Render the full group once, inside **Check rooms with provider**, after the introductory provider copy and before the primary **Check rooms at {Partner}** link. Remove the same group from **Hotel fit** on this page so it is not duplicated within one handoff screen. This placement makes the unresolved or confirmed rule the last material eligibility disclosure before departure while preserving the same evidence source used on result detail.

The group is never collapsed at handoff. Provider wording is never placed behind an accordion. The Continue link remains available in all evidence states; expaify informs and routes, but does not determine eligibility.

The existing **What you may need** copy must not imply that using the checking-in person’s name resolves an identity/cardholder rule. Replace its two paragraphs with:

> Have the lead guest’s full name, a confirmation email, and a reachable phone number ready. The booking partner will show what it needs to create the booking.

> Booking for someone else? Use the name of the person checking in as the lead guest. This does not confirm whose ID or payment card the property will accept; review the ID and cardholder rules before paying.

No new input appears beside this copy.

## Component anatomy

Use a semantic `<section aria-labelledby>` at handoff and a nested `<div role="group" aria-labelledby>` inside expanded card detail. Heading: **ID and cardholder rules**.

The ready-state skeleton is:

```text
ID and cardholder rules
[state title, when needed]

Who this applies to    [value]
Identification         [value]
Cardholder name        [value]

Provider wording
“Verbatim bounded supplier statement”
Source: [source label]. [freshness].

[pre-payment action]
```

Use a `<dl>` for the three facts. Each fact container uses:

```text
min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-raised)] p-3
```

Labels use `text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]`. Values use `mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]`.

The outer handoff section uses:

```text
mt-4 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border-strong)]
bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4
```

The heading uses `text-sm font-medium leading-5 text-[color:var(--text-1)]`. Supporting/action copy uses `text-sm leading-6 text-[color:var(--text-2)]`. Warning/action copy in error, conditional, unknown, or conflict uses a neutral warning panel:

```text
mt-3 rounded-[var(--radius-control)] border border-[color:var(--border-strong)]
bg-[color:var(--warning-soft)] px-3 py-2.5 text-sm leading-6 text-[color:var(--warning)]
```

Errors use `bg-[color:var(--error-soft)] text-[color:var(--error-text)]`; `--error` is never used as text. Explicit negatives use the normal raised surface and `--text-1/--text-2`, not `--success-soft`.

## Final copy system

### Role values

| Evidence | Value |
| --- | --- |
| Explicit lead-guest role | **Lead guest** |
| Explicit cardholder role | **Cardholder** |
| Explicit all-occupants role | **All occupants** |
| Explicit bounded other role | **Provider-named party: {otherLabel}** |
| Statement exists; role absent/unspecified | **Not specified by the provider** |
| No usable role evidence | **Not established** |
| Credible role fields conflict | **Provider details conflict** |

`otherLabel` is provider-supplied, trimmed, and bounded to 80 characters. It wraps and is never inserted into analytics. If missing, invalid, or over the bound, show **Not established**.

### Identification values

| Evidence state | Value |
| --- | --- |
| Confirmed | **Required at check-in** |
| Conditional | **May be required at check-in. See the provider wording below.** |
| Exact explicit negative | **{Provider} reports identification is not required at check-in.** |
| Not established | **Not established by the provider.** |
| Conflicting | **Provider details conflict.** |

### Cardholder-name values

| Evidence state | Value |
| --- | --- |
| Confirmed | **Must match the lead guest’s name.** |
| Conditional | **May need to match the lead guest’s name. See the provider wording below.** |
| Exact explicit negative | **{Provider} reports the cardholder name does not have to match the lead guest’s name.** |
| Not established | **Whether it must match the lead guest’s name is not established.** |
| Conflicting | **Provider details conflict.** |

An affected-party role and the cardholder-name relation are independent. For example, confirmed Lead guest + confirmed Identification + not-established Cardholder name shows all three states exactly; it must not turn the unknown match state into a negative.

### Action copy by role

Use after the fact grid when any dimension is confirmed or conditional:

| Role | Action |
| --- | --- |
| Lead guest | **Make sure the lead guest can meet these rules at check-in. Recheck the booking partner’s terms before paying.** |
| Cardholder | **Make sure the cardholder can meet these rules at check-in. Recheck the booking partner’s terms before paying.** |
| All occupants | **Make sure every occupant covered by the rule can meet it at check-in. Recheck the booking partner’s terms before paying.** |
| Other | **Make sure the provider-named party can meet these rules at check-in. Recheck the booking partner’s terms before paying.** |
| Unspecified/not established | **Check who these rules apply to on the booking partner or with the property before paying.** |

If both dimensions are exact explicit negatives and the role is not established, show: **Recheck the booking partner’s current terms before paying; the property makes the final admission decision at check-in.**

## Complete state specification

### 1. Default / ready mixed state

“Default” means a successfully resolved evidence object; each dimension retains its own state. Render the heading, three fact rows, provider wording when supplied, action, and provenance. Never compute a family-wide state that overwrites a dimension.

Example exact output:

> ID and cardholder rules  
> Who this applies to: **Lead guest**  
> Identification: **Required at check-in**  
> Cardholder name: **Whether it must match the lead guest’s name is not established.**  
> Provider wording  
> “Government-issued photo identification is required at check-in.”  
> Source: Acme Hotels. Observed July 30, 2026.  
> Make sure the lead guest can meet these rules at check-in. Recheck the booking partner’s terms before paying.

The quoted wording is illustrative fixture text, not universal UI copy.

### 2. Loading

State title: **Checking ID and cardholder rules…**

If there is no prior valid evidence, show:

> We’re checking what the provider reports. If you continue before this finishes, check these rules on the booking partner before paying.

Render three non-animated placeholder rows with visible labels and value **Checking…**. Do not use shimmer or an empty skeleton. The primary handoff link remains enabled.

If valid prior evidence is available during a refresh, keep it visible and add:

> Checking for updated ID and cardholder rules…

Set the loading container to `role="status" aria-live="polite" aria-atomic="true"`. Do not move focus for an automatic load.

### 3. Confirmed

Use only the exact role/dimension facts established by structured evidence. Provider wording appears immediately after the facts. Use the role-specific action above. No celebratory icon or success color.

If provider wording is absent but the structured field is valid, omit the **Provider wording** heading and show provenance for the structured source. Do not invent a quotation.

### 4. Conditional

State title: **Conditions apply**

Use **May be required** / **May need to match** only for the affected dimension. Keep the exact condition in **Provider wording**; do not rewrite a prose condition into a normalized rule.

Action:

> This requirement depends on the provider’s conditions. Read the provider wording and verify it on the booking partner or with the property before paying.

### 5. Exact explicit negative

Show **not required** only when the adapter declares stable negative capability for that exact dimension and the scoped supplier field explicitly returns the negative.

If Identification is negative and Cardholder name is unknown, exact output is:

> Who this applies to: **Not established**  
> Identification: **{Provider} reports identification is not required at check-in.**  
> Cardholder name: **Whether it must match the lead guest’s name is not established.**  
> Check the unresolved cardholder-name rule on the booking partner before paying.

Never use “No ID required,” “No rules,” or “You’re all set.”

### 6. Not established / empty / unsupported / malformed

All absent, unsupported, stale-beyond-contract, malformed, supplier-mismatched, property/rate-mismatched, or locale-invalid dimensions degrade independently to not established. If all three dimensions are unavailable on the current Hotellook path, show exactly:

> **ID and cardholder rules not provided**
>
> Hotellook did not tell us whether the lead guest, cardholder, or all occupants need ID, or whether the cardholder name must match. Check these rules on the booking partner before paying.

Fact values:

- Who this applies to: **Not established**
- Identification: **Not established by the provider.**
- Cardholder name: **Whether it must match the lead guest’s name is not established.**

Provenance: **Source: Hotellook. ID and cardholder rules not returned.**

For an unnamed provider, substitute **The booking provider** / **the booking provider**. For mixed coverage, title the warning **Some ID or cardholder details are not established** and name only the unresolved dimensions in the action:

> Check {who the rule applies to\|the identification requirement\|whether the cardholder name must match} on the booking partner before paying.

Join two items with “and”; join three with commas plus “and.” Never say missing evidence means the rule does not exist.

### 7. Prose-only, role unspecified

When bounded supplier wording exists but no structured role or dimension can be normalized:

State title: **Provider rule reported; who it applies to is not specified**

Facts remain:

- Who this applies to: **Not specified by the provider**
- Identification: **Not established by the provider.**
- Cardholder name: **Whether it must match the lead guest’s name is not established.**

Show **Provider wording** and the verbatim statement. Action:

> The provider wording may describe an ID or payment rule, but expaify cannot safely summarize who it applies to. Read it and check the rule on the booking partner or with the property before paying.

The UI must not search this text for “guest,” “card,” “passport,” “all,” “must,” or similar terms.

### 8. Error

Without prior evidence:

> **ID and cardholder rules could not be checked**
>
> We couldn’t check these rules with {provider}. This does not mean there are no requirements. Try again, or check with the booking partner or property before paying.

Fact values remain **Not established**; provenance is **Source: {Provider}. Check failed.**

If retry is available, button label is **Try again**. While pending it remains mounted, disabled, and reads **Checking…**. If retry is not available, omit the button; never render a disabled dead control.

With prior valid evidence, retain the attributed facts and statements and show:

> **Updated rules could not be checked**
>
> The previously reported details remain below. Their current accuracy is not confirmed. Check the booking partner or property before paying.

Never replace prior facts with “not provided” because of a transport error.

### 9. Conflicting

State title: **ID or cardholder details conflict**

Only the affected role/dimension says **Provider details conflict.** Unaffected dimensions retain their own valid state. Show each credible bounded statement under **Provider wording**, including separate attribution and observation date. Then show exactly:

> **These details conflict. Check with the booking partner or property before paying.**

Use warning treatment, never success. Statement order follows stable source order and does not imply precedence.

### 10. Long, missing-freshness, and multiple-statement evidence

- Trim outer whitespace only; preserve supplier wording verbatim inside quotation marks.
- Maximum source text is 300 characters; maximum source label is 80; maximum visible statements is three.
- Use `[overflow-wrap:anywhere] break-words whitespace-pre-wrap`; never clamp or truncate provider wording.
- Valid statement freshness: **Observed {Month D, YYYY}.**
- Missing/invalid statement freshness: **Observation date not available.**
- Valid group freshness: **ID and cardholder rules fetched {Month D, YYYY}.**
- Missing/invalid group freshness: **ID and cardholder rules freshness not available.**
- Omitted count: **{Provider} returned {N} more {statement|statements} for this rule. Check the property’s full rules before paying.** Use “statement” only for 1; otherwise use “statements.”
- Duplicate statement IDs render once. Invalid statements are omitted and their affected dimension degrades safely; no empty **Provider wording** heading remains.
- Conflicting statements do not collapse into an omitted summary if doing so would hide one side of the conflict. If the three-statement cap cannot show at least one statement from each side, the normalized payload is invalid for display and that dimension degrades to not established.

### 11. Scope, locale, and provider edge cases

- Property evidence must match the rendered property ID. Rate or selected-stay evidence must also match the current offer when that scope exists.
- Supplier must match the selected offer source. A mismatch degrades to not established.
- A property-level fact is labeled **For this property**; a rate-level fact is labeled **For this room offer**. Never promote property evidence to a selected-rate guarantee.
- If the provider returns a statement in a locale different from the interface locale, retain the source locale label: **Provider wording ({locale label})**. Do not machine-translate in the component.
- Provider name fallback is **The booking provider** when blank or over 80 characters.
- A stale item beyond a documented provider freshness contract is not shown as current evidence. If previously valid evidence is intentionally retained after refresh failure, use the prior-evidence error state, including its original observation date.
- “All occupants” means only the explicit supplier role. Do not rewrite it as “all adults,” “all guests,” or a headcount unless separately structured.
- Do not infer document subtype. Keep passport, national ID, driver license, or photo-ID wording only in attributed provider text unless a future documented enum supplies it.

## Responsive behavior

### 375px

- Outer page and component must have `min-w-0`; use `px-3.5 py-3`.
- Fact grid is one column: `grid grid-cols-1 gap-2.5`.
- Order is Who → Identification → Cardholder name → Provider wording → action → provenance.
- No horizontal scrolling. Role, action, provider name, URL-independent source labels, and all statement text wrap.
- Buttons/links use at least `min-h-11`; retry is full width with `w-full` when it is the only action.
- Do not place the fact label and value in a compressed side-by-side row.
- The primary provider link follows the complete group in DOM order and remains full width.

### 1280px

- Keep the outer block within the existing provider panel width; do not create a full-viewport band.
- Fact grid may use `sm:grid-cols-2`; **Who this applies to** spans both columns with `sm:col-span-2`, followed by Identification and Cardholder name side by side.
- Provider wording and action span both columns and remain after the facts in DOM and visual order.
- Do not create a third column; long statements need readable line length and must not become a tooltip.

Between breakpoints, layout changes only through the existing `sm` breakpoint. No JS width branching controls content.

## Keyboard, focus, and assistive technology

- Static facts are readable in DOM order and are not added to the tab order.
- Any result-card details control precedes the provider handoff control in DOM order. Use a native `<button>` or `<summary>` with an accessible name that includes the hotel and “ID and cardholder rules.”
- Retry is a native button. `Enter` and `Space` activate it once; duplicate requests are ignored while pending.
- Every interactive control is at least 44px high and uses the global `:focus-visible` outline plus `shadow-[var(--focus-ring)]`. Do not suppress outline.
- Loading and error updates use a dedicated `role="status" aria-live="polite" aria-atomic="true"`; conflict is not assertive.
- Automatic loading, refresh, or evidence arrival never moves focus.
- After a user-initiated retry completes, move focus to the updated status summary (`tabIndex={-1}`) so the result is announced. If the retry button remains mounted, restoring focus to it is also acceptable only when the status summary is announced first.
- The primary provider link accessible name must append the current identity action, not raw provider wording. Unknown example: **“Check rooms at Hotellook for {hotel}. Opens Hotellook in a new tab. ID and cardholder rules were not provided; check them before paying.”**
- Provider quotations are ordinary text, not `<q>` if nested punctuation would alter the verbatim string. Screen-reader text must identify attribution outside the quotation.
- Color never carries state alone; every state has the visible labels above.

## Interaction rules

| Trigger | Result |
| --- | --- |
| Open hotel details | Expand existing detail; show the full identity group in place. Do not fetch or collect user data merely because it opens. |
| Enter/Space on details control | Same as tap/click. Focus remains on the control; expanded content follows it in DOM order. |
| Tap/activate Retry | Announce **Checking ID and cardholder rules…**, disable repeat activation, retain prior valid evidence if present, then announce the resolved status. |
| Retry succeeds | Render each resolved dimension independently; focus/announce per the user-initiated rule above. |
| Retry fails | Preserve prior valid evidence if present; otherwise show error/unknown facts. Continue remains available. |
| Activate provider link | Open the existing sponsored affiliate deeplink in a new tab. Do not alter the URL or affiliate markers. Arm return measurement only after activation. |
| Activate Back to results before handoff | Navigate through the existing back behavior and record a fixed informed-exit action only after qualified disclosure exposure. |
| Return to visible expaify tab | Show the optional return prompt; call it a return, never abandonment or failed booking. |
| Open return prompt | Reveal fixed radio options; do not show a free-text field. Focus moves into the first radio only when the user opens the prompt. |
| Cancel return prompt | Close it, clear the unsent selection, and return focus to **Report what happened**. |
| Submit without a reason | Keep **Send feedback** disabled; no error announcement is needed. |
| Submit a reason | Announce **Thanks. Your response was recorded.** Do not claim it was recorded unless the server accepted the event. On transport failure show **We couldn’t record that response. You can try again.** |

## Return prompt copy

After a return from a continuation-triggered hidden state, show:

Heading: **What happened on the booking partner?**  
Body: **Optional. Choose one answer. Do not include names, card details, or document information.**  
Trigger: **Report what happened**  
Legend: **Choose the closest answer**  
Submit: **Send feedback**  
Secondary action: **Cancel**

Fixed choices and values:

| Visible label | Value |
| --- | --- |
| The lead guest’s ID requirement did not work for this booking | `lead_guest_id_requirement` |
| The cardholder had to be present or the names had to match | `cardholder_presence_or_name_match` |
| ID was required for all occupants | `all_occupants_id_requirement` |
| The identity or cardholder requirement was unclear | `identity_requirement_unclear` |
| A different hotel detail changed | `different_hotel_detail` |
| I completed the booking | `booking_completed` |
| Prefer not to say | `prefer_not_to_say` |

Do not offer “Other” or any text box. **I completed the booking** is self-report, not verified conversion.

## Privacy-safe measurement contract

Measurement must not ship until the analytics client and server allowlist accept the same exact events and enum values. Analytics failure never blocks disclosure, navigation, retry, or handoff.

Qualified exposure means at least 50% of the full handoff identity group is visible continuously for 1,000ms while the document is visible. Reset the timer if either condition breaks. A mount is not an exposure. Fire once per handoff attempt.

Use these fixed events and properties:

| Event | Required fixed properties |
| --- | --- |
| `hotel_identity_disclosure_exposed` | `surface`, `evidence_state`, `affected_party_state`, `identity_document_state`, `payment_name_match_state`, `viewport_group`, `source_class` |
| `hotel_identity_informed_exit` | the state properties above plus `exit_action` |
| `hotel_identity_handoff_continued` | the state properties above plus `partner_named` |
| `hotel_identity_handoff_returned` | the state properties above plus `away_duration_bucket` |
| `hotel_identity_return_reason_selected` | the three state enums plus `reason` |

Allowed enums:

- `surface`: `result_detail | handoff`
- `evidence_state`: `confirmed | conditional | explicit_negative | not_established | error | conflicting | mixed`
- `affected_party_state`: `lead_guest | cardholder | all_occupants | other | unspecified | not_established | conflicting`
- `identity_document_state`, `payment_name_match_state`: `confirmed | conditional | not_required | not_established | conflicting`
- `viewport_group`: `mobile_375 | desktop_1280 | other`
- `source_class`: `current_provider | other_provider | unnamed_provider`
- `exit_action`: `back_to_results | change_hotel`
- `partner_named`: boolean
- `away_duration_bucket`: `under_30s | 30s_to_2m | 2m_to_10m | over_10m`
- `reason`: the seven fixed return values above

Generate a random, short-lived handoff-attempt UUID when Continue is activated and discard it after the return/reason window or 30 minutes, whichever comes first. Treat it as transport correlation metadata, not a reportable dimension; do not derive it from an offer, property, account, email, name, card, or session. The analytics API design must decide how to accept that envelope metadata before DEV implementation; do not add it opportunistically as an unvalidated event property.

Never send names, initials, email, phone, address, nationality, residency, age, document type/number/image/OCR, card data, billing data, provider wording, free text, DOM text/snapshots, keystrokes, clipboard data, property/offer IDs, booking references, full URLs/query parameters/affiliate tokens, or deterministic hashes of any of those values. Do not use session replay on this group. Apply minimum cohort thresholds and the shortest approved retention period before reporting segmented data.

Report these as separate measures: informed exit, continuation, return to expaify, unknown-state continuation for verification, and optional self-reported reason. Never label return as abandonment, rejection, or failed payment.

## Presentation derivation contract

The UI implementation may add a nested identity presentation object, but it must preserve existing exported component props and admission-policy exports. The presentation layer needs these independent values:

```ts
type GuestIdentityDimensionState =
  | 'confirmed'
  | 'conditional'
  | 'not_required'
  | 'not_established'
  | 'conflicting'

type GuestIdentityPresentation = {
  state: 'loading' | 'ready' | 'error'
  scope?: 'property' | 'rate' | 'selected_stay'
  affectedParty: {
    value: 'lead_guest' | 'cardholder' | 'all_occupants' | 'other' | 'unspecified' | 'not_established'
    state: GuestIdentityDimensionState
    otherLabel?: string
  }
  identityDocument: { state: GuestIdentityDimensionState }
  paymentNameMatch: { state: GuestIdentityDimensionState }
  statements: readonly SupplierAdmissionStatement[]
  sourceLabel: string
  locale?: string
  fetchedAt?: string
  refreshFailed?: boolean
}
```

This shape is a UX presentation requirement, not authorization to fabricate provider support. UI may render fixtures and current unknown evidence. Provider normalization, capability changes, analytics validation, retry wiring, or schema work belongs to DEV. The existing prose-only `checkin_identity` evidence must map to `affectedParty: unspecified` and both dimensions `not_established`; it must never map to Lead guest.

## Acceptance criteria

1. Current Hotellook handoff shows the exact **ID and cardholder rules not provided** copy, all three facts, and a before-paying action; it never says “no rule.”
2. A prose-only fixture never produces Lead guest, Cardholder, All occupants, a document subtype, or a name-match claim in normalized summary copy.
3. Confirmed Lead guest ID + unknown cardholder match renders those two dimensions independently.
4. Exact negative Identification + unknown Cardholder name does not collapse to a family-wide negative or green state.
5. Conditional wording uses “may”/“depends on,” retains provider wording, and instructs verification.
6. Conflict shows all necessary opposing statements and the exact conflict action; display order does not select a winner.
7. Loading, empty/not established, error with/without prior evidence, malformed, scope mismatch, missing freshness, long wording, multiple statements, and omitted-count states match this spec.
8. No not-established-only offer renders a collapsed result chip. Every affirmative chip matches expanded structured facts and the same evidence at handoff.
9. At 375px, facts stack without overlap, clipping, horizontal scroll, or truncated role/action/source text. At 1280px, Who spans the two-column fact grid and evidence remains after facts.
10. Keyboard users reach details/retry before Continue; all controls have visible focus, 44px targets, correct Enter/Space behavior, and polite status announcements.
11. The handoff group is fully visible in DOM before Continue and its provider wording is not hidden in an accordion.
12. No identity/card inputs, document upload, camera, clipboard read, or user-entered free text exists.
13. Analytics allowlist tests accept every defined enum combination, reject extras/free text/sensitive fields, and distinguish exposure, informed exit, continuation, return, and self-report.
14. Provider deeplink, `rel="noopener noreferrer sponsored"`, and affiliate markers remain unchanged.
15. Adjacent admission age, residency, occupancy, funds, cancellation, smoking, document-readiness, and special-request behavior does not change.

## Implementation handoff

UI should implement the visual component and all fixture-driven states without changing provider/API/business logic. Because current shared types cannot represent independent role, identity-document, and payment-name-match evidence, and because analytics/retry changes require server work, UI must preserve the existing contract and create a DEV handoff for normalization, persistence, analytics allowlisting, and any refresh endpoint work.

No positive production claim may ship until a contracted provider schema and capability tests establish the exact dimension. The safe production release with Hotellook is the explicit not-provided handoff disclosure.

**Next ticket:** `UI-HOTEL-GUEST-IDENTITY-REQUIREMENTS-01`
