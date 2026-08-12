import type { MetadataRoute } from 'next'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { getBlogPosts } from '@/lib/contentful'
import { CITY_SLUGS } from '@/lib/cities'

const BASE = 'https://expaify.com'

// DATABASE_URL and the Contentful credentials are runtime-only container
// secrets, unavailable during the Docker build's `next build` step -- without
// this, the sitemap gets statically baked in at build time missing every
// deal and blog route (same class of bug as the /blog index page).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const static_routes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/deals`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/flights`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/join`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'monthly', priority: 0.2 },
  ]

  let blogRoutes: MetadataRoute.Sitemap = []
  try {
    const posts = await getBlogPosts()
    blogRoutes = posts.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
      lastModified: p.publishedDate ? new Date(p.publishedDate) : undefined,
    }))
  } catch {
    // Contentful unavailable — skip blog routes
  }

  const city_routes: MetadataRoute.Sitemap = Object.keys(CITY_SLUGS).map(slug => ({
    url: `${BASE}/destinations/${slug}`,
    changeFrequency: 'hourly' as const,
    priority: 0.85,
  }))

  let dealRoutes: MetadataRoute.Sitemap = []
  try {
    const deals = await getActiveDeals({ limit: 200, sort: 'newest', includeMock: false })
    dealRoutes = deals.map((d) => ({
      url: `${BASE}/deals/${d.id}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
      lastModified: d.updated_at ? new Date(d.updated_at) : undefined,
    }))
  } catch {
    // DB unavailable at build time — skip deal routes
  }

  return [...static_routes, ...blogRoutes, ...city_routes, ...dealRoutes]
}
