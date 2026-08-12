import type { Document } from '@contentful/rich-text-types';

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: Document;
  heroImageUrl: string | null;
  publishedDate: string;
  tags: string[];
};

type ContentfulAsset = {
  sys?: { id?: string };
  fields?: {
    file?: {
      url?: string;
    };
  };
};

type ContentfulEntry = {
  sys?: { id?: string };
  fields?: {
    title?: string;
    slug?: string;
    excerpt?: string;
    body?: Document;
    heroImage?: { sys?: { id?: string } };
    publishedDate?: string;
    tags?: string[];
  };
};

function mapEntryToBlogPost(entry: ContentfulEntry, assets: ContentfulAsset[]): BlogPost | null {
  const id = entry.sys?.id;
  const fields = entry.fields;
  if (!id || !fields?.title || !fields?.slug || !fields?.body || !fields?.publishedDate) {
    return null;
  }

  let heroImageUrl: string | null = null;
  const heroId = fields.heroImage?.sys?.id;
  if (heroId) {
    const asset = assets.find((a) => a.sys?.id === heroId);
    const url = asset?.fields?.file?.url;
    if (url) {
      heroImageUrl = url.startsWith('//') ? `https:${url}` : url;
    }
  }

  return {
    id,
    title: fields.title,
    slug: fields.slug,
    excerpt: fields.excerpt ?? null,
    body: fields.body,
    heroImageUrl,
    publishedDate: fields.publishedDate,
    tags: fields.tags ?? [],
  };
}

function getEnvConfig() {
  const space = process.env.CONTENTFUL_SPACE_ID;
  const token = process.env.CONTENTFUL_DELIVERY_TOKEN;
  if (!space || !token) {
    console.error('Missing Contentful env vars');
    return null;
  }
  return { space, token };
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const config = getEnvConfig();
  if (!config) return [];
  const url = `https://cdn.contentful.com/spaces/${config.space}/environments/master/entries?content_type=blogPost&include=2&order=-fields.publishedDate`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`Contentful error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items: ContentfulEntry[] = Array.isArray(data.items) ? data.items : [];
    const assets: ContentfulAsset[] = Array.isArray(data.includes?.Asset) ? data.includes.Asset : [];
    const mapped = items
      .map((entry) => mapEntryToBlogPost(entry, assets))
      .filter((post): post is BlogPost => Boolean(post));
    return mapped;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const config = getEnvConfig();
  if (!config) return null;
  const url = `https://cdn.contentful.com/spaces/${config.space}/environments/master/entries?content_type=blogPost&include=2&fields.slug=${encodeURIComponent(
    slug
  )}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`Contentful error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const items: ContentfulEntry[] = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) return null;
    const assets: ContentfulAsset[] = Array.isArray(data.includes?.Asset) ? data.includes.Asset : [];
    const mapped = mapEntryToBlogPost(items[0], assets);
    return mapped ?? null;
  } catch (err) {
    console.error(err);
    return null;
  }
}
