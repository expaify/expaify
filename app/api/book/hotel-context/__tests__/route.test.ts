const persistMock = jest.fn();

jest.mock('@/lib/booking/hotelContextStore', () => ({
  persistBookingHotelContext: (...args: unknown[]) => persistMock(...args),
}));

import { POST } from '../route';

describe('POST /api/book/hotel-context', () => {
  beforeEach(() => persistMock.mockReset());

  it('returns a bounded booking href for a persisted opaque context', async () => {
    persistMock.mockResolvedValue({ ok: true, data: { reference: 'a'.repeat(24) } });
    const input = { kind: 'hotel', fundsPolicy: { state: 'complete' } };
    const response = await POST(new Request('https://expaify.test/api/book/hotel-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        reference: 'a'.repeat(24),
        href: `/book?kind=hotel&hotelContextRef=${'a'.repeat(24)}`,
      },
    });
    expect(persistMock).toHaveBeenCalledWith(input);
  });

  it('returns Result-shaped errors for malformed bodies and unavailable persistence', async () => {
    const malformedResponse = await POST(new Request('https://expaify.test/api/book/hotel-context', {
      method: 'POST',
      body: '{bad json',
    }));
    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toEqual({ ok: false, reason: 'Invalid request body' });

    persistMock.mockResolvedValueOnce({ ok: false, reason: 'Hotel booking review could not be prepared' });
    const unavailableResponse = await POST(new Request('https://expaify.test/api/book/hotel-context', {
      method: 'POST',
      body: JSON.stringify({ kind: 'hotel' }),
    }));
    expect(unavailableResponse.status).toBe(503);
    await expect(unavailableResponse.json()).resolves.toEqual({
      ok: false,
      reason: 'Hotel booking review could not be prepared',
    });
  });
});
