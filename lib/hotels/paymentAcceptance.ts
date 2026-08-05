import type {
  HotelBookingGateDivergence,
  HotelFundsEvidenceScope,
  HotelPaymentAcceptanceCapability,
  HotelPaymentAcceptanceConflict,
  HotelPaymentAcceptanceEvidence,
  HotelPaymentAcceptancePresentation,
  HotelPaymentAcceptanceRow,
  HotelPaymentAcceptanceRowId,
  HotelPaymentAcceptanceRowTone,
  HotelPropertyCardRequirement,
  HotelPropertyPaymentInstrumentClass,
  HotelPropertyPaymentInstrumentState,
} from '../types';

/** No current adapter may declare support without a documented supplier contract behind it. */
export const HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED: HotelPaymentAcceptanceCapability = {
  cardRequiredAtProperty: false,
  instrumentClasses: false,
  bookingGateDivergence: false,
};

export const HOTEL_PAYMENT_ACCEPTANCE_INSTRUMENT_ORDER: readonly HotelPropertyPaymentInstrumentClass[] = [
  'credit_card',
  'debit_card',
  'prepaid_card',
  'cash',
];

export const HOTEL_PAYMENT_ACCEPTANCE_ROW_ORDER: readonly HotelPaymentAcceptanceRowId[] = [
  'card_required_at_property',
  'credit_card',
  'debit_card',
  'prepaid_card',
  'cash',
  'booking_gate_divergence',
];

const ROW_LABELS: Record<HotelPaymentAcceptanceRowId, string> = {
  card_required_at_property: 'Credit card required at the property',
  credit_card: 'Credit cards',
  debit_card: 'Debit cards',
  prepaid_card: 'Prepaid cards',
  cash: 'Cash',
  booking_gate_divergence: 'Same as what you needed to book?',
};

const INSTRUMENT_LABEL_LOWER: Record<HotelPropertyPaymentInstrumentClass, string> = {
  credit_card: 'credit cards',
  debit_card: 'debit cards',
  prepaid_card: 'prepaid cards',
  cash: 'cash',
};

const SCOPE_LABELS: Record<HotelFundsEvidenceScope, string> = {
  property: 'Property-level policy',
  room: 'Room-level policy',
  rate: 'Rate-level policy',
  selected_stay: 'Selected-stay policy',
  not_returned: 'Scope not confirmed',
};

const MAX_PROVIDER_NAME_LENGTH = 80;
const MAX_CONFLICT_LABEL_LENGTH = 80;

function resolveProvider(providerName: string): string {
  const trimmed = providerName.trim();
  return trimmed && trimmed.length <= MAX_PROVIDER_NAME_LENGTH ? trimmed : 'The booking provider';
}

function cardRequiredSentence(provider: string, value: HotelPropertyCardRequirement): string {
  if (value === 'required') return `${provider} says this property requires a credit card at check-in.`;
  if (value === 'not_required') return `${provider} says this property does not require a credit card at check-in.`;
  return `${provider} has not confirmed whether this property requires a credit card at check-in.`;
}

function instrumentSentence(
  provider: string,
  instrumentClass: HotelPropertyPaymentInstrumentClass,
  value: HotelPropertyPaymentInstrumentState,
): string {
  const label = INSTRUMENT_LABEL_LOWER[instrumentClass];
  const isCash = instrumentClass === 'cash';
  const verb = isCash ? 'is' : 'are';
  if (value === 'accepted') return `${provider} says ${label} ${verb} accepted at this property.`;
  if (value === 'not_accepted') return `${provider} says ${label} ${verb} not accepted at this property.`;
  return `${provider} has not confirmed whether ${label} ${verb} accepted at this property.`;
}

function divergenceSentence(provider: string, value: HotelBookingGateDivergence): string {
  if (value === 'same') return `${provider} says the property accepts the same payment methods you used to book.`;
  if (value === 'differs') {
    return `${provider} says the property may require different payment methods than what you used to book. Review the rows above before you check in.`;
  }
  return `${provider} has not confirmed whether the property accepts the same payment methods you used to book.`;
}

function humanizeConflictValue(rowId: HotelPaymentAcceptanceRowId, raw: string): string {
  if (rowId === 'card_required_at_property') {
    if (raw === 'required') return 'required';
    if (raw === 'not_required') return 'not required';
    return raw;
  }
  if (rowId === 'booking_gate_divergence') {
    if (raw === 'same') return 'the same';
    if (raw === 'differs') return 'different';
    return raw;
  }
  if (raw === 'accepted') return 'accepted';
  if (raw === 'not_accepted') return 'not accepted';
  return raw;
}

function boundedLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_CONFLICT_LABEL_LENGTH ? trimmed : 'a provider';
}

function conflictSentence(rowId: HotelPaymentAcceptanceRowId, conflict: HotelPaymentAcceptanceConflict): string {
  const labelA = boundedLabel(conflict.sourceLabelA);
  const labelB = boundedLabel(conflict.sourceLabelB);
  const valueA = humanizeConflictValue(rowId, conflict.valueA);
  const valueB = humanizeConflictValue(rowId, conflict.valueB);
  return `Providers disagree on this. ${labelA} says ${valueA}; ${labelB} says ${valueB}. expaify cannot determine which applies — confirm with the property before you travel.`;
}

function toneFor(
  value: HotelPropertyCardRequirement | HotelPropertyPaymentInstrumentState | HotelBookingGateDivergence,
  conflicting: boolean,
): HotelPaymentAcceptanceRowTone {
  if (conflicting) return 'conflicting';
  if (value === 'not_confirmed') return 'not_confirmed';
  if (value === 'required' || value === 'accepted' || value === 'same') return 'confirmed_positive';
  return 'confirmed_negative';
}

/**
 * Result<T>-style, never throws. Applies the degradation rules in
 * docs/pipeline/hotel-payment-method/03-design.md §4.3, always toward less certainty:
 * provenance mismatch and capability-false both force a fact to not_confirmed; a populated conflict
 * object always wins over that row's own top-level value. Absent evidence renders identically to
 * capability-false (§4.4) — there is no separate "field not present" visual state.
 */
export function deriveHotelPaymentAcceptancePresentation(params: {
  propertyId: string;
  supplier: string;
  providerName: string;
  evidence?: HotelPaymentAcceptanceEvidence;
  capability?: HotelPaymentAcceptanceCapability;
}): HotelPaymentAcceptancePresentation {
  const { propertyId, supplier, providerName, evidence, capability } = params;
  const provider = resolveProvider(providerName);

  if (evidence?.loadState === 'loading') return { state: 'loading' };
  if (evidence?.loadState === 'error') return { state: 'error' };

  const provenanceMatches = evidence !== undefined && evidence.propertyId === propertyId && evidence.supplier === supplier;
  const usableEvidence = provenanceMatches ? evidence : undefined;
  const cap = capability ?? HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED;

  const cardRequiredValue: HotelPropertyCardRequirement = cap.cardRequiredAtProperty && usableEvidence
    ? usableEvidence.cardRequiredAtProperty
    : 'not_confirmed';
  const cardRequiredConflict = cap.cardRequiredAtProperty ? usableEvidence?.cardRequiredConflict : undefined;
  const cardRequiredTone = toneFor(cardRequiredValue, Boolean(cardRequiredConflict));
  const cardRequiredRow: HotelPaymentAcceptanceRow = {
    id: 'card_required_at_property',
    label: ROW_LABELS.card_required_at_property,
    tone: cardRequiredTone,
    sentence: cardRequiredConflict
      ? conflictSentence('card_required_at_property', cardRequiredConflict)
      : cardRequiredSentence(provider, cardRequiredValue),
  };

  const instrumentRows: HotelPaymentAcceptanceRow[] = HOTEL_PAYMENT_ACCEPTANCE_INSTRUMENT_ORDER.map(instrumentClass => {
    const value: HotelPropertyPaymentInstrumentState = cap.instrumentClasses && usableEvidence
      ? usableEvidence.instruments[instrumentClass]
      : 'not_confirmed';
    const conflict = cap.instrumentClasses ? usableEvidence?.instrumentConflicts?.[instrumentClass] : undefined;
    const tone = toneFor(value, Boolean(conflict));
    return {
      id: instrumentClass,
      label: ROW_LABELS[instrumentClass],
      tone,
      sentence: conflict ? conflictSentence(instrumentClass, conflict) : instrumentSentence(provider, instrumentClass, value),
    };
  });

  const divergenceValue: HotelBookingGateDivergence = cap.bookingGateDivergence && usableEvidence
    ? usableEvidence.bookingGateDivergence
    : 'not_confirmed';
  const divergenceConflict = cap.bookingGateDivergence ? usableEvidence?.bookingGateDivergenceConflict : undefined;
  const divergenceTone = toneFor(divergenceValue, Boolean(divergenceConflict));
  const divergenceRow: HotelPaymentAcceptanceRow = {
    id: 'booking_gate_divergence',
    label: ROW_LABELS.booking_gate_divergence,
    tone: divergenceTone,
    sentence: divergenceConflict
      ? conflictSentence('booking_gate_divergence', divergenceConflict)
      : divergenceSentence(provider, divergenceValue),
  };

  const rows: HotelPaymentAcceptanceRow[] = [cardRequiredRow, ...instrumentRows, divergenceRow];

  const confirmedCount = rows.filter(row => row.tone === 'confirmed_positive' || row.tone === 'confirmed_negative').length;
  const unresolvedCount = rows.length - confirmedCount;
  const statusLine = confirmedCount === 0
    ? `${provider} has not confirmed payment acceptance at the property for this stay. None of the facts below come from a provider yet — confirm with the property before you travel.`
    : unresolvedCount === 0
      ? `${provider} confirmed payment acceptance at the property for this stay.`
      : `${provider} confirmed some payment-acceptance facts for this property. Facts marked “not confirmed” below still need to be checked with the property.`;

  const cardRequiredWarning = cardRequiredTone !== 'conflicting' && cardRequiredValue === 'required';

  const scope = usableEvidence?.scope ?? 'not_returned';
  const fetchedAtValid = Boolean(usableEvidence?.fetchedAt && !Number.isNaN(Date.parse(usableEvidence.fetchedAt)));
  const checkedSuffix = fetchedAtValid
    ? ` · Checked ${new Date(usableEvidence!.fetchedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : '';
  const provenance = `Source: ${provider} · ${SCOPE_LABELS[scope]}${checkedSuffix}`;

  return {
    state: 'ready',
    statusLine,
    cardRequiredWarning,
    rows,
    provenance,
  };
}
