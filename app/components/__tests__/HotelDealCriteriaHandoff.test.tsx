import type { ReactElement } from 'react'
import { HotelDealCriteriaHandoff } from '../HotelDealCriteria'
import type { HotelCriteriaContextStatus, HotelSearchCriteriaV1 } from '@/lib/hotels/searchCriteria'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return []
  const children = (node as TestElement).props?.children
  return Array.isArray(children) ? children : [children].filter((child) => child !== null && child !== undefined)
}

function textContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node || typeof node !== 'object') return ''
  return childrenOf(node).map(textContent).join('')
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
  it('shows the choose-dates sentence when the saved deal has incomplete dates, even with matched search criteria', () => {
    const tree = HotelDealCriteriaHandoff({
      context: context(matchedCriteria, 'matched'),
      deal,
      links,
      datesIncomplete: true,
    })

    expect(textContent(tree)).toContain('Choose or confirm your dates there before comparing room options.')
  })

  it('omits the choose-dates sentence when the saved deal has complete dates and matched search criteria', () => {
    const tree = HotelDealCriteriaHandoff({
      context: context(matchedCriteria, 'matched'),
      deal,
      links,
      datesIncomplete: false,
    })

    expect(textContent(tree)).not.toContain('Choose or confirm your dates there before comparing room options.')
  })

  it('shows the choose-dates sentence when there is no search criteria context at all', () => {
    const tree = HotelDealCriteriaHandoff({
      context: context(undefined, 'missing'),
      deal,
      links,
    })

    expect(textContent(tree)).toContain('Choose or confirm your dates there before comparing room options.')
  })
})
