import { HotelProvider, HotelOffer, Result } from '../types';
import { cache } from '../cache/redis';

const HOTELLOOK_BASE = 'https://engine.hotellook.com/api/v2';
const CACHE_TTL = 21600; // 6 hours

// ─── Hotellook API response shape ────────────────────────────────────────────

interface HotellookHotel {
  id: number | string;
  hotelName: string;
  location?: { name?: string };
  priceFrom?: number;   // USD, may be fractional
  stars?: number;
  rating?: number;
  url?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class HotellookProvider implements HotelProvider {
  private get token(): string {
    return process.env.TP_TOKEN ?? '';
  }

  private get marker(): string {
    return process.env.TP_AFFILIATE_MARKER ?? '';
  }

  async searchHotels(
    area: string,
    range: { checkin: string; checkout: string }
  ): Promise<Result<HotelOffer[]>> {
    const cacheKey = `tp:hotels:${area}:${range.checkin}:${range.checkout}`;

    try {
      const cached = await cache.get<HotelOffer[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const url =
        `${HOTELLOOK_BASE}/cache.json` +
        `?location=${encodeURIComponent(area)}` +
        `&checkIn=${encodeURIComponent(range.checkin)}` +
        `&checkOut=${encodeURIComponent(range.checkout)}` +
        `&token=${encodeURIComponent(this.token)}` +
        `&limit=20`;

      const res = await fetch(url);
      if (!res.ok) {
        // Hotellook cache.json is deprecated — return empty, hotels are Phase 3
        return { ok: true, data: [] };
      }

      const json = (await res.json()) as HotellookHotel[];
      const marker = this.marker;

      const offers: HotelOffer[] = json.map((hotel) => {
        // Hotellook returns prices in USD (not RUB), pass through as cents
        const priceUSDcents = Math.round((hotel.priceFrom ?? 0) * 100);
        const hotelId = String(hotel.id);

        const deeplinkBase = hotel.url ?? `https://www.hotellook.com/hotels/${hotelId}`;
        const deeplink = marker
          ? `${deeplinkBase}${deeplinkBase.includes('?') ? '&' : '?'}marker=${marker}`
          : deeplinkBase;

        return {
          id: hotelId,
          name: hotel.hotelName,
          area: hotel.location?.name ?? area,
          pricePerNight: {
            priceCents: priceUSDcents,
            currency: 'USD',
          },
          rating: hotel.stars ?? hotel.rating,
          deeplink,
          source: 'hotellook',
        };
      });

      await cache.set(cacheKey, offers, CACHE_TTL);
      return { ok: true, data: offers };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Shared singleton — used by API routes and other scripts. */
export const hotellook = new HotellookProvider();
