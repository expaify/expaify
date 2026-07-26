import { query } from '@/lib/db/client'
import { POST } from '../route'

jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))

const mockQuery = query as jest.MockedFunction<typeof query>

function request(body: unknown): Request {
  return new Request('https://expaify.test/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], command: 'INSERT', rowCount: 1, oid: 0, fields: [] })
  })

  it('stores a sessionized privacy-bounded event', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_results_viewed',
      occurredAt: new Date().toISOString(),
      path: '/deals',
      props: { criteria_version: 'opaque-version', destination_present: true },
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO analytics_events'), expect.arrayContaining([
      '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      'hotel_results_viewed',
    ]))
  })

  it('rejects malformed sessions and nested properties', async () => {
    const response = await POST(request({
      eventId: 'not-an-id',
      sessionId: 'also-invalid',
      event: 'hotel_results_viewed',
      occurredAt: new Date().toISOString(),
      path: '/deals',
      props: { raw_query: { unsafe: true } },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns a non-throwing service response when persistence is unavailable', async () => {
    mockQuery.mockRejectedValue(new Error('database unavailable'))
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_provider_handoff_clicked',
      occurredAt: new Date().toISOString(),
      path: '/deals/example',
      props: { context_status: 'matched' },
    }))
    expect(response.status).toBe(503)
  })
})
