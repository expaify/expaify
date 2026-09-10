import assert from 'node:assert/strict'

// Run against a running production build or deployment with a real CMS slug:
// node scripts/verify-blog-head.mjs https://expaify.com real-post-slug
const [base, slug] = process.argv.slice(2)
assert(base && slug, 'Provide the site URL and a real blog post slug')
for (const userAgent of ['curl/8.0', 'Mozilla/5.0', 'facebookexternalhit/1.1', 'Slackbot-LinkExpanding 1.0', 'Twitterbot/1.0']) {
  const response = await fetch(`${base}/blog/${encodeURIComponent(slug)}`, {
    headers: { 'User-Agent': userAgent },
  })
  assert.equal(response.status, 200, `${userAgent}: post must exist`)
  const html = await response.text()
  // Inspect raw bytes before </head>; a DOM parser can relocate body metadata.
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]
  assert(head, `${userAgent}: missing head`)
  assert.match(head, /<title>[^<]+<\/title>/i)
  assert.match(head, /<meta\b(?=[^>]*name="description")(?=[^>]*content="[^"]+")[^>]*>/i)
  assert.match(head, new RegExp(`<link\\b(?=[^>]*rel="canonical")(?=[^>]*href="https://expaify\\.com/blog/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")[^>]*>`, 'i'))
  assert(!head.includes('<title>Post not found'), 'Must verify a real post')
  console.log(`${userAgent}: title, description and canonical present in raw head`)
}
