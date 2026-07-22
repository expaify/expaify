import type {
  HotelBillingDetailsStep,
  HotelDocumentIssuer,
  HotelDocumentIssuerRole,
  HotelDocumentReadiness,
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

export function notProvidedHotelDocumentReadiness(sourceLabel: string): HotelDocumentReadiness {
  return {
    status: 'not_provided',
    scope: 'rate',
    documentTypes: [],
    issuerByDocument: {},
    billingDetailsStep: 'unknown',
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
  const sourceLabel = cleanString(sourceInput.label, 120) ?? fallback.source.label;
  const policyId = cleanString(sourceInput.policyId, 200);
  const observedAtValue = cleanString(sourceInput.observedAt, 64);
  const observedAt = observedAtValue && !Number.isNaN(Date.parse(observedAtValue)) ? observedAtValue : undefined;
  const source = { label: sourceLabel, ...(policyId ? { policyId } : {}), ...(observedAt ? { observedAt } : {}) };

  const status = typeof value.status === 'string' && statuses.has(value.status as HotelDocumentStatus)
    ? value.status as HotelDocumentStatus
    : 'not_provided';
  const scope = typeof value.scope === 'string' && scopes.has(value.scope as HotelDocumentScope)
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

  if (status === 'not_provided') {
    return { ...fallback, scope, source, ...(verificationTarget ? { verificationTarget } : {}) };
  }
  if (
    (status === 'confirmed' && normalizedDocumentTypes.length === 0) ||
    (status === 'conditional' && !conditionIsSafe) ||
    (status === 'conflicting' && conflictStatements.length < 2)
  ) {
    return { ...fallback, scope, source, ...(verificationTarget ? { verificationTarget } : {}) };
  }

  return {
    status,
    scope,
    documentTypes: normalizedDocumentTypes,
    issuerByDocument,
    billingDetailsStep,
    ...(status === 'conditional' && condition ? { condition } : {}),
    source,
    ...(status === 'conflicting' ? { conflictStatements } : {}),
    ...(verificationTarget ? { verificationTarget } : {}),
  };
}
