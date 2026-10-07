import robots from '../robots'

describe('robots.ts', () => {
  const rules = robots().rules
  const rule = (Array.isArray(rules) ? rules[0] : rules) as { userAgent: string; allow: string; disallow: string[] }

  it('disallows every real, deployed route that is never linked for a real user to click', () => {
    // Real bug: /research (synthetic test fixtures) and /preview (a design
    // preview), and /admin (auth-gated, but still a real route), are all
    // live and publicly reachable -- confirmed via direct curl against
    // production, not assumed -- yet were never added here. Their own page
    // metadata already sets `robots: {index: false}`, but that only stops
    // indexing a page a crawler already fetched; it doesn't stop the
    // crawl itself.
    for (const path of ['/admin/', '/research/', '/preview/']) {
      expect(rule.disallow).toContain(path)
    }
  })

  it('still disallows the pre-existing entries', () => {
    for (const path of ['/api/', '/account/', '/onboarding/', '/book/']) {
      expect(rule.disallow).toContain(path)
    }
  })

  it('still allows everything else by default', () => {
    expect(rule.allow).toBe('/')
  })
})
