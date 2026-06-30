import { HotelProvider, HotelOffer, Result } from '../types';
import { cache } from '../cache/redis';
import { fetchWithProviderTimeout } from './timeout';

const ENGINE_BASE = 'https://engine.hotellook.com/api/v2/cache.json';
const CACHE_TTL = 21600; // 6 hours

// ─── API response shapes ──────────────────────────────────────────────────────

interface HotelLookCacheEntry {
  hotelId: number;
  hotelName: string;
  stars?: number | string;
  location?: {
    name?: string;
  };
  priceFrom?: number | string;
  photoUrl?: string;
  propertyType?: string;
}

type HotelLookOffer = HotelOffer & {
  stars: number;
  photoUrl?: string;
};

// ─────────────────────────────────────────────────────────────────────────────

function isHotelLookEntry(value: unknown): value is HotelLookCacheEntry {
  return typeof value === 'object' && value !== null;
}

function priceFromToCents(priceFrom: HotelLookCacheEntry['priceFrom']): number | null {
  if (priceFrom === undefined || priceFrom === null) return null;
  if (typeof priceFrom === 'string' && priceFrom.trim() === '') return null;

  const majorUnits = Number(priceFrom);
  if (!Number.isFinite(majorUnits) || majorUnits <= 0) return null;

  // HotelLook cache.json returns priceFrom in the requested currency's major
  // units (currency=USD above), so store integer cents for the app contract.
  const cents = Math.round(majorUnits * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export class HotellookProvider implements HotelProvider {
  private get token(): string {
    return process.env.TP_TOKEN ?? '';
  }

  private get marker(): string {
    return process.env.HOTEL_AFFILIATE_ID ?? process.env.TP_AFFILIATE_MARKER ?? '';
  }

  private buildDeeplink(hotelId: number): string {
    return `https://tp.media/r?marker=${encodeURIComponent(this.marker)}&trs=233847&p=4536&u=https://hotellook.com/hotels/${encodeURIComponent(String(hotelId))}`;
  }

  async searchHotels(
    area: string,
    range: { checkin: string; checkout: string }
  ): Promise<Result<HotelOffer[]>> {
    const token = this.token;
    if (!token) return { ok: false, reason: 'TP_TOKEN not configured' };
    if (!this.marker) return { ok: false, reason: 'HOTEL_AFFILIATE_ID not configured' };

    const location = area.trim().toUpperCase();
    const cacheKey = `hotellook:search:${location}:${range.checkin}:${range.checkout}`;

    try {
      const cached = await cache.get<HotelOffer[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const url =
        `${ENGINE_BASE}` +
        `?location=${encodeURIComponent(location)}` +
        `&checkIn=${encodeURIComponent(range.checkin)}` +
        `&checkOut=${encodeURIComponent(range.checkout)}` +
        `&currency=USD` +
        `&token=${encodeURIComponent(token)}` +
        `&limit=20`;

      const res = await fetchWithProviderTimeout('HotelLook', url);
      if (!res.ok) return { ok: false, reason: `HotelLook HTTP ${res.status}` };

      const json = await res.json();
      if (!Array.isArray(json)) {
        return { ok: false, reason: 'HotelLook returned a malformed response' };
      }
      if (json.length === 0) return { ok: true, data: [] };

      const hotels: HotelLookOffer[] = json.flatMap((entry) => {
        if (!isHotelLookEntry(entry)) return [];
        const hotelId = Number(entry.hotelId);
        const stars = Number(entry.stars ?? 0);
        const priceCents = priceFromToCents(entry.priceFrom);
        if (!Number.isSafeInteger(hotelId) || hotelId <= 0 || typeof entry.hotelName !== 'string') {
          return [];
        }
        if (priceCents === null) return [];

        return {
          id: String(entry.hotelId),
          name: entry.hotelName,
          area: entry.location?.name ?? location,
          stars: Number.isFinite(stars) ? stars : 0,
          rating: Number.isFinite(stars) ? stars : undefined,
          pricePerNight: {
            priceCents,
            currency: 'USD',
          },
          deeplink: this.buildDeeplink(hotelId),
          photoUrl: entry.photoUrl || undefined,
          source: 'hotellook',
        };
      });

      await cache.set(cacheKey, hotels, CACHE_TTL);
      return { ok: true, data: hotels };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Shared singleton — used by API routes and other scripts. */
export const hotellook = new HotellookProvider();
