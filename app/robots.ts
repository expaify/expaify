import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /admin, /research, and /preview are all real, live, deployed
        // routes (confirmed via direct curl, not assumed) -- not statically
        // excluded from the build, just never linked from anywhere a real
        // user would click. /admin is auth-gated server-side regardless;
        // /research (synthetic test fixtures) and /preview (a design
        // preview) already mark themselves `robots: {index: false}` in
        // their own page metadata, but that only stops indexing a page
        // already crawled -- it doesn't stop a crawler from requesting it
        // in the first place. Disallow here closes that gap, same as the
        // existing entries below.
        disallow: ['/api/', '/account/', '/onboarding/', '/book/', '/admin/', '/research/', '/preview/'],
      },
    ],
    sitemap: 'https://expaify.com/sitemap.xml',
  }
}
