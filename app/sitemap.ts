import type { MetadataRoute } from 'next'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { CITY_SLUGS } from '@/lib/cities'

const BASE = 'https://expaify.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const static_routes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/deals`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/join`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'monthly', priority: 0.2 },
  ]

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

  return [...static_routes, ...city_routes, ...dealRoutes]
}
