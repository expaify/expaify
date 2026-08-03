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
      props: {
        criteria_version: 'opaque-version',
        result_state: 'populated',
        destination_present: true,
        date_state: 'missing',
        occupancy_state: 'not_captured',
        room_state: 'not_captured',
      },
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

  it('rejects properties outside the event-specific privacy contract', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_results_viewed',
      occurredAt: new Date().toISOString(),
      path: '/deals',
      props: { criteria_version: 'opaque-version', raw_query: 'Paris for two adults' },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it.each([
    ['hotel_detail_viewed', {
      context_status: 'matched',
      deal_id: 'deal_123',
      hotel_id: 'hotel_123',
      entry_source: 'search_results',
      viewport_group: 'desktop_1280',
      has_dates: true,
      has_verified_guest_rating: false,
      score_state: 'confirmed',
      price_freshness_state: 'fresh',
    }],
    ['hotel_decision_section_reached', {
      hotel_id: 'hotel_123',
      entry_source: 'search_results',
      section: 2,
      position: 1,
      viewport_group: 'desktop_1280',
    }],
    ['hotel_room_handoff_started', {
      hotel_id: 'hotel_123',
      entry_source: 'search_results',
      provider: 'booking',
    }],
    ['hotel_detail_back_to_results', {
      hotel_id: 'hotel_123',
      entry_source: 'search_results',
    }],
  ])('stores privacy-bounded hotel decision event %s', async (event, props) => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event,
      occurredAt: new Date().toISOString(),
      path: '/book',
      props,
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      expect.arrayContaining([event]),
    )
  })

  it('rejects raw provider URLs from hotel decision events', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_room_handoff_started',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: { provider: 'hotellook', provider_url: 'https://tp.media/r?marker=secret' },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects unknown event names rather than accepting arbitrary properties', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'arbitrary_event',
      occurredAt: new Date().toISOString(),
      path: '/deals',
      props: {},
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
      props: {
        provider: 'booking',
        deal_id: 'deal_example',
        context_status: 'matched',
        destination_present: true,
        date_state: 'missing',
        occupancy_state: 'not_captured',
        room_state: 'not_captured',
      },
    }))
    expect(response.status).toBe(503)
  })

  it('rejects an out-of-enum value for a bounded property even when the key is allowlisted', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_results_viewed',
      occurredAt: new Date().toISOString(),
      path: '/deals',
      props: {
        criteria_version: 'opaque-version',
        result_state: 'anything-i-want',
        destination_present: true,
        date_state: 'missing',
        occupancy_state: 'not_captured',
        room_state: 'not_captured',
      },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects an event missing one of its required properties', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_results_viewed',
      occurredAt: new Date().toISOString(),
      path: '/deals',
      props: {
        criteria_version: 'opaque-version',
        destination_present: true,
        date_state: 'missing',
        occupancy_state: 'not_captured',
        room_state: 'not_captured',
      },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a provider value outside the closed affiliate set', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_provider_handoff_clicked',
      occurredAt: new Date().toISOString(),
      path: '/deals/example',
      props: {
        provider: 'some-other-site',
        deal_id: 'deal_example',
        context_status: 'matched',
        destination_present: true,
        date_state: 'missing',
        occupancy_state: 'not_captured',
        room_state: 'not_captured',
      },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  const identityState = {
    surface: 'handoff', evidence_state: 'not_established', affected_party_state: 'not_established',
    identity_document_state: 'not_established', payment_name_match_state: 'not_established',
    viewport_group: 'desktop_1280', source_class: 'current_provider',
  }

  it.each([
    ['hotel_identity_disclosure_exposed', identityState],
    ['hotel_identity_informed_exit', { ...identityState, exit_action: 'back_to_results' }],
    ['hotel_identity_handoff_continued', { ...identityState, partner_named: true }],
    ['hotel_identity_handoff_returned', { ...identityState, away_duration_bucket: '30s_to_2m' }],
    ['hotel_identity_return_reason_selected', {
      affected_party_state: 'not_established', identity_document_state: 'not_established',
      payment_name_match_state: 'not_established', reason: 'prefer_not_to_say',
    }],
  ])('accepts exact privacy-safe identity event %s', async (event, props) => {
    const response = await POST(request({ eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3', sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1', event, occurredAt: new Date().toISOString(), path: '/book', props }))
    expect(response.status).toBe(202)
  })

  it.each(['name', 'card_number', 'document_number', 'provider_wording', 'property_id', 'url', 'free_text'])('rejects forbidden identity analytics property %s', async (key) => {
    const response = await POST(request({ eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3', sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1', event: 'hotel_identity_disclosure_exposed', occurredAt: new Date().toISOString(), path: '/book', props: { ...identityState, [key]: 'sensitive' } }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
