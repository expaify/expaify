import {
  type HotelAccessEvidenceState,
  type HotelAmenityConfidence,
  type HotelAmenityEvidence,
  type HotelEvidenceCertainty,
  type HotelEvidenceFee,
  type HotelEvidenceScope,
  type HotelEvidenceStatus,
} from '../types';

type AccessFact = {
  id: string;
  label: string;
  defaultScope: HotelEvidenceScope;
  kind: 'property' | 'room_request';
};

const ACCESS_FACTS: readonly AccessFact[] = [
  { id: 'elevator', label: 'Elevator', defaultScope: 'property', kind: 'property' },
  { id: 'on_site_parking', label: 'On-site parking', defaultScope: 'property', kind: 'property' },
  { id: 'step_free_route', label: 'Step-free route, entrance to room', defaultScope: 'property', kind: 'property' },
  { id: 'room_pref_ground_floor', label: 'Ground-floor room', defaultScope: 'room', kind: 'room_request' },
  { id: 'room_pref_high_floor', label: 'High-floor room', defaultScope: 'room', kind: 'room_request' },
  { id: 'room_pref_near_elevator', label: 'Room near the elevator', defaultScope: 'room', kind: 'room_request' },
  { id: 'room_pref_connecting', label: 'Connecting rooms', defaultScope: 'room', kind: 'room_request' },
];

const FACT_BY_ID = new Map(ACCESS_FACTS.map(fact => [fact.id, fact]));
const STATUS_PRECEDENCE: Record<HotelEvidenceStatus, number> = {
  unavailable: 0,
  unknown: 1,
  not_returned: 2,
  confirmed: 3,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function isStatus(value: unknown): value is HotelEvidenceStatus {
  return value === 'confirmed' || value === 'unavailable' || value === 'not_returned' || value === 'unknown';
}

function isScope(value: unknown): value is HotelEvidenceScope {
  return value === 'property' || value === 'room' || value === 'rate' || value === 'selected_stay';
}

function isFee(value: unknown): value is HotelEvidenceFee {
  return value === 'included' || value === 'paid' || value === 'unknown';
}

function isConfidence(value: unknown): value is HotelAmenityConfidence {
  return value === 'verified' || value === 'provider_only' || value === 'inferred' || value === 'unavailable';
}

function isCertainty(value: unknown): value is HotelEvidenceCertainty {
  return value === 'guaranteed' || value === 'requestable';
}

function validScope(fact: AccessFact, scope: HotelEvidenceScope): boolean {
  return fact.kind === 'property'
    ? scope === 'property'
    : scope === 'room' || scope === 'selected_stay';
}

function validConfirmedCombination(
  fact: AccessFact,
  scope: HotelEvidenceScope,
  certainty: HotelEvidenceCertainty | undefined
): boolean {
  if (fact.id === 'elevator' || fact.id === 'step_free_route') {
    return scope === 'property' && certainty === 'guaranteed';
  }
  if (fact.id === 'on_site_parking') {
    return scope === 'property' && (certainty === 'guaranteed' || certainty === 'requestable');
  }
  return (scope === 'room' && certainty === 'requestable')
    || (scope === 'selected_stay' && (certainty === 'guaranteed' || certainty === 'requestable'));
}

function notReturned(fact: AccessFact, sourceLabel: string): HotelAmenityEvidence {
  return {
    id: fact.id,
    label: fact.label,
    status: 'not_returned',
    scope: fact.defaultScope,
    sourceLabel,
  };
}

function unknownEvidence(
  fact: AccessFact,
  sourceLabel: string,
  scope: HotelEvidenceScope = fact.defaultScope
): HotelAmenityEvidence {
  return {
    id: fact.id,
    label: fact.label,
    status: 'unknown',
    scope: validScope(fact, scope) ? scope : fact.defaultScope,
    sourceLabel,
  };
}

function normalizeItem(
  value: unknown,
  fallbackSourceLabel: string
): HotelAmenityEvidence | undefined {
  if (!isRecord(value)) return undefined;
  const id = cleanString(value.id);
  if (!id) return undefined;
  const fact = FACT_BY_ID.get(id);
  if (!fact) return undefined;

  const sourceLabel = cleanString(value.sourceLabel);
  const status = value.status;
  const scope = value.scope;
  if (!isStatus(status) || !isScope(scope) || !validScope(fact, scope)) {
    return unknownEvidence(fact, sourceLabel ?? fallbackSourceLabel);
  }

  if ((status === 'confirmed' || status === 'unavailable') && !sourceLabel) {
    return unknownEvidence(fact, fallbackSourceLabel, scope);
  }

  const certainty = isCertainty(value.certainty) ? value.certainty : undefined;
  if (status === 'confirmed' && !validConfirmedCombination(fact, scope, certainty)) {
    return unknownEvidence(fact, sourceLabel ?? fallbackSourceLabel, scope);
  }

  const normalized: HotelAmenityEvidence = {
    id: fact.id,
    label: fact.label,
    status,
    scope,
    sourceLabel: sourceLabel ?? fallbackSourceLabel,
  };

  if (status === 'confirmed') normalized.certainty = certainty;
  if (fact.id === 'on_site_parking' && isFee(value.fee)) normalized.fee = value.fee;
  const fetchedAt = cleanString(value.fetchedAt);
  if (fetchedAt) normalized.fetchedAt = fetchedAt;
  if (isConfidence(value.confidence)) normalized.confidence = value.confidence;
  return normalized;
}

export function normalizeHotelAmenityEvidence(
  value: unknown,
  fallbackSourceLabel: string
): { evidence: HotelAmenityEvidence[]; state: HotelAccessEvidenceState } {
  const sourceLabel = cleanString(fallbackSourceLabel) ?? 'Hotel provider';
  if (value === undefined || value === null) {
    return { evidence: ACCESS_FACTS.map(fact => notReturned(fact, sourceLabel)), state: 'ready' };
  }
  if (!Array.isArray(value)) {
    return { evidence: ACCESS_FACTS.map(fact => notReturned(fact, sourceLabel)), state: 'error' };
  }

  const supplied = new Map<string, HotelAmenityEvidence>();
  for (const item of value) {
    const normalized = normalizeItem(item, sourceLabel);
    if (!normalized) continue;
    const current = supplied.get(normalized.id);
    if (!current || STATUS_PRECEDENCE[normalized.status] < STATUS_PRECEDENCE[current.status]) {
      supplied.set(normalized.id, normalized);
    }
  }

  return {
    evidence: ACCESS_FACTS.map(fact => supplied.get(fact.id) ?? notReturned(fact, sourceLabel)),
    state: 'ready',
  };
}
