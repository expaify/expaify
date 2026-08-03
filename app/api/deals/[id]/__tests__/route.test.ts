import { NextRequest } from 'next/server';
import { getDealById, getPriceHistory, type DealRow } from '@/lib/pipeline/dealDetection';
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall';
import { query } from '@/lib/db/client';
import { GET } from '../route';

jest.mock('@/lib/pipeline/dealDetection', () => ({
  getDealById: jest.fn(),
  getPriceHistory: jest.fn(),
}));
jest.mock('@/lib/paywall', () => ({
  getFreeUnlockedDealIds: jest.fn(),
  getPaywallContext: jest.fn(),
}));
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }));

const mockGetDealById = getDealById as jest.MockedFunction<typeof getDealById>;
const mockGetPriceHistory = getPriceHistory as jest.MockedFunction<typeof getPriceHistory>;
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>;
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>;
const mockQuery = query as jest.MockedFunction<typeof query>;

const fundsPolicy = {
  provider: 'capable-provider',
  capability: { policy: true },
  evidence: {
    state: 'explicit_none', obligations: [], sourceLabel: 'Provider policy', scope: 'selected_stay',
  },
  loadState: 'ready',
};

const deal: DealRow = {
  id: 'deal-1', hotel_id: 'hotel-1', hotel_name: 'Hotel One', stars: 4, photo_url: null,
  city: 'Miami', deal_price_cents: 10_000, median_price_cents: 15_000, discount_pct: 33,
  check_in_window: 'Aug 1–3', check_in_date: '2026-08-01', nights: 2, snapshot_count: 20,
  ota_links: { booking: 'https://example.test/hotel?aid=affiliate' }, headline: null,
  description: null, is_mock: false, first_seen: null, expires_at: null, updated_at: null,
  funds_policy_bridge: fundsPolicy,
};

describe('GET /api/deals/[id] funds-policy continuity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDealById.mockResolvedValue(deal);
    mockGetPriceHistory.mockResolvedValue([]);
    mockQuery.mockResolvedValue({ rows: [{ id: 7 }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] });
  });

  it('returns the normalized bridge without exposing the persisted storage field', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: 'premium', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 });

    const response = await GET(new NextRequest('https://expaify.test/api/deals/deal-1'), {
      params: Promise.resolve({ id: 'deal-1' }),
    });
    const body = await response.json() as { deal: Record<string, unknown> };

    expect(body.deal).toMatchObject({ id: 'deal-1', fundsPolicy });
    expect(body.deal).not.toHaveProperty('funds_policy_bridge');
  });

  it('does not expose either bridge shape for a locked deal', async () => {
    mockGetPaywallContext.mockResolvedValue({ userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 });
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set());

    const response = await GET(new NextRequest('https://expaify.test/api/deals/deal-1'), {
      params: Promise.resolve({ id: 'deal-1' }),
    });
    const body = await response.json() as { deal: Record<string, unknown> };

    expect(body.deal).not.toHaveProperty('fundsPolicy');
    expect(body.deal).not.toHaveProperty('funds_policy_bridge');
  });
});
