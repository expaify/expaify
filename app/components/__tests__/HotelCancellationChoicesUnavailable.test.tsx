import type { ReactElement } from 'react'
import {
  HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_BODY,
  HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_HEADING,
  default as HotelCancellationChoicesUnavailable,
} from '../HotelCancellationChoicesUnavailable'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: TestElement): unknown[] {
  const children = node.props.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') return childrenOf(node as TestElement).map(collectText).join('')
  return ''
}

describe('HotelCancellationChoicesUnavailable', () => {
  it('renders the exact static honest-absence copy without live-region or interaction semantics', () => {
    const panel = HotelCancellationChoicesUnavailable() as TestElement
    const text = collectText(panel)

    expect(text).toBe(
      `${HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_HEADING}${HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_BODY}`,
    )
    expect(panel.props['data-hotel-cancellation-availability']).toBe('unsupported')
    expect(panel.props.role).toBeUndefined()
    expect(panel.props['aria-live']).toBeUndefined()
    expect(String(panel.props.className)).toContain('min-w-0')
    expect(String(panel.props.className)).toContain('w-full')
    expect(String(panel.props.className)).toContain('bg-[color:var(--warning-soft)]')
    expect((childrenOf(panel)[0] as TestElement).type).toBe('h3')
    expect(text).not.toMatch(/\$\d|more for cancellation flexibility/i)
  })

  it('is placed only on the saved detail, expanded hotel detail, and immediately before handoff continuation', () => {
    const fs = jest.requireActual('node:fs') as typeof import('node:fs')
    const savedDetail = fs.readFileSync('app/deals/[dealId]/page.tsx', 'utf8')
    const hotelCard = fs.readFileSync('app/components/HotelCard.tsx', 'utf8')
    const bookingFlow = fs.readFileSync('app/book/BookingFlow.tsx', 'utf8')
    const dealCard = fs.readFileSync('app/components/ui/DealCard.tsx', 'utf8')

    const savedPriceIndex = savedDetail.indexOf('<section aria-labelledby="saved-price-score-title"')
    const savedPanelIndex = savedDetail.indexOf('<HotelCancellationChoicesUnavailable headingLevel="h2" />')
    const savedProviderIndex = savedDetail.indexOf('<section aria-labelledby="saved-provider-title"')
    expect(savedPriceIndex).toBeLessThan(savedPanelIndex)
    expect(savedPanelIndex).toBeLessThan(savedProviderIndex)

    const expandedIndex = hotelCard.indexOf('{isExpanded && (')
    const expandedPanelIndex = hotelCard.indexOf('<HotelCancellationChoicesUnavailable headingLevel="h4" />')
    const expandedProviderIndex = hotelCard.indexOf('<p className="font-medium text-[color:var(--text-1)]">Provider handoff</p>')
    expect(expandedIndex).toBeLessThan(expandedPanelIndex)
    expect(expandedPanelIndex).toBeLessThan(expandedProviderIndex)

    const handoffPanelIndex = bookingFlow.indexOf('<HotelCancellationChoicesUnavailable />')
    const continueActionIndex = bookingFlow.indexOf('href={hotelContext.providerUrl}', handoffPanelIndex)
    expect(handoffPanelIndex).toBeGreaterThan(bookingFlow.indexOf('<section aria-labelledby="hotel-provider-title"'))
    expect(handoffPanelIndex).toBeLessThan(continueActionIndex)

    expect(dealCard).not.toContain('HotelCancellationChoicesUnavailable')
  })
})
