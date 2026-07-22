import type {
  HotelDocumentCheckState,
  HotelDocumentIssuer,
  HotelDocumentReadiness,
} from '@/lib/types'
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
}

export function getNotProvidedHotelDocumentReadiness(sourceLabel: string): HotelDocumentReadiness {
  return notProvidedHotelDocumentReadiness(sourceLabel)
}

const factRowClassName = 'rounded-lg bg-[color:var(--bg-muted)] px-3 py-2.5'
const factValueClassName = 'mt-0.5 break-words text-sm leading-5 text-[color:var(--text-1)]'

function cleanLabel(value: string | undefined, fallback: string) {
  const cleaned = value?.trim()
  return cleaned || fallback
}

function sentenceStart(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
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
          className="btn-secondary inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-center text-sm font-medium"
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
      <p className="break-words text-sm font-semibold leading-6 text-[color:var(--text-1)]">{heading}</p>
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
    <div className="mt-5 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-[color:var(--text-1)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={event => onChange(event.currentTarget.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-[color:var(--border-strong)] text-[color:var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand-soft)]"
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
  const showFacts = !isLoading && !isError && effectiveStatus !== 'not_provided'

  let lead = ''
  let support: string | undefined
  if (isLoading) {
    lead = 'Checking invoice and receipt information…'
    support = 'You can still continue to the booking partner while this check finishes.'
  } else if (isError) {
    lead = 'Invoice and receipt information could not be checked.'
    support = 'Availability and issuer remain unknown. You can retry or verify during booking.'
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
    ? 'No document claim is shown while this check is pending. Confirm the required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.'
    : isError
      ? 'No document claim is shown because the check did not complete. Confirm the required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.'
      : undefined

  const readinessForDisplay = effectiveStatus === readiness.status
    ? readiness
    : { ...readiness, status: effectiveStatus }

  return (
    <section
      aria-labelledby="hotel-document-readiness-title"
      aria-live={isLoading || isError ? 'polite' : undefined}
      role={isLoading ? 'status' : undefined}
      className="mt-3 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3.5 py-4 sm:px-4"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--brand)]">Before you book</p>
      <h3 id="hotel-document-readiness-title" className="mt-1 text-base font-bold leading-6 text-[color:var(--text-1)]">
        Invoice &amp; receipt
      </h3>
      <p className="mt-3 break-words text-sm font-bold leading-6 text-[color:var(--text-1)]">{lead}</p>
      {support ? <p className="mt-2 break-words text-sm leading-6 text-[color:var(--text-2)]">{support}</p> : null}

      {showFacts ? (
        <dl className="mt-3 grid grid-cols-1 gap-2">
          <div className={factRowClassName}>
            <dt className="text-xs font-bold leading-5 text-[color:var(--text-2)]">Invoice</dt>
            <dd className={factValueClassName}>{documentFact('invoice', readinessForDisplay, partner, source)}</dd>
          </div>
          <div className={factRowClassName}>
            <dt className="text-xs font-bold leading-5 text-[color:var(--text-2)]">Receipt</dt>
            <dd className={factValueClassName}>{documentFact('receipt', readinessForDisplay, partner, source)}</dd>
          </div>
          <div className={factRowClassName}>
            <dt className="text-xs font-bold leading-5 text-[color:var(--text-2)]">Billing details</dt>
            <dd className={factValueClassName}>{billingDetailsCopy(readinessForDisplay, partner)}</dd>
          </div>
        </dl>
      ) : null}

      {!isLoading && !isError && effectiveStatus === 'conflicting' ? (
        <div className="mt-3">
          <p className="text-sm font-semibold leading-6 text-[color:var(--text-1)]">Supplied statements</p>
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
          className="btn-secondary mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium disabled:cursor-wait disabled:opacity-60"
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

      <div className="mt-3 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--text-3)]">
        {provenance ? (
          <p>{provenance}</p>
        ) : (
          <>
            <p>{readiness.scope === 'rate' ? 'This information applies to the selected rate.' : 'This information applies to the selected stay.'}</p>
            <p className="mt-1 break-words">
              Document availability and issuer are based on information from {source}. Confirm the required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
