import { DealCard } from '../ui/DealCard'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DepositHoldSetDisclosure,
  deriveHotelFundsSetPresentation,
  getHotelFundsCardSignal,
} from '../HotelFundsPolicyComparison'
import {
  hotelFundsPolicyFixtures as fixtures,
  offer,
  policies,
} from '../__fixtures__/hotelFundsPolicyComparison'

describe('hotel deposit and hold comparison presentation', () => {
  it('covers all-unsupported, mixed, all-capable, and capable-unknown result sets', () => {
    expect(deriveHotelFundsSetPresentation(fixtures.allUnsupported20)).toMatchObject({
      capabilityState: 'none', visibleBookableCount: 20, supportedOfferCount: 0,
    })
    expect(deriveHotelFundsSetPresentation(fixtures.mixed)).toMatchObject({
      capabilityState: 'mixed', visibleBookableCount: 4, supportedOfferCount: 3,
      completeCount: 1, explicitNoneCount: 1, notReturnedCount: 1,
    })
    expect(deriveHotelFundsSetPresentation(fixtures.allCapableReturned)).toMatchObject({
      capabilityState: 'all', supportedOfferCount: 4,
      completeCount: 1, partialCount: 1, conflictingCount: 1, explicitNoneCount: 1,
    })
    expect(deriveHotelFundsSetPresentation(fixtures.allCapableUnknown)).toMatchObject({
      capabilityState: 'all', notReturnedCount: 2,
    })
  })

  it('suppresses claims without the DEV bridge and for empty, locked, or sample-only sets', () => {
    expect(deriveHotelFundsSetPresentation(fixtures.bridgeMissing)).toBeNull()
    expect(deriveHotelFundsSetPresentation(fixtures.empty)).toBeNull()
    expect(deriveHotelFundsSetPresentation(fixtures.lockedAndSampleOnly)).toBeNull()
  })

  it('degrades contradictory unsupported evidence and independent policy errors safely', () => {
    expect(deriveHotelFundsSetPresentation(fixtures.malformedPair)).toMatchObject({
      capabilityState: 'none', invalidPairCount: 1, completeCount: 0,
    })
    expect(getHotelFundsCardSignal(policies.unsupportedWithComplete)).toBeNull()
    expect(deriveHotelFundsSetPresentation(fixtures.error)).toMatchObject({
      capabilityState: 'error', supportedOfferCount: 0, completeCount: 0,
    })
    expect(getHotelFundsCardSignal(policies.error)).toBeNull()
  })

  it('shows signals only for valid returned evidence with exact comparison copy', () => {
    expect(getHotelFundsCardSignal(policies.complete)?.copy).toBe('Temporary card hold: $200\u00a0USD per stay. Not part of the stay price.')
    expect(getHotelFundsCardSignal(policies.partial)?.copy).toBe('Deposit or hold details are incomplete. Confirm the missing information before booking.')
    expect(getHotelFundsCardSignal(policies.conflicting)?.copy).toBe('Deposit or hold details conflict. Confirm the amount and timing before booking.')
    expect(getHotelFundsCardSignal(policies.explicitNone)?.copy).toBe('The provider reports no deposit or incidental hold for this selected stay.')
    expect(getHotelFundsCardSignal(policies.notReturned)).toBeNull()
    expect(getHotelFundsCardSignal(policies.unsupported)).toBeNull()
  })

  it('recomputes the same aggregate slot across pagination and retains it after append failure', () => {
    const pageOne = [offer(policies.unsupported)]
    const afterAppend = [...pageOne, offer(policies.complete)]
    expect(deriveHotelFundsSetPresentation(pageOne)?.capabilityState).toBe('none')
    expect(deriveHotelFundsSetPresentation(afterAppend)?.capabilityState).toBe('mixed')
    expect(deriveHotelFundsSetPresentation(pageOne)?.capabilityState).toBe('none')
    expect(deriveHotelFundsSetPresentation([offer(policies.complete)])?.capabilityState).toBe('all')
  })

  it('keeps linked-card accessible names honest and includes visible evidence without adding a control', () => {
    const baseDeal = {
      id: 'deal-1', hotelName: 'Hotel One', city: 'Miami', stars: 4,
      dealPrice: { priceCents: 10_000, currency: 'USD' },
      medianPrice: { priceCents: 15_000, currency: 'USD' }, discountPct: 33,
      checkInWindow: 'Aug 1–3', snapshotCount: 20, links: {}, fundsPolicy: policies.complete,
    }
    const linked = renderToStaticMarkup(<DealCard deal={baseDeal} href="/deals/1" />)
    expect(linked).toContain('aria-label="View deal: Hotel One. 4-star hotel class. Temporary card hold: $200\u00a0USD per stay. Not part of the stay price.."')
    const unknown = renderToStaticMarkup(<DealCard deal={{ ...baseDeal, fundsPolicy: policies.notReturned }} href="/deals/1" />)
    expect(unknown).toContain('aria-label="View deal: Hotel One. 4-star hotel class."')
  })

  it('renders one neutral, non-interactive set disclosure with exact settled copy', () => {
    const none = deriveHotelFundsSetPresentation(fixtures.allUnsupported20)!
    const html = renderToStaticMarkup(<DepositHoldSetDisclosure presentation={none} queryKey="query:v1" />)
    expect(html.match(/<aside/g)).toHaveLength(1)
    expect(html).toContain('Deposit and hold details unavailable')
    expect(html).toContain('The providers in these results do not supply deposit or incidental-hold details.')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('<button')

    const mixed = renderToStaticMarkup(<DepositHoldSetDisclosure presentation={deriveHotelFundsSetPresentation(fixtures.mixed)} queryKey="query:v1" />)
    expect(mixed).toContain('About deposit and hold details')
    expect(mixed).toContain('No label means the policy is unknown, not that no deposit applies.')
  })

  it('uses one polite status for refresh and independent capability error', () => {
    const settled = deriveHotelFundsSetPresentation(fixtures.mixed)
    const refreshing = renderToStaticMarkup(<DepositHoldSetDisclosure presentation={settled} queryKey="query:v1" refreshing />)
    expect(refreshing).toContain('role="status"')
    expect(refreshing).toContain('aria-live="polite"')
    expect(refreshing).toContain('aria-busy="true"')
    expect(refreshing).toContain('Checking whether deposit and hold details are available…')
    expect(refreshing).not.toContain('<aside')

    const error = renderToStaticMarkup(<DepositHoldSetDisclosure presentation={deriveHotelFundsSetPresentation(fixtures.error)} queryKey="query:v1" />)
    expect(error).toContain("Deposit and hold details couldn&#x27;t be checked")
    expect(error).toContain('role="status"')
    expect(error).not.toContain('role="alert"')
  })
})
