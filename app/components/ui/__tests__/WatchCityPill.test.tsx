import { renderToStaticMarkup } from 'react-dom/server'
import { WatchCityPill } from '../WatchCityPill'

describe('WatchCityPill initial states', () => {
  it('renders a clear not-watching action', () => {
    const html = renderToStaticMarkup(
      <WatchCityPill city="Miami" initialWatching={false} initialCount={0} />,
    )

    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('Watch Miami')
    expect(html).not.toContain('aria-disabled=')
  })

  it('keeps watching cities removable even when the watchlist is full', () => {
    const html = renderToStaticMarkup(
      <WatchCityPill city="Miami" initialWatching initialCount={10} />,
    )

    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Watching Miami')
    expect(html).not.toContain('aria-disabled=')
  })

  it('exposes the at-cap state without adding a second management control', () => {
    const html = renderToStaticMarkup(
      <WatchCityPill city="Miami" initialWatching={false} initialCount={10} />,
    )

    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('opacity-60')
    expect(html.match(/Watch Miami/g)).toHaveLength(1)
  })
})
