jest.mock('../../cache/redis', () => ({
  cache: { get: jest.fn(), set: jest.fn() },
}));

import { cache } from '../../cache/redis';
import { buildBookingHotelContext } from '../config';
import {
  persistBookingHotelContext,
  resolveBookingHotelContext,
} from '../hotelContextStore';
import type { HotelOffer } from '../../types';

const cacheGet = cache.get as jest.Mock;
const cacheSet = cache.set as jest.Mock;

const hotel: HotelOffer = {
  id: 'opaque-hotel',
  name: 'Opaque Context Hotel',
  area: 'Central district',
  stars: 4,
  pricePerNight: { priceCents: 18_900, currency: 'USD' },
  priceBasis: 'per_night_before_taxes_fees',
  deeplink: 'https://tp.media/r?marker=affiliate',
  source: 'provider',
  documentReadiness: {
    status: 'not_provided',
    scope: 'rate',
    documentTypes: [],
    issuerByDocument: {},
    billingDetailsStep: 'unknown',
    source: { label: 'Provider' },
  },
  fundsPolicy: {
    state: 'complete',
    sourceLabel: 'Provider policy',
    scope: 'selected_stay',
    obligations: [{
      type: 'authorization_hold',
      amount: { kind: 'exact', money: { priceCents: 25_000, currency: 'USD' } },
      basis: 'per_stay',
      applicationWording: 'At check-in',
      paymentMethodWording: 'Credit card',
      returnOrRelease: { action: 'release', providerWording: 'after checkout' },
      sourceLabel: 'Provider policy',
      scope: 'selected_stay',
    }],
  },
  fundsPolicyCapability: { policy: true },
  fundsPolicyLoadState: 'ready',
};

describe('opaque hotel booking context store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheSet.mockResolvedValue(undefined);
  });

  it('persists and resolves semantically equal structured evidence with a bounded opaque reference', async () => {
    const context = buildBookingHotelContext(hotel);
    const persisted = await persistBookingHotelContext(context);
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) throw new Error(persisted.reason);
    expect(persisted.data.reference).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(cacheSet).toHaveBeenCalledWith(
      `booking:hotel-context:${persisted.data.reference}`,
      context,
      1_800,
    );

    cacheGet.mockResolvedValueOnce(context);
    await expect(resolveBookingHotelContext(persisted.data.reference)).resolves.toEqual({ ok: true, data: context });
  });

  it('degrades contradictory capability and evidence before persistence and after cache replay', async () => {
    const contradictory = buildBookingHotelContext({
      ...hotel,
      fundsPolicyCapability: { policy: false },
    });

    expect(contradictory.fundsPolicy).toEqual({
      state: 'not_returned',
      obligations: [],
      sourceLabel: 'Provider policy',
      scope: 'not_returned',
    });

    const persisted = await persistBookingHotelContext(contradictory);
    expect(persisted.ok).toBe(true);
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringMatching(/^booking:hotel-context:/),
      contradictory,
      1_800,
    );
    cacheGet.mockResolvedValueOnce({
      ...contradictory,
      fundsPolicy: hotel.fundsPolicy,
    });
    if (!persisted.ok) throw new Error(persisted.reason);
    await expect(resolveBookingHotelContext(persisted.data.reference)).resolves.toEqual({
      ok: true,
      data: contradictory,
    });
  });

  it('returns Result failures for malformed, missing, and cache-failed contexts', async () => {
    await expect(persistBookingHotelContext({ kind: 'hotel' })).resolves.toEqual({
      ok: false,
      reason: 'Invalid hotel booking context',
    });
    await expect(resolveBookingHotelContext('not-valid')).resolves.toEqual({
      ok: false,
      reason: 'Invalid hotel booking context reference',
    });
    cacheGet.mockResolvedValueOnce(null);
    await expect(resolveBookingHotelContext('a'.repeat(24))).resolves.toEqual({
      ok: false,
      reason: 'Hotel booking context expired',
    });
    cacheSet.mockRejectedValueOnce(new Error('redis unavailable'));
    await expect(persistBookingHotelContext(buildBookingHotelContext(hotel))).resolves.toEqual({
      ok: false,
      reason: 'Hotel booking review could not be prepared',
    });
  });
});
