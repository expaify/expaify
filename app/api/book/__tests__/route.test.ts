import { POST } from '../route';

describe('POST /api/book booking gate', () => {
  const originalBookingEnabled = process.env.BOOKING_ENABLED;
  const originalDuffelKey = process.env.DUFFEL_KEY;

  beforeEach(() => {
    delete process.env.BOOKING_ENABLED;
    delete process.env.DUFFEL_KEY;
    global.fetch = jest.fn();
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
});
