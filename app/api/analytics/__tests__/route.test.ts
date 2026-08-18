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

  it.each([
    ['free_signup', { source: 'onboarding' }],
    ['city_set', { city: 'Paris' }],
    ['trial_start', { plan: 'annual' }],
    ['alert_sent', { tier: 'free', cities: 'Paris', deal_count: 2, resend_message_id: '<digest-1@email.amazonses.com>' }],
    ['alert_skipped', { tier: 'free', cities: 'everywhere', reason: 'no_qualifying_deals' }],
    ['welcome_sent', { resend_message_id: '<welcome-1@email.amazonses.com>', city: 'Everywhere' }],
    ['alert_click', {}],
    ['unlock_used', { deal_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', remaining: 2 }],
    ['destination_hub_view', { city: 'Orlando' }],
    ['destination_cta_free_alerts', { city: 'Orlando' }],
    ['destination_cta_premium', { city: 'Orlando' }],
  ])('accepts free-alert funnel event %s', async (event, props) => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event,
      occurredAt: new Date().toISOString(),
      path: '/onboarding',
      props,
    }))

    expect(response.status).toBe(202)
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

  it.each([
    ['hotel_handoff_viewed', {
      handoffAttemptId: '3eb5df1f-e028-40a8-a755-679e63579723',
      priceDisclosureState: 'incomplete',
      stayCostState: 'nightly_only',
      taxState: 'not_returned',
      mandatoryChargeState: 'not_returned',
      source: 'hotellook',
    }],
    ['hotel_handoff_continue_clicked', {
      handoffAttemptId: '3eb5df1f-e028-40a8-a755-679e63579723',
      priceDisclosureState: 'fully_itemized',
      source: 'other',
      partnerNamed: true,
    }],
    ['hotel_handoff_returned', {
      handoffAttemptId: '3eb5df1f-e028-40a8-a755-679e63579723',
      priceDisclosureState: 'partially_itemized',
      awayDurationBucket: '30–120s',
    }],
    ['hotel_handoff_back_clicked', {
      handoffAttemptId: '3eb5df1f-e028-40a8-a755-679e63579723',
      priceDisclosureState: 'provider_total_breakdown_unknown',
    }],
    ['hotel_handoff_return_reason_selected', {
      handoffAttemptId: '3eb5df1f-e028-40a8-a755-679e63579723',
      priceDisclosureState: 'unavailable',
      reason: 'pay_at_property_amount_unexpected',
    }],
  ])('accepts the exact attempt-level contract for %s', async (event, props) => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event,
      occurredAt: new Date().toISOString(),
      path: '/book',
      props,
    }))
    expect(response.status).toBe(202)
  })

  it('rejects a lifecycle event with a missing attempt id or legacy extra property', async () => {
    const base = {
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_handoff_back_clicked',
      occurredAt: new Date().toISOString(),
      path: '/book',
    }
    const missing = await POST(request({ ...base, props: { priceDisclosureState: 'incomplete' } }))
    const legacyExtra = await POST(request({
      ...base,
      props: {
        handoffAttemptId: '3eb5df1f-e028-40a8-a755-679e63579723',
        priceDisclosureState: 'incomplete',
        partnerHost: 'example.com',
      },
    }))
    expect(missing.status).toBe(400)
    expect(legacyExtra.status).toBe(400)
  })

  it.each([
    ['hotel_funds_policy_summary_viewed', {
      policyState: 'not_returned', obligationTypes: 'unknown', scope: 'not_returned',
      provider: 'hotellook', surface: 'book_handoff',
    }],
    ['hotel_invoice_need_changed', { needed: true, source: 'hotellook', partnerNamed: false }],
    ['hotel_invoice_retry_clicked', { priorCheckState: 'error', source: 'other', scope: 'rate' }],
    ['hotel_invoice_readiness_viewed', {
      status: 'confirmed', documentTypes: 'invoice,receipt', invoiceIssuerRole: 'booking_provider',
      receiptIssuerRole: 'property', billingDetailsStep: 'during_partner_booking', source: 'hotellook', scope: 'rate',
    }],
    ['hotel_booking_help_opened', {
      source: 'hotellook', partnerHost: 'example.com', partnerNamed: true, locationPrecision: 'exact',
    }],
    ['hotel_loyalty_disclosure_opened', {
      source: 'other', partnerHost: 'external-provider', partnerNamed: false,
      handoffSessionId: '3eb5df1f-e028-40a8-a755-679e63579723',
    }],
  ])('accepts reconciled hotel evidence event %s', async (event, props) => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event,
      occurredAt: new Date().toISOString(),
      path: '/book',
      props,
    }))
    expect(response.status).toBe(202)
  })
})
