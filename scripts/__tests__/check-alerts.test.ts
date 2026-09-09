// Exercises the actual job, including legacy auto-running script when stashed.
// Provider, DB and email transports are all stubbed; no real delivery is possible.
const baseAlert = {
  id: 'alert-1', email: 'test@example.com', origin: 'JFK', destination: 'LAX',
  target_cents: 25000, currency: 'EUR', travel_start: '2099-09-01', travel_end: '2099-09-08',
  trip_type: 'roundtrip', passenger_count: 2, hotel_id: null, hotel_provider: null,
  active: true, triggered_at: null,
};
const fare = {
  id: 'fare-1', origin: 'JFK', destination: 'LAX', depart: '2099-09-01T10:00:00Z', return: '2099-09-08T12:00:00Z',
  price: { priceCents: 10000, currency: 'EUR' }, passengerCount: 2, priceScope: 'per_person',
  fareType: 'cash', cabin: 'economy',
};

async function run(alerts: object[], fares: object[] = [], hotels: object[] = [], dryRun = false) {
  jest.resetModules();
  const query = jest.fn(async (sql: string) => ({ rows: sql.includes('SELECT') ?
    sql.includes('hotel_id IS NOT NULL') ? alerts.filter(a => (a as typeof baseAlert).hotel_id) :
    sql.includes('AND hotel_id IS NULL') ? alerts.filter(a => !(a as typeof baseAlert).hotel_id) : alerts : [] }));
  const searchFares = jest.fn(async () => ({ ok: true, data: fares }));
  const searchHotels = jest.fn(async () => ({ ok: true, data: { offers: hotels } }));
  jest.doMock('../../lib/db/client', () => ({ query }));
  jest.doMock('../../lib/providers/travelpayouts', () => ({ travelpayouts: {
    searchFares, priceTrends: jest.fn(async () => ({ ok: true, data: [{ priceCents: 10000, currency: 'USD', date: '2099-01-01' }] })),
  } }));
  jest.doMock('../../lib/providers/bookingComHotelsRapidApi', () => ({ bookingComHotels: { searchHotels } }));
  jest.doMock('../../lib/providers/hotellook', () => ({ hotellook: { searchHotels } }));
  const delivery = jest.fn(async () => new Response('{}', { status: 200 }));
  global.fetch = delivery;
  process.env.RESEND_API_KEY = 'test-only';
  let finish!: () => void;
  const exited = new Promise<void>(resolve => { finish = resolve; });
  jest.spyOn(process, 'exit').mockImplementation(() => { finish(); return undefined as never; });
  const job = require('../check-alerts') as { checkAlerts?: (options: { dryRun: boolean }) => Promise<void> };
  if (job.checkAlerts) await job.checkAlerts({ dryRun });
  else await exited;
  return { delivery, query, searchFares, searchHotels };
}

const originalFetch = global.fetch;
const originalKey = process.env.RESEND_API_KEY;
afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
  jest.restoreAllMocks();
});

it.each([
  ['USD fare for a EUR alert', { ...fare, price: { priceCents: 10000, currency: 'USD' } }],
  ['different outbound date', { ...fare, depart: '2099-09-02' }],
  ['different return date', { ...fare, return: '2099-09-09' }],
  ['missing return date', { ...fare, return: undefined }],
  ['different route', { ...fare, destination: 'SFO' }],
  ['different passenger count', { ...fare, passengerCount: 1 }],
  ['unknown price scope', { ...fare, priceScope: undefined }],
  ['party total above target', { ...fare, price: { priceCents: 15000, currency: 'EUR' } }],
])('does not trigger from %s or a cheap generic USD monthly baseline', async (_name, candidate) => {
  const { delivery, query } = await run([baseAlert], [candidate]);
  expect(delivery).not.toHaveBeenCalled();
  expect(query.mock.calls.some(([sql]) => sql.includes('SET triggered_at'))).toBe(false);
});

it('requests exact EUR trip and sends EUR party total only after a matching quote', async () => {
  const { delivery, searchFares, query } = await run([baseAlert], [fare]);
  expect(searchFares).toHaveBeenCalledWith('JFK', 'LAX', {
    depart: '2099-09-01', return: '2099-09-08', passengers: 2, currency: 'EUR', strictDates: true,
  });
  expect(delivery).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(String((delivery.mock.calls as unknown as [string, RequestInit][])[0][1].body));
  expect(payload.text).toContain('EUR 200.00');
  expect(payload.text).toContain('2099-09-01 to 2099-09-08');
  expect(query.mock.calls.some(([sql]) => sql.includes('SET triggered_at'))).toBe(true);
});

it.each([
  { ...baseAlert, travel_start: null },
  { ...baseAlert, travel_end: null },
  { ...baseAlert, currency: null },
  { ...baseAlert, passenger_count: null },
  { ...baseAlert, active: false },
  { ...baseAlert, triggered_at: '2099-01-01' },
  { ...baseAlert, hotel_id: '123', trip_type: 'hotel', hotel_provider: null },
  { ...baseAlert, hotel_id: '123', trip_type: 'hotel', hotel_provider: 'hotellook' },
])('excludes incomplete/legacy/inactive alerts before any provider call: %j', async alert => {
  const { delivery, searchFares, searchHotels } = await run([alert], [fare]);
  expect(searchFares).not.toHaveBeenCalled();
  expect(searchHotels).not.toHaveBeenCalled();
  expect(delivery).not.toHaveBeenCalled();
});

it('rejects a bare-ID collision from another hotel provider', async () => {
  const alert = { ...baseAlert, trip_type: 'hotel', hotel_id: '123', hotel_provider: 'booking.com' };
  const hotel = { id: '123', name: 'Wrong hotel', source: 'hotellook', pricePerNight: { priceCents: 10000, currency: 'EUR' } };
  const { delivery } = await run([alert], [], [hotel]);
  expect(delivery).not.toHaveBeenCalled();
});

it('checks Booking.com identity on exact stay and currency', async () => {
  const alert = { ...baseAlert, trip_type: 'hotel', hotel_id: '123', hotel_provider: 'booking.com' };
  const hotel = { id: '123', source: 'booking.com', pricePerNight: { priceCents: 10000, currency: 'EUR' } };
  const { delivery, searchHotels } = await run([alert], [], [hotel]);
  expect(searchHotels).toHaveBeenCalledWith('JFK', { checkin: '2099-09-01', checkout: '2099-09-08', currency: 'EUR', strictCurrency: true });
  expect(delivery).toHaveBeenCalledTimes(1);
});

it('dry run never sends email or writes even for a qualifying quote', async () => {
  const { delivery, query } = await run([baseAlert], [fare], [], true);
  expect(delivery).not.toHaveBeenCalled();
  expect(query.mock.calls.every(([sql]) => sql.includes('SELECT'))).toBe(true);
});
