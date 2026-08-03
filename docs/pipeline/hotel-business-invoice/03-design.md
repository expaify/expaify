# UXDES-HOTEL-BUSINESS-INVOICE-01: Hotel Business Invoice Eligibility

Date: 2026-08-03  
Stage: UX Design  
Priority: P1  
Upstream: `docs/pipeline/hotel-business-invoice/02-research.md`  
Extends: `docs/pipeline/hotel-invoice-readiness/03-design.md`

## Outcome

Extend the shipped `/book` **Invoice & receipt** disclosure with two selected-rate facts that remain independent from document availability and from each other:

1. **Business or tax ID** — whether the responsible issuer or booking flow explicitly accepts a supplier-named identifier category.
2. **Name on document** — whether the document may name an individual, a legal entity, or either, plus only the identity relationships the supplier explicitly states.

The disclosure helps a traveler identify what is supported, explicitly unsupported, conditional, conflicting, or not provided before external handoff. It never produces a combined “business ready” verdict, never asks for billing values, and never promises tax validity, reimbursement, or appearance on the final document.

Current production behavior is honest but limited: every inspected provider supplies no selected-rate evidence for either new dimension, so both rows render `not_provided` until an approved provider contract supplies normalized evidence.

## Scope And Inherited Contract

### In scope

- Add the two fact rows to the existing disclosure only while invoice intent is selected.
- Model and render five evidence states independently for each dimension.
- Keep scope, source, policy reference, observed time, entry boundary, correction boundary, conflicts, and verification target attached to the dimension they qualify.
- Represent document-name eligibility separately from guest, booker, and cardholder relationships.
- Define privacy-safe copy, responsive behavior, keyboard behavior, fixtures, analytics constraints, and test acceptance.

### Inherited without redesign

- Intent control, location in `HotelHandoffReview`, disclosure title, document status lead, Invoice, Receipt, and Billing details rows.
- Document-level `idle`, `loading`, `ready`, and `error` check behavior.
- Existing issuer, document type, source/scope, retry, verification, affiliate handoff, and non-guarantee rules.
- Existing primary **Continue to {partner}**, **Special requests**, and **Back to search** ordering.

### Out of scope

- A combined eligibility score, badge, verdict, filter, sort, Deal Score input, or CTA gate.
- Company, individual, legal-entity, address, email, tax/VAT/GST number, cardholder, document, or free-text inputs.
- Validation or transmission of any billing value.
- Tax or legal guidance, employer-policy matching, reimbursement, deductibility, or document guarantees.
- Property messaging, document retrieval, expense export, or a new support workflow.
- Inferring eligibility from issuer, payment collector, guest, booker, cardholder, property policy, provider brand, URL, or the existing generic `billingDetailsStep`.

## Information Architecture And Hierarchy

Keep the existing page hierarchy. Inside **Invoice & receipt**, use this fixed reading order:

1. Document-level status lead and supporting copy.
2. **Invoice**.
3. **Receipt**.
4. **Billing details**.
5. **Business or tax ID**.
6. **Name on document**.
7. Dimension-specific verification guidance for only incomplete, negative, or disputed facts.
8. Document-level scope/source and non-guarantee.

The primary page action remains **Continue to {partner}**. Document availability and issuer are secondary decision facts. Eligibility details, relationships, timing, correction, provenance, and verification are tertiary evidence. Do not place either new row in a positive or negative color treatment; explicit text carries the state.

## Required Data Contract

Exact implementation names may vary, but the UI and normalizer must preserve these semantics. The two objects are not optional at the rendering boundary; missing provider data normalizes to a complete `not_provided` object.

```ts
type HotelBusinessDocumentEligibilityState =
  | 'supported'
  | 'unsupported'
  | 'conditional'
  | 'conflicting'
  | 'not_provided'

type HotelDocumentEntryStep =
  | 'during_partner_booking'
  | 'after_booking_contact_provider'
  | 'after_booking_contact_property'
  | 'at_checkout'
  | 'not_provided'

type HotelDocumentCorrectionBoundary =
  | { rule: 'allowed_until'; boundaryLabel: string }
  | { rule: 'not_allowed_after'; boundaryLabel: string }
  | { rule: 'not_provided' }

type HotelEligibilitySource = {
  label: string
  scope: 'rate' | 'selected_stay'
  policyId?: string
  observedAt?: string
}

type HotelEligibilityVerificationTarget = {
  role: 'booking_provider' | 'property'
  url?: string
}

type HotelEligibilityConflictStatement = {
  sourceLabel: string
  statement: string
}

type HotelTaxIdentifierEligibility = {
  state: HotelBusinessDocumentEligibilityState
  identifierLabel?: string
  condition?: string
  entryStep: HotelDocumentEntryStep
  correction: HotelDocumentCorrectionBoundary
  source: HotelEligibilitySource
  conflictStatements?: HotelEligibilityConflictStatement[]
  verificationTarget?: HotelEligibilityVerificationTarget
}

type HotelNameRelationship =
  | 'same_required'
  | 'different_allowed'
  | 'not_provided'

type HotelDocumentNameEligibility = {
  state: HotelBusinessDocumentEligibilityState
  allowedAddresseeTypes: Array<'individual' | 'legal_entity'>
  unsupportedAddresseeTypes?: Array<'individual' | 'legal_entity'>
  condition?: string
  relationships: {
    guest: HotelNameRelationship
    booker: HotelNameRelationship
    cardholder: HotelNameRelationship
  }
  entryStep: HotelDocumentEntryStep
  correction: HotelDocumentCorrectionBoundary
  source: HotelEligibilitySource
  conflictStatements?: HotelEligibilityConflictStatement[]
  verificationTarget?: HotelEligibilityVerificationTarget
}
```

Add both objects to `HotelDocumentReadiness` and preserve them through `HotelOffer`, booking-context serialization, `/api/book/hotel-context`, and the client review state. Do not serialize raw provider JSON.

### Normalization rules

- `supported` means only that selected-rate/stay evidence says the named category can be supplied in this flow. It does not mean the value is valid or will appear on the issued document.
- `unsupported` requires an explicit selected-rate/stay negative. Supplier omission never becomes `unsupported`.
- `conditional` requires a normalized, displayable condition. Missing, unsafe, or contradictory conditions degrade that dimension to `conflicting` when two valid statements exist, otherwise `not_provided`.
- `conflicting` requires at least two attributed normalized statements about the same dimension. Otherwise degrade that dimension to `not_provided`.
- Property-level evidence cannot set a selected-rate positive or negative. It may be retained outside these objects as clearly labeled context only.
- `identifierLabel`, `condition`, `boundaryLabel`, source strings, and conflict statements are provider-supplied display categories, never user-entered values. Normalize length and character safety server-side; render as text, never HTML.
- A missing or invalid `identifierLabel` may use the controlled fallback **a business or tax ID** for `unsupported` and `not_provided`; a positive identifier claim without a named identifier category degrades to `not_provided`.
- `allowedAddresseeTypes` is required and non-empty for `supported`. `unsupportedAddresseeTypes` is required and non-empty for `unsupported`. A general negative may normalize to both controlled types only when the supplier explicitly denies both.
- A supported addressee type does not populate any relationship. Each guest/booker/cardholder relationship remains `not_provided` unless explicitly sourced.
- `entryStep` and `correction` qualify only their containing dimension. Do not copy the inherited generic `billingDetailsStep` or the other dimension’s timing.
- A network/check error is a transport state, not an eligibility state. It never becomes `unsupported`.
- Each dimension’s verification URL must be validated. Reusing `providerUrl` preserves the complete affiliate-marked URL byte for byte.
- Changing either eligibility object never changes document status, document type, issuer, price, Deal Score, or CTA availability.

## Component Specification

### Disclosure rows

For every document-level `ready` state, including inherited `not_provided`, render both new rows after **Billing details**. This intentionally differs from the inherited rule that omits fully unknown document rows: these two explicit unknowns are the residual disclosure this repair adds.

```tsx
<div className="rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2.5">
  <dt className="text-xs font-medium leading-5 text-[color:var(--text-2)]">
    Business or tax ID
  </dt>
  <dd className="mt-0.5 break-words text-sm leading-5 text-[color:var(--text-1)]">
    <p>{primaryStateCopy}</p>
    <div className="mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]">
      {detailLines}
    </div>
    <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">
      {dimensionProvenance}
    </p>
  </dd>
</div>
```

Use the identical pattern for **Name on document**. Detail lines are separate `p` elements using `mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]`. Conflict statements use a semantic list, not paragraphs styled as a list.

Do not add icons, pills, checkmarks, warning colors, tooltips, accordions, or side-by-side columns. State copy must be visible without interaction and understandable without color.

### Dimension provenance

End each new row with its own provenance line. Final visible patterns:

- Rate: **Source: {source}. Applies to the selected rate.**
- Stay: **Source: {source}. Applies to the selected stay.**
- With policy reference: append ** Reference: {policyId}.**
- With a valid observed time: append ** Checked {formatted date and time}.**

Use an unambiguous localized date/time containing day, month, year, time, and timezone abbreviation. If the value is missing or invalid, omit it. Never say “today,” “recently,” or “just now.” A blank source label normalizes to **Hotel provider**.

Keep the inherited document-level provenance below the new rows because it qualifies document availability and issuer, not the new eligibility facts.

## Final UI Copy

Dynamic values in braces are normalized supplier categories. Copy around them is fixed.
When an optional inline phrase is absent, trim the composed sentence before adding its single terminal period; never render doubled spaces or ` .`.

### Business or tax ID states

| State | Primary copy | Required detail |
| --- | --- | --- |
| `supported` | **{Source} says you can provide {identifierLabel} {entryPhrase}.** | Correction line, including an explicit unknown. |
| `conditional` | **{IdentifierLabel} support depends on {condition}.** | Entry line when sourced; correction line; verification instruction. |
| `unsupported` | **{Source} says {identifierLabel} cannot be added for this selected rate.** | Verification instruction. Do not render entry or correction as actionable. |
| `conflicting` | **Supplied business or tax ID details conflict.** | **expaify cannot determine which statement applies to this selected rate.** followed by attributed statements and verification. |
| `not_provided` | **The provider did not say whether a business or tax ID can be added.** | Verification instruction. |

For `scope: 'selected_stay'`, replace **selected rate** with **selected stay** in explicit-negative and conflict support copy.

### Name on document states

| State | Primary copy | Required detail |
| --- | --- | --- |
| `supported`, individual only | **{Source} says the document can name an individual {entryPhrase}.** | Relationship lines; correction line. |
| `supported`, legal entity only | **{Source} says the document can name a legal entity {entryPhrase}.** | Relationship lines; correction line. |
| `supported`, both | **{Source} says the document can name either an individual or a legal entity {entryPhrase}.** | Relationship lines; correction line. |
| `conditional` | **The name allowed on the document depends on {condition}.** | Known allowed types, entry line when sourced, relationships, correction, and verification. |
| `unsupported` | **{Source} says {an individual / a legal entity / either an individual or a legal entity} cannot be named for this selected rate.** | Verification instruction. Do not imply the other type is supported unless separately evidenced. |
| `conflicting` | **Supplied document-name details conflict.** | **expaify cannot determine which statement applies to this selected rate.** followed by attributed statements and verification. |
| `not_provided` | **The provider did not say whose name can appear on the document.** | Unknown relationship line and verification instruction. |

For `scope: 'selected_stay'`, replace **selected rate** with **selected stay** where shown.

### Entry phrases and standalone entry copy

| Value | Inline phrase for `supported` | Standalone line for `conditional` |
| --- | --- | --- |
| `during_partner_booking` | **during booking** | **Provide this during booking.** |
| `after_booking_contact_provider` | **after booking by contacting the booking provider** | **After booking, contact the booking provider to provide this.** |
| `after_booking_contact_property` | **after booking by contacting the property** | **After booking, contact the property to provide this.** |
| `at_checkout` | **at checkout** | **Provide this at checkout.** |
| `not_provided` | Omit the phrase and end after the category. | **The provider did not say when to provide this.** |

When a normalized responsible-party display name is present in that dimension’s evidence, replace only **the booking provider** or **the property**. Do not borrow an issuer or partner name from another object.

### Correction copy

| Rule | Final copy |
| --- | --- |
| `allowed_until` | **The provider says this can be changed until {boundaryLabel}.** |
| `not_allowed_after` | **The provider says this cannot be changed after {boundaryLabel}.** |
| `not_provided` with `during_partner_booking` | **Provide this during booking; the provider did not say whether it can be changed later.** |
| `not_provided` with another known entry step | **The provider did not say whether this can be changed after you provide it.** |
| `not_provided` with no entry step | **The provider did not say when to provide this or whether it can be changed later.** |

Do not show a correction line in `unsupported` because no supported entry exists. In `not_provided`, the primary and verification copy already communicate uncertainty; omit a repetitive correction line unless the entry boundary is separately known from valid evidence.

### Name relationship copy

Render all three relationship roles in one compact relationship block so omissions cannot be mistaken for permission.

| Relationship | `same_required` | `different_allowed` | `not_provided` |
| --- | --- | --- | --- |
| Guest | **The document name must match the guest name.** | **The document name may differ from the guest name.** | included in grouped unknown copy |
| Booker | **The document name must match the booker name.** | **The document name may differ from the booker name.** | included in grouped unknown copy |
| Cardholder | **The document name must match the cardholder name.** | **The document name may differ from the cardholder name.** | included in grouped unknown copy |

After known lines, group all omitted roles in source order:

- One omitted: **The provider did not say whether this name may differ from the {guest / booker / cardholder}.**
- Two omitted: **The provider did not say whether this name may differ from the {first role} or {second role}.**
- Three omitted: **The provider did not say whether this name may differ from the guest, booker, or cardholder.**

Do not say “payer,” “billing name,” “any name,” or “company name must match” unless a future normalized supplier relationship explicitly defines that role.

## Verification Rules And Copy

Verification is dimension-specific and appears after the fact list under the fixed heading **Verify unanswered invoice details**. Include one list item for each dimension in `conditional`, `unsupported`, `conflicting`, or `not_provided`; a `supported` dimension also requires verification when entry or correction remains unknown, but its wording asks only about the missing boundary.

### Tax-ID instruction

- General unresolved: **Ask {target} whether it can add {identifierLabel} to the document before booking.**
- No safe identifier label: **Ask {target} whether it can add your required business or tax ID to the document before booking.**
- Only entry/correction missing: **Ask {target} when to provide {identifierLabel} and whether it can be changed later.**

### Document-name instruction

- General unresolved: **Ask {target} whether the document can use an individual or legal-entity name, and whether it may differ from the guest, booker, or cardholder.**
- Specific unsupported/conditional type: **Ask {target} whether the document can use {an individual / a legal-entity} name for this selected rate.**
- Only relationship missing: **Ask {target} whether the document name may differ from the {unknown roles}.**
- Only entry/correction missing: **Ask {target} when to provide the document name and whether it can be changed later.**

`{target}` comes only from that dimension’s normalized verification role and display name. Fallbacks are **the booking provider** and **the property**. If no responsible target is safely sourced, use **the document issuer**; do not guess from the URL host.

### Destination behavior

- When a dimension has a distinct validated URL, make its instruction a descriptive text link. Accessible name: visible instruction plus **Opens {destination} in a new tab.** A nearby shared cue says **Verification links open in a new tab.**
- If both dimensions resolve to the same distinct URL, render both question-specific list items but link only one shared action below them: **Check these details with {target}**. Do not duplicate destinations.
- If a destination equals the primary `providerUrl`, render static instructions and add **The Continue button opens the same external booking flow where you can check these details.** Do not add another link or button.
- If no validated URL exists, render static instructions only. Do not create a disabled control, search link, phone number, or contact form.
- If one dimension points to the property and the other to the booking provider, keep both target labels and safe destinations distinct.
- All URLs retain affiliate markers. Verification is navigation only; expaify does not send a request or billing data.

Use:

```tsx
<div className="mt-3 border-t border-[color:var(--border)] pt-3">
  <h4 className="text-sm font-medium leading-6 text-[color:var(--text-1)]">
    Verify unanswered invoice details
  </h4>
  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-2)]">
    {dimensionInstructions}
  </ul>
  {destinationCue}
</div>
```

## Exhaustive State Behavior

### Intent off

- Render the existing unchecked intent control only.
- Do not mount, visually hide, announce, or measure either eligibility row.
- Do not prefill or persist a business-travel preference.

### Loading

- Preserve the inherited lead **Checking invoice and receipt information…** and supporting copy.
- Do not show stale or placeholder eligibility claims on the first load.
- The same `role="status"` and polite live region announces the eventual complete disclosure once. Do not announce each row separately.
- Keep **Continue** enabled and in place.

### Ready

- Render the inherited document status exactly as specified, then both independent eligibility rows.
- This applies when inherited document status is `confirmed`, `conditional`, `unavailable`, `conflicting`, or `not_provided`.
- Eligibility never rewrites the document lead. For example, a confirmed invoice with unknown eligibility remains **Invoice expected…**, while both new rows say what is not provided.

### Check error

- On an initial error with no last-known normalized evidence, preserve the inherited lead **Invoice and receipt information could not be checked.** Do not render either eligibility row, because no supplier state was returned.
- Supporting copy becomes **Document availability, business or tax ID support, and document-name eligibility remain unknown. You can retry or verify during booking.**
- Verification instructions ask both questions without calling either dimension unsupported.
- **Try again** retains existing behavior. Loading replaces the error in the same polite region; on completion, announce the disclosure once.
- If previously rendered evidence remains within its provider-defined validity window, retain it with its original provenance and show the non-interruptive line **A newer check did not complete. These details were checked {date and time}.** Do not change either eligibility state. If validity cannot be established, use the initial-error behavior.

### Empty or invalid hotel context

Preserve **Hotel handoff unavailable**. Render neither intent control nor disclosure because there is no valid rate/stay scope.

## Mixed-State Fixtures

These fixtures are required for implementation and QA. They use fictional sources and categories only; they contain no names, identifier values, emails, hotel IDs, or real booking URLs.

| Fixture | Inherited document state | Tax-ID state | Name state | Required visible outcome |
| --- | --- | --- | --- | --- |
| A — both supported | Invoice confirmed from property | `supported`: **VAT number**, during booking, correction unknown, Source Alpha | `supported`: legal entity, during booking, guest different allowed, booker/cardholder unknown, Source Alpha | Preserve confirmed invoice; show both positive category claims, each correction boundary, and unknown booker/cardholder relationship. No combined verdict. |
| B — one unknown | Invoice confirmed from provider | `not_provided`, Source Beta | `supported`: individual, after booking via provider, Source Beta | Tax row remains unknown; name row remains supported. Verification asks only the tax-ID question plus any missing name boundary. |
| C — independent conditions | Receipt confirmed; property invoice conditional | `conditional`: depends on payment method, Source Gamma | `conditional`: depends on property approval, Source Delta | Keep receipt/invoice facts intact; each row shows its own condition, source, target, and question. |
| D — conflict plus negative | Invoice confirmed | `conflicting`: two attributed statements, Source Epsilon/Zeta | `unsupported`: legal entity explicitly denied, Source Epsilon | Tax conflict does not obscure the explicit name negative. Both remain textually distinct. |
| E — explicit negative plus positive | Invoice confirmed | `unsupported`: VAT number denied, Source Eta | `supported`: legal entity, Source Eta | Show the negative and positive independently; never say the stay is ready or not ready. |
| F — all provider omissions | Document `not_provided` | `not_provided`, Hotellook | `not_provided`, Hotellook | Preserve inherited unknown lead; render both explicit unknown rows and focused verification questions. Do not say unavailable. |
| G — differing provenance | Invoice confirmed, Source Theta | `supported`: business registration number, Source Iota, rate scope | `supported`: individual, Source Kappa, selected-stay scope | Each fact retains its own source and scope; the document source remains separate. |
| H — relationship partial | Invoice confirmed | `supported`: VAT number | `supported`: legal entity; guest different allowed; booker same required; cardholder unknown | Render both known relationship lines and one cardholder unknown line. Never resolve the contradiction on the user’s behalf if source data itself marks it conflicting. |
| I — property context only | Invoice confirmed | property policy says IDs accepted but rate silent | property policy says company name accepted but rate silent | Both selected-rate states remain `not_provided`; optional property context cannot upgrade them. |
| J — malformed evidence | Invoice confirmed | positive missing identifier label | conflict with only one statement | Normalize both dimensions to `not_provided`; no optimistic or conflict copy survives. |
| K — long labels | Invoice confirmed | supported category/source/boundary at maximum normalized lengths | supported legal entity with maximum source label | Wrap all text at 375px and 1280px; no truncation, overlap, or horizontal scroll. |
| L — transport error | Initial readiness request fails | no supplier state | no supplier state | Show inherited check error and retry/verification; do not manufacture two `not_provided` supplier claims. |

## Interaction Rules

### Pointer and touch

- Existing intent label toggles once across its full 44px minimum target.
- Rows contain no disclosure toggles and need no tap to reveal material facts.
- A distinct verification link emits its dimension event immediately before navigation.
- **Try again** runs one bounded request; while pending, disable only that button.
- **Continue** always opens the unchanged affiliate-marked provider URL. No eligibility state blocks, relabels, or rewrites it.

### Keyboard and focus

Tab order remains: existing responsibility content → intent checkbox → **Try again** when present → distinct tax-ID verification link when present → distinct document-name verification link when present → shared verification link when destinations are deduplicated → **Special requests** → **Continue** → **Back to search**.

- `Space` toggles the native checkbox; do not add an Enter handler.
- `Enter` or `Space` activates the native retry button.
- `Enter` activates native links. Do not add keyboard handlers to static guidance.
- Selecting intent inserts the disclosure after the checkbox without moving focus.
- Passive ready/error updates do not move focus. If activating retry removes the focused button, move focus once to the replacement status region with temporary `tabIndex={-1}`.
- Toggling intent off while focus is inside the disclosure returns focus to the checkbox before removal; it must not fall to the document body.
- No state opens a modal, traps focus, or intercepts browser Back.

## Responsive Layout

### Mobile: 375px

- Preserve the existing single-column handoff panel with `w-full min-w-0`.
- Disclosure uses `px-3.5 py-4`; each fact uses `px-3 py-2.5`.
- All five fact rows stack in document order with `gap-2`. Do not create a horizontal scroller or two-column evidence grid.
- Dynamic source, condition, identifier, boundary, and target labels use `break-words`; no truncation or line clamp.
- Conflict lists and verification lists use `pl-5`, remain inside the card, and wrap continuation lines.
- Distinct verification links and retry controls have at least 44px height and use the full available width when using the existing button style. Inline descriptive links need a 44px minimum tap area through block padding.
- The longer disclosure grows in normal document flow. No sticky footer or overlay may cover facts or **Continue**.
- At 200% text zoom, reading order and source association remain intact with no overlap or horizontal page scroll.

### Desktop: 1280px

- Keep the disclosure inside the existing review/handoff panel; do not add a modal, drawer, or third column.
- The five fact rows remain one column so provenance cannot be visually paired with the wrong fact.
- Keep actions within the existing panel width. Long labels wrap rather than widening the panel.
- Preserve the current non-sticky behavior and identical reading order to mobile.

### Tailwind/token patterns

- Outer disclosure: `min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3.5 py-4 sm:px-4`.
- Fact rows: `rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2.5`.
- Primary fact copy: `break-words text-sm leading-5 text-[color:var(--text-1)]`.
- Supporting details: `break-words text-xs leading-5 text-[color:var(--text-2)]`.
- Provenance: `break-words text-xs leading-5 text-[color:var(--text-3)]`.
- Section divisions: `border-t border-[color:var(--border)] pt-3`.
- Links/buttons use the existing `.btn`/`.btn-outline` contracts and global focus treatment; if explicit, use `focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand-soft)]`.
- Use only existing tokens from `app/globals.css`: `--bg-surface`, `--bg-muted`, `--border`, `--brand`, `--brand-soft`, `--text-1`, `--text-2`, and `--text-3`. Do not add colors or state-specific fills.

## Accessibility Requirements

- Keep `<section aria-labelledby="hotel-document-readiness-title">` and the visible **Invoice & receipt** heading.
- Keep all facts in one semantic `dl`; each row is a `div` containing `dt` then `dd`. Supporting paragraphs belong inside the same `dd` so their association is announced.
- Conflict statements use a labeled `ul`. Include source labels in text; do not communicate disagreement by color or position.
- Verification uses a visible heading and semantic list. Links have unique, question-specific accessible names and announce destination/new-tab behavior.
- The disclosure is not a form for billing data. There are no text inputs, autocomplete attributes, validation errors, or sensitive values in the DOM.
- Loading/retry use one `aria-live="polite"` status region. Ready content is announced as one update; nested rows and conflicts do not get their own live regions.
- Do not use `role="alert"` for unsupported, conditional, conflict, unknown, or transport error.
- Dynamic text is escaped. Do not use `dangerouslySetInnerHTML`.
- State remains understandable with CSS disabled and in this order: lead → document facts → generic billing step → tax-ID fact → document-name fact → verification → provenance → primary Continue.
- Every interactive element retains a visible focus indicator with at least 3:1 contrast against adjacent colors. No focus indicator is clipped by row or panel overflow.
- At 200% browser zoom and 320 CSS px reflow, content remains available without two-dimensional scrolling.

## Privacy And Trust Copy Boundary

End the existing document-level provenance with this revised fixed sentence:

**Document availability and issuer are based on information from {documentSource}. Business or tax ID and document-name details show only what each listed source supplied. Confirm the required format and details with the issuer; expaify does not guarantee that a document will include them or meet tax or employer requirements.**

Never render these claims:

- “Business ready,” “expense ready,” “tax ready,” “valid invoice,” or “compliant invoice.”
- “Your tax ID/name will appear” when evidence only says a field is accepted.
- “No tax ID/name allowed” from omission.
- “The payer/company/guest will be named” from adjacent identity or payment data.
- “We’ll send,” “we’ll save,” “we’ll validate,” or “we’ll request” billing information.

Provider query strings, URL fragments, and analytics payload values must never be interpolated into disclosure copy.

## Analytics Contract For DEV

The server allowlist must accept and enum-validate the shipped invoice events before any production result is reported. No event includes source labels, hotel/property/person/company names, offer IDs, document values, identifier categories, policy IDs, timestamps, URLs, query strings, conditions, boundary labels, or free text.

| Signal | Fire rule | Allowed categorical properties |
| --- | --- | --- |
| Existing readiness exposure | Existing 50% visible for one continuous second, once per review | inherited document fields; `taxIdState`; `documentNameState`; `taxIdSourceClass`; `documentNameSourceClass` |
| Dimension verification | Immediately before a real destination opens | `dimension: 'tax_id' \| 'document_name'`; `dimensionState`; `targetRole`; coarse `sourceClass` |
| Existing handoff | Existing Continue activation | `invoiceNeeded`; inherited `invoiceReadinessStatus`; `taxIdState`; `documentNameState` |
| Optional explicit return reason | Only after an explicit fixed-choice response | `reason: 'tax_id_unclear' \| 'document_name_unclear'` plus existing approved enums |

If a shared verification action covers both dimensions, emit one event per user action with `dimension: 'multiple'` only if that new enum is explicitly allowlisted; otherwise emit one privacy-safe event with no fabricated per-dimension click count. Generic return, Back, tab focus, abandonment, or support browsing is not an invoice failure.

Server and client tests must reject tax-ID values, names, email, hotel/offer IDs, full URLs, query strings, identifier labels, conditions, correction boundaries, and free text. Until allowlisting ships and is verified, report no production baseline from the existing rejected client emissions.

## Acceptance Criteria

1. Invoice intent remains default-off and no billing values are collected, retained, rendered, or emitted.
2. When intent is on and a check is ready, **Business or tax ID** and **Name on document** always render independently after **Billing details**.
3. Each dimension supports `supported`, `unsupported`, `conditional`, `conflicting`, and `not_provided` with the exact state boundaries and final copy in this spec.
4. Omission, malformed evidence, property-only evidence, issuer identity, generic billing timing, or another dimension can never create a positive or negative claim.
5. Document availability, issuer, tax-ID eligibility, and name eligibility never overwrite one another; no combined verdict appears.
6. Every dimension retains its own selected-rate/stay source, optional policy/time, entry step, correction boundary, conflicts, and verification target.
7. Name addressee type and guest/booker/cardholder relationships remain distinct. Unknown relationships are visibly unknown.
8. Conditional and conflict states preserve supplier conditions/statements without presenting expaify as the arbiter.
9. Verification asks only the unresolved question, targets only a sourced role/destination, deduplicates identical destinations, preserves affiliate URLs, and sends no request.
10. Initial loading/error makes no eligibility claim; retry does not block or alter **Continue**.
11. Fixtures A–L render without state leakage, sensitive values, overflow, truncation, or reliance on color.
12. At 375px, 1280px, 200% zoom, keyboard-only navigation, and screen-reader reading order, facts and sources remain correctly associated and all actions remain usable.
13. Analytics events and properties are server-allowlisted, categorical, enum-validated, and reject sensitive or free-text data before metrics are interpreted.

## Implementation And Test Matrix

- Unit-test normalizer fallback for every missing/malformed field and every cross-dimension leakage attempt.
- Unit-test all 5 × 5 tax-ID/name combinations at the model boundary; use focused UI fixtures A–L for representative visual output rather than 25 snapshots.
- Test explicit selected-rate negatives separately from provider omission and property-level context.
- Test relationship permutations, including all unknown, one known, and mixed known values.
- Test separate sources/scopes/timestamps/targets and invalid timestamps/URLs.
- Test initial loading, passive ready, initial error, retry loading/success/error, and valid last-known evidence after refresh failure.
- Test identical verification URL deduplication, differing safe destinations, providerUrl equality, invalid URLs, affiliate-marker preservation, and no request side effect.
- Test DOM absence while intent is off and no sensitive-value fields or strings in rendered HTML/analytics payloads.
- Test tab order, focus restoration when collapsing, retry focus behavior, polite announcements, unique accessible link names, and no nested live regions.
- Test at 375px and 1280px with maximum normalized labels, conflict lists, 200% zoom, and 320px reflow.
- Run `npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests`.

## Handoff

UI implementation should extend `HotelDocumentReadinessDisclosure` and its tests without changing the existing intent, handoff, price, Deal Score, or affiliate contracts. DEV work is required for shared types, provider normalization, booking-context continuity, safe source/URL validation, and analytics allowlisting. Until a contracted provider exposes selected-rate evidence, adapters must return `not_provided` independently for both dimensions.

The UI stage must implement every visible state and fixture in this spec, run TypeScript verification, and then hand off required normalization/API/analytics work to DEV. No provider may claim support from the prospective Booking.com or Expedia reference capabilities alone.

## Blockers And Out-Of-Scope Findings

- **Supplier evidence blocker:** current Hotellook, Booking.com Rapid API, and Hotelbeds paths expose no selected-rate evidence for either new dimension. Production supported/unsupported/conditional states require an approved supplier contract.
- **Measurement blocker:** the existing analytics endpoint rejects shipped invoice events and augmented handoff properties. No production baseline is valid until server allowlisting is repaired and tested.
- Supplier input capability does not guarantee that the issuer will place a value on a document.
- Tax validity, jurisdiction rules, employer acceptance, billing-value collection, provider selection, document issuance/retrieval, and expense tooling remain out of scope.
