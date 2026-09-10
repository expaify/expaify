import { renderToStaticMarkup } from 'react-dom/server'
import { DealChip } from '../DealChip'
import { DealCard } from '../DealCard'
import { LockedDealCard } from '../LockedDealCard'

const discounts = [-1, 0, 4, 6, 11, 17, 21, 29, 29.99]

describe('the promised 30% minimum savings claim', () => {
  it.each(discounts)('omits the chip at %s%%', discountPct => {
    expect(renderToStaticMarkup(<DealChip discountPct={discountPct} />)).toBe('')
  })

  it.each([30, 31, 50])('keeps qualifying chips at %s%%', discountPct => {
    expect(renderToStaticMarkup(<DealChip discountPct={discountPct} />)).toContain(`−${discountPct}% vs usual`)
  })

  it.each(discounts)('shows a tracked hotel price without savings claims at %s%%', discountPct => {
    const html = renderToStaticMarkup(<DealCard deal={{
      id: 'tracked-hotel', hotelName: 'Tracked Hotel', city: 'Paris', stars: 4,
      dealPrice: { priceCents: 10000 - discountPct * 100, currency: 'USD' },
      medianPrice: { priceCents: 10000, currency: 'USD' }, discountPct,
      checkInWindow: 'Sep 14–17', snapshotCount: 20, links: {}, isMock: false,
    }} />)
    expect(html).toContain('Tracked Hotel')
    expect(html).toContain('/ night')
    expect(html).not.toMatch(/Save |% vs usual|% below|usually /)
  })

  it.each(discounts)('does not advertise locked tracked hotels as savings at %s%%', discountPct => {
    const html = renderToStaticMarkup(<LockedDealCard placeholderName="Hotel" placeholderCity="Paris" stars={4} discountPct={discountPct} />)
    expect(html).not.toMatch(/Save |Deal found today|Members-only deal|Locked deal/)
    expect(html).toContain('Currently tracked')
  })
})
