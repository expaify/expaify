import type {
  HotelAdmissionAgeEvidence,
  HotelAdmissionFamily,
  HotelAdmissionPolicyCapability,
  HotelAdmissionPolicyEvidence,
  HotelAdmissionPresentation,
  HotelAdmissionRow,
  HotelAdmissionStatementEvidence,
  HotelDocumentStatus,
  SupplierAdmissionStatement,
} from '../types';

const MAX_SOURCE_TEXT_LENGTH = 300;
const MAX_SOURCE_LABEL_LENGTH = 80;
const MAX_STATEMENTS_PER_FAMILY = 3;
const DOCUMENT_STATES = new Set<HotelDocumentStatus>(['confirmed', 'conditional', 'unavailable', 'not_provided', 'conflicting']);

export const ADMISSION_FAMILY_ORDER: readonly HotelAdmissionFamily[] = [
  'checkin_age',
  'checkin_identity',
  'local_guest_restriction',
  'occupancy_admission',
];

/** No current adapter may declare support without a documented supplier contract behind it. */
export const HOTEL_ADMISSION_POLICY_UNSUPPORTED: HotelAdmissionPolicyCapability = {
  checkin_age: false,
  checkin_identity: false,
  local_guest_restriction: false,
  occupancy_admission: false,
};

const FAMILY_LABELS: Record<HotelAdmissionFamily, string> = {
  checkin_age: 'Minimum check-in age',
  checkin_identity: 'ID and payment at check-in',
  local_guest_restriction: 'Local residents and registration ID',
  occupancy_admission: 'Who may occupy the room',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validAge(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function validStatements(value: unknown): SupplierAdmissionStatement[] {
  if (!Array.isArray(value)) return [];
  const statements: SupplierAdmissionStatement[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const sourceLabel = typeof item.sourceLabel === 'string' ? item.sourceLabel.trim() : '';
    const sourceText = typeof item.sourceText === 'string' ? item.sourceText.trim() : '';
    if (!id || !sourceLabel || !sourceText) continue;
    if (sourceLabel.length > MAX_SOURCE_LABEL_LENGTH || sourceText.length > MAX_SOURCE_TEXT_LENGTH) continue;
    const observedAt = typeof item.observedAt === 'string' ? item.observedAt : undefined;
    statements.push({ id, sourceLabel, sourceText, ...(observedAt !== undefined ? { observedAt } : {}) });
  }
  return statements;
}

type NormalizedFamily =
  | { state: 'not_provided' }
  | { state: 'unavailable'; statements: SupplierAdmissionStatement[] }
  | { state: 'confirmed' | 'conditional'; statements: SupplierAdmissionStatement[]; minimumAge?: number }
  | { state: 'confirmed_clear' }
  | { state: 'conflicting'; statements: SupplierAdmissionStatement[] };

function normalizeAgeFamily(value: unknown, capability: boolean): NormalizedFamily {
  if (!isRecord(value) || !DOCUMENT_STATES.has(value.state as HotelDocumentStatus)) return { state: 'not_provided' };
  const evidence = value as unknown as HotelAdmissionAgeEvidence;
  const state = evidence.state;

  if (state === 'not_provided') return { state: 'not_provided' };
  if (state === 'unavailable') return { state: 'unavailable', statements: validStatements(evidence.statements) };

  const minimumAge = validAge(evidence.minimumAge);
  if (minimumAge === null) return { state: 'not_provided' };
  // minimumAge === 0 states no restriction; it is never rendered as a fact, so the
  // whole family degrades rather than surfacing "0 or older" as a number.
  if (minimumAge === 0) return { state: 'not_provided' };
  const statements = validStatements(evidence.statements);

  if (state === 'conflicting') {
    return statements.length > 0 ? { state: 'conflicting', statements } : { state: 'not_provided' };
  }

  if (state === 'confirmed' || state === 'conditional') {
    if (minimumAge !== undefined && minimumAge > 0) {
      return { state, statements, minimumAge };
    }
    if (statements.length > 0) return { state, statements };
    if (state === 'confirmed' && minimumAge === undefined && statements.length === 0) {
      return capability ? { state: 'confirmed_clear' } : { state: 'not_provided' };
    }
    return { state: 'not_provided' };
  }

  return { state: 'not_provided' };
}

function normalizeStatementFamily(value: unknown, capability: boolean): NormalizedFamily {
  if (!isRecord(value) || !DOCUMENT_STATES.has(value.state as HotelDocumentStatus)) return { state: 'not_provided' };
  const evidence = value as unknown as HotelAdmissionStatementEvidence;
  const state = evidence.state;

  if (state === 'not_provided') return { state: 'not_provided' };
  if (state === 'unavailable') return { state: 'unavailable', statements: validStatements(evidence.statements) };

  const statements = validStatements(evidence.statements);

  if (state === 'conflicting') {
    return statements.length > 0 ? { state: 'conflicting', statements } : { state: 'not_provided' };
  }

  if (state === 'confirmed' || state === 'conditional') {
    if (statements.length > 0) return { state, statements };
    if (state === 'confirmed') return capability ? { state: 'confirmed_clear' } : { state: 'not_provided' };
    return { state: 'not_provided' };
  }

  return { state: 'not_provided' };
}

function restrictedSentence(family: HotelAdmissionFamily, conditional: boolean, minimumAge?: number): string {
  if (family === 'checkin_age') {
    return conditional
      ? `This property requires guests to be ${minimumAge} or older at check-in, with the conditions stated below.`
      : `This property requires guests to be ${minimumAge} or older at check-in.`;
  }
  if (family === 'checkin_identity') {
    return conditional
      ? 'This property applies the following identification and payment conditions at check-in in some cases.'
      : 'This property requires the registering guest to meet the following identification and payment conditions at check-in.';
  }
  if (family === 'local_guest_restriction') {
    return conditional
      ? 'This property applies the following restriction on local residents or registration ID at check-in in some cases.'
      : 'This property applies the following restriction on local residents or registration ID at check-in.';
  }
  return conditional
    ? 'This property applies the following restriction on who may be registered to occupy a room in some cases.'
    : 'This property applies the following restriction on who may be registered to occupy a room.';
}

function noRuleReportedSentence(family: HotelAdmissionFamily, provider: string): string {
  if (family === 'checkin_age') return `${provider} reports no minimum check-in age for this property.`;
  if (family === 'checkin_identity') return `${provider} reports no identification or payment-name condition at check-in for this property.`;
  if (family === 'local_guest_restriction') return `${provider} reports no local-resident or registration-ID restriction for this property.`;
  return `${provider} reports no restriction on who may be registered to occupy a room at this property.`;
}

function unavailableSentence(family: HotelAdmissionFamily, provider: string): string {
  if (family === 'checkin_age') return `${provider} could not confirm a minimum check-in age for this property.`;
  if (family === 'checkin_identity') return `${provider} could not confirm what identification or payment the registering guest must present at check-in.`;
  if (family === 'local_guest_restriction') return `${provider} could not confirm whether this property restricts local residents or requires a specific registration ID.`;
  return `${provider} could not confirm who this property will register to occupy a room.`;
}

function conflictingSentence(family: HotelAdmissionFamily, provider: string): string {
  if (family === 'checkin_age') return `${provider} returned conflicting statements about the minimum check-in age. Both are shown below.`;
  if (family === 'checkin_identity') return `${provider} returned conflicting statements about identification and payment at check-in. Both are shown below.`;
  if (family === 'local_guest_restriction') return `${provider} returned conflicting statements about local-resident and registration-ID rules. Both are shown below.`;
  return `${provider} returned conflicting statements about who may be registered to occupy a room. Both are shown below.`;
}

function buildRow(family: HotelAdmissionFamily, normalized: NormalizedFamily, provider: string): HotelAdmissionRow | null {
  if (normalized.state === 'not_provided') return null;

  const label = FAMILY_LABELS[family];

  if (normalized.state === 'confirmed_clear') {
    return {
      family,
      rowState: 'no_rule_reported',
      label,
      sentence: noRuleReportedSentence(family, provider),
      statements: [],
      omittedStatementCount: 0,
    };
  }

  if (normalized.state === 'unavailable') {
    return {
      family,
      rowState: 'unavailable',
      label,
      sentence: unavailableSentence(family, provider),
      statements: [],
      omittedStatementCount: 0,
    };
  }

  if (normalized.state === 'conflicting') {
    const shown = normalized.statements.slice(0, MAX_STATEMENTS_PER_FAMILY);
    return {
      family,
      rowState: 'conflicting',
      label,
      sentence: conflictingSentence(family, provider),
      statements: shown,
      omittedStatementCount: Math.max(0, normalized.statements.length - shown.length),
    };
  }

  // confirmed | conditional (restricted)
  const shown = normalized.statements.slice(0, MAX_STATEMENTS_PER_FAMILY);
  return {
    family,
    rowState: 'restricted',
    label,
    sentence: restrictedSentence(family, normalized.state === 'conditional', 'minimumAge' in normalized ? normalized.minimumAge : undefined),
    statements: shown,
    omittedStatementCount: Math.max(0, normalized.statements.length - shown.length),
  };
}

export function deriveAdmissionPolicyPresentation(params: {
  propertyId: string;
  supplier: string;
  providerName: string;
  evidence?: HotelAdmissionPolicyEvidence;
  capability?: HotelAdmissionPolicyCapability;
}): HotelAdmissionPresentation {
  const { propertyId, supplier, providerName, evidence, capability } = params;

  if (
    !evidence ||
    evidence.scope !== 'property' ||
    evidence.propertyId !== propertyId ||
    evidence.supplier !== supplier
  ) {
    return { state: 'not_provided' };
  }

  if (evidence.loadState === 'loading') return { state: 'loading' };
  if (evidence.loadState === 'error') return { state: 'error' };

  const cap: HotelAdmissionPolicyCapability = capability ?? HOTEL_ADMISSION_POLICY_UNSUPPORTED;

  const normalized: Record<HotelAdmissionFamily, NormalizedFamily> = {
    checkin_age: normalizeAgeFamily(evidence.families?.checkin_age, cap.checkin_age === true),
    checkin_identity: normalizeStatementFamily(evidence.families?.checkin_identity, cap.checkin_identity === true),
    local_guest_restriction: normalizeStatementFamily(evidence.families?.local_guest_restriction, cap.local_guest_restriction === true),
    occupancy_admission: normalizeStatementFamily(evidence.families?.occupancy_admission, cap.occupancy_admission === true),
  };

  const rows: HotelAdmissionRow[] = [];
  for (const family of ADMISSION_FAMILY_ORDER) {
    const row = buildRow(family, normalized[family], providerName);
    if (row) rows.push(row);
  }

  if (rows.length === 0) return { state: 'not_provided' };

  const coverageIncomplete = ADMISSION_FAMILY_ORDER.some(family => normalized[family].state === 'not_provided');
  const hasRestriction = rows.some(row => row.rowState === 'restricted');
  const fetchedAtDate = evidence.fetchedAt ? new Date(evidence.fetchedAt) : null;
  const fetchedAt = fetchedAtDate && Number.isFinite(fetchedAtDate.getTime()) ? evidence.fetchedAt : undefined;

  return {
    state: 'reported',
    rows,
    coverageIncomplete,
    hasRestriction,
    ...(fetchedAt !== undefined ? { fetchedAt } : {}),
  };
}
