export const HOTEL_IDENTITY_RETURN_REASONS = [
  'lead_guest_id_requirement',
  'cardholder_presence_or_name_match',
  'all_occupants_id_requirement',
  'identity_requirement_unclear',
  'different_hotel_detail',
  'booking_completed',
  'prefer_not_to_say',
] as const;

export const HOTEL_IDENTITY_EVENT_PROPERTIES = {
  hotel_identity_disclosure_exposed: ['surface', 'evidence_state', 'affected_party_state', 'identity_document_state', 'payment_name_match_state', 'viewport_group', 'source_class'],
  hotel_identity_informed_exit: ['surface', 'evidence_state', 'affected_party_state', 'identity_document_state', 'payment_name_match_state', 'viewport_group', 'source_class', 'exit_action'],
  hotel_identity_handoff_continued: ['surface', 'evidence_state', 'affected_party_state', 'identity_document_state', 'payment_name_match_state', 'viewport_group', 'source_class', 'partner_named'],
  hotel_identity_handoff_returned: ['surface', 'evidence_state', 'affected_party_state', 'identity_document_state', 'payment_name_match_state', 'viewport_group', 'source_class', 'away_duration_bucket'],
  hotel_identity_return_reason_selected: ['affected_party_state', 'identity_document_state', 'payment_name_match_state', 'reason'],
} as const;

export type HotelIdentityEvent = keyof typeof HOTEL_IDENTITY_EVENT_PROPERTIES;
type Primitive = string | number | boolean;

const enumValues: Record<string, readonly Primitive[]> = {
  surface: ['result_detail', 'handoff'],
  evidence_state: ['confirmed', 'conditional', 'explicit_negative', 'not_established', 'error', 'conflicting', 'mixed'],
  affected_party_state: ['lead_guest', 'cardholder', 'all_occupants', 'other', 'unspecified', 'not_established', 'conflicting'],
  identity_document_state: ['confirmed', 'conditional', 'not_required', 'not_established', 'conflicting'],
  payment_name_match_state: ['confirmed', 'conditional', 'not_required', 'not_established', 'conflicting'],
  viewport_group: ['mobile_375', 'desktop_1280', 'other'],
  source_class: ['current_provider', 'other_provider', 'unnamed_provider'],
  exit_action: ['back_to_results', 'change_hotel'],
  partner_named: [true, false],
  away_duration_bucket: ['under_30s', '30s_to_2m', '2m_to_10m', 'over_10m'],
  reason: HOTEL_IDENTITY_RETURN_REASONS,
};

export function isHotelIdentityEvent(event: string): event is HotelIdentityEvent {
  return Object.prototype.hasOwnProperty.call(HOTEL_IDENTITY_EVENT_PROPERTIES, event);
}

/** Exact client/server privacy allowlist: no extra keys and no free-form values. */
export function validateHotelIdentityAnalytics(
  event: string,
  props: unknown,
): Record<string, Primitive> | null {
  if (!isHotelIdentityEvent(event) || typeof props !== 'object' || props === null || Array.isArray(props)) return null;
  const input = props as Record<string, unknown>;
  const expected = HOTEL_IDENTITY_EVENT_PROPERTIES[event];
  const keys = Object.keys(input);
  if (keys.length !== expected.length || keys.some(key => !(expected as readonly string[]).includes(key))) return null;
  const output: Record<string, Primitive> = {};
  for (const key of expected) {
    const value = input[key];
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null;
    if (!enumValues[key]?.includes(value)) return null;
    output[key] = value;
  }
  return output;
}
