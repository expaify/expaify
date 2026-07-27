import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'

export const runtime = 'nodejs'

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT = /^[a-z][a-z0-9_]{1,79}$/
const PATH = /^\/[A-Za-z0-9_\-./]{0,299}$/
const OPAQUE_VALUE = /^[A-Za-z0-9_-]{1,100}$/

const EVENT_PROPERTIES: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries({
    hotel_criteria_summary_viewed: ['surface', 'criteria_version', 'destination_present', 'date_state', 'occupancy_state', 'room_state', 'criteria_source'],
    hotel_criteria_edit_started: ['surface', 'criteria_version', 'entry_point'],
    hotel_criteria_edit_cancelled: ['surface', 'criteria_version', 'entry_point', 'draft_changed'],
    hotel_criteria_edit_applied: ['changed_fields', 'previous_version', 'criteria_version', 'result_count_bucket'],
    hotel_results_viewed: ['criteria_version', 'result_state', 'destination_present', 'date_state', 'occupancy_state', 'room_state'],
    hotel_detail_viewed: ['criteria_version', 'context_status', 'deal_id'],
    hotel_provider_handoff_clicked: ['provider', 'deal_id', 'criteria_version', 'context_status', 'destination_present', 'date_state', 'occupancy_state', 'room_state'],
    feed_empty_filtered_viewed: [],
    feed_empty_cold_viewed: [],
    feed_filter_chip_removed: ['filter', 'source'],
    hotel_result_card_opened: ['current_sort', 'previous_sort', 'sort_transition', 'premium_eligible', 'loaded_result_count', 'viewport_band', 'filter_state', 'card_position'],
    hotel_sort_control_viewed: ['current_sort', 'premium_eligible', 'loaded_result_count', 'viewport_band', 'filter_state'],
    hotel_sort_changed: ['sort_from', 'sort_to', 'sort_transition', 'premium_eligible', 'loaded_result_count', 'viewport_band', 'filter_state', 'request_ms'],
    hotel_sort_disabled_attempted: ['sort_from', 'sort_to', 'sort_transition', 'premium_eligible', 'loaded_result_count', 'viewport_band', 'filter_state'],
    deal_stale_banner_viewed: ['dealId'],
    city_empty_viewed: ['city', 'tier'],
    city_watch_clicked: ['city'],
    city_watch_saved: ['city'],
    city_watch_failed: ['city'],
    city_join_cta_clicked: ['city', 'tier'],
    hotel_handoff_viewed: ['source', 'partnerHost', 'currency', 'priceCents', 'priceBasis', 'locationPrecision'],
    hotel_handoff_continue_clicked: ['source', 'partnerHost', 'currency', 'priceCents', 'priceBasis', 'locationPrecision', 'partnerNamed'],
    hotel_handoff_returned: ['source', 'partnerHost', 'awayDurationBucket'],
    hotel_handoff_back_clicked: ['source', 'partnerHost'],
    hotel_request_guidance_viewed: ['source', 'partnerHost', 'capabilityState', 'eligibleRequestCount'],
    hotel_request_handoff_continued: ['source', 'partnerHost', 'capabilityState', 'eligibleRequestCount', 'selectedRequestCount', 'guidanceSeen'],
    hotel_request_help_opened: ['source', 'partnerHost', 'capabilityState'],
    resilience_context_impression: ['condition', 'eventId', 'sourceClass', 'viewport'],
    resilience_summary_impression: ['dealId', 'evidenceState', 'signalTypes', 'scope'],
    resilience_source_opened: ['signalType', 'sourceClass'],
    resilience_disclosure_opened: ['dealId', 'evidenceState', 'entrySurface'],
  }).map(([event, keys]) => [event, new Set(keys)]),
)

type Primitive = string | number | boolean

const REQUIRED_PROPERTIES: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries({
    hotel_criteria_summary_viewed: ['surface', 'criteria_version', 'destination_present', 'date_state', 'occupancy_state', 'room_state', 'criteria_source'],
    hotel_criteria_edit_started: ['surface', 'criteria_version', 'entry_point'],
    hotel_criteria_edit_cancelled: ['surface', 'criteria_version', 'entry_point', 'draft_changed'],
    hotel_criteria_edit_applied: ['changed_fields', 'previous_version', 'criteria_version', 'result_count_bucket'],
    hotel_results_viewed: ['criteria_version', 'result_state', 'destination_present', 'date_state', 'occupancy_state', 'room_state'],
    hotel_detail_viewed: ['context_status', 'deal_id'],
    hotel_provider_handoff_clicked: ['provider', 'deal_id', 'context_status', 'destination_present', 'date_state', 'occupancy_state', 'room_state'],
  }).map(([event, keys]) => [event, new Set(keys)]),
)

function oneOf(value: Primitive, options: readonly string[]): boolean {
  return typeof value === 'string' && options.includes(value)
}

function validPropertyValue(event: string, key: string, value: Primitive): boolean {
  if (key === 'criteria_version' || key === 'previous_version' || key === 'deal_id') {
    return typeof value === 'string' && OPAQUE_VALUE.test(value)
  }
  if (key === 'destination_present' || key === 'draft_changed' || key === 'premium_eligible' || key === 'partnerNamed' || key === 'guidanceSeen') {
    return typeof value === 'boolean'
  }
  if (key === 'surface') return oneOf(value, ['results', 'detail', 'handoff'])
  if (key === 'date_state') return oneOf(value, ['exact_stay', 'checkin_window', 'missing'])
  if (key === 'occupancy_state' || key === 'room_state') return oneOf(value, ['applied', 'not_captured'])
  if (key === 'criteria_source') return oneOf(value, ['deals_page', 'destination_page', 'edit', 'restored'])
  if (key === 'entry_point') return oneOf(value, ['summary', 'empty_state', 'mismatch'])
  if (key === 'result_count_bucket') return oneOf(value, ['0', '1_5', '6_20', '21_plus'])
  if (key === 'result_state') return oneOf(value, ['empty', 'populated', 'sample', 'locked'])
  if (key === 'context_status') return oneOf(value, ['matched', 'mismatch', 'missing', 'invalid'])
  if (key === 'provider') return oneOf(value, ['expedia', 'booking', 'kiwi', 'trip'])
  if (key === 'changed_fields') {
    if (typeof value !== 'string') return false
    const fields = value === '' ? [] : value.split(',')
    return fields.length <= 3 && fields.every(field => ['date_from', 'date_to', 'destination'].includes(field)) &&
      fields.join(',') === [...fields].sort().join(',')
  }
  if (key === 'city') return typeof value === 'string' && TRACKED_MARKET_NAMES.includes(value)
  if (typeof value === 'string') return value.length <= 500 && !/[\r\n]/.test(value)
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1_000_000_000
  return typeof value === 'boolean'
}

function parseBody(value: unknown): {
  eventId: string
  sessionId: string
  event: string
  occurredAt: Date
  path: string
  props: Record<string, Primitive>
} | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (
    typeof body.eventId !== 'string' || !ID.test(body.eventId) ||
    typeof body.sessionId !== 'string' || !ID.test(body.sessionId) ||
    typeof body.event !== 'string' || !EVENT.test(body.event) ||
    typeof body.path !== 'string' || !PATH.test(body.path) ||
    typeof body.occurredAt !== 'string'
  ) return null
  const occurredAt = new Date(body.occurredAt)
  if (!Number.isFinite(occurredAt.getTime()) || Math.abs(Date.now() - occurredAt.getTime()) > 86_400_000) return null
  if (!body.props || typeof body.props !== 'object' || Array.isArray(body.props)) return null
  const entries = Object.entries(body.props as Record<string, unknown>)
  const allowedProperties = EVENT_PROPERTIES[body.event]
  if (!allowedProperties) return null
  const receivedKeys = new Set(entries.map(([key]) => key))
  const requiredProperties = REQUIRED_PROPERTIES[body.event]
  if (requiredProperties && [...requiredProperties].some(key => !receivedKeys.has(key))) return null
  if (entries.length > 30) return null
  const props: Record<string, Primitive> = {}
  for (const [key, item] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(key)) return null
    if (!allowedProperties.has(key)) return null
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') return null
    if (!validPropertyValue(body.event, key, item)) return null
    props[key] = item
  }
  return { eventId: body.eventId, sessionId: body.sessionId, event: body.event, occurredAt, path: body.path, props }
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid analytics payload' }, { status: 400 })
  }
  const event = parseBody(raw)
  if (!event) return NextResponse.json({ ok: false, reason: 'Invalid analytics payload' }, { status: 400 })

  try {
    await query(
      `INSERT INTO analytics_events
        (event_id, session_id, event_name, occurred_at, path, properties)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.sessionId, event.event, event.occurredAt.toISOString(), event.path, JSON.stringify(event.props)],
    )
  } catch {
    return NextResponse.json({ ok: false, reason: 'Analytics unavailable' }, { status: 503 })
  }
  return new NextResponse(null, { status: 202 })
}
