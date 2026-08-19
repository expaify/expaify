import type { ReactElement } from 'react'
import { DealDetailProviderHandoff } from '../DealDetailProviderHandoff'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return []
  const children = (node as TestElement).props?.children
  return Array.isArray(children) ? children : [children].filter(child => child !== null && child !== undefined)
}

function findAnchor(node: unknown, label: string): TestElement | undefined {
  if (!node || typeof node !== 'object') return undefined
  const element = node as TestElement
  if (element.type === 'a' && childrenOf(element).join('') === label) return element
  for (const child of childrenOf(element)) {
    const match = findAnchor(child, label)
    if (match) return match
  }
  return undefined
}

describe('DealDetailProviderHandoff', () => {
  it('uses the unattributed Booking.com search only when no attributed provider is eligible', () => {
    const bookingSearchUrl = 'https://www.booking.com/searchresults.html?ss=Hotel+Paris&checkin=2026-08-01&checkout=2026-08-03'
    const tree = DealDetailProviderHandoff({
      dealId: 'deal-1',
      city: 'Paris',
      links: { bookingSearchUrl },
      backHref: '/deals',
      expired: false,
    })
    const fallback = findAnchor(tree, 'Search on Booking.com')

    expect(fallback?.props.href).toBe(bookingSearchUrl)
    expect(fallback?.props.target).toBe('_blank')
    expect(fallback?.props.rel).toBe('noopener noreferrer')
    expect(findAnchor(tree, 'Get free alerts for Paris')).toBeDefined()
  })

  it('keeps an eligible attributed provider as the primary action', () => {
    const tree = DealDetailProviderHandoff({
      dealId: 'deal-1',
      city: 'Paris',
      links: {
        booking: 'https://www.booking.com/hotel/example.html?aid=123',
        bookingSearchUrl: 'https://www.booking.com/searchresults.html?ss=Hotel+Paris',
      },
      backHref: '/deals',
      expired: false,
    })

    expect(findAnchor(tree, 'View deal on Booking.com')).toBeDefined()
    expect(findAnchor(tree, 'Search on Booking.com')).toBeUndefined()
  })
})
