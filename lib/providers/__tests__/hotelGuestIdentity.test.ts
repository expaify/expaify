import {
  HOTEL_GUEST_IDENTITY_UNSUPPORTED,
  normalizeHotelGuestIdentity,
} from '../hotelGuestIdentity';
import type { HotelGuestIdentityCapability } from '@/lib/types';

const capability: HotelGuestIdentityCapability = {
  affectedParty: true,
  identityDocument: { confirmed: true, conditional: true, explicitNegative: true, conflicting: true },
  paymentNameMatch: { confirmed: true, conditional: true, explicitNegative: true, conflicting: true },
  maxAgeSeconds: 21_600,
};
const expected = { propertyId: 'p1', offerId: 'r1', supplier: 'supplier', locale: 'en-US', now: Date.parse('2026-08-03T02:00:00Z') };
const base = {
  state: 'ready', scope: 'rate', propertyId: 'p1', offerId: 'r1', supplier: 'supplier', locale: 'en-US',
  fetchedAt: '2026-08-03T01:00:00Z',
  affectedParty: { value: 'lead_guest', state: 'confirmed' },
  identityDocument: { state: 'confirmed' }, paymentNameMatch: { state: 'not_established' },
  statements: [{ id: 'one', sourceLabel: 'Supplier', sourceText: 'Card or passport wording is display-only.' }],
};

describe('hotel guest identity provider normalization', () => {
  it('preserves independent contracted dimensions and scope', () => {
    const normalized = normalizeHotelGuestIdentity(base, capability, expected);
    expect(normalized).toMatchObject({ scope: 'rate', propertyId: 'p1', offerId: 'r1', affectedParty: { value: 'lead_guest' }, identityDocument: { state: 'confirmed' }, paymentNameMatch: { state: 'not_established' } });
  });

  it('never parses supplier prose into roles or requirements', () => {
    const normalized = normalizeHotelGuestIdentity({ ...base, affectedParty: {}, identityDocument: {}, paymentNameMatch: {} }, capability, expected);
    expect(normalized.affectedParty.value).toBe('not_established');
    expect(normalized.identityDocument.state).toBe('not_established');
    expect(normalized.paymentNameMatch.state).toBe('not_established');
  });

  it('degrades a malformed dimension independently', () => {
    const normalized = normalizeHotelGuestIdentity({ ...base, identityDocument: 'required' }, capability, expected);
    expect(normalized.affectedParty.value).toBe('lead_guest');
    expect(normalized.identityDocument.state).toBe('not_established');
    expect(normalized.paymentNameMatch.state).toBe('not_established');
  });

  it.each([
    ['property mismatch', { ...base, propertyId: 'other' }],
    ['rate mismatch', { ...base, offerId: 'other' }],
    ['supplier mismatch', { ...base, supplier: 'other' }],
    ['locale mismatch', { ...base, locale: 'fr-FR' }],
    ['stale evidence', { ...base, fetchedAt: '2026-08-02T00:00:00Z' }],
  ])('degrades %s evidence without a positive claim', (_case, input) => {
    const normalized = normalizeHotelGuestIdentity(input, capability, expected);
    expect(normalized.affectedParty.value).toBe('not_established');
    expect(normalized.identityDocument.state).toBe('not_established');
    expect(normalized.paymentNameMatch.state).toBe('not_established');
  });

  it('keeps Hotellook unsupported even if an uncontracted positive payload appears', () => {
    const normalized = normalizeHotelGuestIdentity(base, HOTEL_GUEST_IDENTITY_UNSUPPORTED, expected);
    expect(normalized.identityDocument.state).toBe('not_established');
  });

  it('preserves the valid omitted-statement count without parsing statement text', () => {
    const normalized = normalizeHotelGuestIdentity({
      ...base,
      statements: [1, 2, 3, 4, 5].map(index => ({
        id: `statement-${index}`,
        sourceLabel: 'Supplier',
        sourceText: `Display-only supplier wording ${index}.`,
      })),
    }, capability, expected);

    expect(normalized.statements).toHaveLength(3);
    expect(normalized.omittedStatementCount).toBe(2);
    expect(normalized.affectedParty.value).toBe('lead_guest');
    expect(normalized.identityDocument.state).toBe('confirmed');

    const normalizedAgain = normalizeHotelGuestIdentity(normalized, capability, expected);
    expect(normalizedAgain.statements).toHaveLength(3);
    expect(normalizedAgain.omittedStatementCount).toBe(2);
  });

  it('degrades only conflicting dimensions when truncation could hide an opposing statement', () => {
    const normalized = normalizeHotelGuestIdentity({
      ...base,
      affectedParty: { value: 'not_established', state: 'conflicting' },
      identityDocument: { state: 'conflicting' },
      paymentNameMatch: { state: 'confirmed' },
      statements: [1, 2, 3, 4].map(index => ({
        id: `conflict-${index}`,
        sourceLabel: 'Supplier',
        sourceText: `Bounded statement ${index}.`,
      })),
    }, capability, expected);

    expect(normalized.affectedParty).toEqual({ value: 'not_established', state: 'not_established' });
    expect(normalized.identityDocument.state).toBe('not_established');
    expect(normalized.paymentNameMatch.state).toBe('confirmed');
    expect(normalized.omittedStatementCount).toBe(1);
  });
});
