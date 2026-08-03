import type {
  HotelDocumentCheckState,
  HotelDocumentCorrectionBoundary,
  HotelDocumentEntryStep,
  HotelDocumentNameEligibility,
  HotelDocumentIssuer,
  HotelDocumentReadiness,
  HotelEligibilitySource,
  HotelEligibilityVerificationTarget,
  HotelTaxIdentifierEligibility,
} from '@/lib/types'
import type { Ref } from 'react'
import { notProvidedHotelDocumentReadiness } from '@/lib/providers/hotelDocumentReadiness'

export type {
  HotelBillingDetailsStep,
  HotelDocumentCheckState,
  HotelDocumentIssuer,
  HotelDocumentIssuerRole,
  HotelDocumentReadiness,
  HotelDocumentScope,
  HotelDocumentStatus,
  HotelDocumentType,
  HotelBusinessDocumentEligibilityState,
  HotelDocumentAddresseeType,
  HotelDocumentCorrectionBoundary,
  HotelDocumentEntryStep,
  HotelDocumentNameEligibility,
  HotelEligibilitySource,
  HotelEligibilityVerificationTarget,
  HotelNameRelationship,
  HotelTaxIdentifierEligibility,
} from '@/lib/types'

type PartnerIdentity = {
  label: string
  named: boolean
}

type ReadinessDisclosureProps = {
  readiness: HotelDocumentReadiness
  checkState: HotelDocumentCheckState
  partner: PartnerIdentity
  providerUrl: string
  retryAvailable?: boolean
  retryPending?: boolean
  onRetry?: () => void
  onVerificationClick?: () => void
  statusRegionRef?: Ref<HTMLElement>
  statusRegionFocusable?: boolean
}

export function getNotProvidedHotelDocumentReadiness(sourceLabel: string): HotelDocumentReadiness {
  return notProvidedHotelDocumentReadiness(sourceLabel)
}

const factRowClassName = 'rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2.5'
const factValueClassName = 'mt-0.5 break-words text-sm leading-5 text-[color:var(--text-1)]'

function cleanLabel(value: string | undefined, fallback: string) {
  const cleaned = value?.trim()
  return cleaned || fallback
}

function sentenceStart(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function withTerminalPeriod(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`
}

function issuerLabel(
  issuer: HotelDocumentIssuer | undefined,
  partner: PartnerIdentity,
  usage: 'fact' | 'instruction' = 'fact',
) {
  if (!issuer || issuer.role === 'unknown') {
    return usage === 'instruction' ? 'the issuer' : 'issuer not provided'
  }

  const suppliedName = issuer.displayName?.trim()
  if (suppliedName) return suppliedName
  if (issuer.role === 'booking_provider') return partner.named ? partner.label : 'the booking partner'
  if (issuer.role === 'property') return 'the property'
  return 'multiple issuers'
}

function billingDetailsCopy(readiness: HotelDocumentReadiness, partner: PartnerIdentity) {
  const invoiceIssuer = readiness.issuerByDocument.invoice
  const namedProvider = invoiceIssuer?.role === 'booking_provider' && invoiceIssuer.displayName?.trim()
    ? invoiceIssuer.displayName.trim()
    : partner.named
      ? partner.label
      : 'the booking provider'
  const namedProperty = invoiceIssuer?.role === 'property' && invoiceIssuer.displayName?.trim()
    ? invoiceIssuer.displayName.trim()
    : 'the property'

  switch (readiness.billingDetailsStep) {
    case 'during_partner_booking':
      return `Add billing details on ${namedProvider}’s site while booking.`
    case 'after_booking_contact_provider':
      return `After booking, contact ${namedProvider} using your confirmation.`
    case 'after_booking_contact_property':
      return `After booking, use your confirmation to contact ${namedProperty} before your stay.`
    case 'at_checkout':
      return `Ask ${namedProperty} to use your billing details at checkout.`
    case 'not_required':
      return 'The provider states that separate billing details are not required.'
    case 'unknown':
      return 'The provider did not say when or where to supply billing details.'
  }
}

function isSafeExternalUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function isAffiliateUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === 'tp.media' || ['marker', 'aid', 'affiliate', 'aff_id', 'ref'].some(key => url.searchParams.has(key))
  } catch {
    return false
  }
}

function documentFact(
  type: 'invoice' | 'receipt',
  readiness: HotelDocumentReadiness,
  partner: PartnerIdentity,
  source: string,
) {
  const hasDocument = readiness.documentTypes.includes(type)
  const hasBookingConfirmation = readiness.documentTypes.includes('booking_confirmation')
  const issuer = issuerLabel(readiness.issuerByDocument[type], partner)

  if (readiness.status === 'conflicting') return 'Supplied details conflict; verify before booking.'
  if (readiness.status === 'unavailable' && type === 'invoice') {
    return `Not available for this selected rate, according to ${source}.`
  }
  if (!hasDocument) {
    if (hasBookingConfirmation && type === 'receipt') {
      return 'Not confirmed. A booking confirmation is a different document.'
    }
    return 'Not confirmed for this selected rate.'
  }
  if (type === 'receipt') {
    return issuer === 'issuer not provided'
      ? 'Payment receipt expected; issuer not provided.'
      : `Payment receipt expected from ${issuer}.`
  }
  return issuer === 'issuer not provided'
    ? 'Expected; issuer not provided.'
    : `Expected from ${issuer}.`
}

function shouldShowVerification(readiness: HotelDocumentReadiness) {
  if (readiness.status !== 'confirmed') return true
  const hasInvoice = readiness.documentTypes.includes('invoice')
  const invoiceIssuer = readiness.issuerByDocument.invoice
  return !hasInvoice || !invoiceIssuer || invoiceIssuer.role === 'unknown' || readiness.billingDetailsStep === 'unknown'
}

function entryPhrase(step: HotelDocumentEntryStep) {
  switch (step) {
    case 'during_partner_booking': return 'during booking'
    case 'after_booking_contact_provider': return 'after booking by contacting the booking provider'
    case 'after_booking_contact_property': return 'after booking by contacting the property'
    case 'at_checkout': return 'at checkout'
    case 'not_provided': return ''
  }
}

function entryLine(step: HotelDocumentEntryStep) {
  switch (step) {
    case 'during_partner_booking': return 'Provide this during booking.'
    case 'after_booking_contact_provider': return 'After booking, contact the booking provider to provide this.'
    case 'after_booking_contact_property': return 'After booking, contact the property to provide this.'
    case 'at_checkout': return 'Provide this at checkout.'
    case 'not_provided': return 'The provider did not say when to provide this.'
  }
}

function correctionLine(correction: HotelDocumentCorrectionBoundary, step: HotelDocumentEntryStep) {
  if (correction.rule === 'allowed_until') return `The provider says this can be changed until ${correction.boundaryLabel}.`
  if (correction.rule === 'not_allowed_after') return `The provider says this cannot be changed after ${correction.boundaryLabel}.`
  if (step === 'during_partner_booking') return 'Provide this during booking; the provider did not say whether it can be changed later.'
  if (step !== 'not_provided') return 'The provider did not say whether this can be changed after you provide it.'
  return 'The provider did not say when to provide this or whether it can be changed later.'
}

function formattedObservedAt(value: string | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return undefined
  return new Intl.DateTimeFormat('en', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value))
}

function eligibilityProvenance(source: HotelEligibilitySource) {
  const label = cleanLabel(source.label, 'Hotel provider')
  const scope = source.scope === 'rate' ? 'selected rate' : 'selected stay'
  const policy = source.policyId?.trim() ? ` Reference: ${source.policyId.trim()}.` : ''
  const observed = formattedObservedAt(source.observedAt)
  return `Source: ${label}. Applies to the ${scope}.${policy}${observed ? ` Checked ${observed}.` : ''}`
}

function scopeLabel(source: HotelEligibilitySource) {
  return source.scope === 'rate' ? 'selected rate' : 'selected stay'
}

function addresseeCopy(types: Array<'individual' | 'legal_entity'>) {
  const hasIndividual = types.includes('individual')
  const hasEntity = types.includes('legal_entity')
  if (hasIndividual && hasEntity) return 'either an individual or a legal entity'
  if (hasEntity) return 'a legal entity'
  return 'an individual'
}

function relationshipLines(eligibility: HotelDocumentNameEligibility) {
  const roles = ['guest', 'booker', 'cardholder'] as const
  const known = roles.flatMap(role => {
    const relationship = eligibility.relationships[role]
    if (relationship === 'not_provided') return []
    return [`The document name ${relationship === 'same_required' ? 'must match' : 'may differ from'} the ${role} name.`]
  })
  const unknown = roles.filter(role => eligibility.relationships[role] === 'not_provided')
  if (unknown.length === 1) known.push(`The provider did not say whether this name may differ from the ${unknown[0]}.`)
  if (unknown.length === 2) known.push(`The provider did not say whether this name may differ from the ${unknown[0]} or ${unknown[1]}.`)
  if (unknown.length === 3) known.push('The provider did not say whether this name may differ from the guest, booker, or cardholder.')
  return known
}

function ConflictStatements({ statements }: { statements: Array<{ sourceLabel: string; statement: string }> | undefined }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-[color:var(--text-2)]">
      {(statements ?? []).map((statement, index) => (
        <li key={`${statement.sourceLabel}-${index}`} className="break-words">
          {cleanLabel(statement.sourceLabel, 'Hotel provider')}: {withTerminalPeriod(cleanLabel(statement.statement, 'Statement not provided'))}
        </li>
      ))}
    </ul>
  )
}

function TaxEligibilityRow({ eligibility }: { eligibility: HotelTaxIdentifierEligibility }) {
  const source = cleanLabel(eligibility.source.label, 'Hotel provider')
  const identifier = cleanLabel(eligibility.identifierLabel, 'a business or tax ID')
  const phrase = entryPhrase(eligibility.entryStep)
  let primary: string
  let details: string[] = []
  if (eligibility.state === 'supported') {
    primary = `${source} says you can provide ${identifier}${phrase ? ` ${phrase}` : ''}.`
    details = [correctionLine(eligibility.correction, eligibility.entryStep)]
  } else if (eligibility.state === 'conditional') {
    primary = withTerminalPeriod(`${sentenceStart(identifier)} support depends on ${eligibility.condition}`)
    details = [entryLine(eligibility.entryStep), correctionLine(eligibility.correction, eligibility.entryStep)]
  } else if (eligibility.state === 'unsupported') {
    primary = `${source} says ${identifier} cannot be added for this ${scopeLabel(eligibility.source)}.`
  } else if (eligibility.state === 'conflicting') {
    primary = 'Supplied business or tax ID details conflict.'
    details = [`expaify cannot determine which statement applies to this ${scopeLabel(eligibility.source)}.`]
  } else {
    primary = 'The provider did not say whether a business or tax ID can be added.'
  }
  return (
    <div className={factRowClassName}>
      <dt className="text-xs font-medium leading-5 text-[color:var(--text-2)]">Business or tax ID</dt>
      <dd className={factValueClassName}>
        <p>{primary}</p>
        {details.map(detail => <p key={detail} className="mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]">{detail}</p>)}
        {eligibility.state === 'conflicting' ? <ConflictStatements statements={eligibility.conflictStatements} /> : null}
        <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">{eligibilityProvenance(eligibility.source)}</p>
      </dd>
    </div>
  )
}

function NameEligibilityRow({ eligibility }: { eligibility: HotelDocumentNameEligibility }) {
  const source = cleanLabel(eligibility.source.label, 'Hotel provider')
  const phrase = entryPhrase(eligibility.entryStep)
  let primary: string
  let details: string[] = []
  if (eligibility.state === 'supported') {
    primary = `${source} says the document can name ${addresseeCopy(eligibility.allowedAddresseeTypes)}${phrase ? ` ${phrase}` : ''}.`
    details = [...relationshipLines(eligibility), correctionLine(eligibility.correction, eligibility.entryStep)]
  } else if (eligibility.state === 'conditional') {
    primary = withTerminalPeriod(`The name allowed on the document depends on ${eligibility.condition}`)
    if (eligibility.allowedAddresseeTypes.length) details.push(`The supplied details allow ${addresseeCopy(eligibility.allowedAddresseeTypes)}.`)
    details.push(entryLine(eligibility.entryStep), ...relationshipLines(eligibility), correctionLine(eligibility.correction, eligibility.entryStep))
  } else if (eligibility.state === 'unsupported') {
    primary = `${source} says ${addresseeCopy(eligibility.unsupportedAddresseeTypes ?? [])} cannot be named for this ${scopeLabel(eligibility.source)}.`
  } else if (eligibility.state === 'conflicting') {
    primary = 'Supplied document-name details conflict.'
    details = [`expaify cannot determine which statement applies to this ${scopeLabel(eligibility.source)}.`]
  } else {
    primary = 'The provider did not say whose name can appear on the document.'
    details = relationshipLines(eligibility)
  }
  return (
    <div className={factRowClassName}>
      <dt className="text-xs font-medium leading-5 text-[color:var(--text-2)]">Name on document</dt>
      <dd className={factValueClassName}>
        <p>{primary}</p>
        {details.map(detail => <p key={detail} className="mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]">{detail}</p>)}
        {eligibility.state === 'conflicting' ? <ConflictStatements statements={eligibility.conflictStatements} /> : null}
        <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">{eligibilityProvenance(eligibility.source)}</p>
      </dd>
    </div>
  )
}

function targetLabel(target: HotelEligibilityVerificationTarget | undefined) {
  if (target?.role === 'booking_provider') return 'the booking provider'
  if (target?.role === 'property') return 'the property'
  return 'the document issuer'
}

function taxVerificationInstruction(eligibility: HotelTaxIdentifierEligibility) {
  const target = targetLabel(eligibility.verificationTarget)
  const identifier = eligibility.identifierLabel?.trim()
  if (eligibility.state === 'supported') return `Ask ${target} when to provide ${identifier ?? 'your required business or tax ID'} and whether it can be changed later.`
  return identifier
    ? `Ask ${target} whether it can add ${identifier} to the document before booking.`
    : `Ask ${target} whether it can add your required business or tax ID to the document before booking.`
}

function unknownRelationshipRoles(eligibility: HotelDocumentNameEligibility) {
  return (['guest', 'booker', 'cardholder'] as const).filter(role => eligibility.relationships[role] === 'not_provided')
}

function nameVerificationInstruction(eligibility: HotelDocumentNameEligibility) {
  const target = targetLabel(eligibility.verificationTarget)
  const unknown = unknownRelationshipRoles(eligibility)
  if (eligibility.state === 'supported' && eligibility.entryStep !== 'not_provided' && eligibility.correction.rule !== 'not_provided' && unknown.length) {
    const roles = unknown.length === 1 ? unknown[0] : unknown.length === 2 ? `${unknown[0]} or ${unknown[1]}` : 'guest, booker, or cardholder'
    return `Ask ${target} whether the document name may differ from the ${roles}.`
  }
  if (eligibility.state === 'supported') return `Ask ${target} when to provide the document name and whether it can be changed later.`
  const specifiedTypes = eligibility.unsupportedAddresseeTypes?.length
    ? eligibility.unsupportedAddresseeTypes
    : eligibility.state === 'conditional' && eligibility.allowedAddresseeTypes.length
      ? eligibility.allowedAddresseeTypes
      : undefined
  const types = specifiedTypes ? addresseeCopy(specifiedTypes) : undefined
  return types
    ? `Ask ${target} whether the document can use ${types.replace('a legal entity', 'a legal-entity')} name for this ${scopeLabel(eligibility.source)}.`
    : `Ask ${target} whether the document can use an individual or legal-entity name, and whether it may differ from the guest, booker, or cardholder.`
}

function needsEligibilityVerification(eligibility: HotelTaxIdentifierEligibility | HotelDocumentNameEligibility) {
  if (eligibility.state !== 'supported') return true
  if (eligibility.entryStep === 'not_provided' || eligibility.correction.rule === 'not_provided') return true
  return 'relationships' in eligibility && unknownRelationshipRoles(eligibility).length > 0
}

function EligibilityVerificationGuidance({ readiness, providerUrl, onVerificationClick }: Pick<ReadinessDisclosureProps, 'readiness' | 'providerUrl' | 'onVerificationClick'>) {
  const items = [
    needsEligibilityVerification(readiness.taxIdentifierEligibility) ? { key: 'tax', text: taxVerificationInstruction(readiness.taxIdentifierEligibility), target: readiness.taxIdentifierEligibility.verificationTarget } : undefined,
    needsEligibilityVerification(readiness.documentNameEligibility) ? { key: 'name', text: nameVerificationInstruction(readiness.documentNameEligibility), target: readiness.documentNameEligibility.verificationTarget } : undefined,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))
  if (!items.length) return null
  const distinctUrls = items.map(item => item.target?.url).filter((url): url is string => isSafeExternalUrl(url) && url !== providerUrl)
  const sharedUrl = items.length > 1 && distinctUrls.length === items.length && new Set(distinctUrls).size === 1 ? distinctUrls[0] : undefined
  const usesPrimary = items.some(item => item.target?.url === providerUrl)
  return (
    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
      <h4 className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Verify unanswered invoice details</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-2)]">
        {items.map(item => {
          const url = item.target?.url
          const linked = isSafeExternalUrl(url) && url !== providerUrl && !sharedUrl
          const destination = targetLabel(item.target)
          return <li key={item.key} className="break-words">{linked ? <a href={url} target="_blank" rel={isAffiliateUrl(url) ? 'noopener noreferrer sponsored' : 'noopener noreferrer'} aria-label={`${item.text} Opens ${destination} in a new tab.`} onClick={onVerificationClick} className="-my-2 inline-block min-h-11 py-2 underline underline-offset-2">{item.text}</a> : item.text}</li>
        })}
      </ul>
      {sharedUrl ? <a href={sharedUrl} target="_blank" rel={isAffiliateUrl(sharedUrl) ? 'noopener noreferrer sponsored' : 'noopener noreferrer'} aria-label={`Check these details with ${targetLabel(items[0].target)}. Opens ${targetLabel(items[0].target)} in a new tab.`} onClick={onVerificationClick} className="btn btn-outline mt-3 w-full text-center">Check these details with {targetLabel(items[0].target)}</a> : null}
      {distinctUrls.length > 0 ? <p className="mt-2 text-xs leading-5 text-[color:var(--text-3)]">Verification links open in a new tab.</p> : null}
      {usesPrimary ? <p className="mt-2 text-xs leading-5 text-[color:var(--text-3)]">The Continue button opens the same external booking flow where you can check these details.</p> : null}
    </div>
  )
}

function VerificationGuidance({
  readiness,
  partner,
  providerUrl,
  onVerificationClick,
}: Pick<ReadinessDisclosureProps, 'readiness' | 'partner' | 'providerUrl' | 'onVerificationClick'>) {
  const verificationUrl = readiness.verificationTarget?.url
  const hasSafeDistinctUrl = isSafeExternalUrl(verificationUrl) && verificationUrl !== providerUrl
  const usesPrimaryDestination = isSafeExternalUrl(verificationUrl) && verificationUrl === providerUrl
  const destination = readiness.verificationTarget?.role === 'property'
    ? 'the property’s site'
    : partner.named
      ? partner.label
      : 'the booking partner’s site'

  if (hasSafeDistinctUrl) {
    return (
      <div className="mt-3 border-t border-[color:var(--border)] pt-3">
        <a
          href={verificationUrl}
          target="_blank"
          rel={isAffiliateUrl(verificationUrl) ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
          aria-label={`Check invoice details with ${destination}. Opens ${destination} in a new tab.`}
          onClick={onVerificationClick}
          className="btn btn-outline w-full text-center"
        >
          Check invoice details with {destination}
        </a>
        <p className="mt-2 text-center text-xs leading-5 text-[color:var(--text-3)]">
          Opens {destination} in a new tab.
        </p>
      </div>
    )
  }

  const isNotProvided = readiness.status === 'not_provided'
  const heading = usesPrimaryDestination
    ? 'Check invoice details during booking'
    : isNotProvided && partner.named
      ? `Check with ${partner.label} before booking`
      : 'Check invoice details during booking'
  const support = usesPrimaryDestination
    ? 'The Continue button opens the same external booking flow where you can verify these details.'
    : isNotProvided
      ? 'Ask who issues the invoice or receipt, what billing details are needed, and when to provide them.'
      : 'The Continue button opens the external booking flow where you can verify these details.'

  return (
    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
      <p className="break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{heading}</p>
      <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{support}</p>
    </div>
  )
}

export function HotelDocumentIntentControl({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="mt-5 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium leading-6 text-[color:var(--text-1)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={event => onChange(event.currentTarget.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded-[calc(var(--radius-control)-0.5rem)] border-[color:var(--border-strong)] text-[color:var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand-soft)]"
        />
        <span className="min-w-0 break-words">I need an invoice or receipt for this stay</span>
      </label>
      <p className="ml-8 mt-1 text-xs leading-5 text-[color:var(--text-3)]">
        We’ll show what the provider supplied before you continue.
      </p>
    </div>
  )
}

export function HotelDocumentReadinessDisclosure({
  readiness,
  checkState,
  partner,
  providerUrl,
  retryAvailable = false,
  retryPending = false,
  onRetry,
  onVerificationClick,
  statusRegionRef,
  statusRegionFocusable = false,
}: ReadinessDisclosureProps) {
  const source = cleanLabel(readiness.source.label, 'Hotel provider')
  const hasInvoice = readiness.documentTypes.includes('invoice')
  const hasReceipt = readiness.documentTypes.includes('receipt')
  const invoiceIssuer = issuerLabel(readiness.issuerByDocument.invoice, partner)
  const receiptIssuer = issuerLabel(readiness.issuerByDocument.receipt, partner)
  const safeCondition = readiness.condition?.trim()
  const conditionIsValid = Boolean(safeCondition && safeCondition.length <= 160 && !/[.!?]$/.test(safeCondition))
  const effectiveStatus = readiness.status === 'conditional' && !conditionIsValid ? 'conflicting' : readiness.status
  const isLoading = checkState === 'loading'
  const isError = checkState === 'error'
  const showDocumentFacts = !isLoading && !isError && effectiveStatus !== 'not_provided'
  const showEligibilityFacts = !isLoading && !isError

  let lead = ''
  let support: string | undefined
  if (isLoading) {
    lead = 'Checking invoice and receipt information…'
    support = 'You can still continue to the booking partner while this check finishes.'
  } else if (isError) {
    lead = 'Invoice and receipt information could not be checked.'
    support = 'Document availability, business or tax ID support, and document-name eligibility remain unknown. You can retry or verify during booking.'
  } else if (effectiveStatus === 'not_provided') {
    lead = `${source} did not provide invoice or receipt information for this rate.`
    support = 'Availability, issuer, and billing-detail timing are unknown.'
  } else if (effectiveStatus === 'conflicting') {
    lead = 'Invoice information is unclear because the supplied details conflict.'
    support = 'expaify cannot determine which statement applies to this selected rate.'
  } else if (effectiveStatus === 'conditional') {
    lead = `Invoice availability depends on ${safeCondition}.`
  } else if (effectiveStatus === 'unavailable') {
    lead = `${source} states that an invoice is not available for this rate.`
  } else if (hasInvoice) {
    lead = `Invoice expected from ${invoiceIssuer}.`
  } else if (hasReceipt) {
    lead = `${sentenceStart(receiptIssuer)} provides a payment receipt; an invoice is not confirmed.`
  } else {
    lead = 'A booking confirmation is supplied; an invoice and receipt are not confirmed.'
  }

  const provenance = isLoading
    ? 'No document claim is shown while this check is pending. Confirm the required format and details with the issuer; expaify does not guarantee tax or employer acceptance.'
    : isError
      ? 'No document claim is shown because the check did not complete. Confirm the required format and details with the issuer; expaify does not guarantee tax or employer acceptance.'
      : undefined

  const readinessForDisplay = effectiveStatus === readiness.status
    ? readiness
    : { ...readiness, status: effectiveStatus }

  return (
    <section
      ref={statusRegionRef}
      aria-labelledby="hotel-document-readiness-title"
      aria-live={isLoading || isError ? 'polite' : undefined}
      role={isLoading ? 'status' : undefined}
      tabIndex={statusRegionFocusable ? -1 : undefined}
      className="mt-3 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3.5 py-4 sm:px-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">Before you book</p>
      <h3 id="hotel-document-readiness-title" className="mt-1 text-base font-medium leading-6 text-[color:var(--text-1)]">
        Invoice &amp; receipt
      </h3>
      <p className="mt-3 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{lead}</p>
      {support ? <p className="mt-2 break-words text-sm leading-6 text-[color:var(--text-2)]">{support}</p> : null}

      {showDocumentFacts || showEligibilityFacts ? (
        <dl className="mt-3 grid grid-cols-1 gap-2">
          {showDocumentFacts ? <>
            <div className={factRowClassName}>
              <dt className="text-xs font-medium leading-5 text-[color:var(--text-2)]">Invoice</dt>
              <dd className={factValueClassName}>{documentFact('invoice', readinessForDisplay, partner, source)}</dd>
            </div>
            <div className={factRowClassName}>
              <dt className="text-xs font-medium leading-5 text-[color:var(--text-2)]">Receipt</dt>
              <dd className={factValueClassName}>{documentFact('receipt', readinessForDisplay, partner, source)}</dd>
            </div>
            <div className={factRowClassName}>
              <dt className="text-xs font-medium leading-5 text-[color:var(--text-2)]">Billing details</dt>
              <dd className={factValueClassName}>{billingDetailsCopy(readinessForDisplay, partner)}</dd>
            </div>
          </> : null}
          {showEligibilityFacts ? <TaxEligibilityRow eligibility={readinessForDisplay.taxIdentifierEligibility} /> : null}
          {showEligibilityFacts ? <NameEligibilityRow eligibility={readinessForDisplay.documentNameEligibility} /> : null}
        </dl>
      ) : null}

      {!isLoading && !isError && effectiveStatus === 'conflicting' ? (
        <div className="mt-3">
          <p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Supplied statements</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-2)]">
            {(readiness.conflictStatements ?? []).map((statement, index) => (
              <li key={`${statement.sourceLabel}-${index}`} className="break-words">
                {cleanLabel(statement.sourceLabel, 'Hotel provider')}: {cleanLabel(statement.statement, 'Statement not provided')}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isError && retryAvailable && onRetry ? (
        <button
          type="button"
          disabled={retryPending}
          onClick={onRetry}
          className="btn btn-outline mt-3 w-full disabled:cursor-wait"
        >
          Try again
        </button>
      ) : null}

      {!isLoading && (isError || shouldShowVerification(readinessForDisplay)) ? (
        <VerificationGuidance
          readiness={readinessForDisplay}
          partner={partner}
          providerUrl={providerUrl}
          onVerificationClick={onVerificationClick}
        />
      ) : null}

      {!isLoading && !isError ? (
        <EligibilityVerificationGuidance readiness={readinessForDisplay} providerUrl={providerUrl} onVerificationClick={onVerificationClick} />
      ) : null}

      {isError ? (
        <div className="mt-3 border-t border-[color:var(--border)] pt-3">
          <h4 className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Verify unanswered invoice details</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-2)]">
            <li>Ask the document issuer whether it can add your required business or tax ID to the document before booking.</li>
            <li>Ask the document issuer whether the document can use an individual or legal-entity name, and whether it may differ from the guest, booker, or cardholder.</li>
          </ul>
        </div>
      ) : null}

      <div className="mt-3 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--text-3)]">
        {provenance ? (
          <p>{provenance}</p>
        ) : (
          <>
            <p>{readiness.scope === 'rate' ? 'This information applies to the selected rate.' : 'This information applies to the selected stay.'}</p>
            <p className="mt-1 break-words">
              Document availability and issuer are based on information from {source}. Business or tax ID and document-name details show only what each listed source supplied. Confirm the required format and details with the issuer; expaify does not guarantee that a document will include them or meet tax or employer requirements.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
