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
    _area: string,
    _range: { checkin: string; checkout: string }
  ): Promise<Result<HotelOffer[]>> {
    // TODO: hotel API unavailable — switch provider
    // All known Travelpayouts/Hotellook endpoints (yasen.hotellook.com/tp/v1,
    // engine.hotellook.com/api/v2, hotel-engine.travelpayouts.com/api/v1)
    // return 404. Return empty results cleanly until a working provider is wired in.
    return { ok: true, data: [] };
  }
}

/** Shared singleton — used by API routes and other scripts. */
export const hotellook = new HotellookProvider();
