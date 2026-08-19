import { renderToStaticMarkup } from 'react-dom/server'
import { ColdSampleFeedIntro } from '../ColdSampleFeedIntro'

describe('ColdSampleFeedIntro', () => {
  it('discloses cold inventory and labels sample deals honestly', () => {
    const markup = renderToStaticMarkup(<ColdSampleFeedIntro />)

    expect(markup).toContain('role="status"')
    expect(markup).toContain('We&#x27;re building your feed.')
    expect(markup).toContain('Our tracker sweeps hotel prices across 26 destinations once a day.')
    expect(markup).toContain('Real deals appear here after the next sweep — check back soon.')
    expect(markup).toContain('Example deals')
    expect(markup).toContain('These use sample hotels and prices — they&#x27;re not bookable.')
    expect(markup).not.toContain('Preview deal')
  })
})
