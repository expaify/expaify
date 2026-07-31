import type {
  HotelFundsAmount,
  HotelFundsBasis,
  HotelFundsEvidenceRecord,
  HotelFundsEvidenceScope,
  HotelFundsMissingField,
  HotelFundsObligationType,
  HotelFundsPolicyEvidence,
  HotelFundsPolicyBridge,
  HotelFundsPolicyCapability,
  HotelFundsPolicyLoadState,
  HotelFundsPolicyState,
  Money,
} from '../types';

const POLICY_STATES = new Set<HotelFundsPolicyState>([
  'complete', 'partial', 'explicit_none', 'not_returned', 'conflicting',
]);
const OBLIGATION_TYPES = new Set<HotelFundsObligationType>([
  'authorization_hold', 'refundable_deposit', 'other_refundable_obligation',
]);
const BASES = new Set<HotelFundsBasis>([
  'per_stay', 'per_night', 'per_room', 'per_person', 'provider_defined', 'not_returned',
]);
const SCOPES = new Set<HotelFundsEvidenceScope>([
  'property', 'room', 'rate', 'selected_stay', 'not_returned',
]);
const MISSING_FIELD_ORDER: HotelFundsMissingField[] = [
  'mechanism', 'amount', 'basis', 'application_timing', 'payment_method',
  'return_or_release', 'scope', 'source',
];
const MAX_RECORDS = 10;
const MAX_SOURCE_LENGTH = 120;
const MAX_WORDING_LENGTH = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : undefined;
}

function normalizeSourceLabel(value: unknown, fallback: string): string {
  return boundedString(value, MAX_SOURCE_LENGTH) ?? boundedString(fallback, MAX_SOURCE_LENGTH) ?? 'Hotel provider';
}

function normalizeScope(value: unknown): HotelFundsEvidenceScope | undefined {
  return typeof value === 'string' && SCOPES.has(value as HotelFundsEvidenceScope)
    ? value as HotelFundsEvidenceScope
    : undefined;
}

function normalizeMoney(value: unknown): Money | undefined {
  if (!isRecord(value)) return undefined;
  const currency = boundedString(value.currency, 3)?.toUpperCase();
  return Number.isSafeInteger(value.priceCents) && (value.priceCents as number) >= 0 && /^[A-Z]{3}$/.test(currency ?? '')
    ? { priceCents: value.priceCents as number, currency: currency! }
    : undefined;
}

function normalizeAmount(value: unknown): HotelFundsAmount | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string') return undefined;
  if (value.kind === 'not_returned') return { kind: 'not_returned' };
  if (value.kind === 'exact') {
    const money = normalizeMoney(value.money);
    return money ? { kind: 'exact', money } : undefined;
  }
  if (value.kind === 'range') {
    const min = normalizeMoney(value.min);
    const max = normalizeMoney(value.max);
    return min && max && min.currency === max.currency && min.priceCents <= max.priceCents
      ? { kind: 'range', min, max }
      : undefined;
  }
  if (value.kind === 'percentage') {
    const percent = value.percent;
    const appliesTo = value.appliesTo;
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) return undefined;
    if (appliesTo === 'stay_price') return { kind: 'percentage', percent, appliesTo };
    const appliesToWording = boundedString(value.appliesToWording, MAX_WORDING_LENGTH);
    return appliesTo === 'other_documented_basis' && appliesToWording
      ? { kind: 'percentage', percent, appliesTo, appliesToWording }
      : undefined;
  }
  if (value.kind === 'variable') {
    const providerWording = boundedString(value.providerWording, MAX_WORDING_LENGTH);
    return providerWording ? { kind: 'variable', providerWording } : undefined;
  }
  return undefined;
}

type NormalizedRecord = { record: HotelFundsEvidenceRecord; missing: Set<HotelFundsMissingField>; usable: boolean };

function recordSignature(record: HotelFundsEvidenceRecord): string {
  return JSON.stringify(record);
}

const DECISION_FACT_FIELDS = [
  'type',
  'amount',
  'basis',
  'applicationWording',
  'paymentMethodWording',
  'returnOrRelease',
] as const satisfies ReadonlyArray<keyof HotelFundsEvidenceRecord>;

function factsAreCompatible(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return true;
  if (!isRecord(left) || !isRecord(right)) return Object.is(left, right);

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every(key => factsAreCompatible(left[key], right[key]));
}

function recordsAreIncompatible(
  left: HotelFundsEvidenceRecord,
  right: HotelFundsEvidenceRecord,
): boolean {
  return DECISION_FACT_FIELDS.some(field => !factsAreCompatible(left[field], right[field]));
}

function hasIncompatibleRecordPair(records: readonly NormalizedRecord[]): boolean {
  return records.some((candidate, index) => (
    records.slice(index + 1).some(other => recordsAreIncompatible(candidate.record, other.record))
  ));
}

function normalizeRecord(value: unknown, fallbackSource: string): NormalizedRecord | null {
  if (!isRecord(value)) return null;
  const missing = new Set<HotelFundsMissingField>();
  const type = typeof value.type === 'string' && OBLIGATION_TYPES.has(value.type as HotelFundsObligationType)
    ? value.type as HotelFundsObligationType
    : undefined;
  const amount = normalizeAmount(value.amount);
  const basis = typeof value.basis === 'string' && BASES.has(value.basis as HotelFundsBasis)
    ? value.basis as HotelFundsBasis
    : undefined;
  const applicationWording = boundedString(value.applicationWording, MAX_WORDING_LENGTH);
  const paymentMethodWording = boundedString(value.paymentMethodWording, MAX_WORDING_LENGTH);
  const suppliedSource = boundedString(value.sourceLabel, MAX_SOURCE_LENGTH);
  const suppliedScope = normalizeScope(value.scope);
  const sourceLabel = normalizeSourceLabel(suppliedSource, fallbackSource);
  const scope = suppliedScope ?? 'not_returned';

  if (!type) missing.add('mechanism');
  if (!amount || amount.kind === 'not_returned') missing.add('amount');
  if (!basis || basis === 'not_returned') missing.add('basis');
  if (!applicationWording) missing.add('application_timing');
  if (!paymentMethodWording) missing.add('payment_method');
  if (!suppliedScope || suppliedScope === 'not_returned') missing.add('scope');
  if (!suppliedSource) missing.add('source');

  let returnOrRelease: HotelFundsEvidenceRecord['returnOrRelease'];
  if (isRecord(value.returnOrRelease)) {
    const action = value.returnOrRelease.action;
    const providerWording = boundedString(value.returnOrRelease.providerWording, MAX_WORDING_LENGTH);
    const issuerProcessingWording = boundedString(value.returnOrRelease.issuerProcessingWording, MAX_WORDING_LENGTH);
    const actionMatches = action === 'release'
      ? type === 'authorization_hold'
      : action === 'refund' && (type === 'refundable_deposit' || type === 'other_refundable_obligation');
    if (actionMatches && providerWording && (action === 'release' || action === 'refund')) {
      returnOrRelease = { action, providerWording, ...(issuerProcessingWording ? { issuerProcessingWording } : {}) };
    }
  }
  if (!returnOrRelease) missing.add('return_or_release');

  const record: HotelFundsEvidenceRecord = {
    ...(type ? { type } : {}),
    ...(amount ? { amount } : {}),
    ...(basis ? { basis } : {}),
    ...(applicationWording ? { applicationWording } : {}),
    ...(paymentMethodWording ? { paymentMethodWording } : {}),
    ...(returnOrRelease ? { returnOrRelease } : {}),
    sourceLabel,
    scope,
  };
  const usable = Boolean(type || amount || basis || applicationWording || paymentMethodWording || returnOrRelease);
  return { record, missing, usable };
}

export function createNotReturnedHotelFundsPolicy(sourceLabel: string): HotelFundsPolicyEvidence {
  return {
    state: 'not_returned',
    obligations: [],
    sourceLabel: normalizeSourceLabel(undefined, sourceLabel),
    scope: 'not_returned',
  };
}

export function normalizeHotelFundsPolicyCapability(input: unknown): HotelFundsPolicyCapability {
  return { policy: isRecord(input) && input.policy === true };
}

export function normalizeHotelFundsPolicyLoadState(input: unknown): HotelFundsPolicyLoadState {
  return input === 'loading' || input === 'error' ? input : 'ready';
}

export function normalizeHotelFundsPolicyBridge(input: {
  provider?: unknown;
  capability?: unknown;
  evidence?: unknown;
  loadState?: unknown;
} | unknown): HotelFundsPolicyBridge {
  const record = isRecord(input) ? input : {};
  const provider = normalizeSourceLabel(record.provider, 'Hotel provider');
  const capability = normalizeHotelFundsPolicyCapability(record.capability);
  const evidence = normalizeHotelFundsPolicyEvidence(record.evidence, provider);
  const contradictory = !capability.policy && evidence.state !== 'not_returned';
  return {
    provider,
    capability,
    evidence: contradictory ? createNotReturnedHotelFundsPolicy(evidence.sourceLabel) : evidence,
    loadState: normalizeHotelFundsPolicyLoadState(record.loadState),
  };
}

export function createUnsupportedHotelFundsPolicyBridge(
  provider: string,
  sourceLabel = provider,
): HotelFundsPolicyBridge {
  return normalizeHotelFundsPolicyBridge({
    provider,
    capability: { policy: false },
    evidence: createNotReturnedHotelFundsPolicy(sourceLabel),
    loadState: 'ready',
  });
}

export function normalizeHotelFundsPolicyEvidence(
  input: unknown,
  fallbackSourceLabel: string,
): HotelFundsPolicyEvidence {
  const fallback = createNotReturnedHotelFundsPolicy(fallbackSourceLabel);
  if (!isRecord(input) || typeof input.state !== 'string' || !POLICY_STATES.has(input.state as HotelFundsPolicyState)) {
    return fallback;
  }

  const state = input.state as HotelFundsPolicyState;
  const suppliedSource = boundedString(input.sourceLabel, MAX_SOURCE_LENGTH);
  const sourceLabel = normalizeSourceLabel(suppliedSource, fallback.sourceLabel);
  const scope = normalizeScope(input.scope) ?? 'not_returned';
  const fetchedAtValue = boundedString(input.fetchedAt, 40);
  const fetchedAt = fetchedAtValue && !Number.isNaN(Date.parse(fetchedAtValue)) ? fetchedAtValue : undefined;
  const normalizedRecords = Array.isArray(input.obligations)
    ? input.obligations.slice(0, MAX_RECORDS).map(value => normalizeRecord(value, sourceLabel)).filter((value): value is NormalizedRecord => value !== null)
    : [];
  const usableRecords = normalizedRecords.filter(value => value.usable);

  if (state === 'not_returned') return { ...fallback, sourceLabel };
  if (state === 'explicit_none') {
    if (!Array.isArray(input.obligations) || input.obligations.length > 0 || !suppliedSource || scope === 'not_returned') return fallback;
    return { state, obligations: [], sourceLabel, scope, ...(fetchedAt ? { fetchedAt } : {}) };
  }

  const conflictRecords = Array.isArray(input.conflictingRecords)
    ? input.conflictingRecords.slice(0, MAX_RECORDS).map(value => normalizeRecord(value, sourceLabel)).filter((value): value is NormalizedRecord => value !== null && value.usable)
    : [];
  const distinctConflictRecords = conflictRecords.filter((candidate, index, records) => (
    records.findIndex(record => recordSignature(record.record) === recordSignature(candidate.record)) === index
  ));
  if (state === 'conflicting' && hasIncompatibleRecordPair(distinctConflictRecords)) {
    return {
      state,
      obligations: usableRecords.map(value => value.record),
      sourceLabel,
      scope,
      ...(fetchedAt ? { fetchedAt } : {}),
      conflictingRecords: distinctConflictRecords.map(value => value.record),
    };
  }

  const candidates = state === 'conflicting' ? conflictRecords : usableRecords;
  if (candidates.length === 0) return fallback;
  const missing = new Set<HotelFundsMissingField>();
  for (const candidate of candidates) for (const field of candidate.missing) missing.add(field);
  if (!suppliedSource) missing.add('source');
  if (scope === 'not_returned') missing.add('scope');
  const normalizedState: HotelFundsPolicyState = missing.size === 0 ? 'complete' : 'partial';

  return {
    state: normalizedState,
    obligations: candidates.map(value => value.record),
    sourceLabel,
    scope,
    ...(fetchedAt ? { fetchedAt } : {}),
    ...(normalizedState === 'partial'
      ? { missingFields: MISSING_FIELD_ORDER.filter(field => missing.has(field)) }
      : {}),
  };
}

export type HotelFundsAnalyticsDimensions = {
  policyState: HotelFundsPolicyState | 'error';
  obligationTypes: string;
  scope: HotelFundsEvidenceScope;
  provider: string;
  surface: 'hotel_card' | 'book_handoff';
};

export function getHotelFundsAnalyticsDimensions(input: {
  evidence: unknown;
  loadState?: 'loading' | 'ready' | 'error';
  provider: string;
  surface: 'hotel_card' | 'book_handoff';
}): HotelFundsAnalyticsDimensions {
  const provider = boundedString(input.provider.toLowerCase(), 40)?.replace(/[^a-z0-9_-]/g, '_') || 'unknown';
  if (input.loadState === 'error') {
    return { policyState: 'error', obligationTypes: 'unknown', scope: 'not_returned', provider, surface: input.surface };
  }
  const evidence = normalizeHotelFundsPolicyEvidence(input.evidence, provider);
  const analyticsRecords = evidence.state === 'conflicting'
    ? evidence.conflictingRecords ?? []
    : evidence.obligations;
  const types = [...new Set(analyticsRecords.map(record => record.type).filter((type): type is HotelFundsObligationType => Boolean(type)))].sort();
  return {
    policyState: evidence.state,
    obligationTypes: evidence.state === 'explicit_none' ? 'none' : types.join(',') || 'unknown',
    scope: evidence.scope,
    provider,
    surface: input.surface,
  };
}
