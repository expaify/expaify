import { getBlogPostBySlug, getBlogPosts } from '@/lib/contentful';

const baseDocument = {
  nodeType: 'document',
  data: {},
  content: [],
};

describe('contentful provider', () => {
  beforeEach(() => {
    process.env.CONTENTFUL_SPACE_ID = 'test-space';
    process.env.CONTENTFUL_DELIVERY_TOKEN = 'test-token';
    global.fetch = jest.fn();
  });

  it('getBlogPosts returns mapped posts on success', async () => {
    const response = {
      items: [
        {
          sys: { id: 'entry1' },
          fields: {
            title: 'Test Post',
            slug: 'test-post',
            excerpt: 'A short summary',
            body: baseDocument,
            heroImage: { sys: { id: 'asset1', linkType: 'Asset', type: 'Link' } },
            publishedDate: '2026-08-12',
            tags: ['travel'],
          },
        },
      ],
      includes: {
        Asset: [
          {
            sys: { id: 'asset1' },
            fields: {
              file: { url: '//images.ctfassets.net/test.jpg' },
            },
          },
        ],
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => response,
    });

    const posts = await getBlogPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].heroImageUrl).toBe('https://images.ctfassets.net/test.jpg');
    expect(posts[0].title).toBe('Test Post');
  });

  it('getBlogPosts returns [] on non-200 response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const posts = await getBlogPosts();
    expect(posts).toEqual([]);
  });

  it('getBlogPosts returns [] on fetch rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const posts = await getBlogPosts();
    expect(posts).toEqual([]);
  });

  it('getBlogPostBySlug returns null when no entries', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    const post = await getBlogPostBySlug('missing');
    expect(post).toBeNull();
  });

  it('getBlogPostBySlug maps entry without heroImage', async () => {
    const response = {
      items: [
        {
          sys: { id: 'entry2' },
          fields: {
            title: 'No Image Post',
            slug: 'no-image',
            body: baseDocument,
            publishedDate: '2026-01-01',
          },
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => response,
    });

    const post = await getBlogPostBySlug('no-image');
    expect(post).not.toBeNull();
    expect(post?.heroImageUrl).toBeNull();
    expect(post?.title).toBe('No Image Post');
  });
});
