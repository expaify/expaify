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

  it('stores a privacy-bounded invoice readiness exposure with independent tax-ID and document-name states', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_invoice_readiness_viewed',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        status: 'confirmed',
        documentTypes: 'invoice,receipt',
        invoiceIssuerRole: 'booking_provider',
        receiptIssuerRole: 'unknown',
        billingDetailsStep: 'during_partner_booking',
        source: 'hotellook',
        scope: 'rate',
        taxIdState: 'not_provided',
        documentNameState: 'supported',
        taxIdSourceClass: 'other',
        documentNameSourceClass: 'booking_provider',
      },
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      expect.arrayContaining(['hotel_invoice_readiness_viewed']),
    )
  })

  it('rejects an out-of-enum taxIdState even when the key is allowlisted', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_invoice_readiness_viewed',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        status: 'confirmed',
        documentTypes: 'invoice',
        invoiceIssuerRole: 'booking_provider',
        receiptIssuerRole: 'unknown',
        billingDetailsStep: 'during_partner_booking',
        source: 'hotellook',
        scope: 'rate',
        taxIdState: 'business_ready',
      },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('stores a dimension-scoped invoice verification click', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_invoice_verification_clicked',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        status: 'confirmed',
        documentTypes: 'none',
        invoiceIssuerRole: 'unknown',
        receiptIssuerRole: 'unknown',
        billingDetailsStep: 'unknown',
        source: 'other',
        scope: 'selected_stay',
        targetRole: 'property',
        dimension: 'tax_id',
        dimensionState: 'conditional',
        sourceClass: 'property',
      },
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      expect.arrayContaining(['hotel_invoice_verification_clicked']),
    )
  })

  it('rejects a dimension value outside the closed enum', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_invoice_verification_clicked',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        status: 'confirmed',
        documentTypes: 'none',
        invoiceIssuerRole: 'unknown',
        receiptIssuerRole: 'unknown',
        billingDetailsStep: 'unknown',
        source: 'other',
        scope: 'rate',
        targetRole: 'property',
        dimension: 'billing_details',
      },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('stores a handoff continuation carrying invoice and eligibility state', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_handoff_continue_clicked',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        source: 'hotellook',
        partnerHost: 'booking.com',
        currency: 'USD',
        priceCents: 12_000,
        priceBasis: 'per_night_before_taxes_fees',
        locationPrecision: 'exact',
        partnerNamed: true,
        invoiceNeeded: true,
        invoiceReadinessStatus: 'conflicting',
        taxIdState: 'conflicting',
        documentNameState: 'unsupported',
      },
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      expect.arrayContaining(['hotel_handoff_continue_clicked']),
    )
  })

  it('rejects a handoff continuation missing the required invoice readiness fields', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_handoff_continue_clicked',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        source: 'hotellook',
        partnerHost: 'booking.com',
        currency: 'USD',
        priceCents: 12_000,
        priceBasis: 'per_night_before_taxes_fees',
        locationPrecision: 'exact',
        partnerNamed: true,
      },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('stores an explicit return reason for an unclear tax-ID or document-name fact', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_handoff_return_reason_selected',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        reason: 'tax_id_unclear',
        offerId: 'offer_123',
        provider: 'hotellook',
        partnerHost: 'booking.com',
        handoffSessionId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      },
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      expect.arrayContaining(['hotel_handoff_return_reason_selected']),
    )
  })

  it('accepts a fallback-format handoff session id alongside the document-name-unclear reason', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_handoff_return_reason_selected',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        reason: 'document_name_unclear',
        offerId: 'offer_123',
        provider: 'duffel',
        partnerHost: 'booking.com',
        handoffSessionId: 'handoff-1732200000000',
      },
    }))

    expect(response.status).toBe(202)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      expect.arrayContaining(['hotel_handoff_return_reason_selected']),
    )
  })

  it('rejects a hotel return reason using the unrelated flight-provider enum', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_handoff_return_reason_selected',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        reason: 'tax_id_unclear',
        offerId: 'offer_123',
        provider: 'booking',
        partnerHost: 'booking.com',
        handoffSessionId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      },
    }))
    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects sensitive identifier or free-text values on eligibility events', async () => {
    const response = await POST(request({
      eventId: '5c3a83c9-fe75-4747-8171-a9b08c5c15a3',
      sessionId: '2e1572d9-5d76-469a-9eb6-6e84cc8e26a1',
      event: 'hotel_invoice_readiness_viewed',
      occurredAt: new Date().toISOString(),
      path: '/book',
      props: {
        status: 'confirmed',
        documentTypes: 'invoice',
        invoiceIssuerRole: 'booking_provider',
        receiptIssuerRole: 'unknown',
        billingDetailsStep: 'during_partner_booking',
        source: 'hotellook',
        scope: 'rate',
        identifierLabel: 'VAT number 123456',
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
