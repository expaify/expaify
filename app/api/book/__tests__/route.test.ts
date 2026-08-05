import { POST } from '../route';
import { cache } from '@/lib/cache/redis';

// Idempotency lock acquisition defaults to "true" (first attempt) so every
// pre-existing test below behaves exactly as it did before the idempotency
// layer was added. Tests that specifically exercise the lock/replay/ambiguous
// paths override these per-call.
jest.mock('@/lib/cache/redis', () => ({
  cache: {
    setIfAbsent: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockSetIfAbsent = cache.setIfAbsent as jest.Mock;
const mockGet = cache.get as jest.Mock;
const mockSet = cache.set as jest.Mock;

const VALID_FARE_CONTEXT = {
  offerId: 'off_123',
  provider: 'duffel',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-22T08:00:00Z',
  carrier: 'AA',
  stops: 0,
  priceCents: 45000,
  currency: 'USD',
  passengerCount: 1,
  priceScope: 'party_total',
};

const VALID_PASSENGER = {
  title: 'mr',
  given_name: 'Alex',
  family_name: 'Rivera',
  born_on: '1990-01-01',
  email: 'alex@example.com',
  phone_number: '+12125551234',
  gender: 'm',
};

function validBookRequest(): Request {
  return new Request('https://expaify.test/api/book', {
    method: 'POST',
    body: JSON.stringify({ offerId: 'off_123', fareContext: VALID_FARE_CONTEXT, passenger: VALID_PASSENGER }),
  });
}

describe('POST /api/book booking gate', () => {
  const originalBookingEnabled = process.env.BOOKING_ENABLED;
  const originalDuffelKey = process.env.DUFFEL_KEY;

  beforeEach(() => {
    delete process.env.BOOKING_ENABLED;
    delete process.env.DUFFEL_KEY;
    global.fetch = jest.fn();
    mockSetIfAbsent.mockReset().mockResolvedValue(true);
    mockGet.mockReset().mockResolvedValue(null);
    mockSet.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalBookingEnabled === undefined) {
      delete process.env.BOOKING_ENABLED;
    } else {
      process.env.BOOKING_ENABLED = originalBookingEnabled;
    }
    if (originalDuffelKey === undefined) {
      delete process.env.DUFFEL_KEY;
    } else {
      process.env.DUFFEL_KEY = originalDuffelKey;
    }
    jest.restoreAllMocks();
  });

  it('returns a clean disabled response when BOOKING_ENABLED is unset', async () => {
    const request = new Request('https://expaify.test/api/book', {
      method: 'POST',
      body: '{not-json',
    });

    const response = await POST(request);
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      reason: 'In-app booking is not available yet. Please use the provider link when available.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('treats values other than true as disabled', async () => {
    process.env.BOOKING_ENABLED = 'false';
    const request = new Request('https://expaify.test/api/book', {
      method: 'POST',
      body: JSON.stringify({ offerId: 'off_123', passenger: {} }),
    });

    const response = await POST(request);
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.reason).toMatch(/booking is not available/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requires fare context when booking is enabled', async () => {
    process.env.BOOKING_ENABLED = 'true';
    const request = new Request('https://expaify.test/api/book', {
      method: 'POST',
      body: JSON.stringify({ offerId: 'off_123', passenger: {} }),
    });

    const response = await POST(request);
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, reason: 'fareContext is required' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks multi-passenger Duffel booking review before collecting one passenger only', async () => {
    process.env.BOOKING_ENABLED = 'true';
    const request = new Request('https://expaify.test/api/book', {
      method: 'POST',
      body: JSON.stringify({
        offerId: 'off_123',
        fareContext: {
          offerId: 'off_123',
          provider: 'duffel',
          origin: 'JFK',
          destination: 'LAX',
          depart: '2026-09-22T08:00:00Z',
          carrier: 'AA',
          stops: 0,
          priceCents: 90000,
          currency: 'USD',
          passengerCount: 2,
          priceScope: 'party_total',
        },
        passenger: {},
      }),
    });

    const response = await POST(request);
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.reason).toMatch(/multi-passenger booking review/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a Duffel offer whose passenger count no longer matches the fare context', async () => {
    process.env.BOOKING_ENABLED = 'true';
    process.env.DUFFEL_KEY = 'duffel_test_key';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          passengers: [{ id: 'pas_1' }, { id: 'pas_2' }],
          total_amount: '450.00',
          total_currency: 'USD',
        },
      }),
    });

    const request = new Request('https://expaify.test/api/book', {
      method: 'POST',
      body: JSON.stringify({
        offerId: 'off_123',
        fareContext: {
          offerId: 'off_123',
          provider: 'duffel',
          origin: 'JFK',
          destination: 'LAX',
          depart: '2026-09-22T08:00:00Z',
          carrier: 'AA',
          stops: 0,
          priceCents: 45000,
          currency: 'USD',
          passengerCount: 1,
          priceScope: 'party_total',
        },
        passenger: {
          title: 'mr',
          given_name: 'Alex',
          family_name: 'Rivera',
          born_on: '1990-01-01',
          email: 'alex@example.com',
          phone_number: '+12125551234',
          gender: 'm',
        },
      }),
    });

    const response = await POST(request);
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      reason: 'Fare passenger count changed. Return to search and choose the current fare.',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://api.duffel.com/air/offers/off_123');
  });

  describe('idempotency (REPAIR-BOOKING-SUBMIT-IDEMPOTENCY-01)', () => {
    beforeEach(() => {
      process.env.BOOKING_ENABLED = 'true';
      process.env.DUFFEL_KEY = 'duffel_test_key';
    });

    it('never reaches Duffel when another request already holds the lock and is in progress', async () => {
      mockSetIfAbsent.mockResolvedValue(false);
      mockGet.mockResolvedValue({ status: 'in_progress' });

      const response = await POST(validBookRequest());
      const body = await response.json() as { ok: boolean; reason: string };

      expect(response.status).toBe(409);
      expect(body.ok).toBe(false);
      expect(body.reason).toMatch(/already being processed/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('replays a cached done result verbatim instead of creating a second order', async () => {
      mockSetIfAbsent.mockResolvedValue(false);
      mockGet.mockResolvedValue({
        status: 'done',
        httpStatus: 200,
        body: { ok: true, bookingReference: 'ABC123', orderId: 'ord_prior' },
      });

      const response = await POST(validBookRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ ok: true, bookingReference: 'ABC123', orderId: 'ord_prior' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('replays a cached failure result (e.g. a definitive price mismatch) verbatim, without re-fetching', async () => {
      mockSetIfAbsent.mockResolvedValue(false);
      mockGet.mockResolvedValue({
        status: 'done',
        httpStatus: 409,
        body: { ok: false, reason: 'Fare price changed. Return to search and choose the current fare.' },
      });

      const response = await POST(validBookRequest());
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.reason).toMatch(/fare price changed/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns the ambiguous state honestly instead of a generic error or a replayable success', async () => {
      mockSetIfAbsent.mockResolvedValue(false);
      mockGet.mockResolvedValue({ status: 'ambiguous' });

      const response = await POST(validBookRequest());
      const body = await response.json() as { ok: boolean; ambiguous: boolean; reason: string };

      expect(body.ok).toBe(false);
      expect(body.ambiguous).toBe(true);
      expect(body.reason).toMatch(/check your email/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('marks the record ambiguous — not done — when the order call itself throws (network failure)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { passengers: [{ id: 'pas_1' }], total_amount: '450.00', total_currency: 'USD' } }),
        })
        .mockRejectedValueOnce(new Error('socket hang up'));

      const response = await POST(validBookRequest());
      const body = await response.json() as { ok: boolean; ambiguous: boolean };

      expect(body.ok).toBe(false);
      expect(body.ambiguous).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.any(String),
        { status: 'ambiguous' },
        expect.any(Number)
      );
    });

    it('caches a successful order as done, keyed off offerId + passenger identity, before returning it', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { passengers: [{ id: 'pas_1' }], total_amount: '450.00', total_currency: 'USD' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'ord_1', booking_reference: 'XYZ789' } }),
        })
      const response = await POST(validBookRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ ok: true, bookingReference: 'XYZ789', orderId: 'ord_1' });
      expect(mockSetIfAbsent).toHaveBeenCalledWith(expect.any(String), { status: 'in_progress' }, expect.any(Number));
      expect(mockSet).toHaveBeenCalledWith(
        expect.any(String),
        { status: 'done', httpStatus: 200, body: { ok: true, bookingReference: 'XYZ789', orderId: 'ord_1' } },
        expect.any(Number)
      );

      // Same key derivation regardless of caller — two different offers/passengers must not collide.
      const key1 = mockSetIfAbsent.mock.calls[0][0] as string;
      mockSetIfAbsent.mockClear();
      mockSet.mockClear();
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { passengers: [{ id: 'pas_2' }], total_amount: '450.00', total_currency: 'USD' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'ord_2', booking_reference: 'DIFFERENT' } }),
        })
      const differentOfferRequest = new Request('https://expaify.test/api/book', {
        method: 'POST',
        body: JSON.stringify({
          offerId: 'off_456',
          fareContext: { ...VALID_FARE_CONTEXT, offerId: 'off_456' },
          passenger: VALID_PASSENGER,
        }),
      });
      await POST(differentOfferRequest);
      const key2 = mockSetIfAbsent.mock.calls[0][0] as string;
      expect(key2).not.toBe(key1);
    });

    it('sends a Duffel Idempotency-Key header derived from the same offer+passenger fingerprint', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { passengers: [{ id: 'pas_1' }], total_amount: '450.00', total_currency: 'USD' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'ord_1', booking_reference: 'XYZ789' } }),
        })

      await POST(validBookRequest());

      const orderCall = (global.fetch as jest.Mock).mock.calls.find(call => call[0] === 'https://api.duffel.com/air/orders');
      expect(orderCall).toBeDefined();
      const headers = orderCall![1].headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toEqual(expect.any(String));
      expect(headers['Idempotency-Key'].length).toBeGreaterThan(10);
    });
  });
});
