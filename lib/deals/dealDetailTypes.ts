export type DealKind = 'flight' | 'hotel';

export type DealDetail = {
  id: string;
  kind: DealKind;
  title: string;
  subtitle: string;
  provider: string;
  price: number;
  currency: string;
  dealScore?: number;
  imageUrl?: string;
  bookingUrl: string;
  expiresAt?: string;
  updatedAt: string;
  metadata: Record<string, string | number | boolean | null>;
};
