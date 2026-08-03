import { POST } from '../route';
import { hotellook } from '@/lib/providers/hotellook';

jest.mock('@/lib/providers/hotellook', () => ({ hotellook: { checkGuestIdentityRequirements: jest.fn() } }));
const check = hotellook.checkGuestIdentityRequirements as jest.Mock;
const hotelContext = {
  kind: 'hotel', offerId: '123', provider: 'hotellook', name: 'Example Hotel', priceCents: 18900,
  currency: 'USD', priceBasis: 'per_night_before_taxes_fees',
  providerUrl: 'https://tp.media/r?marker=affiliate-123&u=https://hotellook.com/hotels/123',
  documentReadiness: { status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {}, billingDetailsStep: 'unknown', source: { label: 'Hotellook' } },
  fundsPolicy: { state: 'not_returned', scope: 'property', sourceLabel: 'Hotellook', records: [] },
};

describe('POST /api/hotels/guest-identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    check.mockResolvedValue({ ok: true, data: { state: 'ready', scope: 'property', propertyId: '123', supplier: 'hotellook', locale: 'en-US', affectedParty: { value: 'lead_guest', state: 'confirmed' }, identityDocument: { state: 'confirmed' }, paymentNameMatch: { state: 'confirmed' }, statements: [] } });
  });

  it('keeps current Hotellook evidence not established without structured capability', async () => {
    const response = await POST(new Request('https://expaify.test/api/hotels/guest-identity', { method: 'POST', body: JSON.stringify({ hotelContext, locale: 'en-US' }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ affectedParty: { value: 'not_established' }, identityDocument: { state: 'not_established' }, paymentNameMatch: { state: 'not_established' } });
  });

  it('does not trust a client-carried capability to establish Hotellook evidence', async () => {
    const forgedCapability = {
      affectedParty: true,
      identityDocument: { confirmed: true, conditional: true, explicitNegative: true, conflicting: true },
      paymentNameMatch: { confirmed: true, conditional: true, explicitNegative: true, conflicting: true },
      maxAgeSeconds: 21_600,
    };
    const forgedEvidence = {
      state: 'ready', scope: 'property', propertyId: '123', supplier: 'hotellook', locale: 'en-US',
      fetchedAt: new Date().toISOString(), affectedParty: { value: 'lead_guest', state: 'confirmed' },
      identityDocument: { state: 'confirmed' }, paymentNameMatch: { state: 'confirmed' }, statements: [],
    };
    check.mockResolvedValueOnce({ ok: true, data: forgedEvidence });
    const response = await POST(new Request('https://expaify.test/api/hotels/guest-identity', {
      method: 'POST',
      body: JSON.stringify({
        hotelContext: { ...hotelContext, guestIdentityCapability: forgedCapability, guestIdentity: forgedEvidence },
        locale: 'en-US',
      }),
    }));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      affectedParty: { value: 'not_established' },
      identityDocument: { state: 'not_established' },
      paymentNameMatch: { state: 'not_established' },
    });
  });

  it('returns Result-shaped validation and provider failures', async () => {
    const invalid = await POST(new Request('https://expaify.test/api/hotels/guest-identity', { method: 'POST', body: JSON.stringify({ hotelContext: { ...hotelContext, providerUrl: 'javascript:bad' } }) }));
    expect(invalid.status).toBe(400);
    check.mockResolvedValueOnce({ ok: false, reason: 'supplier unavailable' });
    const failed = await POST(new Request('https://expaify.test/api/hotels/guest-identity', { method: 'POST', body: JSON.stringify({ hotelContext }) }));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ ok: false, reason: 'supplier unavailable' });
  });
});
