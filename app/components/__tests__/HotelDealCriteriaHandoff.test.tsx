import type { ReactElement } from 'react'
import { HotelDealCriteriaHandoff } from '../HotelDealCriteria'
import type { HotelCriteriaContextStatus, HotelSearchCriteriaV1 } from '@/lib/hotels/searchCriteria'

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useEffect: jest.fn(),
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useRef: jest.fn((initialValue: unknown) => ({ current: initialValue })),
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  }
})

function childrenOf(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return []
  const children = (node as TestElement).props?.children
  return Array.isArray(children) ? children : [children].filter((child) => child !== null && child !== undefined)
}

function textContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node || typeof node !== 'object') return ''
  if (Array.isArray(node)) return node.map(textContent).join('')
  const element = node as TestElement
  if (typeof element.type === 'function') {
    return textContent((element.type as (props: Record<string, unknown>) => unknown)(element.props))
  }
  return childrenOf(element).map(textContent).join('')
}

function findAnchor(node: unknown, label: string): TestElement | undefined {
  if (!node || typeof node !== 'object') return undefined
  const element = node as TestElement
  if (element.type === 'a' && textContent(element) === label) return element
  for (const child of childrenOf(element)) {
    const match = findAnchor(child, label)
    if (match) return match
  }
  return undefined
}

const links = { expedia: 'https://www.expedia.com/hotel?affcid=marker' }

const matchedCriteria: HotelSearchCriteriaV1 = {
  schemaVersion: 1,
  criteriaVersion: 'v-12345678',
  destination: { state: 'selected', city: 'Paris' },
  dates: { semantic: 'checkin_window', dateFrom: '2026-08-01', dateTo: '2026-08-03' },
  occupancy: { state: 'not_captured' },
  source: 'deals_page',
}

function context(criteria?: HotelSearchCriteriaV1, status: HotelCriteriaContextStatus = 'missing') {
  return { criteria, status, backHref: '/deals' }
}

const deal = { id: 'deal-1', city: 'Paris', checkInDate: '2026-08-01' }

describe('HotelDealCriteriaHandoff saved-deal date boundary copy', () => {
  it('shows the confirm-dates boundary when the saved deal has incomplete dates, even with matched search criteria', () => {
    const tree = HotelDealCriteriaHandoff({
      context: context(matchedCriteria, 'matched'),
      deal,
      links,
      datesIncomplete: true,
    })

    expect(textContent(tree)).toContain('Stay dates: confirm with provider')
  })

  it('keeps the confirm-dates boundary when display dates are absent', () => {
    const tree = HotelDealCriteriaHandoff({
      context: context(matchedCriteria, 'matched'),
      deal,
      links,
      datesIncomplete: false,
    })

    expect(textContent(tree)).toContain('Stay dates: confirm with provider')
  })

  it('shows the confirm-dates boundary when there is no search criteria context at all', () => {
    const tree = HotelDealCriteriaHandoff({
      context: context(undefined, 'missing'),
      deal,
      links,
    })

    expect(textContent(tree)).toContain('Stay dates: confirm with provider')
  })

  it('uses the Booking.com search fallback when no attributed provider link is eligible', () => {
    const bookingSearchUrl = 'https://www.booking.com/searchresults.html?ss=Hotel+Paris&checkin=2026-08-01&checkout=2026-08-03'
    const tree = HotelDealCriteriaHandoff({
      context: context(matchedCriteria, 'matched'),
      deal,
      links: { bookingSearchUrl },
    })
    const html = textContent(tree)
    const fallback = findAnchor(tree, 'Search on Booking.com')

    expect(html).toContain('Search on Booking.com')
    expect(html).not.toContain('Provider link unavailable')
    expect(fallback?.props.href).toBe(bookingSearchUrl)
    expect(fallback?.props.target).toBe('_blank')
    expect(fallback?.props.rel).toBe('noopener noreferrer')
  })
})
