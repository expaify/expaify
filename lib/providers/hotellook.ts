import { HotelProvider, HotelOffer, Result } from '../types';
import { cache } from '../cache/redis';

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
  priceFrom?: number;
  photoUrl?: string;
  propertyType?: string;
}

type HotelLookOffer = HotelOffer & {
  stars: number;
  photoUrl?: string;
};

// ─────────────────────────────────────────────────────────────────────────────

export class HotellookProvider implements HotelProvider {
  private get token(): string {
    return process.env.TP_TOKEN ?? '';
  }

  private get marker(): string {
    return process.env.TP_AFFILIATE_MARKER ?? '';
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
    if (!this.marker) return { ok: false, reason: 'TP_AFFILIATE_MARKER not configured' };

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

      const res = await fetch(url);
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

      const json = (await res.json()) as HotelLookCacheEntry[];
      if (!Array.isArray(json) || json.length === 0) return { ok: true, data: [] };

      const hotels: HotelLookOffer[] = json.map((entry) => {
        const hotelId = Number(entry.hotelId);
        const stars = Number(entry.stars ?? 0);
        const priceCents = Number(entry.priceFrom ?? 0);

        return {
          id: String(entry.hotelId),
          name: entry.hotelName,
          area: entry.location?.name ?? location,
          stars: Number.isFinite(stars) ? stars : 0,
          rating: Number.isFinite(stars) ? stars : undefined,
          pricePerNight: {
            priceCents: Number.isFinite(priceCents) ? Math.trunc(priceCents) : 0,
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
