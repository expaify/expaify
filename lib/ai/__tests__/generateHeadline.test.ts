import { fallbackDealCopy, generateHeadlines } from '../generateHeadline'
import { query } from '../../db/client'

jest.mock('../../db/client', () => ({
  query: jest.fn(),
}))

const mockQuery = query as jest.MockedFunction<typeof query>

const deal = {
  id: 'deal-1',
  hotelName: 'Hotel Example',
  city: 'Miami',
  stars: 4,
  discountPct: 35,
  dealPriceCents: 15000,
  medianPriceCents: 23000,
  checkInWindow: 'Sep 1 - Sep 3',
}

describe('generateHeadlines', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.OPENAI_API_KEY
    mockQuery.mockResolvedValue({
      rows: [],
      rowCount: 1,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    })
  })

  it('stores deterministic fallback copy when OPENAI_API_KEY is missing', async () => {
    await generateHeadlines([deal])

    const fallback = fallbackDealCopy(deal)
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE deals SET headline = $1, description = $2, updated_at = NOW() WHERE id = $3',
      [fallback.headline, fallback.description, deal.id]
    )
  })

  it('keeps fallback headlines bounded for UI display', () => {
    const copy = fallbackDealCopy({
      ...deal,
      hotelName: 'The Extremely Long Example Resort Suites Near The Waterfront',
    })

    expect(copy.headline.length).toBeLessThanOrEqual(70)
  })
})
