import { cache } from '../../cache/redis';
import { bookingComHotels } from '../bookingComHotelsRapidApi';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

const DESTINATION_FIXTURE = {
  data: [{ dest_id: '-1456928', dest_type: 'city', search_type: 'city', name: 'Paris' }],
};

function hotelsFixture(grossPriceValue: number) {
  return {
    data: {
      hotels: [{
        hotel_id: 12345,
        property: {
          name: 'Hotel Test',
          latitude: 48.85,
          longitude: 2.35,
          propertyClass: 4,
          priceBreakdown: { grossPrice: { value: grossPriceValue, currency: 'USD' } },
        },
      }],
    },
  };
}

beforeEach(() => {
  process.env.RAPIDAPI_KEY = 'test-key';
});

// grossPrice is the TOTAL for the whole stay on this API (same field, same
// booking-com15 host already live-verified in lib/pipeline/snapshot.ts), not
// a nightly rate -- this locks in the fix that divides it by real nights
// before storing it as pricePerNight.
it('divides the total-stay grossPrice by real nights instead of storing the stay total as a nightly rate', async () => {
  global.fetch = jest.fn().mockImplementation((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/searchDestination')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(DESTINATION_FIXTURE) } as Response);
    }
    // A real $150/night hotel booked for 3 nights: Booking.com returns the
    // $450 stay total in grossPrice.value.
    return Promise.resolve({ ok: true, json: () => Promise.resolve(hotelsFixture(450)) } as Response);
  });

  const result = await bookingComHotels.searchHotels('PAR', { checkin: '2026-10-01', checkout: '2026-10-04' });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.offers).toHaveLength(1);
  expect(result.data.offers[0].pricePerNight).toEqual({ priceCents: 15000, currency: 'USD' });
});

it('treats a 1-night stay total correctly (no division artifact)', async () => {
  global.fetch = jest.fn().mockImplementation((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/searchDestination')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(DESTINATION_FIXTURE) } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(hotelsFixture(150)) } as Response);
  });

  const result = await bookingComHotels.searchHotels('PAR', { checkin: '2026-10-01', checkout: '2026-10-02' });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.offers[0].pricePerNight).toEqual({ priceCents: 15000, currency: 'USD' });
});
