# UXD-HOTEL-BUSINESS-INVOICE-01: Hotel Business Invoice Eligibility Discovery

Date: 2026-08-03  
Stage: UX Discovery  
Priority: P1  
Persona: Senior UX Strategist

## Scope Relationship To The Shipped Invoice-Readiness Pipeline

This ticket extends, but does not reopen, `docs/pipeline/hotel-invoice-readiness/`. That shipped pipeline already established and implemented four selected-rate disclosures: document availability, document issuer, billing-detail timing, and a verification path. Those decisions remain inherited requirements.

The residual gap is narrower: the current contract treats “billing details” as one undifferentiated concept. It cannot say whether the issuer accepts a business or tax identifier, whether the requested individual or legal-entity name may appear on the document, or whether that name may differ from the guest, booker, or payment-card holder. This discovery owns only that eligibility gap. It does not redesign the existing invoice/receipt disclosure, collect billing values, or claim that a document will satisfy an employer or tax authority.

## User Pain Point

A business traveler can learn that a selected hotel rate may produce an invoice or receipt yet still cannot determine whether the issuer will put the required business/tax identifier and payer or legal-entity name on it, so the stay can appear expense-ready before booking but become unreimbursable only after the document is issued.

## Who Is Affected And At What Step

The affected user is a traveler booking a hotel for employer reimbursement, client billing, or business accounting whose expense process requires more than proof of payment. The highest-risk cases are bookings where the guest, booker, cardholder, reimbursing company, and requested document addressee are not the same party.

The gap spans the decision from deal evaluation through provider handoff:

1. **Deal evaluation and hotel detail:** a traveler can compare price and fit but receives no signal that business-document eligibility is known, unknown, or selected-rate dependent. This is a prioritization problem, not permission to put an unverified rate claim on a property-level card.
2. **expaify hotel review:** `/book` asks “I need an invoice or receipt for this stay” and can disclose document type, issuer, and billing-detail timing. Its single “Billing details” row does not identify which fields the issuer accepts or whose name can appear.
3. **Booking handoff:** the traveler continues to the partner without knowing whether a company/tax ID can be supplied, whether a business or individual can be named as the document addressee, or whether those details can be corrected after booking. Generic advice to confirm “required format and billing details” transfers the entire eligibility check to the traveler.
4. **Return, abandonment, or support intent:** if the partner flow does not answer the question, the traveler may return, leave the rate, open help, or seek provider/property support. The current return-reason list has no invoice or billing-identity reason, so this intent is absorbed into “Other hotel details did not match” or remains unreported.

## Current Implementation Signal

The gap is directly observable in the current contract and handoff UI:

- `HotelDocumentReadiness` in `lib/types.ts` represents status, rate/stay scope, document types, issuer by document, one `billingDetailsStep`, provenance, conflicts, and a verification target. It has no field for supported billing-identity inputs, tax/business-identifier acceptance, requested document addressee, the relationship between that addressee and guest/booker/cardholder, or a correction deadline.
- `HotelDocumentReadinessDisclosure` in `app/components/HotelDocumentReadiness.tsx` renders Invoice, Receipt, and Billing details. Its strongest billing statement is where or when to add unspecified details; its fallback says the provider did not say when or where to supply them. A user cannot distinguish “field accepted,” “field not accepted,” and “provider did not supply this information.”
- The active Hotellook adapter returns `not_provided` for `documentReadiness` on every offer. It supplies no selected-rate evidence for invoice fields or payer-name rules. Silence must therefore remain unknown, not be converted into ineligibility.
- The live deal-detail path initializes `documentReadiness` as `not_provided` before review. No earlier deal-evaluation surface carries business-invoice eligibility evidence.
- `BookingFlow` emits client events for invoice need, readiness exposure, retry, and verification, but `app/api/analytics/route.ts` does not allowlist those invoice events, so the internal production sink rejects them. The handoff return reasons also omit billing-document uncertainty. Pre-booking comprehension and support-intent reduction therefore have no defensible production baseline today.

## Measurable Signal

This problem should be measured as comprehension and explicit intent, not inferred from a generic exit:

1. **Pre-booking eligibility comprehension:** in a task-based baseline, show a selected-rate review and ask the traveler whether the requested document can include their required business/tax identifier, whose name may appear, and what remains unconfirmed. Today the only accurate response to the first two questions is “the screen does not say.” Success requires correct answers for both sourced and unknown examples; continuing to the partner is not evidence of comprehension.
2. **Eligibility-information coverage:** percentage of reviewed selected rates for which the supplier provides an independently classifiable state for (a) document availability, (b) issuer, (c) business/tax-identifier support, and (d) document-addressee or payer-name rule. Report completeness by dimension and provider; do not collapse missing fields into one optimistic “eligible” state. The current Hotellook baseline for (c) and (d) is 0% sourced coverage.
3. **Support-intent signals:** among travelers who indicate an invoice need, measure explicit verification actions, invoice-specific return reasons, help/contact intent, and back-to-results actions by eligibility state. A reduced rate of these signals is directional evidence only when comprehension remains stable or improves. Generic returns and abandonment must not be labeled invoice failures.

## Minimum Sourced Eligibility Information

Before expaify may help a traveler classify a selected rate as business-document ready, the evidence must answer these dimensions independently and at selected-rate or selected-stay scope:

1. **Inherited document facts:** document type, availability status, expected issuer, and billing-detail step from the existing `HotelDocumentReadiness` contract.
2. **Business/tax-identifier rule:** whether the issuer explicitly supports, does not support, conditionally supports, or did not provide information about adding a business/tax identifier; where relevant, the supplier-provided identifier category or jurisdiction must be preserved without expaify deciding tax validity.
3. **Document-name rule:** which party may be named as the document addressee or billed entity, and whether that name may differ from the guest, booker, or cardholder. “Payer name” must not be used as a shortcut unless the supplier defines that relationship; payment responsibility and document addressee are separate facts.
4. **Entry and correction boundary:** when the supported details must be supplied and, only if explicitly sourced, whether they can be changed after booking or before document issuance.
5. **Provenance and verification:** supplier label, selected-rate/stay scope, evidence timestamp or policy reference when available, and the responsible provider/property verification path for every missing, conditional, or conflicting dimension.

Each dimension needs its own unknown state. If a supplier confirms an invoice but omits tax-ID or name rules, expaify may show the invoice fact and must show the omitted dimensions as “not provided”; it must not downgrade the invoice to unavailable or upgrade the stay to business-document eligible. Property-level policy, issuer role, payment collector, deeplink host, and prior success at the same hotel are not substitutes for selected-rate evidence.

## Constraints The Solution Must Respect

1. **No legal, tax, or reimbursement guarantee.** State only supplier-sourced support for entering specified billing information. Do not label a document tax-valid, VAT/GST-compliant, deductible, employer-approved, or guaranteed to be issued; do not infer eligibility from document availability alone.
2. **Keep issuer, payment, identity, and provenance separate.** Property-issued and platform/provider-issued documents must remain distinct, as must guest, booker, cardholder, payment collector, and requested document addressee. Every claim must travel through `lib/providers` as selected-rate/stay evidence using `Result<T>` and an explicit unknown state; affiliate-marked handoff links and the money contract remain untouched.
3. **Do not collect or expose billing values during evaluation.** expaify may disclose which categories the issuer says it accepts, but this repair must not ask for or persist a company name, person name, address, tax/VAT number, cardholder identity, or document. The disclosure and unknown-state guidance must remain usable at 375px and desktop without turning hotel search into a business-accounting form.

## Success Statement

This is solved when a first-time business traveler can determine before leaving expaify whether the selected rate’s documented issuer is known to accept the required business/tax identifier and requested individual or legal-entity name—and can identify each unanswered dimension and the responsible verification path—without assuming that invoice availability guarantees tax or employer acceptance and without submitting sensitive billing values to expaify.

## UXR Handoff Focus

`UXR-HOTEL-BUSINESS-INVOICE-01` should:

1. Read all three files in `docs/pipeline/hotel-invoice-readiness/` and preserve its shipped status, issuer, timing, provenance, error, conflict, and verification decisions.
2. Audit current and prospective supplier documentation for selected-rate or booking-stage evidence of accepted business/tax identifiers, invoice addressee or legal-entity names, relationships to guest/booker/cardholder, entry deadlines, and correction rules. Record omission separately from explicit non-support.
3. Compare one or two business-invoice patterns at the interaction level, focusing on the exact labels and state boundaries used before commitment—not visual styling and not jurisdiction-specific tax advice.
4. Produce 3–5 testable directives for independently known, unsupported, conditional, conflicting, and not-provided tax-ID and document-name dimensions, including minimum provenance and verification copy.
5. Define a privacy-safe comprehension test and production measurement contract for invoice-sensitive exposure, verification/support intent, back/return reasons, and handoff; explicitly account for the current analytics allowlist gap.

## Out-Of-Scope Findings

- The shipped invoice-readiness surface currently returns `not_provided` for all Hotellook offers. Closing sourced coverage requires a supplier or booking-stage integration that exposes selected-rate document policy; UXR may audit this dependency, but this UXD ticket does not select or integrate a provider.
- `HotelCard` remains unreachable from current routes and must not receive property-level invoice claims as a workaround. Reconnecting live search or deleting stale card code is outside this ticket.
- Tax-law interpretation, employer-policy validation, invoice issuance, billing-data collection/transmission, document storage, expense export, post-stay retrieval, and dispute support are outside scope.
- The existing invoice UI emits events that the production analytics allowlist does not accept. Repairing analytics is a later implementation concern; this discovery does not change application code.
