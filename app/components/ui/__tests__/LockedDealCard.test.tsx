import { renderToStaticMarkup } from 'react-dom/server'
import { LockedDealCard } from '../LockedDealCard'

const props = { placeholderName: 'Hotel', placeholderCity: 'Paris', stars: 4, discountPct: 35, dealId: 'hotel-1' }

describe('LockedDealCard weekly balance', () => {
  it.each([1, 2, 3])('shows %s remaining visually and in the accessible link name', remaining => {
    const html = renderToStaticMarkup(<LockedDealCard {...props} canSelfUnlock personalUnlocksRemaining={remaining} />)
    const label = `${remaining} ${remaining === 1 ? 'unlock' : 'unlocks'} left this week`
    expect(html).toContain('Use a weekly unlock')
    expect(html).toContain(`>${label}</span>`)
    expect(html).toContain(`Use one weekly unlock to reveal this hotel. ${label}.`)
    expect(html).toContain('href="#"')
  })

  it.each([0, 3])('omits the count when self unlock is unavailable, even with balance %s', remaining => {
    const html = renderToStaticMarkup(<LockedDealCard {...props} canSelfUnlock={false} personalUnlocksRemaining={remaining} />)
    expect(html).not.toContain('left this week')
    expect(html).not.toContain('Use a weekly unlock')
    expect(html).toContain('Unlock hotel with Premium.')
  })

  it('preserves callers that do not supply a balance', () => {
    const html = renderToStaticMarkup(<LockedDealCard {...props} canSelfUnlock />)
    expect(html).toContain('Use a weekly unlock')
    expect(html).not.toContain('undefined unlocks')
  })
})
