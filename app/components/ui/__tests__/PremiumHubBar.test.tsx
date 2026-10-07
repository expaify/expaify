import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PremiumHubBar } from '../PremiumHubBar'

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

describe('PremiumHubBar free-alerts link', () => {
  // Real bug: the copy right next to this link says "Just want email when
  // {city} drops?" -- a real city-specific promise -- but the link itself
  // dropped the city the same way DealDetailProviderHandoff/LockedDealCard/
  // the destinations page CTAs did. (city isn't passed by DealFeed.tsx's
  // one real caller today, so this branch isn't live yet, but it must be
  // correct for whenever it is.)
  it('carries the city into the link when one is given', () => {
    const ref = createRef<HTMLElement>()
    const html = renderToStaticMarkup(
      <PremiumHubBar lockedDealsCount={2} firstLockedDealRef={ref} city="Nashville" />
    )

    expect(html).toContain('Just want email when Nashville drops?')
    expect(html).toContain('city=Nashville')
  })

  it('omits the city param entirely when no city is given', () => {
    const ref = createRef<HTMLElement>()
    const html = renderToStaticMarkup(
      <PremiumHubBar lockedDealsCount={2} firstLockedDealRef={ref} />
    )

    expect(html).toContain('Just want email when a deal drops?')
    expect(html).not.toContain('city=')
  })
})
