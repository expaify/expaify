import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('@/lib/paywall', () => ({
  getFreeUnlockedDealIds: jest.fn(),
  getPaywallContext: jest.fn(),
}))

import { DealDetailCity } from '../page'

describe('deal detail city destination link', () => {
  it('links a tracked city using the canonical reverse lookup slug', () => {
    const html = renderToStaticMarkup(<DealDetailCity city="Cancún" />)

    expect(html).toContain('href="/destinations/cancun"')
    expect(html).toContain('>Cancún</a>')
  })

  it('renders an untracked city as plain text', () => {
    const html = renderToStaticMarkup(<DealDetailCity city="Boston" />)

    expect(html).toBe('Boston')
    expect(html).not.toContain('<a')
  })
})
