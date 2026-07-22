import type {
  HotelAgeEligibility,
  HotelMembershipEligibility,
  HotelRateEligibilityEvidence,
  HotelRateRestrictionFamily,
  HotelRefundabilityEligibility,
  HotelResidencyEligibility,
} from '../types';

const UNKNOWN_MEMBERSHIP = { state: 'not_provided' } as const;
const UNKNOWN_RESIDENCY = { state: 'not_provided' } as const;
const UNKNOWN_AGE = { state: 'not_provided' } as const;
const UNKNOWN_REFUNDABILITY = { state: 'not_provided' } as const;
const SAFE_LABEL_LENGTH = 80;

export type RateEligibilityPresentation =
  | { state: 'restricted'; conditions: readonly { family: HotelRateRestrictionFamily; label: string }[]; coverageIncomplete: boolean; fetchedAt?: string }
  | { state: 'clear'; fetchedAt?: string }
  | { state: 'not_provided'; fetchedAt?: string }
  | { state: 'loading' }
  | { state: 'error' };

export type RateEligibilityAnalytics = {
  overallState: 'restricted' | 'clear' | 'not_provided';
  restrictionTypes: string;
  knownRestrictionCount: number;
  coverageCount: number;
  eligibilityLoadStatus: 'ready' | 'loading' | 'error';
};

function safeString(value: unknown, maxLength = SAFE_LABEL_LENGTH): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : undefined;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime());
}

function validProvenance(value: unknown, supplier: string, fetchedAt: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { supplier?: unknown; fetchedAt?: unknown };
  return candidate.supplier === supplier && candidate.fetchedAt === fetchedAt && validTimestamp(candidate.fetchedAt);
}

function normalizeMembership(value: unknown, supplier: string, fetchedAt: string): HotelMembershipEligibility {
  if (!value || typeof value !== 'object') return UNKNOWN_MEMBERSHIP;
  const candidate = value as { state?: unknown; membershipLabel?: unknown; provenance?: unknown };
  if (candidate.state === 'not_provided') return UNKNOWN_MEMBERSHIP;
  if (!validProvenance(candidate.provenance, supplier, fetchedAt)) return UNKNOWN_MEMBERSHIP;
  if (candidate.state === 'clear') return { state: 'clear', provenance: { supplier, fetchedAt } };
  if (candidate.state !== 'restricted') return UNKNOWN_MEMBERSHIP;
  const membershipLabel = safeString(candidate.membershipLabel);
  return {
    state: 'restricted',
    ...(membershipLabel ? { membershipLabel } : {}),
    provenance: { supplier, fetchedAt },
  };
}

function normalizeResidency(value: unknown, supplier: string, fetchedAt: string): HotelResidencyEligibility {
  if (!value || typeof value !== 'object') return UNKNOWN_RESIDENCY;
  const candidate = value as { state?: unknown; placeLabel?: unknown; provenance?: unknown };
  if (candidate.state === 'not_provided') return UNKNOWN_RESIDENCY;
  if (!validProvenance(candidate.provenance, supplier, fetchedAt)) return UNKNOWN_RESIDENCY;
  if (candidate.state === 'clear') return { state: 'clear', provenance: { supplier, fetchedAt } };
  const placeLabel = safeString(candidate.placeLabel);
  return candidate.state === 'restricted' && placeLabel
    ? { state: 'restricted', placeLabel, provenance: { supplier, fetchedAt } }
    : UNKNOWN_RESIDENCY;
}

function normalizeAge(value: unknown, supplier: string, fetchedAt: string): HotelAgeEligibility {
  if (!value || typeof value !== 'object') return UNKNOWN_AGE;
  const candidate = value as { state?: unknown; minAge?: unknown; maxAge?: unknown; provenance?: unknown };
  if (candidate.state === 'not_provided') return UNKNOWN_AGE;
  if (!validProvenance(candidate.provenance, supplier, fetchedAt)) return UNKNOWN_AGE;
  if (candidate.state === 'clear') return { state: 'clear', provenance: { supplier, fetchedAt } };
  if (candidate.state !== 'restricted') return UNKNOWN_AGE;
  const minAge = candidate.minAge;
  const maxAge = candidate.maxAge;
  const minValid = minAge === undefined || (Number.isSafeInteger(minAge) && (minAge as number) >= 0);
  const maxValid = maxAge === undefined || (Number.isSafeInteger(maxAge) && (maxAge as number) >= 0);
  if (!minValid || !maxValid || (minAge === undefined && maxAge === undefined)) return UNKNOWN_AGE;
  if (minAge !== undefined && maxAge !== undefined && (minAge as number) > (maxAge as number)) return UNKNOWN_AGE;
  return {
    state: 'restricted',
    ...(minAge !== undefined ? { minAge: minAge as number } : {}),
    ...(maxAge !== undefined ? { maxAge: maxAge as number } : {}),
    provenance: { supplier, fetchedAt },
  };
}

function normalizeRefundability(value: unknown, supplier: string, fetchedAt: string): HotelRefundabilityEligibility {
  if (!value || typeof value !== 'object') return UNKNOWN_REFUNDABILITY;
  const candidate = value as { state?: unknown; provenance?: unknown };
  if (candidate.state === 'not_provided') return UNKNOWN_REFUNDABILITY;
  if (!validProvenance(candidate.provenance, supplier, fetchedAt)) return UNKNOWN_REFUNDABILITY;
  if (candidate.state === 'restricted') return { state: 'restricted', provenance: { supplier, fetchedAt } };
  if (candidate.state === 'clear') return { state: 'clear', provenance: { supplier, fetchedAt } };
  return UNKNOWN_REFUNDABILITY;
}

export function unknownHotelRateEligibility(
  offerId: string,
  supplier: string,
  supplierLabel: string,
  loadStatus: HotelRateEligibilityEvidence['loadStatus'] = 'ready',
): HotelRateEligibilityEvidence {
  return {
    offerId,
    supplier,
    supplierLabel: safeString(supplierLabel) ?? 'Hotel provider',
    loadStatus,
    membership: UNKNOWN_MEMBERSHIP,
    residency: UNKNOWN_RESIDENCY,
    age: UNKNOWN_AGE,
    refundability: UNKNOWN_REFUNDABILITY,
  };
}

export function normalizeHotelRateEligibility(
  value: unknown,
  expected: { offerId: string; supplier: string; supplierLabel?: string },
): HotelRateEligibilityEvidence {
  const fallback = unknownHotelRateEligibility(
    expected.offerId,
    expected.supplier,
    expected.supplierLabel ?? expected.supplier,
  );
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<HotelRateEligibilityEvidence>;
  if (candidate.offerId !== expected.offerId || candidate.supplier !== expected.supplier) return fallback;
  const supplierLabel = safeString(candidate.supplierLabel) ?? 'Hotel provider';
  const loadStatus = candidate.loadStatus === 'loading' || candidate.loadStatus === 'error' ? candidate.loadStatus : 'ready';
  if (loadStatus !== 'ready') return unknownHotelRateEligibility(expected.offerId, expected.supplier, supplierLabel, loadStatus);
  if (!validTimestamp(candidate.fetchedAt)) return unknownHotelRateEligibility(expected.offerId, expected.supplier, supplierLabel);
  const fetchedAt = candidate.fetchedAt;

  return {
    offerId: expected.offerId,
    supplier: expected.supplier,
    supplierLabel,
    fetchedAt,
    loadStatus: 'ready',
    membership: normalizeMembership(candidate.membership, expected.supplier, fetchedAt),
    residency: normalizeResidency(candidate.residency, expected.supplier, fetchedAt),
    age: normalizeAge(candidate.age, expected.supplier, fetchedAt),
    refundability: normalizeRefundability(candidate.refundability, expected.supplier, fetchedAt),
  };
}

function ageLabel(age: Extract<HotelAgeEligibility, { state: 'restricted' }>): string {
  if (age.minAge !== undefined && age.maxAge !== undefined) return `Ages ${age.minAge}–${age.maxAge} only`;
  if (age.minAge !== undefined) return `Ages ${age.minAge}+ only`;
  return `Maximum age ${age.maxAge}`;
}

export function presentHotelRateEligibility(evidence: HotelRateEligibilityEvidence): RateEligibilityPresentation {
  if (evidence.loadStatus === 'loading') return { state: 'loading' };
  if (evidence.loadStatus === 'error') return { state: 'error' };
  const conditions: { family: HotelRateRestrictionFamily; label: string }[] = [];
  if (evidence.residency.state === 'restricted') conditions.push({ family: 'residency', label: `Residents of ${evidence.residency.placeLabel} only` });
  if (evidence.age.state === 'restricted') conditions.push({ family: 'age', label: ageLabel(evidence.age) });
  if (evidence.membership.state === 'restricted') conditions.push({ family: 'membership', label: evidence.membership.membershipLabel ? `${evidence.membership.membershipLabel} members only` : 'Members only' });
  if (evidence.refundability.state === 'restricted') conditions.push({ family: 'refundability', label: 'Non-refundable' });
  const familyStates = [evidence.membership.state, evidence.residency.state, evidence.age.state, evidence.refundability.state];
  if (conditions.length > 0) {
    return {
      state: 'restricted',
      conditions,
      coverageIncomplete: familyStates.includes('not_provided'),
      fetchedAt: evidence.fetchedAt,
    };
  }
  if (familyStates.every(state => state === 'clear')) return { state: 'clear', fetchedAt: evidence.fetchedAt };
  return { state: 'not_provided', fetchedAt: evidence.fetchedAt };
}

export function getRateEligibilityAnalytics(evidence: HotelRateEligibilityEvidence): RateEligibilityAnalytics {
  const presentation = presentHotelRateEligibility(evidence);
  const familyEntries = [
    ['membership', evidence.membership.state],
    ['residency', evidence.residency.state],
    ['age', evidence.age.state],
    ['refundability', evidence.refundability.state],
  ] as const;
  const restricted = familyEntries.filter(([, state]) => state === 'restricted').map(([family]) => family);
  return {
    overallState: presentation.state === 'restricted' || presentation.state === 'clear' ? presentation.state : 'not_provided',
    restrictionTypes: restricted.join(','),
    knownRestrictionCount: restricted.length,
    coverageCount: familyEntries.filter(([, state]) => state !== 'not_provided').length,
    eligibilityLoadStatus: evidence.loadStatus,
  };
}
