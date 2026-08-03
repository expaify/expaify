import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import GuestReviewEvidence, { getGuestReviewScanLine } from '../GuestReviewEvidence'
import { DealCard } from '../ui/DealCard'
import type { HotelReviewEvidence } from '@/lib/types'

function text(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join('')
  const element = node as ReactElement<{ children?: ReactNode }>
  if (typeof element.type === 'function') {
    return text((element.type as (props: { children?: ReactNode }) => ReactNode)(element.props))
  }
  return text(element.props.children)
}

const completeAggregate: HotelReviewEvidence = {
  schemaVersion: 1,
  state: 'ready',
  providerPropertyId: 'hotel-1',
  providerId: 'fixture-provider',
  provenance: 'verified_guest',
  score: { value: 8.7, scaleMax: 10 },
  sourceLabel: 'Fixture Guest Reviews',
  overallReviewCount: 1_248,
  coverage: { kind: 'provider_declared_aggregate', startMonth: '2025-03', endMonth: '2026-03' },
  contextCue: {
    licensedForDisplay: true,
    travelerSegment: 'family',
    topic: 'quiet_rooms',
    pattern: 'quiet rooms',
    sourceLabel: 'Fixture Guest Reviews',
    scope: 'returned_sample',
    windowStartMonth: '2026-01',
    windowEndMonth: '2026-03',
    supportingReviewCount: 42,
  },
  ratingObservedAt: '2026-07-31T12:00:00.000Z',
}

describe('GuestReviewEvidence', () => {
  it('shows the honest unavailable state without separate empty fact rows', () => {
    const rendered = text(GuestReviewEvidence({}))
    expect(rendered).toContain('Guest score not provided by this provider.')
    expect(rendered).toContain('Review count and review dates are not available.')
    expect(rendered).not.toContain('Overall review count')
  })

  it('keeps aggregate coverage, observation time, and cue support distinct', () => {
    const rendered = text(GuestReviewEvidence({ evidence: completeAggregate, expectedProviderId: 'fixture-provider', expectedPropertyId: 'hotel-1' }))
    expect(rendered).toContain('8.7/10 guest score from Fixture Guest Reviews.')
    expect(rendered).toContain('1,248 reviews')
    expect(rendered).toContain('Guest score includes reviews through March 2026.')
    expect(rendered).toContain('Rating data checked July 31, 2026.')
    expect(rendered).toContain('Based on 42 reviews from January 2026–March 2026')
  })

  it('labels a returned date as sample-only', () => {
    const evidence: HotelReviewEvidence = { ...completeAggregate, contextCue: undefined, coverage: { kind: 'returned_sample', latestStayMonth: '2026-02', sampleSize: 20 } }
    const rendered = text(GuestReviewEvidence({ evidence }))
    expect(rendered).toContain('Most recent review returned: February 2026.')
    expect(rendered).toContain('returned review sample, not the full guest score')
    expect(rendered).not.toContain('includes reviews through')
  })

  it('rejects mismatches and malformed counts atomically', () => {
    expect(text(GuestReviewEvidence({ evidence: completeAggregate, expectedPropertyId: 'hotel-2' }))).toContain('returned rating details could not be verified')
    expect(text(GuestReviewEvidence({ evidence: { ...completeAggregate, overallReviewCount: 0 } }))).not.toContain('8.7/10')
  })

  it('only exposes a DealCard scan line for verified guest evidence', () => {
    expect(getGuestReviewScanLine(completeAggregate)).toEqual({ visible: '8.7/10 guest score · 1,248 reviews', accessible: 'Guest score: 8.7 out of 10, based on 1,248 reviews' })
    expect(getGuestReviewScanLine({ ...completeAggregate, provenance: 'provider_only' })).toBeNull()
    expect(getGuestReviewScanLine({ ...completeAggregate, state: 'error' })).toBeNull()

    const card = renderToStaticMarkup(<DealCard deal={{
      id: 'hotel-1', hotelName: 'Fixture Hotel', city: 'London', stars: 4,
      dealPrice: { priceCents: 18_000, currency: 'USD' },
      medianPrice: { priceCents: 22_000, currency: 'USD' }, discountPct: 18,
      checkInWindow: 'Aug 10–12', snapshotCount: 22, links: {},
      reviewEvidence: completeAggregate,
    }} href="/deals/hotel-1" />)
    expect(card).toContain('8.7/10 guest score · 1,248 reviews')
    expect(card).toContain('Guest score: 8.7 out of 10, based on 1,248 reviews')
    expect(card).toContain('4-star hotel class')
  })

  it.each([
    ['loading', 'Checking guest review evidence…'],
    ['error', 'Guest review evidence could not be checked.'],
    ['invalid', 'The returned rating details could not be verified'],
    ['stale', 'The saved rating details are too old to verify'],
  ] as const)('renders the %s state', (state, copy) => {
    expect(text(GuestReviewEvidence({ evidence: { ...completeAggregate, state } }))).toContain(copy)
  })
})
