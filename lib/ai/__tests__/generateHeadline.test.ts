import { fallbackDealCopy, generateHeadlines } from '../generateHeadline'
import { query } from '../../db/client'

const mockCreate = jest.fn()

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }))
})

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

  it('stores schema-bound generated copy only after local content validation', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            headline: 'Quiet four-star stay in Miami',
            description: 'A city stay is tracking below its recent range. expaify compares the rate against recent price checks before surfacing it.',
          }),
        },
      }],
    })

    await generateHeadlines([deal])

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      response_format: expect.objectContaining({
        type: 'json_schema',
        json_schema: expect.objectContaining({ strict: true }),
      }),
    }))
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE deals SET headline = $1, description = $2, updated_at = NOW() WHERE id = $3',
      ['Quiet four-star stay in Miami', 'A city stay is tracking below its recent range. expaify compares the rate against recent price checks before surfacing it.', deal.id]
    )
  })

  it('rejects generated hotel names and prices before writing UI copy', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            headline: 'Hotel Example from $150',
            description: 'Hotel Example is available for Sep 1. Book now before this price disappears.',
          }),
        },
      }],
    })

    await generateHeadlines([deal])

    const fallback = fallbackDealCopy(deal)
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE deals SET headline = $1, description = $2, updated_at = NOW() WHERE id = $3',
      [fallback.headline, fallback.description, deal.id]
    )
  })
})
