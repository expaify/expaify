import { query } from './client';
import type { PricePoint } from '../types';

interface SnapshotRow {
  date: Date;
  price_cents: number;
  currency: string;
}

export async function getBaseline(origin: string, dest: string): Promise<PricePoint[]> {
  const result = await query<SnapshotRow>(
    `SELECT date, price_cents, currency
     FROM snapshots
     WHERE origin = $1
       AND destination = $2
       AND fetched_at >= NOW() - INTERVAL '90 days'
     ORDER BY date DESC`,
    [origin, dest]
  );

  return result.rows.map((row) => ({
    date:
      row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date).slice(0, 10),
    priceCents: row.price_cents,
    currency: row.currency.trim(),
  }));
}
