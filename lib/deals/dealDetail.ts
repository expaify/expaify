import { query } from '../db/client';
import type { DealDetail, DealKind } from './dealDetailTypes';

const DEAL_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

type DealMetadataValue = string | number | boolean | null;

type DealRow = {
  id?: unknown;
  kind?: unknown;
  title?: unknown;
  subtitle?: unknown;
  provider?: unknown;
  price?: unknown;
  price_cents?: unknown;
  currency?: unknown;
  deal_score?: unknown;
  dealScore?: unknown;
  image_url?: unknown;
  imageUrl?: unknown;
  booking_url?: unknown;
  bookingUrl?: unknown;
  expires_at?: unknown;
  expiresAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  metadata?: unknown;
};

export function isValidDealId(dealId: string): boolean {
  return DEAL_ID_PATTERN.test(dealId);
}

function isDealKind(value: unknown): value is DealKind {
  return value === 'flight' || value === 'hotel';
}

function toRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function toInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toMetadata(value: unknown): Record<string, DealMetadataValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, DealMetadataValue>>(
    (metadata, [key, entry]) => {
      if (
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean' ||
        entry === null
      ) {
        metadata[key] = entry;
      }

      return metadata;
    },
    {},
  );
}

export function dealRowToDetail(row: DealRow): DealDetail | null {
  const id = toRequiredString(row.id);
  const title = toRequiredString(row.title);
  const subtitle = toRequiredString(row.subtitle);
  const provider = toRequiredString(row.provider);
  const currency = toRequiredString(row.currency);
  const bookingUrl = toRequiredString(row.booking_url ?? row.bookingUrl);
  const updatedAt = toIsoString(row.updated_at ?? row.updatedAt);
  const price = toInteger(row.price_cents ?? row.price);

  if (
    !id ||
    !isDealKind(row.kind) ||
    !title ||
    !subtitle ||
    !provider ||
    price === null ||
    !currency ||
    !bookingUrl ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    kind: row.kind,
    title,
    subtitle,
    provider,
    price,
    currency: currency.toUpperCase(),
    dealScore: toOptionalNumber(row.deal_score ?? row.dealScore),
    imageUrl: toOptionalString(row.image_url ?? row.imageUrl),
    bookingUrl,
    expiresAt: toIsoString(row.expires_at ?? row.expiresAt) ?? undefined,
    updatedAt,
    metadata: toMetadata(row.metadata),
  };
}

export async function getDealDetail(dealId: string): Promise<DealDetail | null> {
  if (!isValidDealId(dealId)) return null;

  try {
    const result = await query<DealRow>(
      `SELECT *
       FROM deals
       WHERE id = $1
       LIMIT 1`,
      [dealId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return dealRowToDetail(row);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;

    if (code === '42P01') return null;

    throw error;
  }
}
