import type {
  HotelSmokingDimension,
  HotelSmokingEvidenceState,
  HotelSmokingPolicy,
  HotelSmokingPolicyLoadState,
  HotelSmokingScope,
  PropertySmokingPolicyValue,
  RoomSmokingPolicyValue,
  SupplierSmokingStatement,
} from '../types';

const MAX_STATEMENTS_PER_DIMENSION = 20;
const MAX_ID_LENGTH = 200;
const MAX_SOURCE_LABEL_LENGTH = 100;
const MAX_SOURCE_TEXT_LENGTH = 2_000;

const ROOM_VALUES = new Set<RoomSmokingPolicyValue>([
  'all_rooms_non_smoking',
  'smoking_rooms_offered',
  'selected_room_non_smoking',
  'selected_room_smoking',
]);
const PROPERTY_VALUES = new Set<PropertySmokingPolicyValue>([
  'smoke_free_property',
  'indoor_common_areas_smoke_free',
  'designated_smoking_areas',
  'smoking_permitted_in_stated_areas',
]);
const SCOPES = new Set<HotelSmokingScope>([
  'property_room_inventory',
  'property_room_capability',
  'selected_room_rate',
  'entire_property',
  'indoor_common_areas',
  'designated_areas',
  'stated_areas',
  'unclear',
]);
const EVIDENCE_STATES = new Set<HotelSmokingEvidenceState>([
  'confirmed',
  'ambiguous',
  'conflicting',
  'not_provided',
  'unavailable',
]);
const LOAD_STATES = new Set<HotelSmokingPolicyLoadState>([
  'loading',
  'ready',
  'refreshing',
  'error',
]);

/** Policy evidence is current only for a provider whose data contract is listed here. */
export const HOTEL_SMOKING_POLICY_FRESHNESS_MS: Readonly<Record<string, number>> = {
  hotellook: 6 * 60 * 60 * 1_000,
};

type DimensionKind = 'room' | 'property';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) return null;
  return value;
}

/** Preserve visible supplier wording while removing display-unsafe control bytes. */
export function normalizeSupplierSmokingText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (normalized.trim().length === 0 || normalized.length > MAX_SOURCE_TEXT_LENGTH) return null;
  return normalized;
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 40) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function expectedScope(kind: DimensionKind, value: RoomSmokingPolicyValue | PropertySmokingPolicyValue): HotelSmokingScope {
  const scopes: Record<RoomSmokingPolicyValue | PropertySmokingPolicyValue, HotelSmokingScope> = {
    all_rooms_non_smoking: 'property_room_inventory',
    smoking_rooms_offered: 'property_room_capability',
    selected_room_non_smoking: 'selected_room_rate',
    selected_room_smoking: 'selected_room_rate',
    smoke_free_property: 'entire_property',
    indoor_common_areas_smoke_free: 'indoor_common_areas',
    designated_smoking_areas: 'designated_areas',
    smoking_permitted_in_stated_areas: 'stated_areas',
  };
  const scope = scopes[value];
  if ((kind === 'room') !== ROOM_VALUES.has(value as RoomSmokingPolicyValue)) return 'unclear';
  return scope;
}

function normalizeStatement(value: unknown, kind: DimensionKind): SupplierSmokingStatement | null {
  if (!isRecord(value)) return null;
  const id = boundedString(value.id, MAX_ID_LENGTH);
  const sourceLabel = boundedString(value.sourceLabel, MAX_SOURCE_LABEL_LENGTH);
  const sourceText = normalizeSupplierSmokingText(value.sourceText);
  const scope = value.scope;
  const statementValue = value.value;
  if (!id || !sourceLabel || !sourceText || !SCOPES.has(scope as HotelSmokingScope) || !validIsoTimestamp(value.fetchedAt)) {
    return null;
  }
  if (statementValue !== undefined) {
    const validValue = kind === 'room'
      ? ROOM_VALUES.has(statementValue as RoomSmokingPolicyValue)
      : PROPERTY_VALUES.has(statementValue as PropertySmokingPolicyValue);
    if (!validValue) return null;
  }

  const optionalIdFields = ['roomId', 'rateId'] as const;
  const normalized: SupplierSmokingStatement = {
    id,
    scope: scope as HotelSmokingScope,
    sourceLabel,
    sourceText,
    fetchedAt: value.fetchedAt,
  };
  if (statementValue !== undefined) normalized.value = statementValue as RoomSmokingPolicyValue | PropertySmokingPolicyValue;
  for (const field of optionalIdFields) {
    if (value[field] !== undefined) {
      const parsed = boundedString(value[field], MAX_ID_LENGTH);
      if (!parsed) return null;
      normalized[field] = parsed;
    }
  }
  for (const field of ['checkin', 'checkout'] as const) {
    if (value[field] !== undefined) {
      if (!validDate(value[field])) return null;
      normalized[field] = value[field];
    }
  }
  return normalized;
}

function unavailableDimension<T>(): HotelSmokingDimension<T> {
  return { state: 'unavailable', statements: [] };
}

export function notProvidedHotelSmokingPolicy(): HotelSmokingPolicy {
  return {
    loadState: 'ready',
    room: { state: 'not_provided', statements: [] },
    property: { state: 'not_provided', statements: [] },
  };
}

export function unavailableHotelSmokingPolicy(): HotelSmokingPolicy {
  return {
    loadState: 'error',
    room: unavailableDimension(),
    property: unavailableDimension(),
  };
}

function normalizeDimension<T extends RoomSmokingPolicyValue | PropertySmokingPolicyValue>(
  value: unknown,
  kind: DimensionKind,
  provider: string,
  nowMs: number,
): HotelSmokingDimension<T> | null {
  if (!isRecord(value) || !EVIDENCE_STATES.has(value.state as HotelSmokingEvidenceState) || !Array.isArray(value.statements)) return null;
  if (value.statements.length > MAX_STATEMENTS_PER_DIMENSION) return null;
  const statements = value.statements.map(statement => normalizeStatement(statement, kind));
  if (statements.some(statement => statement === null)) return null;
  const retained = statements as SupplierSmokingStatement[];
  const state = value.state as HotelSmokingEvidenceState;
  const normalizedValue = value.value;
  const normalizedScope = value.scope;

  if (state === 'not_provided' || state === 'unavailable') {
    if (retained.length > 0 || normalizedValue !== undefined || normalizedScope !== undefined) return null;
    return { state, statements: [] };
  }
  if (state === 'ambiguous') {
    if (retained.length < 1 || normalizedValue !== undefined) return null;
    return { state, statements: retained, ...(normalizedScope === 'unclear' ? { scope: 'unclear' as const } : {}) };
  }
  if (state === 'conflicting') {
    if (retained.length < 2 || normalizedValue !== undefined) return null;
    return { state, statements: retained };
  }

  const isAllowedValue = kind === 'room'
    ? ROOM_VALUES.has(normalizedValue as RoomSmokingPolicyValue)
    : PROPERTY_VALUES.has(normalizedValue as PropertySmokingPolicyValue);
  if (!isAllowedValue || !SCOPES.has(normalizedScope as HotelSmokingScope)) return null;
  const expected = expectedScope(kind, normalizedValue as T);
  if (expected === 'unclear' || normalizedScope !== expected || retained.length < 1) return null;
  if (!retained.some(statement => statement.value === normalizedValue && statement.scope === normalizedScope)) return null;

  if (normalizedValue === 'selected_room_non_smoking' || normalizedValue === 'selected_room_smoking') {
    const bound = retained.find(statement => statement.value === normalizedValue && statement.scope === 'selected_room_rate');
    if (!bound?.checkin || !bound.checkout || bound.checkout < bound.checkin || !bound.roomId || !bound.rateId) return null;
  }

  const freshnessMs = HOTEL_SMOKING_POLICY_FRESHNESS_MS[provider.toLowerCase()];
  const isStale = freshnessMs === undefined || retained.every(statement => nowMs - Date.parse(statement.fetchedAt) > freshnessMs);
  return {
    state,
    value: normalizedValue as T,
    scope: normalizedScope as HotelSmokingScope,
    statements: retained,
    ...(isStale ? { isStale: true } : {}),
  };
}

/** Invalid dimensions are isolated; an invalid top-level lifecycle becomes a policy-only error. */
export function normalizeHotelSmokingPolicy(
  value: unknown,
  provider: string,
  nowMs = Date.now(),
): HotelSmokingPolicy {
  if (!isRecord(value) || !LOAD_STATES.has(value.loadState as HotelSmokingPolicyLoadState)) {
    return unavailableHotelSmokingPolicy();
  }
  const loadState = value.loadState as HotelSmokingPolicyLoadState;
  const room = normalizeDimension<RoomSmokingPolicyValue>(value.room, 'room', provider, nowMs) ?? unavailableDimension();
  const property = normalizeDimension<PropertySmokingPolicyValue>(value.property, 'property', provider, nowMs) ?? unavailableDimension();

  if (loadState === 'error') return unavailableHotelSmokingPolicy();
  if (loadState === 'loading') {
    return { loadState, room: unavailableDimension(), property: unavailableDimension() };
  }
  return {
    loadState,
    room,
    property,
    ...(loadState === 'refreshing' && value.refreshFailed === true ? { refreshFailed: true } : {}),
  };
}

export function hasCurrentConfirmedSmokingEvidence(policy: HotelSmokingPolicy): boolean {
  return policy.loadState === 'ready' && [policy.room, policy.property].some(
    dimension => dimension.state === 'confirmed' && !dimension.isStale,
  );
}
