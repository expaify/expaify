import { POST } from '../route';

describe('POST /api/book booking gate', () => {
  const originalBookingEnabled = process.env.BOOKING_ENABLED;

  beforeEach(() => {
    delete process.env.BOOKING_ENABLED;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (originalBookingEnabled === undefined) {
      delete process.env.BOOKING_ENABLED;
    } else {
      process.env.BOOKING_ENABLED = originalBookingEnabled;
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
});
