import type { ReactElement } from 'react'
import HotelFundsPolicyPanel, {
  getHotelFundsPolicyAccessibleSuffix,
  type HotelFundsPolicyEvidence,
} from '../HotelFundsPolicyPanel'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: TestElement): unknown[] {
  const children = node.props.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): unknown {
  let current: unknown = node
  while (current && typeof current === 'object' && typeof (current as TestElement).type === 'function') {
    const element = current as TestElement
    current = (element.type as (props: Record<string, unknown>) => unknown)(element.props)
  }
  return current
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement)
    if (!resolved || typeof resolved !== 'object') return collectText(resolved)
    return childrenOf(resolved as TestElement).map(collectText).join('')
  }
  return ''
}

function findElements(node: unknown, predicate: (element: TestElement) => boolean): TestElement[] {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(child => findElements(child, predicate))
  const resolved = resolveFunctionElement(node as TestElement)
  if (!resolved || typeof resolved !== 'object') return []
  const element = resolved as TestElement
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap(child => findElements(child, predicate)),
  ]
}

const completeHold: HotelFundsPolicyEvidence = {
  state: 'complete',
  sourceLabel: 'Hotel partner',
  scope: 'property',
  fetchedAt: '2026-07-22T10:00:00Z',
  obligations: [{
    type: 'authorization_hold',
    amount: { kind: 'exact', money: { priceCents: 15000, currency: 'USD' } },
    basis: 'per_stay',
    applicationWording: 'At check-in',
    paymentMethodWording: 'Credit and debit cards',
    returnOrRelease: {
      action: 'release',
      providerWording: 'after checkout',
      issuerProcessingWording: 'Issuer processing times vary.',
    },
    sourceLabel: 'Hotel partner',
    scope: 'property',
  }],
}

function panel(evidence?: HotelFundsPolicyEvidence | null, loadState: 'loading' | 'ready' | 'error' = 'ready') {
  return HotelFundsPolicyPanel({
    evidence,
    loadState,
    surface: 'book_handoff',
    partnerLabel: 'Booking.com',
    confirmHref: 'https://booking.com/hotel?aid=123',
    hotelName: 'Example Hotel',
    sourceLabel: 'Hotellook',
    variant: 'full',
  })
}

describe('HotelFundsPolicyPanel', () => {
  it('renders a complete hold without folding it into the stay price or promising availability', () => {
    const tree = panel(completeHold)
    const text = collectText(tree)

    expect(text).toContain('Temporary card hold')
    expect(text).toContain('$150\u00a0USD per stay')
    expect(text).toContain('temporary authorization, not part of the stay price')
    expect(text).toContain('can reduce your available card balance')
    expect(text).toContain('The provider says the property releases the authorization after checkout.')
    expect(text).toContain("The provider's timing is not a guaranteed funds-availability date.")
    expect(text).toContain('Property-level policy')
    expect(text).toContain('Confirm this applies to your selected room and rate.')
    expect(findElements(tree, element => element.type === 'article')).toHaveLength(1)
  })

  it('renders collected-deposit and variable rules with the correct mechanism language', () => {
    const evidence: HotelFundsPolicyEvidence = {
      state: 'complete',
      sourceLabel: 'Booking.com',
      scope: 'selected_stay',
      obligations: [{
        type: 'refundable_deposit',
        amount: { kind: 'variable', providerWording: 'one night based on the booked rate' },
        basis: 'per_stay',
        applicationWording: 'At check-in',
        paymentMethodWording: 'Credit card',
        returnOrRelease: { action: 'refund', providerWording: 'after the room inspection' },
        sourceLabel: 'Booking.com',
        scope: 'selected_stay',
      }],
    }
    const text = collectText(panel(evidence))

    expect(text).toContain('Refundable deposit')
    expect(text).toContain('Amount varies — one night based on the booked rate')
    expect(text).toContain('collected separately from the stay price')
    expect(text).toContain('The provider says the property processes the refund after the room inspection.')
    expect(text).not.toContain('Confirm policy with Booking.com')
  })

  it('lists normalized missing facts while preserving partial returned evidence', () => {
    const evidence: HotelFundsPolicyEvidence = {
      state: 'partial',
      sourceLabel: 'Hotel partner',
      scope: 'rate',
      missingFields: ['amount', 'payment_method', 'return_or_release'],
      obligations: [{
        type: 'refundable_deposit',
        applicationWording: 'At arrival',
        sourceLabel: 'Hotel partner',
        scope: 'rate',
      }],
    }
    const text = collectText(panel(evidence))

    expect(text).toContain('policy is incomplete')
    expect(text).toContain('When the deposit is collectedAt arrival')
    expect(text).toContain('the amount or calculation rule, which payment methods it applies to, and the refund or authorization-release conditions')
    expect(text).not.toContain('AmountAmount not provided')
  })

  it('distinguishes explicit none from absent evidence and defaults Hotellook to not returned', () => {
    const explicitNone: HotelFundsPolicyEvidence = {
      state: 'explicit_none',
      sourceLabel: 'Hotel partner',
      scope: 'room',
      obligations: [],
    }

    expect(collectText(panel(explicitNone))).toContain('No deposit or hold reported')
    expect(collectText(panel(explicitNone))).toContain('no deposit or incidental hold for this room')

    const missingText = collectText(panel(undefined))
    expect(missingText).toContain('Policy not provided')
    expect(missingText).toContain('additional available funds before booking')
    expect(missingText).toContain('Source checked: Hotellook · Scope not provided')
    expect(missingText).not.toContain('No deposit or hold reported')
  })

  it('shows every conflicting record with its own source and scope', () => {
    const evidence: HotelFundsPolicyEvidence = {
      state: 'conflicting',
      sourceLabel: 'Hotel partner',
      scope: 'rate',
      obligations: [],
      conflictingRecords: [
        { type: 'authorization_hold', amount: { kind: 'exact', money: { priceCents: 10000, currency: 'USD' } }, sourceLabel: 'Property policy', scope: 'property' },
        { type: 'refundable_deposit', amount: { kind: 'range', min: { priceCents: 20000, currency: 'USD' }, max: { priceCents: 30000, currency: 'USD' } }, sourceLabel: 'Rate policy', scope: 'rate' },
      ],
    }
    const text = collectText(panel(evidence))

    expect(text).toContain('Policy details conflict')
    expect(text).toContain('Provider detail 1')
    expect(text).toContain('Provider detail 2')
    expect(text).toContain('Source: Property policy · Property-level policy')
    expect(text).toContain('Source: Rate policy · Rate-level policy')
  })

  it('uses polite, stable loading and non-blocking error states', () => {
    const loading = panel(null, 'loading')
    const loadingSection = findElements(loading, element => element.type === 'section')[0]
    expect(collectText(loading)).toContain('Checking deposit and hold policy…')
    expect(loadingSection.props.role).toBe('status')
    expect(loadingSection.props['aria-live']).toBe('polite')
    expect(loadingSection.props['aria-busy']).toBe('true')
    expect(findElements(loading, element => String(element.props.className).includes('skeleton'))).toHaveLength(3)

    const error = panel(null, 'error')
    expect(collectText(error)).toContain('Policy check unavailable')
    expect(collectText(error)).toContain('Confirm with the property or booking partner before booking.')
    expect(collectText(error)).not.toContain('Retry policy check')
  })

  it('places the confirmation action inside uncertain handoff states with a complete accessible name', () => {
    const tree = panel(undefined)
    const link = findElements(tree, element => element.type === 'a')[0]
    expect(collectText(link)).toBe('Confirm policy with Booking.com')
    expect(link.props.rel).toBe('noopener noreferrer sponsored')
    expect(link.props.className).toContain('min-h-11')
    expect(link.props['aria-label']).toBe('Confirm policy with Booking.com for Example Hotel. Opens Booking.com in a new tab. Deposit or hold details may still require confirmation with the property.')
  })

  it('provides state-only action suffixes, including loading and provider error', () => {
    expect(getHotelFundsPolicyAccessibleSuffix(completeHold)).toBe('Additional-funds policy reported; review details before provider handoff.')
    expect(getHotelFundsPolicyAccessibleSuffix(undefined)).toBe('Deposit and hold policy was not provided.')
    expect(getHotelFundsPolicyAccessibleSuffix(undefined, 'loading')).toContain('still being checked')
    expect(getHotelFundsPolicyAccessibleSuffix(undefined, 'error')).toBe('Deposit and hold policy could not be checked.')
  })
})
