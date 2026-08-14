import type {
  HotelBillingDetailsStep,
  HotelDocumentIssuer,
  HotelDocumentIssuerRole,
  HotelDocumentReadiness,
  HotelBusinessDocumentEligibilityState,
  HotelDocumentAddresseeType,
  HotelDocumentCorrectionBoundary,
  HotelDocumentEntryStep,
  HotelEligibilitySource,
  HotelEligibilityVerificationTarget,
  HotelNameRelationship,
  HotelTaxIdentifierEligibility,
  HotelDocumentNameEligibility,
  HotelDocumentScope,
  HotelDocumentStatus,
  HotelDocumentType,
} from '../types';

const statuses = new Set<HotelDocumentStatus>(['confirmed', 'conditional', 'unavailable', 'not_provided', 'conflicting']);
const scopes = new Set<HotelDocumentScope>(['rate', 'selected_stay']);
const documentTypes = new Set<HotelDocumentType>(['invoice', 'receipt', 'booking_confirmation']);
const issuerRoles = new Set<HotelDocumentIssuerRole>(['booking_provider', 'property', 'split', 'unknown']);
const billingSteps = new Set<HotelBillingDetailsStep>([
  'during_partner_booking',
  'after_booking_contact_provider',
  'after_booking_contact_property',
  'at_checkout',
  'not_required',
  'unknown',
]);
const eligibilityStates = new Set<HotelBusinessDocumentEligibilityState>(['supported', 'unsupported', 'conditional', 'conflicting', 'not_provided']);
const entrySteps = new Set<HotelDocumentEntryStep>(['during_partner_booking', 'after_booking_contact_provider', 'after_booking_contact_property', 'at_checkout', 'not_provided']);
const addresseeTypes = new Set<HotelDocumentAddresseeType>(['individual', 'legal_entity']);
const relationships = new Set<HotelNameRelationship>(['same_required', 'different_allowed', 'not_provided']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : undefined;
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function issuer(value: unknown): HotelDocumentIssuer | undefined {
  if (!isRecord(value) || typeof value.role !== 'string' || !issuerRoles.has(value.role as HotelDocumentIssuerRole)) {
    return undefined;
  }
  const displayName = cleanString(value.displayName, 160);
  return { role: value.role as HotelDocumentIssuerRole, ...(displayName ? { displayName } : {}) };
}

function eligibilitySource(value: unknown, fallbackLabel: string): HotelEligibilitySource {
  const source = isRecord(value) ? value : {};
  const label = cleanString(source.label, 120) ?? cleanString(fallbackLabel, 120) ?? 'Hotel provider';
  const scope = typeof source.scope === 'string' && scopes.has(source.scope as HotelDocumentScope)
    ? source.scope as HotelDocumentScope
    : 'rate';
  const policyId = cleanString(source.policyId, 200);
  const observedAtValue = cleanString(source.observedAt, 64);
  const observedAt = observedAtValue && !Number.isNaN(Date.parse(observedAtValue)) ? observedAtValue : undefined;
  return { label, scope, ...(policyId ? { policyId } : {}), ...(observedAt ? { observedAt } : {}) };
}

function eligibilityTarget(value: unknown): HotelEligibilityVerificationTarget | undefined {
  if (!isRecord(value) || (value.role !== 'booking_provider' && value.role !== 'property')) return undefined;
  const url = safeUrl(value.url);
  return { role: value.role, ...(url ? { url } : {}) };
}

function eligibilityConflicts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const sourceLabel = cleanString(item.sourceLabel, 120);
    const statement = cleanString(item.statement, 240);
    return sourceLabel && statement ? [{ sourceLabel, statement }] : [];
  }).slice(0, 4);
}

function correctionBoundary(value: unknown): HotelDocumentCorrectionBoundary {
  if (!isRecord(value)) return { rule: 'not_provided' };
  if (value.rule === 'allowed_until' || value.rule === 'not_allowed_after') {
    const boundaryLabel = cleanString(value.boundaryLabel, 160);
    if (boundaryLabel) return { rule: value.rule, boundaryLabel };
  }
  return { rule: 'not_provided' };
}

function entryStep(value: unknown): HotelDocumentEntryStep {
  return typeof value === 'string' && entrySteps.has(value as HotelDocumentEntryStep)
    ? value as HotelDocumentEntryStep
    : 'not_provided';
}

function notProvidedTaxEligibility(sourceLabel: string): HotelTaxIdentifierEligibility {
  return {
    state: 'not_provided', entryStep: 'not_provided', correction: { rule: 'not_provided' },
    source: eligibilitySource(undefined, sourceLabel),
  };
}

function notProvidedNameEligibility(sourceLabel: string): HotelDocumentNameEligibility {
  return {
    state: 'not_provided', allowedAddresseeTypes: [],
    relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' },
    entryStep: 'not_provided', correction: { rule: 'not_provided' },
    source: eligibilitySource(undefined, sourceLabel),
  };
}

function normalizeTaxEligibility(value: unknown, fallbackLabel: string): HotelTaxIdentifierEligibility {
  const fallback = notProvidedTaxEligibility(fallbackLabel);
  if (!isRecord(value)) return fallback;
  const state = typeof value.state === 'string' && eligibilityStates.has(value.state as HotelBusinessDocumentEligibilityState)
    ? value.state as HotelBusinessDocumentEligibilityState : 'not_provided';
  const source = eligibilitySource(value.source, fallbackLabel);
  const identifierLabel = cleanString(value.identifierLabel, 120);
  const condition = cleanString(value.condition, 160);
  const conflicts = eligibilityConflicts(value.conflictStatements);
  const verificationTarget = eligibilityTarget(value.verificationTarget);
  const invalid = (state === 'supported' && !identifierLabel) || (state === 'conditional' && !condition) || (state === 'conflicting' && conflicts.length < 2);
  if (state === 'not_provided' || invalid) return { ...fallback, source, ...(verificationTarget ? { verificationTarget } : {}) };
  return {
    state, ...(identifierLabel ? { identifierLabel } : {}), ...(state === 'conditional' && condition ? { condition } : {}),
    entryStep: entryStep(value.entryStep), correction: correctionBoundary(value.correction), source,
    ...(state === 'conflicting' ? { conflictStatements: conflicts } : {}),
    ...(verificationTarget ? { verificationTarget } : {}),
  };
}

function normalizeNameEligibility(value: unknown, fallbackLabel: string): HotelDocumentNameEligibility {
  const fallback = notProvidedNameEligibility(fallbackLabel);
  if (!isRecord(value)) return fallback;
  const state = typeof value.state === 'string' && eligibilityStates.has(value.state as HotelBusinessDocumentEligibilityState)
    ? value.state as HotelBusinessDocumentEligibilityState : 'not_provided';
  const source = eligibilitySource(value.source, fallbackLabel);
  const allowed = Array.isArray(value.allowedAddresseeTypes)
    ? [...new Set(value.allowedAddresseeTypes.filter((item): item is HotelDocumentAddresseeType => typeof item === 'string' && addresseeTypes.has(item as HotelDocumentAddresseeType)))] : [];
  const unsupported = Array.isArray(value.unsupportedAddresseeTypes)
    ? [...new Set(value.unsupportedAddresseeTypes.filter((item): item is HotelDocumentAddresseeType => typeof item === 'string' && addresseeTypes.has(item as HotelDocumentAddresseeType)))] : [];
  const condition = cleanString(value.condition, 160);
  const conflicts = eligibilityConflicts(value.conflictStatements);
  const verificationTarget = eligibilityTarget(value.verificationTarget);
  const invalid = (state === 'supported' && allowed.length === 0) || (state === 'unsupported' && unsupported.length === 0) ||
    (state === 'conditional' && !condition) || (state === 'conflicting' && conflicts.length < 2);
  if (state === 'not_provided' || invalid) return { ...fallback, source, ...(verificationTarget ? { verificationTarget } : {}) };
  const relationshipInput = isRecord(value.relationships) ? value.relationships : {};
  const relationship = (role: 'guest' | 'booker' | 'cardholder'): HotelNameRelationship => (
    typeof relationshipInput[role] === 'string' && relationships.has(relationshipInput[role] as HotelNameRelationship)
      ? relationshipInput[role] as HotelNameRelationship : 'not_provided'
  );
  return {
    state, allowedAddresseeTypes: allowed, ...(unsupported.length ? { unsupportedAddresseeTypes: unsupported } : {}),
    ...(state === 'conditional' && condition ? { condition } : {}),
    relationships: { guest: relationship('guest'), booker: relationship('booker'), cardholder: relationship('cardholder') },
    entryStep: entryStep(value.entryStep), correction: correctionBoundary(value.correction), source,
    ...(state === 'conflicting' ? { conflictStatements: conflicts } : {}),
    ...(verificationTarget ? { verificationTarget } : {}),
  };
}

export function notProvidedHotelDocumentReadiness(sourceLabel: string): HotelDocumentReadiness {
  return {
    status: 'not_provided',
    scope: 'rate',
    documentTypes: [],
    issuerByDocument: {},
    billingDetailsStep: 'unknown',
    taxIdentifierEligibility: notProvidedTaxEligibility(sourceLabel),
    documentNameEligibility: notProvidedNameEligibility(sourceLabel),
    source: { label: cleanString(sourceLabel, 120) ?? 'Hotel provider' },
  };
}

/**
 * Converts provider or URL-boundary input to the only scalar evidence the UI may trust.
 * Invalid positive, negative, conditional, or conflicting claims degrade to not_provided.
 */
export function normalizeHotelDocumentReadiness(
  value: unknown,
  fallbackSourceLabel = 'Hotel provider',
): HotelDocumentReadiness {
  const fallback = notProvidedHotelDocumentReadiness(fallbackSourceLabel);
  if (!isRecord(value)) return fallback;

  const sourceInput = isRecord(value.source) ? value.source : {};
  const suppliedSourceLabel = cleanString(sourceInput.label, 120);
  const sourceLabel = suppliedSourceLabel ?? fallback.source.label;
  const policyId = cleanString(sourceInput.policyId, 200);
  const observedAtValue = cleanString(sourceInput.observedAt, 64);
  const observedAt = observedAtValue && !Number.isNaN(Date.parse(observedAtValue)) ? observedAtValue : undefined;
  const source = { label: sourceLabel, ...(policyId ? { policyId } : {}), ...(observedAt ? { observedAt } : {}) };

  const status = typeof value.status === 'string' && statuses.has(value.status as HotelDocumentStatus)
    ? value.status as HotelDocumentStatus
    : 'not_provided';
  const hasSuppliedScope = typeof value.scope === 'string' && scopes.has(value.scope as HotelDocumentScope);
  const scope = hasSuppliedScope
    ? value.scope as HotelDocumentScope
    : 'rate';
  const normalizedDocumentTypes = Array.isArray(value.documentTypes)
    ? [...new Set(value.documentTypes.filter((item): item is HotelDocumentType => (
      typeof item === 'string' && documentTypes.has(item as HotelDocumentType)
    )))]
    : [];
  const billingDetailsStep = typeof value.billingDetailsStep === 'string' && billingSteps.has(value.billingDetailsStep as HotelBillingDetailsStep)
    ? value.billingDetailsStep as HotelBillingDetailsStep
    : 'unknown';

  const issuerByDocument: HotelDocumentReadiness['issuerByDocument'] = {};
  if (isRecord(value.issuerByDocument)) {
    for (const type of normalizedDocumentTypes) {
      const normalizedIssuer = issuer(value.issuerByDocument[type]);
      if (normalizedIssuer) issuerByDocument[type] = normalizedIssuer;
    }
  }

  const condition = cleanString(value.condition, 160);
  const conditionIsSafe = Boolean(condition && !/[.!?]$/.test(condition));
  const conflictStatements = Array.isArray(value.conflictStatements)
    ? value.conflictStatements.flatMap((item) => {
      if (!isRecord(item)) return [];
      const statementSource = cleanString(item.sourceLabel, 120);
      const statement = cleanString(item.statement, 240);
      return statementSource && statement ? [{ sourceLabel: statementSource, statement }] : [];
    }).slice(0, 4)
    : [];

  let verificationTarget: HotelDocumentReadiness['verificationTarget'];
  if (isRecord(value.verificationTarget) && (
    value.verificationTarget.role === 'booking_provider' || value.verificationTarget.role === 'property'
  )) {
    const url = safeUrl(value.verificationTarget.url);
    verificationTarget = { role: value.verificationTarget.role, ...(url ? { url } : {}) };
  }

  const taxIdentifierEligibility = normalizeTaxEligibility(value.taxIdentifierEligibility, sourceLabel);
  const documentNameEligibility = normalizeNameEligibility(value.documentNameEligibility, sourceLabel);

  if (status === 'not_provided') {
    return { ...fallback, scope, source, taxIdentifierEligibility, documentNameEligibility, ...(verificationTarget ? { verificationTarget } : {}) };
  }
  if (
    (status === 'confirmed' && normalizedDocumentTypes.length === 0) ||
    (status === 'unavailable' && (!hasSuppliedScope || !suppliedSourceLabel)) ||
    (status === 'conditional' && !conditionIsSafe) ||
    (status === 'conflicting' && conflictStatements.length < 2)
  ) {
    return { ...fallback, scope, source, taxIdentifierEligibility, documentNameEligibility, ...(verificationTarget ? { verificationTarget } : {}) };
  }

  return {
    status,
    scope,
    documentTypes: normalizedDocumentTypes,
    issuerByDocument,
    billingDetailsStep,
    taxIdentifierEligibility,
    documentNameEligibility,
    ...(status === 'conditional' && condition ? { condition } : {}),
    source,
    ...(status === 'conflicting' ? { conflictStatements } : {}),
    ...(verificationTarget ? { verificationTarget } : {}),
  };
}
