import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PremiumHubBar } from '../PremiumHubBar'

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

describe('PremiumHubBar free-alerts link', () => {
  // DealFeed.tsx now passes city={defaultCity}; see
  // DealFeed.interaction.test.tsx's "carries the destination-page city..."
  // test for the real-caller integration coverage.
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
