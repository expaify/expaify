import { Client } from 'pg'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db/client'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { GET } from '../route'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))

// Opt-in real SQL test; TEMP tables shadow application tables on this connection.
// DEALS_TEST_DATABASE_URL=postgresql://... npm test -- premium.integration
const describeDatabase = process.env.DEALS_TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('premium deals GET with real subscription and filter SQL', () => {
  const client = new Client({ connectionString: process.env.DEALS_TEST_DATABASE_URL })

  beforeAll(async () => {
    await client.connect()
    jest.mocked(query).mockImplementation((sql, params) => client.query(sql, params))
    jest.mocked(auth).mockResolvedValue({ user: { id: 'premium-user' } } as never)
    await client.query(`
      CREATE TEMP TABLE subscriptions (
        id text, user_id text, status text, watchlist text[], onboarding_done boolean,
        alert_min_discount integer, alert_preference text
      );
      INSERT INTO subscriptions VALUES ('sub-1', 'premium-user', 'active', ARRAY['Miami'], true, 40, 'daily');
      CREATE TEMP TABLE tracked_markets (id integer, city text);
      INSERT INTO tracked_markets VALUES (7, 'Miami'), (9, 'Nashville');
      CREATE TEMP TABLE deals (
        id text, hotel_id text DEFAULT 'hotel', hotel_name text DEFAULT 'Real hotel',
        stars numeric DEFAULT 4, review_evidence jsonb, photo_url text, photo_urls text[],
        market_id integer DEFAULT 7, deal_price_cents integer DEFAULT 9000,
        median_price_cents integer DEFAULT 18000, currency text DEFAULT 'USD',
        discount_pct integer DEFAULT 50, check_in_window text DEFAULT 'Future stay',
        check_in_date date DEFAULT CURRENT_DATE + 30, nights integer DEFAULT 2,
        snapshot_count integer DEFAULT 20, ota_links jsonb DEFAULT '{}', headline text,
        description text, is_mock boolean DEFAULT false, status text DEFAULT 'active',
        first_seen timestamptz DEFAULT NOW(), expires_at timestamptz, updated_at timestamptz DEFAULT NOW()
      );
      INSERT INTO deals (id) VALUES ('match');
      INSERT INTO deals (id, market_id) VALUES ('other-market', 9);
      INSERT INTO deals (id, discount_pct) VALUES ('small-discount', 30);
      INSERT INTO deals (id, stars) VALUES ('low-stars', 3);
      INSERT INTO deals (id, deal_price_cents) VALUES ('expensive', 15000);
      INSERT INTO deals (id, currency) VALUES ('non-usd', 'EUR');
      INSERT INTO deals (id, check_in_date) VALUES ('past-stay', CURRENT_DATE - 1);
      INSERT INTO deals (id, status) VALUES ('expired', 'expired');
      INSERT INTO deals (id, is_mock) VALUES ('mock', true);
    `)
  })

  afterAll(async () => { await client.end() })

  async function get(params: string) {
    const response = await GET(new NextRequest(`https://expaify.test/api/deals?${params}`))
    expect(response.status).toBe(200)
    return response.json()
  }

  it.each(['active', 'trialing'])('recognizes a %s subscription and applies combined premium filters within the watchlist', async status => {
    await client.query('UPDATE subscriptions SET status = $1', [status])
    const body = await get('min_discount=40&min_stars=4&max_price_cents=10000&sort=price')
    expect(body.premium).toBe(true)
    expect(body.deals).toEqual([expect.objectContaining({ id: 'match', locked: false, dealPriceCents: 9000 })])
  })

  it('lets an explicit market override the stored watchlist', async () => {
    const body = await get('market_id=9&min_discount=40&min_stars=4&max_price_cents=10000')
    expect(body.deals.map((deal: { id: string }) => deal.id)).toEqual(['other-market'])
    const rows = await getActiveDeals({ marketId: 9, marketIds: [7], minDiscount: 40, minStars: 4, maxPriceCents: 10000 })
    expect(rows.map(row => row.id)).toEqual(['other-market'])
  })

  it('binds date parameters after the market, price and stars parameters', async () => {
    const dates = await client.query("SELECT (CURRENT_DATE + 29)::text AS start, (CURRENT_DATE + 31)::text AS finish")
    await client.query("INSERT INTO deals (id, market_id, check_in_date) VALUES ('too-early', 9, CURRENT_DATE + 28), ('too-late', 9, CURRENT_DATE + 32)")
    try {
      const body = await get(`market_id=9&min_discount=40&min_stars=4&max_price_cents=10000&date_from=${dates.rows[0].start}&date_to=${dates.rows[0].finish}`)
      expect(body.deals.map((deal: { id: string }) => deal.id)).toEqual(['other-market'])
    } finally {
      await client.query("DELETE FROM deals WHERE id IN ('too-early', 'too-late')")
    }
  })

  it.each(['min_discount=90', 'min_stars=5', 'max_price_cents=100'])('returns an honest empty result for %s, without fallback teasers', async filter => {
    const body = await get(`all=1&${filter}`)
    expect(body.deals).toEqual([])
    expect(body.page).toEqual({ nextOffset: null, hasMore: false })
  })
})
