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
});
