import { renderToStaticMarkup } from 'react-dom/server'
import { FreeUnlockStatus } from '../FreeUnlockStatus'

const props = { signedIn: true, premium: false, personalUnlocksRemaining: 3, freeUnlockLimit: 3 }

describe('FreeUnlockStatus', () => {
  it.each([3, 2, 1, 0])('renders the real balance with %s remaining', remaining => {
    const html = renderToStaticMarkup(<FreeUnlockStatus {...props} personalUnlocksRemaining={remaining} />)
    expect(html).toContain(`${3 - remaining} of 3 free unlocks used this week`)
    expect(html).toContain('Resets Monday')
    expect(html).toContain('href="/join"')
    expect(html).toContain('role="status"')
    expect(html.match(/bg-\[color:var\(--primary\)\]/g) ?? []).toHaveLength(3 - remaining)
    expect(html.match(/bg-transparent/g) ?? []).toHaveLength(remaining)
    if (remaining === 0) {
      expect(html).not.toContain('unlock any locked card below at no cost')
      expect(html).toContain('font-bold underline')
    } else {
      expect(html).toContain('unlock any locked card below at no cost')
    }
  })

  it.each([[false, false], [false, true], [true, true]])('hides for signedIn=%s premium=%s', (signedIn, premium) => {
    expect(renderToStaticMarkup(<FreeUnlockStatus {...props} signedIn={signedIn} premium={premium} />)).toBe('')
  })

  it('uses the supplied limit instead of hardcoding three', () => {
    expect(renderToStaticMarkup(<FreeUnlockStatus {...props} freeUnlockLimit={5} personalUnlocksRemaining={1} />)).toContain('4 of 5 free unlocks used this week')
  })
})
