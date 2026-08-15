import { renderToStaticMarkup } from 'react-dom/server';
import type { Document } from '@contentful/rich-text-types';
import { getBlogPostBySlug, getBlogPosts, type BlogPost } from '@/lib/contentful';
import BlogPostPage, { getRelatedPosts } from '../page';

jest.mock('@/lib/contentful', () => ({
  getBlogPostBySlug: jest.fn(),
  getBlogPosts: jest.fn(),
}));
jest.mock('@/app/components/LandingNav', () => ({ LandingNav: () => null }));

const mockGetBlogPostBySlug = getBlogPostBySlug as jest.MockedFunction<typeof getBlogPostBySlug>;
const mockGetBlogPosts = getBlogPosts as jest.MockedFunction<typeof getBlogPosts>;

const emptyBody = {
  nodeType: 'document',
  data: {},
  content: [],
} as Document;

function makePost(
  slug: string,
  tags: string[],
  publishedDate: string,
  excerpt: string | null = `${slug} excerpt`
): BlogPost {
  return {
    id: slug,
    title: `${slug} title`,
    slug,
    excerpt,
    body: emptyBody,
    heroImageUrl: null,
    publishedDate,
    tags,
  };
}

const currentPost = makePost('current', ['hotels', 'deals'], '2026-01-01');

describe('blog related posts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ranks posts by shared-tag count', () => {
    const oneShared = makePost('one-shared', ['hotels'], '2026-03-01');
    const twoShared = makePost('two-shared', ['deals', 'hotels'], '2026-02-01');
    const anotherShared = makePost('another-shared', ['deals'], '2026-01-15');

    expect(getRelatedPosts(currentPost, [oneShared, twoShared, anotherShared])).toEqual([
      twoShared,
      oneShared,
      anotherShared,
    ]);
  });

  it('fills by recency when fewer than two posts share a tag', () => {
    const matching = makePost('matching', ['hotels'], '2025-01-01');
    const newest = makePost('newest', ['flights'], '2026-04-01');
    const nextNewest = makePost('next-newest', [], '2026-03-01');
    const oldest = makePost('oldest', ['guides'], '2026-02-01');

    expect(getRelatedPosts(currentPost, [oldest, matching, nextNewest, newest])).toEqual([
      matching,
      newest,
      nextNewest,
    ]);
  });

  it('excludes the current post by slug', () => {
    const duplicateCurrent = makePost('current', ['hotels', 'deals'], '2026-12-01');
    const other = makePost('other', [], '2026-02-01');

    expect(getRelatedPosts(currentPost, [duplicateCurrent, other])).toEqual([other]);
  });

  it('renders no related-posts section when there are no other posts', async () => {
    mockGetBlogPostBySlug.mockResolvedValue(currentPost);
    mockGetBlogPosts.mockResolvedValue([currentPost]);

    const page = await BlogPostPage({ params: Promise.resolve({ slug: currentPost.slug }) });
    const html = renderToStaticMarkup(page);

    expect(html).not.toContain('Related posts');
  });

  it('renders a real link but no empty excerpt line when an excerpt is null', async () => {
    const withoutExcerpt = makePost('without-excerpt', [], '2026-02-01', null);
    mockGetBlogPostBySlug.mockResolvedValue(currentPost);
    mockGetBlogPosts.mockResolvedValue([currentPost, withoutExcerpt]);

    const page = await BlogPostPage({ params: Promise.resolve({ slug: currentPost.slug }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('Related posts');
    expect(html).toContain('href="/blog/without-excerpt"');
    expect(html).toContain('without-excerpt title');
    expect(html).not.toContain('without-excerpt excerpt');
    expect(html.match(/<p/g)).toHaveLength(1);
  });
});
