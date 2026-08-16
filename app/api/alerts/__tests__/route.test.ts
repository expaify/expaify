import { NextRequest } from 'next/server';
import { DELETE, POST } from '../route';
import { query } from '../../../../lib/db/client';

jest.mock('../../../../lib/db/client', () => ({
  query: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

function postRequest(body: unknown): Request {
  return new Request('https://expaify.test/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function deleteRequest(queryString: string): NextRequest {
  return new NextRequest(`https://expaify.test/api/alerts?${queryString}`, {
    method: 'DELETE',
  });
}

describe('POST /api/alerts', () => {
  const originalResendApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    mockQuery.mockReset();
  });

  afterEach(() => {
    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey;
    }
    jest.restoreAllMocks();
  });

  it('returns Result-style validation failures and does not write', async () => {
    const response = await POST(postRequest({
      email: 'not-an-email',
      origin: 'JFK',
      destination: 'LAX',
      thresholdCents: 25000,
    }));
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, reason: 'Invalid email address' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('does not create an active alert when delivery is unavailable', async () => {
    delete process.env.RESEND_API_KEY;

    const response = await POST(postRequest({
      email: 'traveler@example.com',
      origin: 'JFK',
      destination: 'LAX',
      thresholdCents: 25000,
    }));
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      reason: 'Price alert emails are not configured, so no active alert was created.',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns an explicit storage failure when persistence is unavailable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DATABASE_URL environment variable is not set'));

    const response = await POST(postRequest({
      email: 'traveler@example.com',
      origin: 'jfk',
      destination: 'lax',
      thresholdCents: 25000,
    }));
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      reason: 'Alert storage is unavailable, so no active alert was created.',
    });
  });

  it('returns ok true only after the alert is persisted', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'alert-123' }],
      rowCount: 1,
      command: 'INSERT',
      oid: 0,
      fields: [],
    });

    const response = await POST(postRequest({
      email: 'traveler@example.com',
      origin: 'jfk',
      destination: 'lax',
      thresholdCents: 25000,
    }));
    const body = await response.json() as {
      ok: boolean;
      data: { id: string; active: boolean; message: string };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        id: 'alert-123',
        active: true,
        message: "Alert set! We'll email you when JFK→LAX drops below $250.",
      },
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/alerts', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a malformed UUID before querying the database', async () => {
    const response = await DELETE(deleteRequest(
      'email=traveler%40example.com&id=not-a-uuid',
    ));
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, reason: 'id must be a valid UUID' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects an invalid email before querying the database', async () => {
    const response = await DELETE(deleteRequest(
      'email=not-an-email&id=9869ebcc-2c37-4e12-ae31-fac36f4b21ec',
    ));
    const body = await response.json() as { ok: boolean; reason: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, reason: 'Invalid email address' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('deactivates only the exact UUID and email pair', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    });

    const response = await DELETE(deleteRequest(
      'email=traveler%40example.com&id=9869ebcc-2c37-4e12-ae31-fac36f4b21ec',
    ));
    const body = await response.json() as {
      ok: boolean;
      data: { message: string };
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { message: 'Alert cancelled.' } });
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE price_alerts SET active = false WHERE id = $1 AND email = $2',
      ['9869ebcc-2c37-4e12-ae31-fac36f4b21ec', 'traveler@example.com'],
    );
  });
});
