import { getAiDayPlan } from '../aiTripPlanner';

beforeEach(() => {
  jest.resetAllMocks();
  process.env.RAPIDAPI_KEY_PRICELINE = 'test_key';
});

afterEach(() => {
  delete process.env.RAPIDAPI_KEY_PRICELINE;
});

describe('getAiDayPlan', () => {
  it('returns { ok: true, data: [] activities } for an empty destination without calling fetch', async () => {
    global.fetch = jest.fn();
    const result = await getAiDayPlan('   ');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.activities).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('is not configured when RAPIDAPI_KEY_PRICELINE is unset', async () => {
    delete process.env.RAPIDAPI_KEY_PRICELINE;
    global.fetch = jest.fn();
    const result = await getAiDayPlan('Barcelona');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('AI Trip Planner not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('parses a real-shaped successful response into activities', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        plan: {
          day: 1,
          activities: [
            { time: '9:00 AM', description: 'Arrive in Barcelona and check-in to hotel' },
            { time: '11:00 AM', description: 'Visit Sagrada Familia' },
          ],
        },
      }),
    });

    const result = await getAiDayPlan('Barcelona');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.destination).toBe('Barcelona');
    expect(result.data.day).toBe(1);
    expect(result.data.activities).toHaveLength(2);
    expect(result.data.activities[0]).toEqual({
      time: '9:00 AM',
      description: 'Arrive in Barcelona and check-in to hotel',
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('ai-trip-planner.p.rapidapi.com');
    expect(url).toContain('destination=Barcelona');
    expect(init.headers['x-rapidapi-key']).toBe('test_key');
  });

  it('reports a malformed response instead of throwing or fabricating data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    });

    const result = await getAiDayPlan('Barcelona');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('AI Trip Planner returned a malformed response');
  });

  it('reports non-200 responses with the status code', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

    const result = await getAiDayPlan('Barcelona');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('AI Trip Planner HTTP 403');
  });
});
