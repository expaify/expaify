import { safeJsonLd } from '../safeJsonLd'

describe('safeJsonLd', () => {
  it('escapes script-tag breakout sequences without changing the parsed JSON value', () => {
    const schema = {
      headline: '</script><script>alert(1)</script>',
      description: 'A normal excerpt',
      image: 'https://example.com/hero.jpg?x=</script>',
    }

    const escaped = safeJsonLd(schema)

    expect(escaped).not.toContain('</script')
    expect(escaped).not.toContain('<')
    expect(JSON.parse(escaped)).toEqual(schema)
  })
})
