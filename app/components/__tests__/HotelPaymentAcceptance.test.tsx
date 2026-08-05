import type { ReactElement } from 'react'
import {
  HotelPaymentAcceptanceSection,
  type HotelPaymentAcceptancePresentation,
} from '../HotelPaymentAcceptance'
import { deriveHotelPaymentAcceptancePresentation } from '@/lib/hotels/paymentAcceptance'

function allNotConfirmed(providerName: string): HotelPaymentAcceptancePresentation {
  return deriveHotelPaymentAcceptancePresentation({
    propertyId: 'hotel-1',
    supplier: 'hotellook',
    providerName,
    evidence: undefined,
    capability: undefined,
  })
}

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

function section(presentation: HotelPaymentAcceptancePresentation) {
  return HotelPaymentAcceptanceSection({ presentation })
}

describe('HotelPaymentAcceptanceSection', () => {
  it('renders all six facts as not_confirmed under todays universal zero-supply state', () => {
    const presentation = allNotConfirmed('Hotellook')
    const text = collectText(section(presentation))

    expect(text).toContain('Payment accepted at the property')
    expect(text).toContain('Hotellook has not confirmed payment acceptance at the property for this stay.')
    expect(text).toContain('Hotellook has not confirmed whether this property requires a credit card at check-in.')
    expect(text).toContain('Hotellook has not confirmed whether credit cards are accepted at this property.')
    expect(text).toContain('Hotellook has not confirmed whether debit cards are accepted at this property.')
    expect(text).toContain('Hotellook has not confirmed whether prepaid cards are accepted at this property.')
    expect(text).toContain('Hotellook has not confirmed whether cash is accepted at this property.')
    expect(text).toContain('Hotellook has not confirmed whether the property accepts the same payment methods you used to book.')
    expect(text).toContain('This does not cover the deposit or incidental hold amount — see Deposits and card holds above.')
    // Zero supply must not read as a warning — see docs/pipeline/hotel-payment-method/01-discovery.md §5.
    expect(text).not.toContain('Bring a credit card.')
  })

  it('falls back to a generic provider name when none is available', () => {
    const presentation = allNotConfirmed('')
    const text = collectText(section(presentation))
    expect(text).toContain('The booking provider has not confirmed')
  })

  it('never asserts acceptance language in any not_confirmed row', () => {
    const presentation = allNotConfirmed('Hotelbeds')
    const text = collectText(section(presentation))
    expect(text).not.toMatch(/\bguaranteed\b/i)
    expect(text).not.toMatch(/\bsafe\b/i)
    expect(text).not.toMatch(/\bshould work\b/i)
  })

  it('renders the always-bring-a-credit-card warning and warning tone when card is required', () => {
    const presentation: HotelPaymentAcceptancePresentation = {
      state: 'ready',
      statusLine: 'Example Hotels confirmed some payment-acceptance facts for this property. Facts marked “not confirmed” below still need to be checked with the property.',
      cardRequiredWarning: true,
      rows: [
        { id: 'card_required_at_property', label: 'Credit card required at the property', tone: 'confirmed_positive', sentence: 'Example Hotels says this property requires a credit card at check-in.' },
        { id: 'credit_card', label: 'Credit cards', tone: 'confirmed_positive', sentence: 'Example Hotels says credit cards are accepted at this property.' },
        { id: 'debit_card', label: 'Debit cards', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether debit cards are accepted at this property.' },
        { id: 'prepaid_card', label: 'Prepaid cards', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether prepaid cards are accepted at this property.' },
        { id: 'cash', label: 'Cash', tone: 'confirmed_negative', sentence: 'Example Hotels says cash is not accepted at this property.' },
        { id: 'booking_gate_divergence', label: 'Same as what you needed to book?', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether the property accepts the same payment methods you used to book.' },
      ],
      provenance: 'Source: Example Hotels · Property-level policy · Checked Jul 22, 2026',
    }
    const tree = section(presentation)
    const text = collectText(tree)

    expect(text).toContain('Bring a credit card. Properties that require one at check-in will refuse a debit or prepaid card')
    const sections = findElements(tree, element => element.type === 'section')
    expect(sections).toHaveLength(1)
    expect(String(sections[0].props.className)).toContain('warning-soft')
  })

  it('gives a conflicting row its own warning box while leaving other rows unaffected', () => {
    const presentation: HotelPaymentAcceptancePresentation = {
      state: 'ready',
      statusLine: 'Providers disagree on one fact for this property.',
      cardRequiredWarning: false,
      rows: [
        { id: 'card_required_at_property', label: 'Credit card required at the property', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether this property requires a credit card at check-in.' },
        { id: 'credit_card', label: 'Credit cards', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether credit cards are accepted at this property.' },
        { id: 'debit_card', label: 'Debit cards', tone: 'conflicting', sentence: 'Providers disagree on this. Hotellook says accepted; Hotelbeds says not accepted. expaify cannot determine which applies — confirm with the property before you travel.' },
        { id: 'prepaid_card', label: 'Prepaid cards', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether prepaid cards are accepted at this property.' },
        { id: 'cash', label: 'Cash', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether cash is accepted at this property.' },
        { id: 'booking_gate_divergence', label: 'Same as what you needed to book?', tone: 'not_confirmed', sentence: 'Example Hotels has not confirmed whether the property accepts the same payment methods you used to book.' },
      ],
      provenance: 'Source: Example Hotels · Property-level policy',
    }
    const tree = section(presentation)
    const text = collectText(tree)

    expect(text).toContain('Providers disagree on this. Hotellook says accepted; Hotelbeds says not accepted.')
    const sections = findElements(tree, element => element.type === 'section')
    expect(String(sections[0].props.className)).toContain('warning-soft')
  })

  it('uses polite, non-blocking loading and error states', () => {
    const loadingTree = section({ state: 'loading' })
    expect(collectText(loadingTree)).toContain('Checking payment acceptance…')
    expect(findElements(loadingTree, el => el.type === 'section')[0].props.role).toBe('status')
    expect(findElements(loadingTree, el => el.type === 'section')[0].props['aria-busy']).toBe('true')

    const errorTree = section({ state: 'error' })
    expect(collectText(errorTree)).toContain('Payment acceptance could not be checked.')
    expect(collectText(errorTree)).toContain('Confirm accepted payment methods with the property or booking partner before you travel.')
    expect(findElements(errorTree, el => el.type === 'section')[0].props.role).toBe('status')
    expect(findElements(errorTree, el => el.type === 'section')[0].props['aria-busy']).toBeUndefined()
  })

  it('never mentions accepted/accepts inside a not_confirmed row sentence in a way that asserts acceptance', () => {
    const presentation = allNotConfirmed('Booking.com')
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    for (const row of presentation.rows) {
      expect(row.tone).toBe('not_confirmed')
      expect(row.sentence).toMatch(/has not confirmed/)
    }
  })
})
