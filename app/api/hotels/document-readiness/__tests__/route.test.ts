import { POST } from '../route';
import { hotellook } from '@/lib/providers/hotellook';

jest.mock('@/lib/providers/hotellook', () => ({
  hotellook: { checkDocumentReadiness: jest.fn() },
}));

const checkDocumentReadiness = hotellook.checkDocumentReadiness as jest.Mock;
const documentReadiness = {
  status: 'not_provided' as const,
  scope: 'rate' as const,
  documentTypes: [],
  issuerByDocument: {},
  billingDetailsStep: 'unknown' as const,
  source: { label: 'Hotellook' },
};
const hotelContext = {
  kind: 'hotel',
  offerId: '123',
  provider: 'hotellook',
  name: 'Example Hotel',
  priceCents: 18900,
  currency: 'USD',
  priceBasis: 'per_night_before_taxes_fees',
  providerUrl: 'https://tp.media/r?marker=affiliate-123&u=https://hotellook.com/hotels/123',
  documentReadiness,
};

beforeEach(() => {
  jest.clearAllMocks();
  checkDocumentReadiness.mockResolvedValue({ ok: true, data: documentReadiness });
});

describe('POST /api/hotels/document-readiness', () => {
  it('checks through the provider adapter and preserves the affiliate URL byte-for-byte', async () => {
    const response = await POST(new Request('https://expaify.test/api/hotels/document-readiness', {
      method: 'POST',
      body: JSON.stringify({ hotelContext }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: documentReadiness });
    expect(checkDocumentReadiness).toHaveBeenCalledWith(expect.objectContaining({
      deeplink: hotelContext.providerUrl,
      documentReadiness,
    }));
  });

  it('returns Result-shaped failures for invalid context, unsupported providers, and provider errors', async () => {
    const invalid = await POST(new Request('https://expaify.test/api/hotels/document-readiness', {
      method: 'POST',
      body: JSON.stringify({ hotelContext: { ...hotelContext, providerUrl: 'javascript:alert(1)' } }),
    }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ ok: false, reason: 'valid hotel context is required' });

    const unsupported = await POST(new Request('https://expaify.test/api/hotels/document-readiness', {
      method: 'POST',
      body: JSON.stringify({ hotelContext: { ...hotelContext, provider: 'future-provider' } }),
    }));
    expect(unsupported.status).toBe(422);

    checkDocumentReadiness.mockResolvedValueOnce({ ok: false, reason: 'supplier timed out' });
    const failed = await POST(new Request('https://expaify.test/api/hotels/document-readiness', {
      method: 'POST',
      body: JSON.stringify({ hotelContext }),
    }));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ ok: false, reason: 'supplier timed out' });
  });
});
