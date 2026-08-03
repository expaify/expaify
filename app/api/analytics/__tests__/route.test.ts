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

  it.each([
    ['hotel_room_handoff_started', {
      handoff_session_id: '11111111-1111-4111-8111-111111111111',
      provider: 'booking',
      deal_id: 'deal_123',
      context_status: 'matched',
      destination_present: true,
      date_state: 'checkin_window',
      occupancy_state: 'not_captured',
      room_state: 'not_captured',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
    ['hotel_room_handoff_returned', {
      handoff_session_id: '11111111-1111-4111-8111-111111111111',
      provider: 'booking',
      deal_id: 'deal_123',
      away_duration_bucket: '10s_59s',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
    ['hotel_room_recovery_viewed', {
      handoff_session_id: '11111111-1111-4111-8111-111111111111',
      deal_id: 'deal_123',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
    ['hotel_room_recovery_action', {
      handoff_session_id: '11111111-1111-4111-8111-111111111111',
      deal_id: 'deal_123',
      action: 'recheck_same_hotel',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
    ['hotel_room_handoff_restarted', {
      prior_handoff_session_id: '11111111-1111-4111-8111-111111111111',
      handoff_session_id: '22222222-2222-4222-8222-222222222222',
      provider: 'booking',
      deal_id: 'deal_123',
      recovery_action: 'recheck_same_hotel',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
  ])('accepts the minimum valid room recovery payload for %s', async (event, props) => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event,
      occurredAt: new Date().toISOString(),
      path: '/deals/deal_123',
      props,
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      expect.arrayContaining([event]),
    )
  })

  it.each([
    ['invalid enum', {
      handoff_session_id: '11111111-1111-4111-8111-111111111111',
      deal_id: 'deal_123',
      action: 'claim_sold_out',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
    ['extra property', {
      handoff_session_id: '11111111-1111-4111-8111-111111111111',
      deal_id: 'deal_123',
      action: 'recheck_same_hotel',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
      provider_url: 'https://www.booking.com/hotel/secret',
    }],
    ['raw URL session ID', {
      handoff_session_id: 'https://www.booking.com/hotel/secret',
      deal_id: 'deal_123',
      action: 'recheck_same_hotel',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
    ['missing handoff session ID', {
      deal_id: 'deal_123',
      action: 'recheck_same_hotel',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }],
  ])('rejects a room recovery payload with %s', async (_case, props) => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_room_recovery_action',
      occurredAt: new Date().toISOString(),
      path: '/deals/deal_123',
      props,
    }))

    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
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
})
