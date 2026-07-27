import type {
  HotelRateEligibilityCapability,
  HotelRateEligibilityEvidence,
  HotelRateFamilyEvidence,
  HotelRateFamilyState,
  RateEligibilityPresentation,
  RateRestrictionCondition,
  RateRestrictionFamily,
} from '../types';

const MAX_LABEL_LENGTH = 100;
const FAMILY_STATES = new Set<HotelRateFamilyState>(['restricted', 'clear', 'not_provided']);
const RESTRICTION_ORDER: readonly RateRestrictionFamily[] = ['residency', 'age', 'membership', 'refundability'];

/** No current adapter may declare support without a documented supplier contract behind it. */
export const HOTEL_RATE_ELIGIBILITY_UNSUPPORTED: HotelRateEligibilityCapability = {
  membership: false,
  residency: false,
  age: false,
  refundability: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LABEL_LENGTH ? trimmed : null;
}

/** Preserves supplier capitalization except all-caps input, converted to readable title case. */
function displayLabel(value: string): string {
  if (!/[A-Z]/.test(value) || /[a-z]/.test(value)) return value;
  return value
    .toLowerCase()
    .split(' ')
    .map(word => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function validAge(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

/** Invalid or conflicting evidence for one family is isolated to that family, never guessed. */
function normalizeFamily(value: unknown, family: RateRestrictionFamily): HotelRateFamilyEvidence {
  if (!isRecord(value) || !FAMILY_STATES.has(value.state as HotelRateFamilyState)) {
    return { state: 'not_provided' };
  }
  const state = value.state as HotelRateFamilyState;
  if (state !== 'restricted') return { state };

  if (family === 'refundability') return { state: 'restricted' };

  if (family === 'membership') {
    const label = boundedLabel(value.membershipLabel);
    return { state: 'restricted', ...(label ? { membershipLabel: displayLabel(label) } : {}) };
  }

  if (family === 'residency') {
    const place = boundedLabel(value.residencyPlace);
    return place ? { state: 'restricted', residencyPlace: place } : { state: 'not_provided' };
  }

  const minAge = validAge(value.minAge);
  const maxAge = validAge(value.maxAge);
  if (minAge === null || maxAge === null) return { state: 'not_provided' };
  if (minAge === undefined && maxAge === undefined) return { state: 'not_provided' };
  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) return { state: 'not_provided' };
  return {
    state: 'restricted',
    ...(minAge !== undefined ? { minAge } : {}),
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

function conditionLabel(family: RateRestrictionFamily, evidence: HotelRateFamilyEvidence): string {
  if (family === 'refundability') return 'Non-refundable';
  if (family === 'residency') return `Residents of ${evidence.residencyPlace} only`;
  if (family === 'membership') {
    return evidence.membershipLabel ? `${evidence.membershipLabel} members only` : 'Members only';
  }
  const { minAge, maxAge } = evidence;
  if (minAge !== undefined && maxAge !== undefined) return `Ages ${minAge}–${maxAge} only`;
  if (minAge !== undefined) return `Ages ${minAge}+ only`;
  return `Maximum age ${maxAge}`;
}

function validFetchedAt(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

/**
 * Derives the honest three-state overall rate-eligibility presentation from raw per-family
 * supplier evidence. Provenance (offerId + supplier) must match the displayed offer/rate, or
 * every family degrades to `not_provided` rather than merging mismatched evidence.
 */
export function deriveRateEligibilityPresentation(params: {
  offerId: string;
  supplier: string;
  evidence?: HotelRateEligibilityEvidence;
  capability?: HotelRateEligibilityCapability;
}): RateEligibilityPresentation {
  const { offerId, supplier, evidence, capability } = params;
  if (!evidence || evidence.offerId !== offerId || evidence.supplier !== supplier) {
    return { state: 'not_provided' };
  }

  const families: Record<RateRestrictionFamily, HotelRateFamilyEvidence> = {
    residency: normalizeFamily(evidence.residency, 'residency'),
    age: normalizeFamily(evidence.age, 'age'),
    membership: normalizeFamily(evidence.membership, 'membership'),
    refundability: normalizeFamily(evidence.refundability, 'refundability'),
  };
  const fetchedAt = validFetchedAt(evidence.fetchedAt);

  const conditions: RateRestrictionCondition[] = RESTRICTION_ORDER
    .filter(family => families[family].state === 'restricted')
    .map(family => ({ family, label: conditionLabel(family, families[family]) }));

  if (conditions.length > 0) {
    const coverageIncomplete = RESTRICTION_ORDER.some(family => families[family].state === 'not_provided');
    return { state: 'restricted', conditions, ...(coverageIncomplete ? { coverageIncomplete: true } : {}), ...(fetchedAt ? { fetchedAt } : {}) };
  }

  const allExplicitlyClear = RESTRICTION_ORDER.every(family => families[family].state === 'clear');
  const capabilitySupportsClear = capability !== undefined && RESTRICTION_ORDER.every(family => capability[family]);
  if (allExplicitlyClear && capabilitySupportsClear) {
    return { state: 'clear', ...(fetchedAt ? { fetchedAt } : {}) };
  }

  return { state: 'not_provided' };
}
