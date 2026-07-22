const writeAnalyticsEventMock = jest.fn();

jest.mock('@/lib/analytics/server', () => {
  const actual = jest.requireActual('@/lib/analytics/server') as typeof import('@/lib/analytics/server');
  return { ...actual, writeAnalyticsEvent: (...args: unknown[]) => writeAnalyticsEventMock(...args) };
});

const { POST } = jest.requireActual('../route') as typeof import('../route');

describe('POST /api/analytics', () => {
  beforeEach(() => writeAnalyticsEventMock.mockReset().mockResolvedValue(undefined));

  it('validates and writes primitive-only analytics events', async () => {
    const request = new Request('https://expaify.test/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'hotel_handoff_viewed',
        props: { supplier: 'hotellook', coverageCount: 0, partnerNamed: false },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(202);
    expect(writeAnalyticsEventMock).toHaveBeenCalledWith({
      event: 'hotel_handoff_viewed',
      props: { supplier: 'hotellook', coverageCount: 0, partnerNamed: false },
    });
  });

  it.each([
    { event: 'Hotel Viewed', props: {} },
    { event: 'hotel_viewed', props: { nested: { unsafe: true } } },
    { event: 'hotel_viewed', props: { oversized: 'x'.repeat(201) } },
  ])('rejects malformed event payloads', async (body) => {
    const response = await POST(new Request('https://expaify.test/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(400);
    expect(writeAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it('returns a non-throwing service response when persistence is unavailable', async () => {
    writeAnalyticsEventMock.mockRejectedValueOnce(new Error('database down'));
    const response = await POST(new Request('https://expaify.test/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'hotel_viewed', props: {} }),
    }));
    expect(response.status).toBe(503);
  });

  it('rejects oversized bodies even without a content-length header', async () => {
    const response = await POST(new Request('https://expaify.test/api/analytics', {
      method: 'POST',
      body: JSON.stringify({ event: 'hotel_viewed', props: { value: 'x'.repeat(8_193) } }),
    }));
    expect(response.status).toBe(413);
    expect(writeAnalyticsEventMock).not.toHaveBeenCalled();
  });
});
