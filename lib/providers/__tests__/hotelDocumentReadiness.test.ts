import {
  normalizeHotelDocumentReadiness,
  notProvidedHotelDocumentReadiness,
} from '../hotelDocumentReadiness';

describe('hotel document readiness normalization', () => {
  it('normalizes omitted supplier evidence to not_provided', () => {
    expect(normalizeHotelDocumentReadiness(undefined, 'Hotellook')).toEqual(
      notProvidedHotelDocumentReadiness('Hotellook'),
    );
  });

  it('preserves bounded rate evidence without altering an affiliate verification URL', () => {
    const affiliateUrl = 'https://tp.media/r?marker=a%2Bb&u=https%3A%2F%2Fpartner.test%2Fpolicy%3Fx%3D1%26y%3D2';
    expect(normalizeHotelDocumentReadiness({
      status: 'confirmed',
      scope: 'selected_stay',
      documentTypes: ['invoice', 'receipt', 'invoice', 'unsupported'],
      issuerByDocument: {
        invoice: { role: 'property', displayName: 'Example Property' },
        receipt: { role: 'booking_provider', displayName: 'Example Partner' },
      },
      billingDetailsStep: 'after_booking_contact_property',
      taxIdentifierEligibility: {
        state: 'not_provided', entryStep: 'not_provided', correction: { rule: 'not_provided' },
        source: { label: 'Supplier rate terms', scope: 'rate' },
      },
      documentNameEligibility: {
        state: 'not_provided', allowedAddresseeTypes: [], relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' },
        entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Supplier rate terms', scope: 'rate' },
      },
      source: { label: 'Supplier rate terms', policyId: 'policy-1', observedAt: '2026-07-22T12:00:00.000Z' },
      verificationTarget: { role: 'booking_provider', url: affiliateUrl },
      rawProviderResponse: { secret: 'must not survive' },
    }, 'Fallback')).toEqual({
      status: 'confirmed',
      scope: 'selected_stay',
      documentTypes: ['invoice', 'receipt'],
      issuerByDocument: {
        invoice: { role: 'property', displayName: 'Example Property' },
        receipt: { role: 'booking_provider', displayName: 'Example Partner' },
      },
      billingDetailsStep: 'after_booking_contact_property',
      taxIdentifierEligibility: {
        state: 'not_provided', entryStep: 'not_provided', correction: { rule: 'not_provided' },
        source: { label: 'Supplier rate terms', scope: 'rate' },
      },
      documentNameEligibility: {
        state: 'not_provided', allowedAddresseeTypes: [], relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' },
        entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Supplier rate terms', scope: 'rate' },
      },
      source: { label: 'Supplier rate terms', policyId: 'policy-1', observedAt: '2026-07-22T12:00:00.000Z' },
      verificationTarget: { role: 'booking_provider', url: affiliateUrl },
    });
  });

  it('degrades malformed positive and conflicting claims and drops unsafe URLs', () => {
    expect(normalizeHotelDocumentReadiness({
      status: 'confirmed', documentTypes: [], source: { label: 'Supplier' },
    }, 'Supplier').status).toBe('not_provided');
    expect(normalizeHotelDocumentReadiness({
      status: 'conditional', condition: 'Ends with punctuation.', source: { label: 'Supplier' },
    }, 'Supplier').status).toBe('not_provided');
    expect(normalizeHotelDocumentReadiness({
      status: 'conflicting',
      conflictStatements: [{ sourceLabel: 'Only one', statement: 'One statement' }],
      source: { label: 'Supplier' },
    }, 'Supplier').status).toBe('not_provided');

    const readiness = normalizeHotelDocumentReadiness({
      status: 'not_provided',
      source: { label: 'Supplier' },
      verificationTarget: { role: 'property', url: 'javascript:alert(1)' },
    }, 'Supplier');
    expect(readiness.verificationTarget).toEqual({ role: 'property' });
  });

  it('degrades an unsupported unavailable claim to the fallback without manufacturing evidence', () => {
    expect(normalizeHotelDocumentReadiness({ status: 'unavailable' }, 'Fallback supplier')).toEqual(
      notProvidedHotelDocumentReadiness('Fallback supplier'),
    );
  });

  it.each([
    ['scope', { status: 'unavailable', source: { label: 'Supplier rate terms' } }],
    ['source', { status: 'unavailable', scope: 'selected_stay' }],
    ['a valid source label', { status: 'unavailable', scope: 'rate', source: { label: '   ' } }],
    ['a valid supplier scope', { status: 'unavailable', scope: 'property', source: { label: 'Supplier rate terms' } }],
  ])('does not manufacture an unavailable claim when %s is missing', (_missingEvidence, input) => {
    expect(normalizeHotelDocumentReadiness(input, 'Fallback supplier').status).toBe('not_provided');
  });

  it('preserves unavailable only with explicit supplier source and rate or stay scope', () => {
    expect(normalizeHotelDocumentReadiness({
      status: 'unavailable',
      scope: 'selected_stay',
      source: { label: 'Supplier stay terms' },
    }, 'Fallback supplier')).toEqual({
      status: 'unavailable',
      scope: 'selected_stay',
      documentTypes: [],
      issuerByDocument: {},
      billingDetailsStep: 'unknown',
      taxIdentifierEligibility: {
        state: 'not_provided', entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Supplier stay terms', scope: 'rate' },
      },
      documentNameEligibility: {
        state: 'not_provided', allowedAddresseeTypes: [], relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' },
        entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Supplier stay terms', scope: 'rate' },
      },
      source: { label: 'Supplier stay terms' },
    });
  });

  it('normalizes the two eligibility dimensions independently and preserves their provenance', () => {
    const readiness = normalizeHotelDocumentReadiness({
      status: 'confirmed', scope: 'rate', documentTypes: ['invoice'],
      issuerByDocument: { invoice: { role: 'property' } }, billingDetailsStep: 'unknown',
      source: { label: 'Document source' },
      taxIdentifierEligibility: {
        state: 'supported', identifierLabel: 'VAT number', entryStep: 'during_partner_booking',
        correction: { rule: 'allowed_until', boundaryLabel: 'payment' },
        source: { label: 'Rate terms', scope: 'rate', policyId: 'tax-7', observedAt: '2026-08-03T12:00:00Z' },
      },
      documentNameEligibility: {
        state: 'unsupported', allowedAddresseeTypes: [], unsupportedAddresseeTypes: ['legal_entity'],
        relationships: { guest: 'different_allowed', booker: 'not_provided', cardholder: 'not_provided' },
        entryStep: 'at_checkout', correction: { rule: 'not_allowed_after', boundaryLabel: 'check-in' },
        source: { label: 'Stay terms', scope: 'selected_stay' },
      },
    }, 'Fallback');

    expect(readiness.taxIdentifierEligibility).toMatchObject({
      state: 'supported', identifierLabel: 'VAT number', source: { label: 'Rate terms', scope: 'rate', policyId: 'tax-7' },
    });
    expect(readiness.documentNameEligibility).toMatchObject({
      state: 'unsupported', unsupportedAddresseeTypes: ['legal_entity'], source: { label: 'Stay terms', scope: 'selected_stay' },
    });
  });

  it('degrades malformed eligibility claims independently without copying adjacent evidence', () => {
    const readiness = normalizeHotelDocumentReadiness({
      status: 'confirmed', scope: 'rate', documentTypes: ['invoice'],
      issuerByDocument: { invoice: { role: 'property', displayName: 'Property issuer' } },
      billingDetailsStep: 'during_partner_booking', source: { label: 'Document source' },
      taxIdentifierEligibility: { state: 'supported', source: { label: 'Tax source', scope: 'rate' } },
      documentNameEligibility: {
        state: 'conflicting', conflictStatements: [{ sourceLabel: 'Only one', statement: 'One statement' }],
        source: { label: 'Name source', scope: 'selected_stay' },
      },
    }, 'Fallback');

    expect(readiness.taxIdentifierEligibility.state).toBe('not_provided');
    expect(readiness.taxIdentifierEligibility.entryStep).toBe('not_provided');
    expect(readiness.documentNameEligibility.state).toBe('not_provided');
    expect(readiness.documentNameEligibility.relationships).toEqual({ guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' });
  });

  const eligibilityStates = ['supported', 'unsupported', 'conditional', 'conflicting', 'not_provided'] as const;
  it.each(eligibilityStates.flatMap(taxState => eligibilityStates.map(nameState => [taxState, nameState] as const)))(
    'keeps tax %s independent from document-name %s at the model boundary',
    (taxState, nameState) => {
      const tax = taxState === 'supported'
        ? { state: taxState, identifierLabel: 'VAT number' }
        : taxState === 'conditional'
          ? { state: taxState, identifierLabel: 'VAT number', condition: 'payment method' }
          : taxState === 'conflicting'
            ? { state: taxState, conflictStatements: [{ sourceLabel: 'A', statement: 'Accepted' }, { sourceLabel: 'B', statement: 'Not accepted' }] }
            : { state: taxState, ...(taxState === 'unsupported' ? { identifierLabel: 'VAT number' } : {}) };
      const name = nameState === 'supported'
        ? { state: nameState, allowedAddresseeTypes: ['legal_entity'] }
        : nameState === 'unsupported'
          ? { state: nameState, unsupportedAddresseeTypes: ['legal_entity'] }
          : nameState === 'conditional'
            ? { state: nameState, condition: 'property approval', allowedAddresseeTypes: ['legal_entity'] }
            : nameState === 'conflicting'
              ? { state: nameState, conflictStatements: [{ sourceLabel: 'A', statement: 'Allowed' }, { sourceLabel: 'B', statement: 'Denied' }] }
              : { state: nameState };
      const readiness = normalizeHotelDocumentReadiness({
        status: 'confirmed', scope: 'rate', documentTypes: ['invoice'], issuerByDocument: {},
        billingDetailsStep: 'unknown', source: { label: 'Document source' },
        taxIdentifierEligibility: { ...tax, entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Tax source', scope: 'rate' } },
        documentNameEligibility: {
          ...name, allowedAddresseeTypes: 'allowedAddresseeTypes' in name ? name.allowedAddresseeTypes : [],
          relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' },
          entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Name source', scope: 'selected_stay' },
        },
      }, 'Fallback');

      expect(readiness.taxIdentifierEligibility.state).toBe(taxState);
      expect(readiness.documentNameEligibility.state).toBe(nameState);
      expect(readiness.taxIdentifierEligibility.source.label).toBe('Tax source');
      expect(readiness.documentNameEligibility.source.label).toBe('Name source');
    },
  );
});
