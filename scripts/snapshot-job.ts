import { GOLDEN_ROUTES } from './golden-routes';
import { travelpayouts } from '../lib/providers/travelpayouts';
import { query } from '../lib/db/client';
import type { PricePoint } from '../lib/types';

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

  process.exit(0);
}

main();
