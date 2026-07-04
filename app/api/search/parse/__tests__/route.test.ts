import { NextRequest } from 'next/server'
import { POST } from '../route'

const mockCreate = jest.fn()
let mockPremium = true

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }))
})

jest.mock('@/lib/paywall', () => ({
  getPaywallContext: jest.fn(() => Promise.resolve({
    userId: mockPremium ? 'user-1' : null,
    premium: mockPremium,
    freeUnlockedThisWeek: 0,
    freeUnlockLimit: 3,
  })),
}))

function parseRequest(query: unknown): NextRequest {
  return new NextRequest('https://expaify.test/api/search/parse', {
    method: 'POST',
    body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/search/parse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
    mockPremium = true
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  it('requires premium before calling OpenAI', async () => {
    mockPremium = false

    const response = await POST(parseRequest('4 star hotels in Miami under $150'))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: 'premium required' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('validates schema output before returning filters', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            destination_type: 'hotel',
            city: 'Miami',
            max_price: 150,
            min_stars: 4,
            min_discount: null,
            date_from: null,
            date_to: null,
          }),
        },
      }],
    })

    const response = await POST(parseRequest('4 star hotels in Miami under $150'))
    const body = await response.json() as { filters: Record<string, unknown> }

    expect(response.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      response_format: expect.objectContaining({
        type: 'json_schema',
        json_schema: expect.objectContaining({ strict: true }),
      }),
    }))
    expect(body).toEqual({
      filters: {
        destination_type: 'hotel',
        city: 'Miami',
        max_price: 150,
        min_stars: 4,
      },
    })
  })

  it('retries once and returns the product parse error after invalid output', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              destination_type: 'hotel',
              city: 'Atlantis',
              max_price: null,
              min_stars: null,
              min_discount: null,
              date_from: null,
              date_to: null,
            }),
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              destination_type: 'hotel',
              city: 'Atlantis',
              max_price: null,
              min_stars: null,
              min_discount: null,
              date_from: null,
              date_to: null,
            }),
          },
        }],
      })

    const response = await POST(parseRequest('hotels in Atlantis'))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(422)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(body).toEqual({ error: "Couldn't parse that — try the filters instead" })
  })

  it('gracefully returns the parse error when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const response = await POST(parseRequest('hotels in Miami'))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(422)
    expect(body).toEqual({ error: "Couldn't parse that — try the filters instead" })
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
