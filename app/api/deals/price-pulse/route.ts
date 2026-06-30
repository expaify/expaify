import { query } from '../../../../lib/db/client';
import { buildPricePulseDigest } from '../../../../lib/deals/pricePulse';
import type { PricePulseRouteSample } from '../../../../lib/deals/pricePulseTypes';

export const runtime = 'nodejs';

type SnapshotRow = {
  route_key: string;
  origin_iata: string;
  destination_iata: string;
  observed_at: Date | string;
  lowest_fare_cents: number;
};

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;

  return parsed;
}

function snapshotRowToSample(row: SnapshotRow): PricePulseRouteSample {
  const observedAt =
    row.observed_at instanceof Date
      ? row.observed_at.toISOString()
      : new Date(row.observed_at).toISOString();

  return {
    routeKey: row.route_key,
    originIata: row.origin_iata.trim(),
    destinationIata: row.destination_iata.trim(),
    observedAt,
    lowestFareUsd: row.lowest_fare_cents / 100,
  };
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const windowDays = parsePositiveInteger(params.get('windowDays'), 14);
  const limit = parsePositiveInteger(params.get('limit'), 8);

  try {
    const result = await query<SnapshotRow>(
      `SELECT
         TRIM(origin) || '-' || TRIM(destination) AS route_key,
         TRIM(origin) AS origin_iata,
         TRIM(destination) AS destination_iata,
         fetched_at AS observed_at,
         price_cents AS lowest_fare_cents
       FROM snapshots
       WHERE fetched_at >= NOW() - ($1::int * INTERVAL '1 day')
         AND currency = 'USD'
       ORDER BY fetched_at DESC
       LIMIT 5000`,
      [windowDays],
    );

    const digest = buildPricePulseDigest(result.rows.map(snapshotRowToSample), {
      windowDays,
      limit,
    });

    return Response.json(digest, {
      headers: {
        'Cache-Control': 'public, max-age=900',
      },
    });
  } catch (error) {
    console.error('[price-pulse] Unable to load price pulse', error);

    return Response.json(
      { error: 'Unable to load price pulse' },
      { status: 500 },
    );
  }
}
