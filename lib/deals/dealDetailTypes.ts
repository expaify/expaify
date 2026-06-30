export type DealKind = 'flight' | 'hotel';

export type DealScoreVerdict = 'Great' | 'Good' | 'Typical';
export type DealScoreConfidence = 'high' | 'low';

export type DealDetail = {
  id: string;
  kind: DealKind;
  title: string;
  subtitle: string;
  provider: string;
  price: number;
  currency: string;
  dealScore?: number;
  scoreVerdict?: DealScoreVerdict;
  scoreConfidence?: DealScoreConfidence;
  scoreExplanation?: string;
  scorePercentile?: number;
  scorePctVsMedian?: number;
  imageUrl?: string;
  bookingUrl?: string;
  expiresAt?: string;
  updatedAt: string;
  metadata: Record<string, string | number | boolean | null>;
};
