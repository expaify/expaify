import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingNav } from '@/app/components/LandingNav';
import { getBlogPosts } from '@/lib/contentful';

export const metadata: Metadata = {
  title: 'The expaify Blog — hotel deal-hunting, explained honestly',
  description: 'How Deal Score, price history, and location quality actually work -- straight explanations of the signals expaify uses to tell a real hotel deal from a marketing discount.',
  alternates: { canonical: 'https://expaify.com/blog' },
};

// Contentful credentials are runtime-only secrets, not available during the
// Docker build's `next build` step, so this route must never be statically
// prerendered -- a build-time fetch would bake in an empty "No posts yet"
// page that only self-heals after the next ISR revalidation window.
export const dynamic = 'force-dynamic';

export default async function BlogIndexPage() {
  const posts = await getBlogPosts();
  const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <LandingNav />
      <main className="mx-auto max-w-[760px] px-5 py-12">
        <h1 className="font-display text-4xl font-bold text-[color:var(--ink)]">The expaify Blog: honest hotel deal advice</h1>
        {posts.length === 0 ? (
          <p className="mt-6 text-body text-[color:var(--ink-soft)]">No posts yet — check back soon.</p>
        ) : (
          <div className="mt-8 space-y-6">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-[var(--radius-card)] border border-[color:var(--ink-faint)] bg-white/40 p-5"
              >
                <h2 className="font-display text-h3 font-semibold text-[color:var(--ink)]">
                  <Link href={`/blog/${post.slug}`} className="hover:text-[color:var(--primary)]">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-small text-[color:var(--ink-faint)]">
                  {formatter.format(new Date(post.publishedDate))}
                </p>
                {post.excerpt && (
                  <p className="mt-3 text-body text-[color:var(--ink-soft)]">{post.excerpt}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
