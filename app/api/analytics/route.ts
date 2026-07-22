import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export const runtime = 'nodejs';

type Scalar = string | number | boolean;
type EventRule = { required: readonly string[]; allowed: readonly string[] };

const SNAPSHOT_FIELDS = [
  'offerId', 'provider', 'roomEvidenceState', 'roomScope',
  'propertyEvidenceState', 'propertyScope',
] as const;

const EVENT_RULES: Readonly<Record<string, EventRule>> = {
  hotel_smoking_policy_detail_viewed: { required: SNAPSHOT_FIELDS, allowed: SNAPSHOT_FIELDS },
  hotel_smoking_policy_review_viewed: { required: SNAPSHOT_FIELDS, allowed: SNAPSHOT_FIELDS },
  hotel_smoking_filter_explanation_viewed: {
    required: ['availabilityReason', 'confirmedCoverageCount'],
    allowed: ['availabilityReason', 'confirmedCoverageCount'],
  },
  hotel_smoking_filter_option_selected: {
    required: ['option', 'preFilterTotalCount', 'preFilterConfirmedCount', 'preFilterUnconfirmedCount'],
    allowed: ['option', 'preFilterTotalCount', 'preFilterConfirmedCount', 'preFilterUnconfirmedCount'],
  },
  hotel_smoking_filter_results_rendered: {
    required: ['option', 'confirmedCount', 'unconfirmedCount'],
    allowed: ['option', 'confirmedCount', 'unconfirmedCount'],
  },
  hotel_handoff_return_reason_selected: {
    required: ['reason', 'offerId', 'provider', 'partnerHost', 'handoffSessionId'],
    allowed: ['reason', 'offerId', 'provider', 'partnerHost', 'handoffSessionId'],
  },
};

const EVIDENCE_STATES = new Set(['confirmed', 'ambiguous', 'conflicting', 'not_provided', 'unavailable']);
const SCOPES = new Set([
  'property_room_inventory', 'property_room_capability', 'selected_room_rate', 'entire_property',
  'indoor_common_areas', 'designated_areas', 'stated_areas', 'unclear', 'not_applicable',
]);
const FILTER_OPTIONS = new Set(['smoke_free_property', 'selected_room_non_smoking', 'selected_room_smoking']);
const RETURN_REASONS = new Set([
  'smoking_policy_or_room_mismatch', 'price_or_fees_mismatch', 'room_availability_mismatch',
  'other_hotel_details_mismatch', 'prefer_not_to_say',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validScalar(value: unknown): value is Scalar {
  return typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.length > 0 && value.length <= 200);
}

function validEnumFields(props: Record<string, unknown>): boolean {
  return (!props.roomEvidenceState || EVIDENCE_STATES.has(String(props.roomEvidenceState))) &&
    (!props.propertyEvidenceState || EVIDENCE_STATES.has(String(props.propertyEvidenceState))) &&
    (!props.roomScope || SCOPES.has(String(props.roomScope))) &&
    (!props.propertyScope || SCOPES.has(String(props.propertyScope))) &&
    (!props.option || FILTER_OPTIONS.has(String(props.option))) &&
    (!props.reason || RETURN_REASONS.has(String(props.reason))) &&
    (!props.availabilityReason || ['no_normalized_provider_coverage', 'coverage_check_unavailable'].includes(String(props.availabilityReason)));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.event !== 'string' || !isRecord(body.props) || typeof body.sessionId !== 'string') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const props = body.props as Record<string, unknown>;
  const rule = EVENT_RULES[body.event];
  const propKeys = Object.keys(props);
  if (
    !rule ||
    body.sessionId.length > 100 ||
    rule.required.some(key => !validScalar(props[key])) ||
    propKeys.some(key => !rule.allowed.includes(key)) ||
    propKeys.some(key => !validScalar(props[key])) ||
    !validEnumFields(props)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await query(
      `INSERT INTO product_analytics_events (event_name, analytics_session_id, properties)
       VALUES ($1, $2, $3::jsonb)`,
      [body.event, body.sessionId, JSON.stringify(props)],
    );
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
