import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingNav } from '@/app/components/LandingNav';
import { getBlogPostBySlug } from '@/lib/contentful';
import { documentToReactComponents } from '@contentful/rich-text-react-renderer';
import { BLOCKS, MARKS, type Document } from '@contentful/rich-text-types';

type PageParams = Promise<{ slug: string }>;

const renderOptions = {
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_: unknown, children: React.ReactNode) => (
      <p className="mt-4 text-base leading-relaxed text-[color:var(--ink-soft)]">{children}</p>
    ),
    [BLOCKS.HEADING_2]: (_: unknown, children: React.ReactNode) => (
      <h2 className="mt-8 font-display text-h3 font-semibold text-[color:var(--ink)]">{children}</h2>
    ),
    [BLOCKS.HEADING_3]: (_: unknown, children: React.ReactNode) => (
      <h3 className="mt-6 font-display text-body font-semibold text-[color:var(--ink)]">{children}</h3>
    ),
    [BLOCKS.UL_LIST]: (_: unknown, children: React.ReactNode) => (
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[color:var(--ink-soft)]">{children}</ul>
    ),
    [BLOCKS.OL_LIST]: (_: unknown, children: React.ReactNode) => (
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[color:var(--ink-soft)]">{children}</ol>
    ),
    [BLOCKS.LIST_ITEM]: (_: unknown, children: React.ReactNode) => (
      <li className="text-base leading-relaxed">{children}</li>
    ),
  },
  renderMark: {
    [MARKS.BOLD]: (text: React.ReactNode) => (
      <strong className="font-semibold text-[color:var(--ink)]">{text}</strong>
    ),
  },
};

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) {
    return { title: 'Post not found' };
  }
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      url: `https://expaify.com/blog/${slug}`,
      type: 'article',
    },
    alternates: { canonical: `https://expaify.com/blog/${slug}` },
  };
}

export default async function BlogPostPage({ params }: { params: PageParams }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return notFound();

  const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.publishedDate,
    image: post.heroImageUrl ?? undefined,
    author: { '@type': 'Organization', name: 'expaify' },
    publisher: { '@type': 'Organization', name: 'expaify', url: 'https://expaify.com' },
    mainEntityOfPage: `https://expaify.com/blog/${slug}`,
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <LandingNav />
      <main className="mx-auto max-w-[760px] px-5 py-12">
        <h1 className="font-display text-4xl font-bold text-[color:var(--ink)]">{post.title}</h1>
        <p className="mt-2 text-small text-[color:var(--ink-faint)]">
          {formatter.format(new Date(post.publishedDate))}
        </p>

        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-3 py-1 text-small text-[color:var(--text-inverse)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {post.heroImageUrl && (
          <img
            src={post.heroImageUrl}
            alt={post.title}
            className="mt-8 w-full rounded-[var(--radius-card)]"
          />
        )}

        <div className="mt-8">
          {documentToReactComponents(post.body as Document, renderOptions)}
        </div>
      </main>
    </div>
  );
}
