import type { ReactElement } from 'react'
import {
  getRateRestrictionsAccessibleSummary,
  HotelCardEligibilityLine,
  HotelRateRestrictionsSection,
  type RateEligibilityPresentation,
} from '../HotelRateRestrictions'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') return childrenOf(node as TestElement).map(collectText).join('')
  return ''
}

function collectElements(node: unknown): TestElement[] {
  if (node === null || node === undefined || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(collectElements)
  const element = node as TestElement
  return [element, ...childrenOf(element).flatMap(collectElements)]
}

describe('hotel rate restriction presentation', () => {
  it('renders current provider data as not provided with complete review guidance', () => {
    const line = HotelCardEligibilityLine({ eligibility: { state: 'not_provided' } })
    const section = HotelRateRestrictionsSection({
      eligibility: { state: 'not_provided' },
      providerName: 'Hotellook',
    })

    expect(collectText(line)).toBe('Restrictions not provided')
    expect(collectText(section)).toContain('Hotellook did not provide complete rate restrictions.')
    expect(collectText(section)).toContain('Check membership, residency, age, and refund terms before paying.')
    expect(collectText(section)).toContain('Source: Hotellook. Rate-detail freshness not available.')
    expect(collectText(section)).not.toContain('No reported rate restrictions')
  })

  it('keeps loading and error non-blocking and politely announced', () => {
    const loadingLine = HotelCardEligibilityLine({ eligibility: { state: 'loading' } })
    const loadingSection = HotelRateRestrictionsSection({ eligibility: { state: 'loading' }, providerName: 'Example Provider' })
    const errorSection = HotelRateRestrictionsSection({ eligibility: { state: 'error' }, providerName: 'Example Provider' })

    expect(collectText(loadingLine)).toBe('Checking rate restrictions…')
    expect(collectText(loadingSection)).toContain('Checking rate restrictions…')
    expect(collectText(errorSection)).toContain('Restrictions not provided')
    expect(collectText(errorSection)).toContain('Example Provider could not provide complete rate restrictions.')
    expect(collectText(errorSection)).toContain('Rate restrictions could not be checked.')
    for (const region of [loadingLine, loadingSection, errorSection]) {
      expect(region.props.role).toBe('status')
      expect(region.props['aria-live']).toBe('polite')
    }
  })

  it('supports restricted and explicit-clear presentation fixtures without inferring either', () => {
    const restricted: RateEligibilityPresentation = {
      state: 'restricted',
      conditions: [
        { family: 'refundability', label: 'Non-refundable' },
        { family: 'age', label: 'Ages 21+ only' },
        { family: 'residency', label: 'Residents of Spain only' },
      ],
      coverageIncomplete: true,
    }
    const restrictedLine = HotelCardEligibilityLine({ eligibility: restricted })
    const restrictedSection = HotelRateRestrictionsSection({ eligibility: restricted, providerName: 'Example Provider' })
    const clearSection = HotelRateRestrictionsSection({ eligibility: { state: 'clear' }, providerName: 'Example Provider' })

    expect(collectText(restrictedLine)).toBe('Restricted rate · 3 conditions')
    expect(collectText(restrictedSection)).toContain('Residents of Spain onlyAges 21+ onlyNon-refundable')
    expect(collectText(restrictedSection)).toContain('Other eligibility details not provided by Example Provider.')
    expect(String(restrictedSection.props.className)).toContain('border-[color:var(--border-strong)]')
    expect(collectText(clearSection)).toContain('No reported rate restrictions')
    expect(collectText(clearSection)).toContain('Example Provider reports no membership, residency, age, or non-refundable restriction for this rate.')
    expect(collectElements(clearSection).map(element => String(element.props.className)).join(' ')).not.toContain('var(--success)')
  })

  it('degrades malformed fixtures to not provided and de-duplicates repeated conditions', () => {
    const malformed = { state: 'restricted', conditions: [] } as RateEligibilityPresentation
    const duplicate: RateEligibilityPresentation = {
      state: 'restricted',
      conditions: [
        { family: 'refundability', label: 'Non-refundable' },
        { family: 'refundability', label: 'Non-refundable' },
      ],
    }

    expect(collectText(HotelCardEligibilityLine({ eligibility: malformed }))).toBe('Restrictions not provided')
    expect(collectText(HotelCardEligibilityLine({ eligibility: duplicate }))).toBe('Non-refundable')
    expect(getRateRestrictionsAccessibleSummary(malformed, '', 'card')).toBe(
      'Rate restrictions: Hotel provider did not provide complete rate restrictions.'
    )
  })

  it('provides exact card and provider-handoff accessible summaries without adding focus stops', () => {
    const notProvided: RateEligibilityPresentation = { state: 'not_provided' }
    const line = HotelCardEligibilityLine({ eligibility: notProvided })

    expect(getRateRestrictionsAccessibleSummary(notProvided, 'Hotellook', 'card')).toBe(
      'Rate restrictions: Hotellook did not provide complete rate restrictions.'
    )
    expect(getRateRestrictionsAccessibleSummary(notProvided, 'Hotellook', 'handoff')).toBe(
      "Hotellook did not provide complete rate restrictions. Check the partner's terms before paying."
    )
    expect(collectElements(line).some(element => element.type === 'button' || element.type === 'a')).toBe(false)
    expect(line.props.tabIndex).toBeUndefined()
  })
})
