import sitemap from '../sitemap'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { getBlogPosts } from '@/lib/contentful'

jest.mock('@/lib/pipeline/dealDetection', () => ({ getActiveDeals: jest.fn() }))
jest.mock('@/lib/contentful', () => ({ getBlogPosts: jest.fn() }))

const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockGetBlogPosts = getBlogPosts as jest.MockedFunction<typeof getBlogPosts>

describe('sitemap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetActiveDeals.mockResolvedValue([])
    mockGetBlogPosts.mockResolvedValue([])
  })

  it('includes /flights and /blog alongside the other static routes', async () => {
    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    expect(urls).toContain('https://expaify.com/flights')
    expect(urls).toContain('https://expaify.com/blog')
    expect(urls).toContain('https://expaify.com/deals')
  })

  it('includes a route for every published blog post', async () => {
    mockGetBlogPosts.mockResolvedValue([
      { id: '1', title: 'A', slug: 'post-a', excerpt: null, body: {} as never, heroImageUrl: null, publishedDate: '2026-08-01', tags: [] },
      { id: '2', title: 'B', slug: 'post-b', excerpt: null, body: {} as never, heroImageUrl: null, publishedDate: '2026-08-02', tags: [] },
    ])

    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    expect(urls).toContain('https://expaify.com/blog/post-a')
    expect(urls).toContain('https://expaify.com/blog/post-b')
  })

  it('does not throw and skips blog routes when Contentful is unavailable', async () => {
    mockGetBlogPosts.mockRejectedValue(new Error('network error'))

    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    expect(urls).toContain('https://expaify.com/deals')
    expect(urls.some(u => u.startsWith('https://expaify.com/blog/'))).toBe(false)
  })

  it('does not throw and skips deal routes when the DB is unavailable', async () => {
    mockGetActiveDeals.mockRejectedValue(new Error('db unavailable'))

    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    expect(urls).toContain('https://expaify.com/blog')
    expect(urls.some(u => /\/deals\/[^/]+$/.test(u))).toBe(false)
  })
})
