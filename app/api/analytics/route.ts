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
    hotel_detail_viewed: ['criteria_version', 'context_status', 'deal_id', 'hotel_id', 'entry_source', 'viewport_group', 'has_dates', 'has_verified_guest_rating', 'score_state', 'price_freshness_state'],
    hotel_decision_section_reached: ['hotel_id', 'entry_source', 'section', 'position', 'viewport_group'],
    hotel_room_handoff_started: ['hotel_id', 'entry_source', 'provider'],
    hotel_detail_back_to_results: ['hotel_id', 'entry_source'],
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
    hotel_admission_policy_viewed: ['hotel_id', 'surface', 'source', 'evidence_state', 'families_reported', 'viewport_group'],
    hotel_handoff_with_admission_restriction: ['hotel_id', 'surface', 'source', 'restricted_families'],
  }).map(([event, keys]) => [event, new Set(keys)]),
)

type Primitive = string | number | boolean

// Properties an event must always carry. A subset of an event's allowed
// properties may be conditionally absent (e.g. criteria_version when no
// criteria context resolved) and are intentionally left out here.
const REQUIRED_PROPERTIES: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries({
    hotel_criteria_summary_viewed: ['surface', 'criteria_version', 'destination_present', 'date_state', 'occupancy_state', 'room_state', 'criteria_source'],
    hotel_criteria_edit_started: ['surface', 'criteria_version', 'entry_point'],
    hotel_criteria_edit_cancelled: ['surface', 'criteria_version', 'entry_point', 'draft_changed'],
    hotel_criteria_edit_applied: ['changed_fields', 'previous_version', 'criteria_version', 'result_count_bucket'],
    hotel_results_viewed: ['criteria_version', 'result_state', 'destination_present', 'date_state', 'occupancy_state', 'room_state'],
    hotel_detail_viewed: ['context_status', 'deal_id'],
    hotel_provider_handoff_clicked: ['provider', 'deal_id', 'context_status', 'destination_present', 'date_state', 'occupancy_state', 'room_state'],
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
    hotel_admission_policy_viewed: ['hotel_id', 'surface', 'source', 'evidence_state', 'families_reported', 'viewport_group'],
    hotel_handoff_with_admission_restriction: ['hotel_id', 'surface', 'source', 'restricted_families'],
  }).map(([event, keys]) => [event, new Set(keys)]),
)

function oneOf(value: Primitive, options: readonly string[]): boolean {
  return typeof value === 'string' && options.includes(value)
}

function boundedInteger(value: Primitive, maximum: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum
}

function validFilterState(value: Primitive): boolean {
  if (typeof value !== 'string' || value.length > 240) return false
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    const expectedKeys = [
      'city_active', 'date_from_active', 'date_to_active', 'max_price_bucket',
      'min_discount', 'min_stars', 'personalization_active',
    ]
    if (Object.keys(parsed).sort().join(',') !== expectedKeys.sort().join(',')) return false
    return (
      typeof parsed.city_active === 'boolean' &&
      typeof parsed.date_from_active === 'boolean' &&
      typeof parsed.date_to_active === 'boolean' &&
      typeof parsed.personalization_active === 'boolean' &&
      ['any', 'under_100', 'under_150', 'under_200', 'under_300', 'other'].includes(String(parsed.max_price_bucket)) &&
      [0, 20, 30, 40, 'other'].includes(parsed.min_discount as number | string) &&
      [0, 3, 4, 5, 'other'].includes(parsed.min_stars as number | string)
    )
  } catch {
    return false
  }
}

function validPropertyValue(event: string, key: string, value: Primitive): boolean {
  if (key === 'criteria_version' || key === 'previous_version' || key === 'deal_id' || key === 'dealId' ||
    key === 'eventId' || key === 'hotel_id') {
    return typeof value === 'string' && OPAQUE_VALUE.test(value)
  }
  if (key === 'destination_present' || key === 'draft_changed' || key === 'premium_eligible' ||
    key === 'partnerNamed' || key === 'guidanceSeen' || key === 'has_dates' || key === 'has_verified_guest_rating') {
    return typeof value === 'boolean'
  }
  if (key === 'surface') return oneOf(value, ['results', 'detail', 'handoff'])
  if (key === 'date_state') return oneOf(value, ['checkin_window', 'missing'])
  if (key === 'occupancy_state' || key === 'room_state') return oneOf(value, ['applied', 'not_captured'])
  if (key === 'criteria_source') return oneOf(value, ['deals_page', 'destination_page', 'edit', 'restored'])
  if (key === 'entry_point') return oneOf(value, ['summary', 'empty_state', 'mismatch'])
  if (key === 'entry_source') return oneOf(value, ['search_results', 'saved_deal'])
  if (key === 'result_count_bucket') return oneOf(value, ['0', '1_5', '6_20', '21_plus'])
  if (key === 'result_state') return oneOf(value, ['empty', 'populated', 'sample', 'locked'])
  if (key === 'context_status') return oneOf(value, ['matched', 'mismatch', 'missing', 'invalid'])
  if (key === 'provider') return oneOf(value, ['expedia', 'booking', 'kiwi', 'trip'])
  if (key === 'viewport_group' || key === 'viewport_band') return oneOf(value, ['mobile_375', 'desktop_1280', 'other'])
  if (key === 'score_state') return oneOf(value, ['loading', 'confirmed', 'unavailable', 'error'])
  if (key === 'price_freshness_state') return oneOf(value, ['fresh', 'aging', 'stale', 'expired', 'unavailable'])
  if (key === 'section') return boundedInteger(value, 5)
  if (key === 'position') return boundedInteger(value, 5)
  if (key === 'changed_fields') {
    if (typeof value !== 'string') return false
    const fields = value === '' ? [] : value.split(',')
    return fields.length <= 3 && fields.every(field => ['date_from', 'date_to', 'destination'].includes(field)) &&
      fields.join(',') === [...fields].sort().join(',')
  }
  if (key === 'city') return typeof value === 'string' && TRACKED_MARKET_NAMES.includes(value)
  if (key === 'tier') return oneOf(value, ['anonymous', 'free', 'premium'])
  if (key === 'filter') return oneOf(value, ['city', 'minDiscount', 'minStars', 'maxPrice', 'dateFrom', 'dateTo'])
  if (key === 'source') {
    if (event === 'feed_filter_chip_removed') return oneOf(value, ['promoted', 'review_filters'])
    return oneOf(value, ['hotellook', 'duffel', 'amadeus', 'kiwi', 'travelpayouts', 'other'])
  }
  if (key === 'current_sort' || key === 'previous_sort' || key === 'sort_from' || key === 'sort_to') {
    return oneOf(value, ['recently_found', 'biggest_discount', 'lowest_nightly_price'])
  }
  if (key === 'sort_transition') {
    if (typeof value !== 'string') return false
    const [from, to, extra] = value.split('>')
    return extra === undefined &&
      oneOf(from, ['recently_found', 'biggest_discount', 'lowest_nightly_price']) &&
      oneOf(to, ['recently_found', 'biggest_discount', 'lowest_nightly_price'])
  }
  if (key === 'filter_state') return validFilterState(value)
  if (key === 'loaded_result_count' || key === 'card_position' || key === 'eligibleRequestCount' || key === 'selectedRequestCount') {
    return boundedInteger(value, 10_000)
  }
  if (key === 'request_ms') return boundedInteger(value, 600_000)
  if (key === 'priceCents') return boundedInteger(value, 100_000_000)
  if (key === 'currency') return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
  if (key === 'priceBasis') return value === 'per_night_before_taxes_fees'
  if (key === 'locationPrecision') return oneOf(value, ['exact', 'coordinates', 'area', 'search_area', 'missing'])
  if (key === 'partnerHost') {
    return typeof value === 'string' && value.length <= 253 &&
      (value === 'external-provider' || /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value))
  }
  if (key === 'awayDurationBucket') return oneOf(value, ['<5s', '5–30s', '30–120s', '120s+'])
  if (key === 'capabilityState') return value === 'provider_directed_only'
  if (key === 'condition') {
    return oneOf(value, [
      'control', 'confirmed', 'missing', 'partial', 'stale', 'conflict', 'property-error',
      'context-loading', 'property-loading', 'context-error', 'resolved', 'no-overlap',
    ])
  }
  if (key === 'sourceClass') return oneOf(value, ['property', 'provider', 'auditor', 'authority'])
  if (key === 'viewport') return oneOf(value, ['375', '1280'])
  if (key === 'evidenceState') return oneOf(value, ['loading', 'missing', 'partial', 'confirmed', 'stale', 'conflict', 'error'])
  if (key === 'signalType') {
    return oneOf(value, ['backup_power', 'connectivity_continuity', 'essential_service', 'current_operating_status', 'selected_stay_confirmation', 'destination_context'])
  }
  if (key === 'signalTypes') {
    if (typeof value !== 'string') return false
    return value === 'none' || value.split(',').every(item => (
      oneOf(item, ['backup_power', 'connectivity_continuity', 'essential_service', 'current_operating_status', 'selected_stay_confirmation'])
    ))
  }
  if (key === 'scope') {
    if (typeof value !== 'string') return false
    return value === 'none' || value.split(',').every(item => oneOf(item, ['property', 'room', 'rate', 'selected_stay']))
  }
  if (key === 'entrySurface') return value === 'hotel_detail'
  if (key === 'evidence_state') return oneOf(value, ['loading', 'error', 'not_provided', 'reported'])
  if (key === 'families_reported' || key === 'restricted_families') {
    if (typeof value !== 'string') return false
    if (key === 'families_reported' && value === 'none') return true
    const families = value.split(',')
    const order = ['checkin_age', 'checkin_identity', 'local_guest_restriction', 'occupancy_admission']
    return families.length > 0 && families.length <= 4 &&
      new Set(families).size === families.length &&
      families.every(family => order.includes(family)) &&
      families.every((family, index) => index === 0 || order.indexOf(family) > order.indexOf(families[index - 1]))
  }
  return false
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
