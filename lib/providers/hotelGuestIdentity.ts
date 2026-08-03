import type {
  HotelGuestIdentityAffectedParty,
  HotelGuestIdentityCapability,
  HotelGuestIdentityDimensionState,
  HotelGuestIdentityEvidence,
  HotelGuestIdentityScope,
  HotelGuestIdentityStatement,
} from '../types';

const DIMENSION_STATES = new Set<HotelGuestIdentityDimensionState>([
  'confirmed', 'conditional', 'not_required', 'not_established', 'conflicting',
]);
const PARTIES = new Set<HotelGuestIdentityAffectedParty>([
  'lead_guest', 'cardholder', 'all_occupants', 'other', 'unspecified', 'not_established',
]);
const SCOPES = new Set<HotelGuestIdentityScope>(['property', 'rate', 'selected_stay']);

export const HOTEL_GUEST_IDENTITY_UNSUPPORTED: HotelGuestIdentityCapability = {
  affectedParty: false,
  identityDocument: { confirmed: false, conditional: false, explicitNegative: false, conflicting: false },
  paymentNameMatch: { confirmed: false, conditional: false, explicitNegative: false, conflicting: false },
  maxAgeSeconds: 0,
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function bounded(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

function validDate(value: unknown): string | undefined {
  const date = bounded(value, 64);
  return date && Number.isFinite(Date.parse(date)) ? date : undefined;
}

function statements(value: unknown): {
  statements: HotelGuestIdentityStatement[];
  omittedStatementCount: number;
  conflictSidesVisible: boolean;
} {
  if (!Array.isArray(value)) return { statements: [], omittedStatementCount: 0, conflictSidesVisible: true };
  const seen = new Set<string>();
  const normalized: HotelGuestIdentityStatement[] = [];
  for (const item of value) {
    const input = record(item);
    if (!input) continue;
    const id = bounded(input.id, 100);
    const sourceLabel = bounded(input.sourceLabel, 80);
    const sourceText = bounded(input.sourceText, 300);
    if (!id || seen.has(id) || !sourceLabel || !sourceText) continue;
    seen.add(id);
    const observedAt = validDate(input.observedAt);
    const conflictSide = input.conflictSide === 'affirmative' || input.conflictSide === 'negative'
      ? input.conflictSide
      : undefined;
    normalized.push({ id, sourceLabel, sourceText, ...(observedAt ? { observedAt } : {}), ...(conflictSide ? { conflictSide } : {}) });
  }
  if (normalized.length <= 3) {
    return { statements: normalized, omittedStatementCount: 0, conflictSidesVisible: true };
  }

  const affirmative = normalized.find(statement => statement.conflictSide === 'affirmative');
  const negative = normalized.find(statement => statement.conflictSide === 'negative');
  if (!affirmative || !negative) {
    return {
      statements: normalized.slice(0, 3),
      omittedStatementCount: normalized.length - 3,
      conflictSidesVisible: false,
    };
  }

  const requiredIds = new Set([affirmative.id, negative.id]);
  const visible = normalized.filter(statement => requiredIds.has(statement.id));
  const third = normalized.find(statement => !requiredIds.has(statement.id));
  if (third) visible.push(third);
  const visibleIds = new Set(visible.map(statement => statement.id));
  return {
    statements: normalized.filter(statement => visibleIds.has(statement.id)),
    omittedStatementCount: normalized.length - visibleIds.size,
    conflictSidesVisible: true,
  };
}

function capabilityAllows(
  state: HotelGuestIdentityDimensionState,
  capability: HotelGuestIdentityCapability['identityDocument'],
): boolean {
  if (state === 'not_established') return true;
  if (state === 'confirmed') return capability.confirmed;
  if (state === 'conditional') return capability.conditional;
  if (state === 'not_required') return capability.explicitNegative;
  return capability.conflicting;
}

export function notEstablishedHotelGuestIdentity(input: {
  propertyId: string;
  supplier: string;
  locale: string;
  scope?: HotelGuestIdentityScope;
  offerId?: string;
  state?: 'ready' | 'loading' | 'error';
}): HotelGuestIdentityEvidence {
  return {
    state: input.state ?? 'ready',
    scope: input.scope ?? 'property',
    propertyId: input.propertyId,
    ...(input.offerId ? { offerId: input.offerId } : {}),
    supplier: input.supplier,
    locale: input.locale,
    affectedParty: { value: 'not_established', state: 'not_established' },
    identityDocument: { state: 'not_established' },
    paymentNameMatch: { state: 'not_established' },
    statements: [],
    omittedStatementCount: 0,
  };
}

/**
 * Normalizes only contracted structured fields. `statements` are copied for display
 * after bounding and are deliberately never inspected to derive a party or state.
 */
export function normalizeHotelGuestIdentity(
  value: unknown,
  capability: HotelGuestIdentityCapability | undefined,
  expected: { propertyId: string; offerId: string; supplier: string; locale: string; now?: number },
): HotelGuestIdentityEvidence {
  const fallback = notEstablishedHotelGuestIdentity(expected);
  const input = record(value);
  if (!input || !capability) return fallback;
  const scope = SCOPES.has(input.scope as HotelGuestIdentityScope) ? input.scope as HotelGuestIdentityScope : undefined;
  const propertyId = bounded(input.propertyId, 200);
  const offerId = bounded(input.offerId, 200);
  const supplier = bounded(input.supplier, 80);
  const locale = bounded(input.locale, 35);
  const fetchedAt = validDate(input.fetchedAt);
  if (!scope || propertyId !== expected.propertyId || supplier !== expected.supplier || locale !== expected.locale) return fallback;
  if ((scope === 'rate' || scope === 'selected_stay') && offerId !== expected.offerId) return fallback;
  if (!fetchedAt || capability.maxAgeSeconds <= 0 || (expected.now ?? Date.now()) - Date.parse(fetchedAt) > capability.maxAgeSeconds * 1000) return fallback;
  if (input.state !== 'ready' && input.state !== 'loading' && input.state !== 'error') return fallback;

  const party = record(input.affectedParty) ?? {};
  const identity = record(input.identityDocument) ?? {};
  const payment = record(input.paymentNameMatch) ?? {};
  const partyState = DIMENSION_STATES.has(party.state as HotelGuestIdentityDimensionState)
    ? party.state as HotelGuestIdentityDimensionState : 'not_established';
  const partyValue = PARTIES.has(party.value as HotelGuestIdentityAffectedParty)
    ? party.value as HotelGuestIdentityAffectedParty : 'not_established';
  const identityState = DIMENSION_STATES.has(identity.state as HotelGuestIdentityDimensionState)
    ? identity.state as HotelGuestIdentityDimensionState : 'not_established';
  const paymentState = DIMENSION_STATES.has(payment.state as HotelGuestIdentityDimensionState)
    ? payment.state as HotelGuestIdentityDimensionState : 'not_established';

  const normalizedStatements = statements(input.statements);
  const upstreamOmittedStatementCount = typeof input.omittedStatementCount === 'number'
    && Number.isInteger(input.omittedStatementCount)
    && input.omittedStatementCount >= 0
    && input.omittedStatementCount <= 10_000
    ? input.omittedStatementCount
    : 0;
  const omittedStatementCount = upstreamOmittedStatementCount + normalizedStatements.omittedStatementCount;
  const hasConflictingDimension = partyState === 'conflicting'
    || identityState === 'conflicting'
    || paymentState === 'conflicting';
  const retainedConflictSides = normalizedStatements.statements.some(statement => statement.conflictSide === 'affirmative')
    && normalizedStatements.statements.some(statement => statement.conflictSide === 'negative');
  const conflictIsDisplaySafe = !hasConflictingDimension
    || (omittedStatementCount === 0 ? normalizedStatements.conflictSidesVisible : retainedConflictSides);
  const concreteParty = partyValue === 'lead_guest' || partyValue === 'cardholder' || partyValue === 'all_occupants' || partyValue === 'other';
  const normalizedPartyState = capability.affectedParty && (
    (partyState === 'confirmed' || partyState === 'conditional') ? concreteParty : partyState === 'conflicting'
  ) && (partyState !== 'conflicting' || conflictIsDisplaySafe) ? partyState : 'not_established';
  const normalizedPartyValue = normalizedPartyState === 'not_established'
    ? partyValue === 'unspecified' && normalizedStatements.statements.length > 0 ? 'unspecified' : 'not_established'
    : partyState === 'conflicting' ? 'not_established' : partyValue;
  const otherLabel = normalizedPartyValue === 'other' ? bounded(party.otherLabel, 80) : undefined;
  const safePartyValue = normalizedPartyValue === 'other' && !otherLabel ? 'not_established' : normalizedPartyValue;
  return {
    state: input.state,
    scope,
    propertyId,
    ...(offerId ? { offerId } : {}),
    supplier,
    locale,
    fetchedAt,
    affectedParty: {
      value: safePartyValue,
      state: safePartyValue === 'not_established' ? 'not_established' : normalizedPartyState,
      ...(otherLabel && safePartyValue === 'other' ? { otherLabel } : {}),
    },
    identityDocument: { state: capabilityAllows(identityState, capability.identityDocument) && (identityState !== 'conflicting' || conflictIsDisplaySafe) ? identityState : 'not_established' },
    paymentNameMatch: { state: capabilityAllows(paymentState, capability.paymentNameMatch) && (paymentState !== 'conflicting' || conflictIsDisplaySafe) ? paymentState : 'not_established' },
    statements: normalizedStatements.statements,
    omittedStatementCount,
  };
}
