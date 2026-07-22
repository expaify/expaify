import { renderToStaticMarkup } from 'react-dom/server'
import {
  getNotProvidedHotelDocumentReadiness,
  HotelDocumentIntentControl,
  HotelDocumentReadinessDisclosure,
  type HotelDocumentCheckState,
  type HotelDocumentReadiness,
} from '../HotelDocumentReadiness'

const partner = { label: 'Booking.com', named: true }
const providerUrl = 'https://www.booking.com/hotel/example?aid=affiliate-123'

const baseReadiness: HotelDocumentReadiness = {
  status: 'confirmed',
  scope: 'rate',
  documentTypes: ['invoice'],
  issuerByDocument: {
    invoice: { role: 'booking_provider', displayName: 'Booking.com' },
  },
  billingDetailsStep: 'during_partner_booking',
  source: { label: 'Supplier feed' },
}

function renderDisclosure(
  readiness: HotelDocumentReadiness,
  checkState: HotelDocumentCheckState = 'ready',
  extra: Partial<React.ComponentProps<typeof HotelDocumentReadinessDisclosure>> = {},
) {
  return renderToStaticMarkup(
    <HotelDocumentReadinessDisclosure
      readiness={readiness}
      checkState={checkState}
      partner={partner}
      providerUrl={providerUrl}
      {...extra}
    />,
  )
}

describe('HotelDocumentReadiness UI', () => {
  it('uses a native, labelled, 44px intent control without rendering sensitive inputs', () => {
    const html = renderToStaticMarkup(<HotelDocumentIntentControl checked={false} onChange={jest.fn()} />)

    expect(html).toContain('type="checkbox"')
    expect(html).toContain('min-h-11')
    expect(html).toContain('I need an invoice or receipt for this stay')
    expect(html).toContain('We’ll show what the provider supplied before you continue.')
    expect(html).not.toMatch(/company|tax ID|billing address|email/i)
  })

  it('maps the current Hotellook omission to not provided without an availability claim', () => {
    const readiness = getNotProvidedHotelDocumentReadiness('Hotellook')
    const html = renderDisclosure(readiness)

    expect(readiness).toEqual({
      status: 'not_provided',
      scope: 'rate',
      documentTypes: [],
      issuerByDocument: {},
      billingDetailsStep: 'unknown',
      source: { label: 'Hotellook' },
    })
    expect(html).toContain('Hotellook did not provide invoice or receipt information for this rate.')
    expect(html).toContain('Availability, issuer, and billing-detail timing are unknown.')
    expect(html).not.toContain('<dl')
    expect(html).not.toContain('not available')
  })

  it('renders confirmed invoice evidence with separate document and timing facts', () => {
    const html = renderDisclosure(baseReadiness)

    expect(html).toContain('Invoice expected from Booking.com.')
    expect(html).toContain('<dt')
    expect(html).toContain('Expected from Booking.com.')
    expect(html).toContain('Not confirmed for this selected rate.')
    expect(html).toContain('Add billing details on Booking.com’s site while booking.')
    expect(html).not.toContain('Check invoice details during booking')
  })

  it('keeps receipt-only evidence distinct from invoice evidence', () => {
    const html = renderDisclosure({
      ...baseReadiness,
      documentTypes: ['receipt'],
      issuerByDocument: { receipt: { role: 'property', displayName: 'The Example Hotel' } },
      billingDetailsStep: 'at_checkout',
    })

    expect(html).toContain('The Example Hotel provides a payment receipt; an invoice is not confirmed.')
    expect(html).toContain('Not confirmed for this selected rate.')
    expect(html).toContain('Payment receipt expected from The Example Hotel.')
    expect(html).toContain('Check invoice details during booking')
  })

  it.each([
    [
      'conditional',
      { ...baseReadiness, status: 'conditional', condition: 'billing details being supplied while booking' },
      'Invoice availability depends on billing details being supplied while booking.',
    ],
    [
      'unavailable',
      { ...baseReadiness, status: 'unavailable', documentTypes: [], issuerByDocument: {} },
      'Supplier feed states that an invoice is not available for this rate.',
    ],
    [
      'conflicting',
      {
        ...baseReadiness,
        status: 'conflicting',
        conflictStatements: [
          { sourceLabel: 'Rate terms', statement: 'Invoice supplied at checkout' },
          { sourceLabel: 'Partner policy', statement: 'Invoice process not stated' },
        ],
      },
      'Invoice information is unclear because the supplied details conflict.',
    ],
  ] as const)('renders the exact %s state lead and verification guidance', (_status, readiness, lead) => {
    const html = renderDisclosure(readiness as HotelDocumentReadiness)

    expect(html).toContain(lead)
    expect(html).toContain('Check invoice details during booking')
  })

  it('degrades an unsafe conditional value to conflicting instead of truncating it', () => {
    const html = renderDisclosure({ ...baseReadiness, status: 'conditional', condition: `${'x'.repeat(161)}` })

    expect(html).toContain('Invoice information is unclear because the supplied details conflict.')
    expect(html).not.toContain('Invoice availability depends on')
  })

  it('renders loading and check error without supplier claims or blocking Continue', () => {
    const loading = renderDisclosure(baseReadiness, 'loading')
    const error = renderDisclosure(baseReadiness, 'error', { retryAvailable: true, onRetry: jest.fn() })

    expect(loading).toContain('role="status"')
    expect(loading).toContain('Checking invoice and receipt information…')
    expect(loading).toContain('No document claim is shown while this check is pending.')
    expect(loading).not.toContain('<dl')
    expect(error).toContain('Invoice and receipt information could not be checked.')
    expect(error).toContain('Try again')
    expect(error).toContain('No document claim is shown because the check did not complete.')
    expect(error).not.toContain('role="alert"')
  })

  it('does not duplicate the primary affiliate destination when verification uses the same URL', () => {
    const html = renderDisclosure({
      ...baseReadiness,
      status: 'not_provided',
      documentTypes: [],
      issuerByDocument: {},
      verificationTarget: { role: 'booking_provider', url: providerUrl },
    })

    expect(html).toContain('The Continue button opens the same external booking flow where you can verify these details.')
    expect(html).not.toContain('<a')
    expect(html).not.toContain(providerUrl.replaceAll('&', '&amp;'))
  })

  it('preserves a distinct safe affiliate verification URL and exposes its new-tab destination', () => {
    const verificationUrl = 'https://tp.media/r?marker=invoice-marker&amp;u=hotel'
    const rawVerificationUrl = verificationUrl.replace('&amp;', '&')
    const html = renderDisclosure({
      ...baseReadiness,
      status: 'conditional',
      condition: 'the property approving the request',
      verificationTarget: { role: 'property', url: rawVerificationUrl },
    })

    expect(html).toContain(verificationUrl)
    expect(html).toContain('rel="noopener noreferrer sponsored"')
    expect(html).toContain('Opens the property’s site in a new tab.')
  })

  it('omits unsafe verification links and keeps long content wrap-safe in one column', () => {
    const html = renderDisclosure({
      ...baseReadiness,
      billingDetailsStep: 'unknown',
      source: { label: 'A'.repeat(180) },
      verificationTarget: { role: 'property', url: 'javascript:alert(1)' },
    })

    expect(html).not.toContain('<a')
    expect(html).toContain('grid-cols-1')
    expect(html).toContain('break-words')
    expect(html).not.toContain('javascript:')
  })
})
