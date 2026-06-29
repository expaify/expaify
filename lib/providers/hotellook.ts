import { HotelProvider, HotelOffer, Result } from '../types';
import { cache } from '../cache/redis';

const YASEN_BASE = 'https://yasen.hotellook.com/tp/v1';
const CACHE_TTL = 21600; // 6 hours

// ─── IATA code → city name map ────────────────────────────────────────────────

const IATA_TO_CITY: Record<string, string> = {
  LAX: 'Los Angeles',
  JFK: 'New York',
  EWR: 'New York',
  LHR: 'London',
  NRT: 'Tokyo',
  ORD: 'Chicago',
  CDG: 'Paris',
  GRU: 'São Paulo',
  SYD: 'Sydney',
  DFW: 'Dallas',
  MAD: 'Madrid',
  MIA: 'Miami',
  SFO: 'San Francisco',
  BOS: 'Boston',
};

// ─── API response shapes ──────────────────────────────────────────────────────

interface AvailableLocation {
  id: number;
  cityName: string;
  countryCode: string;
}

interface HotelPrice {
  hotelId: number;
  hotelName: string;
  stars?: number;
  priceFrom?: number;
  priceAvg?: number;
  pricePercentile?: Record<string, number>;
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

  /** Resolve a raw area string to a city name. */
  private resolveCity(area: string): string {
    const trimmed = area.trim();
    // 3 uppercase letters → treat as IATA code
    if (/^[A-Z]{3}$/.test(trimmed)) {
      return IATA_TO_CITY[trimmed] ?? trimmed;
    }
    return trimmed;
  }

  async searchHotels(
    area: string,
    range: { checkin: string; checkout: string }
  ): Promise<Result<HotelOffer[]>> {
    // Guard: missing dates → return empty (not an error)
    if (!range.checkin || !range.checkout) {
      return { ok: true, data: [] };
    }

    const city = this.resolveCity(area);

    // Guard: empty area → return empty
    if (!city) {
      return { ok: true, data: [] };
    }

    const cacheKey = `tp:hotels:v2:${city}:${range.checkin}:${range.checkout}`;

    try {
      const cached = await cache.get<HotelOffer[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      // ── Step 1: resolve city to a location ID ────────────────────────────
      const locCacheKey = `tp:hotels:loc:${city}`;
      let locationId: number | null = await cache.get<number>(locCacheKey);

      if (locationId === null) {
        const locUrl =
          `${YASEN_BASE}/available_locations` +
          `?query=${encodeURIComponent(city)}` +
          `&locale=en` +
          `&token=${encodeURIComponent(this.token)}`;

        const locRes = await fetch(locUrl);
        if (!locRes.ok) {
          return {
            ok: false,
            reason: `available_locations HTTP ${locRes.status}: ${locRes.statusText}`,
          };
        }

        const locations = (await locRes.json()) as AvailableLocation[];
        if (!Array.isArray(locations) || locations.length === 0) {
          return { ok: true, data: [] };
        }

        locationId = locations[0].id;
        // Cache the location ID for 6 h too
        await cache.set(locCacheKey, locationId, CACHE_TTL);
      }

      // ── Step 2: fetch prices by location ─────────────────────────────────
      const pricesUrl =
        `${YASEN_BASE}/prices_by_dates` +
        `?locationId=${encodeURIComponent(locationId)}` +
        `&checkIn=${encodeURIComponent(range.checkin)}` +
        `&checkOut=${encodeURIComponent(range.checkout)}` +
        `&adults=1` +
        `&currency=USD` +
        `&limit=20` +
        `&token=${encodeURIComponent(this.token)}`;

      const pricesRes = await fetch(pricesUrl);
      if (!pricesRes.ok) {
        return {
          ok: false,
          reason: `prices_by_dates HTTP ${pricesRes.status}: ${pricesRes.statusText}`,
        };
      }

      const hotels = (await pricesRes.json()) as HotelPrice[];
      if (!Array.isArray(hotels) || hotels.length === 0) {
        return { ok: true, data: [] };
      }

      const marker = this.marker;

      const offers: HotelOffer[] = hotels.map((hotel) => {
        const hotelId = String(hotel.hotelId);
        const priceUSD = hotel.priceFrom ?? hotel.priceAvg ?? 0;
        const deeplink = `https://www.hotellook.com/hotels/${hotelId}?marker=${marker}`;

        return {
          id: hotelId,
          name: hotel.hotelName,
          area: city,
          pricePerNight: {
            priceCents: Math.round(priceUSD * 100),
            currency: 'USD',
          },
          rating: hotel.stars,
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
