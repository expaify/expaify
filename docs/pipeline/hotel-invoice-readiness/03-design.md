# UXDES-HOTEL-INVOICE-READINESS-01: Hotel Invoice And Receipt Readiness

Date: 2026-07-22  
Stage: UX Design  
Priority: P1  
Upstream: `docs/pipeline/hotel-invoice-readiness/02-research.md`

## Outcome

Add an opt-in **Invoice & receipt** disclosure to the existing `/book` hotel review so a traveler can understand, before external handoff:

1. whether an invoice, receipt, or neither is evidenced for the selected rate;
2. who is expected to issue each evidenced document;
3. when and where billing details must be supplied; and
4. what to do when any of that information is conditional, missing, conflicting, or could not be checked.

The disclosure must never imply that expaify issues the document or guarantees its tax validity, format, reimbursement, or employer acceptance. For every current Hotellook offer, the honest production state is `not_provided`.

## Scope

### In scope

- The hotel handoff review in `app/book/BookingFlow.tsx`.
- A session-local, non-sensitive intent control.
- An evidence block with exhaustive supplier and check states.
- Contextual verification guidance that preserves the existing affiliate handoff.
- Responsive, keyboard, screen-reader, and long-content behavior.
- Coarse analytics requirements for a later DEV stage.
- A dedicated invoice-readiness data contract and continuity through `HotelOffer` and `BookingHotelContext`.

### Out of scope

- Search-form business-travel fields or account-level expense preferences.
- Company name, address, tax ID, email, payment, expense-policy, or document-upload fields.
- Sending billing details or an invoice request from expaify.
- Property messaging, expaify support, document retrieval, expense export, or post-stay workflows.
- Tax, VAT/GST, deductibility, legal, reimbursement, or employer-acceptance advice.
- Inferring document availability or issuer from hotel name, URL host, rate source, payment collector, confirmation page, or general supplier capability.

## Existing Surface And Placement

Retain the current `/book` hierarchy and component contracts. Within `HotelHandoffReview`, the order becomes:

1. Existing selected hotel summary in `ReviewShell`.
2. Existing **Booking partner** panel and responsibility comparison.
3. New intent control: **I need an invoice or receipt for this stay**.
4. New **Invoice & receipt** disclosure, including contextual verification guidance when required, only while the control is selected.
5. Existing **Special requests** section.
6. Existing primary **Continue to {partner}** action and new-tab cue.
7. Existing **Back to search** action.

Do not add invoice language to `HotelCard` or the search form in this ticket. Readiness is selected-rate and handoff-stage information; the active search result is a property-level aggregate and cannot support a reliable claim.

## Information Hierarchy

### Page hierarchy

1. **Primary:** selected hotel identity, nightly price basis, and **Continue to {partner}**.
2. **Secondary:** booking-party responsibility and, when requested, document readiness plus required next step.
3. **Tertiary:** evidence source/scope, non-guarantee, special-request education, and back navigation.

### Invoice disclosure hierarchy

Read in this fixed order:

1. Status lead: the exact known or unknown document outcome.
2. Document facts: invoice and receipt shown separately.
3. Issuer facts: one issuer per document; unknown stays unknown.
4. Billing-detail timing: the supplied action and stage, or an explicit unknown.
5. Verification: one contextual next step for incomplete or negative states.
6. Provenance and boundary: supplier source/scope, then expaify non-guarantee.

Do not use a positive/negative badge. Status must be stated in text and must remain understandable without color or icons.

## Required Data Contract

The UI must consume a dedicated rate/stay-scoped object. It must not reuse amenity evidence or derive fields in the component.

```ts
type HotelDocumentStatus =
  | 'confirmed'
  | 'conditional'
  | 'unavailable'
  | 'not_provided'
  | 'conflicting'

type HotelDocumentType = 'invoice' | 'receipt' | 'booking_confirmation'

type HotelDocumentIssuerRole =
  | 'booking_provider'
  | 'property'
  | 'split'
  | 'unknown'

type HotelBillingDetailsStep =
  | 'during_partner_booking'
  | 'after_booking_contact_provider'
  | 'after_booking_contact_property'
  | 'at_checkout'
  | 'not_required'
  | 'unknown'

type HotelDocumentScope = 'rate' | 'selected_stay'

type HotelDocumentIssuer = {
  role: HotelDocumentIssuerRole
  displayName?: string
}

type HotelDocumentReadiness = {
  status: HotelDocumentStatus
  scope: HotelDocumentScope
  documentTypes: HotelDocumentType[]
  issuerByDocument: Partial<Record<HotelDocumentType, HotelDocumentIssuer>>
  billingDetailsStep: HotelBillingDetailsStep
  condition?: string
  source: {
    label: string
    policyId?: string
    observedAt?: string
  }
  conflictStatements?: Array<{
    sourceLabel: string
    statement: string
  }>
  verificationTarget?: {
    role: 'booking_provider' | 'property'
    url?: string
  }
}

type HotelDocumentCheckState = 'idle' | 'loading' | 'ready' | 'error'
```

Contract rules:

- `HotelOffer.documentReadiness` and `BookingHotelContext.documentReadiness` use this model.
- `scope` must be `rate` or `selected_stay`; property-only policy may appear as context but can never set `confirmed` or `unavailable` for the rate.
- `not_provided` is the fallback for an omitted supplier field. The active Hotellook adapter must normalize to this state with `documentTypes: []`, unknown issuer/timing, and source label `Hotellook`.
- `unavailable` requires an explicit rate/stay-scoped supplier statement.
- `confirmed` requires at least one exact document type and a supplier-supported process for the selected rate.
- Receipt evidence never implies invoice evidence. A booking confirmation is neither a receipt nor an invoice.
- `conditional` requires a concise, displayable condition. If the condition is missing or unsafe, normalize to `conflicting`.
- `conflicting` requires at least two attributed statements; the UI does not choose a winner.
- Missing issuer and billing-detail fields render as unknown; they do not invalidate otherwise supported document evidence.
- A network/transport/check failure sets UI `checkState: 'error'`; it does not mutate supplier status to `unavailable`.
- Validate and preserve only the normalized scalar fields through the `/book` boundary. Never serialize raw provider JSON or secrets.
- `verificationTarget.url`, when present, must be a validated supplier/property URL. Reusing `providerUrl` must preserve the entire affiliate-marked URL byte for byte.
- A resolved booking-partner name is display context only. It is not invoice or receipt evidence.

## Component Specification

### 1. Intent control

Place the control after the responsibility comparison and before the invoice disclosure and **Special requests**.

Semantic pattern:

```tsx
<div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
  <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-[color:var(--text-1)]">
    <input
      type="checkbox"
      className="mt-1 h-5 w-5 shrink-0 rounded border-[color:var(--border-strong)] text-[color:var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand-soft)]"
    />
    <span>I need an invoice or receipt for this stay</span>
  </label>
  <p className="ml-8 mt-1 text-xs leading-5 text-[color:var(--text-3)]">
    We’ll show what the provider supplied before you continue.
  </p>
</div>
```

Rules:

- Default unchecked on each new hotel-review page load.
- Preserve the selection while the user remains on that review, including disclosure retry. Do not persist it to account, cookie, analytics identity, or another hotel.
- Selecting reveals the disclosure immediately after the control. Focus stays on the checkbox; do not move focus or auto-scroll.
- Deselecting collapses the disclosure and returns no focus because focus remains on the checkbox.
- The entire label is clickable. The helper text is not a second label.
- Do not render company, tax, address, receipt-email, or free-text inputs.

### 2. Invoice & receipt disclosure container

```tsx
<section
  aria-labelledby="hotel-document-readiness-title"
  className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3.5 py-4 sm:px-4"
>
  <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--brand)]">
    Before you book
  </p>
  <h3 id="hotel-document-readiness-title" className="mt-1 text-base font-bold leading-6 text-[color:var(--text-1)]">
    Invoice &amp; receipt
  </h3>
  {/* Status lead, facts, action guidance, provenance */}
</section>
```

The lead uses `mt-3 text-sm font-bold leading-6 text-[color:var(--text-1)]`. Supporting copy uses `mt-2 text-sm leading-6 text-[color:var(--text-2)]`. Do not place a success, warning, or error icon beside the title; the exact lead copy carries meaning.

### 3. Document fact list

For `confirmed`, `conditional`, `unavailable`, and `conflicting`, show a semantic `dl` after the lead. For `not_provided`, loading, and check error, omit fact rows whose values are entirely unknown; do not fill the block with repeated “unknown” rows.

```tsx
<dl className="mt-3 grid grid-cols-1 gap-2">
  <div className="rounded-lg bg-[color:var(--bg-muted)] px-3 py-2.5">
    <dt className="text-xs font-bold leading-5 text-[color:var(--text-2)]">Invoice</dt>
    <dd className="mt-0.5 break-words text-sm leading-5 text-[color:var(--text-1)]">{invoiceFact}</dd>
  </div>
  <div className="rounded-lg bg-[color:var(--bg-muted)] px-3 py-2.5">
    <dt className="text-xs font-bold leading-5 text-[color:var(--text-2)]">Receipt</dt>
    <dd className="mt-0.5 break-words text-sm leading-5 text-[color:var(--text-1)]">{receiptFact}</dd>
  </div>
  <div className="rounded-lg bg-[color:var(--bg-muted)] px-3 py-2.5">
    <dt className="text-xs font-bold leading-5 text-[color:var(--text-2)]">Billing details</dt>
    <dd className="mt-0.5 break-words text-sm leading-5 text-[color:var(--text-1)]">{billingDetailsCopy}</dd>
  </div>
</dl>
```

Never place these facts side by side. Keeping one column prevents document/issuer pairs from being misread and supports long issuer names at both breakpoints.

### 4. Verification guidance

Render for `conditional`, `unavailable`, `not_provided`, `conflicting`, and check error. Render for confirmed receipt-only when invoice remains unconfirmed. It sits inside the disclosure after the facts and before provenance.

- If a distinct, validated verification URL exists, render one secondary link labeled from the copy rules below.
- If verification reuses the same `providerUrl` as the primary CTA, do **not** render a duplicate button. Render the static instruction **Check invoice details during booking** and supporting copy **The Continue button opens the same external booking flow where you can verify these details.**
- If no URL exists, render only the static instruction. Do not disable it, style it as a button, or invent a contact path.
- A distinct verification link opens a new tab and uses `rel="noopener noreferrer sponsored"` when it is affiliate-marked. Its accessible name ends with **Opens {destination} in a new tab.**
- Never build a property URL from the property name or a search query.

Secondary link pattern:

```tsx
<a className="btn-secondary mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-center text-sm font-medium">
  Check invoice details with {partnerLabel}
</a>
```

Static guidance pattern:

```tsx
<div className="mt-3 border-t border-[color:var(--border)] pt-3">
  <p className="text-sm font-semibold leading-6 text-[color:var(--text-1)]">Check invoice details during booking</p>
  <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">The Continue button opens the external booking flow where you can verify these details.</p>
</div>
```

### 5. Provenance and boundary

End every ready state with these lines:

- Scope line: **This information applies to the selected rate.** for `scope: 'rate'`; **This information applies to the selected stay.** for `scope: 'selected_stay'`.
- Source and boundary line: **Document availability and issuer are based on information from {source}. Confirm the required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.**

Use:

```tsx
<div className="mt-3 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--text-3)]">
  <p>{scopeCopy}</p>
  <p className="mt-1">Document availability and issuer are based on information from {source}. Confirm the required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.</p>
</div>
```

For loading, replace both ready-state lines with **No document claim is shown while this check is pending. Confirm the required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.** For check error, use **No document claim is shown because the check did not complete. Confirm the required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.**

## Final UI Copy System

Dynamic names must be escaped and rendered as text. Use the supplied `source.label` and per-document `displayName` only after normalization. If a display name is absent, use the role fallback below.

### Role fallbacks

| Data | Visible fallback |
| --- | --- |
| Named booking provider | `{partnerLabel}` |
| Unknown booking provider | `the booking partner` |
| Named property issuer | `{propertyName}` only when supplier evidence explicitly identifies that property as issuer |
| Unnamed property issuer | `the property` |
| Unknown issuer | `issuer not provided` in a fact row; `the issuer` in instruction copy |
| Split issuer | `{supplied split description}`; if absent, `multiple issuers` |

Do not substitute `hotelContext.name` as an issuer unless the evidence explicitly assigns the property issuer role.

### Billing-detail timing

| Value | Final visible copy |
| --- | --- |
| `during_partner_booking` | `Add billing details on the booking partner’s site while booking.` |
| `after_booking_contact_provider` | `After booking, contact the booking provider using your confirmation.` |
| `after_booking_contact_property` | `After booking, use your confirmation to contact the property before your stay.` |
| `at_checkout` | `Ask the property to use your billing details at checkout.` |
| `not_required` | `The provider states that separate billing details are not required.` |
| `unknown` | `The provider did not say when or where to supply billing details.` |

When a trusted partner or property issuer name is supplied, replace only the generic role phrase; do not alter the instruction’s meaning.

### Document fact values

| Evidence | Invoice fact | Receipt fact |
| --- | --- | --- |
| Document present with known issuer | `Expected from {issuer}.` | `Payment receipt expected from {issuer}.` |
| Document present with unknown issuer | `Expected; issuer not provided.` | `Payment receipt expected; issuer not provided.` |
| Document explicitly unavailable | `Not available for this selected rate, according to {source}.` | `Not available for this selected rate, according to {source}.` |
| Document omitted | `Not confirmed for this selected rate.` | `Not confirmed for this selected rate.` |
| Conflicting | `Supplied details conflict; verify before booking.` | `Supplied details conflict; verify before booking.` |
| Booking confirmation only | `Not confirmed for this selected rate.` | `Not confirmed. A booking confirmation is a different document.` |

Do not use “tax invoice,” “valid invoice,” “business invoice,” “VAT invoice,” “reimbursable,” or “accepted” unless a future legal/compliance ticket supplies jurisdiction-safe copy. This ticket never does.

## Exhaustive States

### A. Default: intent off

- Show the checkbox and helper only.
- Do not render the disclosure in a hidden DOM region and do not announce a document state.
- Primary provider CTA, special requests, selected hotel, and rate remain unchanged.
- No readiness-view event fires.

### B. Loading/check pending

Visible copy:

- Lead: **Checking invoice and receipt information…**
- Supporting: **You can still continue to the booking partner while this check finishes.**
- Provenance: **No document claim is shown while this check is pending.**

Behavior:

- The lead container uses `role="status"` and `aria-live="polite"`; do not use `aria-busy` on the whole page.
- Use a small CSS spinner only if an existing spinner pattern exists; otherwise text alone is sufficient.
- Never remove, move, or disable the provider CTA solely because the check is pending.
- When ready, update the same region politely. Do not move focus.

### C. Confirmed invoice

Lead: **Invoice expected from {invoiceIssuer}.**

Show separate Invoice and Receipt rows. If receipt is omitted, its value is **Not confirmed for this selected rate.** Show the billing-detail timing, provenance, and non-guarantee. No verification action is required when the invoice and timing are both confirmed; render one if issuer or timing remains unknown.

### D. Confirmed receipt only

Lead: **{receiptIssuer} provides a payment receipt; an invoice is not confirmed.**

- Invoice row: **Not confirmed for this selected rate.**
- Receipt row: **Payment receipt expected from {receiptIssuer}.**
- Show billing timing if supplied.
- Show verification guidance because the traveler selected a need that may require an invoice.
- Never shorten the lead to “Receipt available” or group it under an invoice-ready state.

### E. Conditional

Lead: **Invoice availability depends on {condition}.**

- The condition must be a complete, supplier-safe phrase without terminal punctuation in data; the component adds the period.
- Show each supported document and issuer separately.
- Show known billing timing or the unknown timing copy.
- Show verification guidance.
- If `condition` is empty, contradictory, contains unsafe free text, or cannot fit normalized copy rules, render the conflicting state instead.

### F. Explicitly unavailable

Lead: **{source} states that an invoice is not available for this rate.**

- Only render from `status: 'unavailable'` with explicit selected-rate/stay evidence.
- Invoice row uses the unavailable copy. Receipt row states the supplied receipt result independently.
- Show verification guidance and preserve the provider CTA.
- Do not generalize to the hotel, provider, future stays, or other rates.

### G. Not provided — current production default

Lead: **{source} did not provide invoice or receipt information for this rate.**

Supporting copy: **Availability, issuer, and billing-detail timing are unknown.**

Guidance:

- Named, safe partner: heading **Check with {partnerLabel} before booking**.
- Unresolved partner: heading **Check invoice details during booking**.
- Supporting: **Ask who issues the invoice or receipt, what billing details are needed, and when to provide them.**
- If the property may issue the document but there is no rate-scoped confirmation: **If the property issues the invoice, use the contact details in your booking confirmation before your stay or ask at checkout, as the provider instructs.**

Do not render Invoice/Receipt fact cards, an availability badge, or “not available.” For current Hotellook offers, `{source}` resolves to **Hotellook**, partner identity remains independent, and timing/issuer remain unknown.

### H. Conflicting

Lead: **Invoice information is unclear because the supplied details conflict.**

Supporting introduction: **expaify cannot determine which statement applies to this selected rate.**

Render a list headed **Supplied statements**. Each item is **{sourceLabel}: {normalized statement}.** Use `ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-2)]"`. Do not emphasize one source, order by perceived trust, or calculate a winner. Then show verification guidance directed to the resolved booking/payment party, or the generic during-booking instruction.

### I. Check error

Lead: **Invoice and receipt information could not be checked.**

Supporting: **Availability and issuer remain unknown. You can retry or verify during booking.**

- Show **Try again** as a button only when a real, bounded check can be retried.
- Retry pattern: `className="btn-secondary mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium"`.
- On activation, keep the intent selected, replace this state with loading, and announce it through the same status region.
- Prevent duplicate requests while retry is pending.
- If retry is unavailable, omit the button; do not render it disabled.
- Always retain the verification guidance and provider CTA.
- Do not show technical status codes or the word “unavailable.”

### J. Empty/no valid hotel context

The existing **Hotel handoff unavailable** state remains authoritative. Do not render the intent control or disclosure because there is no validated selected rate to scope the evidence to. **Back to search** remains the only action.

### K. Upstream hotel search empty or error

No invoice module appears on search because no `/book` hotel review exists. This ticket does not change upstream empty/error copy.

## Interaction Rules

### Pointer/tap

- Tapping anywhere in the checkbox label toggles intent once.
- Tapping a distinct verification link fires the verification event immediately before the browser opens the validated destination.
- Tapping **Try again** starts one check and disables only that retry button while pending; it does not affect the primary CTA.
- Tapping **Continue** always follows the existing affiliate URL in a new tab. Readiness state never rewrites the URL.

### Keyboard

- Tab order: existing responsibility content → intent checkbox → disclosure retry or distinct verification link, when present → existing Special requests summary → primary Continue link → Back to search.
- `Space` toggles the checkbox. Do not attach Enter handlers to the checkbox.
- `Enter` or `Space` activates **Try again** because it is a native button.
- `Enter` activates verification and Continue links.
- Collapsing or updating the disclosure never traps focus.
- If the focused retry button is removed after activation, focus may remain on the replacement status region only if the button would otherwise be lost; set `tabIndex={-1}` temporarily and call focus once. Do not move focus when a passive check completes.

### External destination cues

- Visible cue for the primary CTA remains: **Opens {partnerLabel} in a new tab. Your expaify search stays open here.** or the existing generic equivalent.
- A distinct verification link includes a nearby cue: **Opens {destinationLabel} in a new tab.**
- Icons are decorative with `aria-hidden="true" focusable="false"`; accessible names include the new-tab destination.

## Responsive Layout

### Mobile: 375px

- All new blocks are a single column and `w-full min-w-0`.
- Keep panel padding at `p-4`; disclosure uses `px-3.5 py-4`.
- Checkbox label uses `items-start`; long labels wrap beside the fixed 20px control.
- Fact rows remain stacked. Never use a horizontal scroller or two-column issuer layout.
- Issuer, source, condition, and partner strings use `break-words`; no truncation or line clamp.
- Retry or distinct verification action and Continue remain full width with `min-h-11`.
- Static verification guidance does not create a second competing button when it shares the provider destination.
- The primary CTA remains visible by normal scroll after all disclosure states; no sticky overlay is introduced.
- At 200% text zoom, blocks grow vertically and retain source order without overlap.

### Desktop: 1280px

- Preserve the existing review shell and handoff panel width.
- Keep the invoice disclosure within the same right-side handoff panel; do not create a modal or third page column.
- Responsibility cards may retain `sm:grid-cols-2`; invoice fact rows remain one column.
- Actions remain stacked and capped by the existing panel width so long labels wrap cleanly.
- Do not make the handoff panel sticky if it is not already sticky in the current implementation.

## Accessibility Requirements

- Checkbox has a persistent visible label and at least 44px label height.
- All interactive controls use the existing global `:focus-visible` treatment or explicit `focus-visible:ring-4` with `--brand-soft`; never remove focus outline without replacement.
- Disclosure heading is associated with the section by `aria-labelledby`.
- Loading and retry transitions use one polite status region. Do not repeatedly announce unchanged provenance text.
- Static facts use semantic `dl`, `dt`, and `dd`; conflicting statements use a semantic list.
- Do not apply `role="alert"` to unknown, unavailable, conflicting, or check-error states. None requires interruptive announcement.
- Do not rely on `--success`, `--warning`, or any icon to convey status. All states use explicit text.
- Links opening new tabs identify the destination and new-tab behavior in their accessible name.
- Dynamic strings are not concatenated into unsafe HTML.
- With CSS disabled, reading order remains status → document facts → billing timing → verification → provenance/boundary → primary Continue.

## Edge Cases And Resolution Rules

| Edge case | Required rendering |
| --- | --- |
| Partner URL resolves a known brand but readiness issuer is unknown | Name the partner in handoff/verification only; render `issuer not provided`. |
| Rate source and outbound partner differ | Source line names the evidence source; CTA names the outbound partner; do not merge them. |
| Payment collector is known, invoice issuer is unknown | Keep existing collector copy; invoice row says `issuer not provided`. |
| Receipt issuer and invoice issuer differ | Render separate issuer names in separate fact rows. |
| Receipt exists plus booking confirmation | Render receipt; do not call the confirmation an invoice or receipt. |
| Only booking confirmation exists | State that invoice and receipt are not confirmed; do not render document-ready language. |
| Property-level invoice policy only | Show as contextual supporting text only; selected-rate state remains `not_provided` or `conditional`. |
| Condition is longer than 160 characters | Reject it from lead copy and render `conflicting`; do not truncate a material condition. |
| Issuer/source/partner name is long or contains no spaces | Apply `break-words`; never truncate or shrink below existing text sizes. |
| Missing or blank source label | Normalize to `Hotel provider`; do not show an empty interpolation. |
| Unsafe or missing distinct verification URL | Omit the link and show static during-booking guidance. |
| Verification and primary destinations are identical | Show static guidance plus one primary Continue link, not duplicate destination buttons. |
| Check times out after prior ready data was visible | Keep the prior attributed data only if its provenance remains valid and label it with its observed time; otherwise show check error. Never convert to unavailable. |
| Intent toggled rapidly | Last checkbox state wins; cancel or ignore stale check responses and emit one event per actual value change. |
| User returns from partner tab | Preserve session-local intent and disclosure state. Do not infer invoice failure or booking completion. |
| Evidence observed time is missing | Omit time; never render `Invalid Date` or “just now.” |
| Evidence is stale by a future supplier-specific rule | Degrade to `not_provided` or trigger a check according to that contract; do not show a stale positive/negative claim. |

## Analytics Specification For DEV

Analytics must go to an approved production sink before results are interpreted. No event may include hotel/property name, offer ID, full URL, query string, company data, billing address, tax ID, email, payment data, or free text.

| Event | Fire rule | Allowed properties |
| --- | --- | --- |
| `hotel_invoice_need_changed` | Once per actual checkbox value change | `needed`, `source`, `partnerNamed` |
| `hotel_invoice_readiness_viewed` | Disclosure is at least 50% visible continuously for 1 second, once per review | `status`, `documentTypes`, `invoiceIssuerRole`, `receiptIssuerRole`, `billingDetailsStep`, `source`, `scope` |
| `hotel_invoice_verification_clicked` | Immediately before a distinct verification destination opens | Same categorical readiness fields plus `targetRole` |
| `hotel_invoice_retry_clicked` | Immediately before a real retry begins | `priorCheckState`, `source`, `scope` |
| Existing `hotel_handoff_continue_clicked` | Existing click rule | Add only `invoiceNeeded`, `invoiceReadinessStatus` |

Do not fire readiness-view from render, intent selection alone, sub-one-second visibility, or repeated scrolling. Do not interpret the existing tab-return event as invoice failure. An optional exit reason remains a separate future feature and is not implemented in this UI ticket.

## Acceptance Criteria

1. The intent control appears on every valid hotel review, defaults unchecked, is fully keyboard operable, and collects no sensitive billing data.
2. With intent off, no invoice/receipt claim is rendered or announced.
3. With intent on, the disclosure appears before the provider CTA without moving focus.
4. Current Hotellook offers render `not_provided`: **Hotellook did not provide invoice or receipt information for this rate.** They never render available or unavailable.
5. Confirmed invoice, confirmed receipt-only, conditional, explicitly unavailable, not provided, conflicting, loading, and check-error states use the exact copy and behavior in this spec.
6. Invoice, receipt, issuer, and billing-detail timing remain distinct; no field is derived from partner host, source, collector, property name, or another document type.
7. Every incomplete/negative state provides a specific verification next step without blocking or duplicating the primary booking action.
8. The primary CTA preserves the original affiliate-marked provider URL and existing sponsored/new-tab behavior.
9. Loading and check error retain the selected hotel summary and enabled provider CTA.
10. Missing fields never normalize to `confirmed` or `unavailable`; check failure remains separate from supplier status.
11. All ready states show supplier scope/provenance and the exact non-guarantee boundary.
12. At 375px, all content and actions fit without overlap, clipping, truncation, or horizontal scrolling; at 1280px, the current review shell remains usable.
13. At 200% zoom and with long unbroken names, content wraps without obscuring the checkbox or actions.
14. Status remains understandable with color and icons removed; semantic facts/lists and accessible external-link cues are present.
15. Analytics emit only on the specified interaction/exposure rules and contain no prohibited sensitive or identifying fields.

## Implementation And Test Matrix

UI must add focused component tests for:

- intent off/on visibility and focus retention;
- all eight evidence/check states and exact lead copy;
- Hotellook omission mapping to `not_provided`;
- receipt-only not implying invoice;
- missing issuer/timing fallbacks;
- same-URL verification producing one primary destination;
- distinct safe verification URL preserving its affiliate markers;
- unsafe/missing verification URL producing static guidance;
- loading/error leaving Continue enabled;
- retry transition and duplicate-request prevention;
- long strings and responsive class contracts;
- keyboard semantics and accessible new-tab names;
- sustained 50%/1-second exposure analytics, no render/brief-visibility event, and prohibited-field absence.

DEV is required after UI because the current code cannot carry invoice readiness through provider normalization and `BookingHotelContext`, and `lib/analytics.ts` has no production destination. UI should isolate copy/state rendering in a presentational component while keeping the current production fallback deterministic.

## Handoff

Create `UI-HOTEL-INVOICE-READINESS-01` to implement the intent control, exhaustive disclosure states, responsive/accessibility behavior, and current Hotellook `not_provided` presentation. That UI ticket must hand off to `DEV-HOTEL-INVOICE-READINESS-01` for the normalized provider contract, safe booking-context continuity, supplier-backed checks, and production analytics integration.
