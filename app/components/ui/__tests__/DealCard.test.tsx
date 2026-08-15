import { renderToStaticMarkup } from 'react-dom/server'
import { DealCardCity } from '../DealCard'

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
