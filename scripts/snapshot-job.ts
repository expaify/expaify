import { GOLDEN_ROUTES } from './golden-routes';
import { travelpayouts } from '../lib/providers/travelpayouts';
import { hotellook } from '../lib/providers/hotellook';
import { query } from '../lib/db/client';
import type { HotelOffer, PricePoint } from '../lib/types';

async function insertSnapshots(
  origin: string,
  dest: string,
  points: PricePoint[]
): Promise<number> {
  if (points.length === 0) return 0;

  let inserted = 0;

  for (const point of points) {
    const date = point.date.length === 7 ? `${point.date}-01` : point.date;
    const result = await query(
      `INSERT INTO snapshots (origin, destination, date, price_cents, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT snapshots_route_date_unique DO NOTHING`,
      [origin, dest, date, point.priceCents, point.currency]
    );
    inserted += result.rowCount ?? 0;
  }

  return inserted;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function isValidHotelSnapshot(hotel: HotelOffer): boolean {
  const hotelId = hotel.id.trim();
  const priceCents = hotel.pricePerNight.priceCents;
  const currency = hotel.pricePerNight.currency.trim();

  return (
    hotelId.length > 0 &&
    Number.isSafeInteger(priceCents) &&
    priceCents > 0 &&
    /^[A-Z]{3}$/.test(currency)
  );
}

async function insertHotelSnapshots(hotels: HotelOffer[], date: string): Promise<number> {
  let inserted = 0;

  for (const hotel of hotels) {
    if (!isValidHotelSnapshot(hotel)) continue;

    const result = await query(
      `INSERT INTO hotel_snapshots (hotel_id, date, price_per_night_cents, currency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT hotel_snapshots_unique DO NOTHING`,
      [
        hotel.id.trim(),
        date,
        hotel.pricePerNight.priceCents,
        hotel.pricePerNight.currency.trim(),
      ]
    );
    inserted += result.rowCount ?? 0;
  }

  return inserted;
}

async function snapshotTopHotels(): Promise<void> {
  const checkin = daysFromNow(7);
  const checkout = daysFromNow(8);

  try {
    const { rows } = await query<{ destination: string }>(
      `SELECT destination
       FROM searched_routes
       GROUP BY destination
       ORDER BY SUM(search_count) DESC
       LIMIT 50`
    );

    for (const { destination } of rows) {
      const label = `hotels:${destination}`;

      try {
        const result = await hotellook.searchHotels(destination, { checkin, checkout });
        if (!result.ok) {
          console.error(`[${label}] ${result.reason}`);
          continue;
        }

        const n = await insertHotelSnapshots(result.data.offers, checkin);
        console.log(`[${label}] inserted ${n} rows`);
      } catch (err) {
        console.error(`[${label}] ${err instanceof Error ? err.message : err}`);
      }
    }
  } catch (err) {
    console.error('[snapshot] Failed to fetch top hotel destinations:', err);
  }
}

async function main(): Promise<void> {
  for (const route of GOLDEN_ROUTES) {
    const label = `${route.origin}-${route.dest}`;
    try {
      const result = await travelpayouts.priceTrends(route.origin, route.dest);

      if (!result.ok) {
        console.error(`[${label}] ERROR: ${result.reason}`);
        continue;
      }

      const n = await insertSnapshots(route.origin, route.dest, result.data);
      console.log(`[${label}] inserted ${n} rows`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${label}] ERROR: ${message}`);
    }
  }

  // Also snapshot user-searched routes (top 200 by search count, last 90 days)
  try {
    const { rows } = await query<{ origin: string; destination: string }>(
      `SELECT origin, destination FROM searched_routes
       WHERE first_searched_at > NOW() - INTERVAL '90 days'
       ORDER BY search_count DESC
       LIMIT 200`
    );
    for (const route of rows) {
      const alreadyDone = GOLDEN_ROUTES.some(g => g.origin === route.origin && g.dest === route.destination);
      if (alreadyDone) continue;
      const label = `${route.origin}-${route.destination}`;
      try {
        const result = await travelpayouts.priceTrends(route.origin, route.destination);
        if (!result.ok) { console.error(`[${label}] ${result.reason}`); continue; }
        const n = await insertSnapshots(route.origin, route.destination, result.data);
        console.log(`[${label}] inserted ${n} rows (user route)`);
      } catch (err) {
        console.error(`[${label}] ${err instanceof Error ? err.message : err}`);
      }
    }
  } catch (err) {
    console.error('[snapshot] Failed to fetch searched_routes:', err);
  }

  await snapshotTopHotels();

  process.exit(0);
}

main();
