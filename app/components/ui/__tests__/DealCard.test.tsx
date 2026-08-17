import { renderToStaticMarkup } from 'react-dom/server'
import { DealCard, DealCardCity } from '../DealCard'
import { createUnsupportedHotelClimateEvidence } from '@/lib/hotels/climateEvidence'

describe('DealCard city destination link', () => {
  it('links a tracked city using the canonical reverse lookup slug', () => {
    const html = renderToStaticMarkup(<DealCardCity city="New York" />)

    expect(html).toContain('href="/destinations/new-york"')
    expect(html).toContain('>New York</a>')
  })

  it('renders an untracked city as plain text', () => {
    const html = renderToStaticMarkup(<DealCardCity city="Boston" />)

    expect(html).toBe('Boston')
    expect(html).not.toContain('<a')
  })
})

describe('DealCard amenity evidence', () => {
  const deal = {
    id: 'hotel-1',
    hotelName: 'Example Hotel',
    city: 'Boston',
    stars: 4,
    dealPrice: { priceCents: 12000, currency: 'USD' },
    medianPrice: { priceCents: 18000, currency: 'USD' },
    discountPct: 33,
    checkInWindow: 'Sep 10–13',
    snapshotCount: 20,
    links: {},
  }

  it('omits unsupported climate and unknown EV-charging placeholders on unlocked cards', () => {
    const html = renderToStaticMarkup(
      <DealCard
        deal={deal}
        href="/deals/hotel-1"
        climateEvidence={createUnsupportedHotelClimateEvidence(deal.id, 'current-contract')}
      />,
    )

    expect(html).not.toContain('Room climate details not supported')
    expect(html).not.toContain('EV charging details not provided')
  })
})
