import { BookingComRapidApiProvider } from '../bookingComRapidApi';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('BookingComRapidApiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RAPIDAPI_KEY;
    delete process.env.RAPIDAPI_HOST;
    delete process.env.RAPIDAPI_BASE_URL;
    delete process.env.RAPIDAPI_FLIGHT_PATH;
  });

  it('returns a configuration error when RAPIDAPI_KEY is missing', async () => {
    const provider = new BookingComRapidApiProvider({ host: 'booking-com15.p.rapidapi.com' });
    const result = await provider.searchFares('JFK', 'LAX', {
      depart: '2099-09-22',
      passengers: 1,
    });

    expect(result).toEqual({ ok: false, reason: 'RAPIDAPI_KEY not configured' });
  });

  it('calls the configured RapidAPI endpoint with legs, host, and key headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: true, data: {} }),
    } as Response);

    const provider = new BookingComRapidApiProvider({
      apiKey: 'rapid-key',
      host: 'booking-com15.p.rapidapi.com',
      baseUrl: 'https://booking-com15.p.rapidapi.com',
      flightPath: '/api/v1/flights/getMinPriceMultiStops',
    });

    const result = await provider.searchFares('BOM', 'AMD', {
      depart: '2099-12-25',
      return: '2099-12-26',
      passengers: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unresolved mapping failure');
    expect(result.reason).toContain('response mapping not finalized');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://booking-com15.p.rapidapi.com/api/v1/flights/getMinPriceMultiStops?'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
          'x-rapidapi-key': 'rapid-key',
        }),
      })
    );

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('cabinClass')).toBe('ECONOMY');
    expect(parsed.searchParams.get('currency_code')).toBe('USD');
    expect(parsed.searchParams.get('legs')).toBe(JSON.stringify([
      { fromId: 'BOM.AIRPORT', toId: 'AMD.AIRPORT', date: '2099-12-25' },
      { fromId: 'AMD.AIRPORT', toId: 'BOM.AIRPORT', date: '2099-12-26' },
    ]));
  });
});
