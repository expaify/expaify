import { NextResponse } from 'next/server';
import { getBaseline } from '../../../lib/db/getBaseline';
import { query } from '../../../lib/db/client';
import { scoreDeal } from '../../../lib/scoring/scoreDeal';
import type { NormalizedFare, NormalizedHotelOffer, PricePoint } from '../../../lib/types';

interface HotelSnapshotRow {
  date: Date;
  price_per_night_cents: number;
  currency: string;
}

async function getHotelBaseline(hotelId: string): Promise<PricePoint[]> {
  const result = await query<HotelSnapshotRow>(
    `SELECT date, price_per_night_cents, currency
     FROM hotel_snapshots
     WHERE hotel_id = $1
       AND fetched_at >= NOW() - INTERVAL '90 days'
     ORDER BY date DESC`,
    [hotelId],
  );

  return result.rows.map((row) => ({
    date:
      row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date).slice(0, 10),
    priceCents: row.price_per_night_cents,
    currency: row.currency.trim(),
  }));
}

/**
 * POST /api/score
 *
 * Body: { fare: NormalizedFare }
 *
 * Response: DealScore
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get('type');

  if (type !== 'hotel') {
    return NextResponse.json({ error: 'type=hotel is required' }, { status: 400 });
  }

  const hotelId = params.get('hotelId')?.trim();
  const pricePerNightCents = Number(params.get('pricePerNightCents'));
  const currency = params.get('currency')?.trim().toUpperCase() || 'USD';

  if (!hotelId) {
    return NextResponse.json({ error: 'hotelId is required' }, { status: 400 });
  }

  if (!Number.isInteger(pricePerNightCents) || pricePerNightCents <= 0) {
    return NextResponse.json(
      { error: 'pricePerNightCents must be a positive integer' },
      { status: 400 },
    );
  }

  let history;
  try {
    history = await getHotelBaseline(hotelId);
  } catch {
    return NextResponse.json(
      { error: 'Could not load hotel baseline' },
      { status: 502 },
    );
  }

  const hotel: NormalizedHotelOffer = {
    id: hotelId,
    name: '',
    area: '',
    stars: 0,
    pricePerNight: { priceCents: pricePerNightCents, currency },
    deeplink: '',
    source: 'score-api',
  };

  const dealScore = scoreDeal(hotel, history);
  return NextResponse.json(dealScore);
}

export async function POST(request: Request) {
  let body: { fare?: NormalizedFare };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'fare is required' }, { status: 400 });
  }

  const fare = body?.fare;
  if (!fare) {
    return NextResponse.json({ error: 'fare is required' }, { status: 400 });
  }

  let history;
  try {
    history = await getBaseline(fare.origin, fare.destination);
  } catch {
    return NextResponse.json(
      { error: 'Could not load baseline' },
      { status: 502 },
    );
  }

  const dealScore = scoreDeal(fare, history);
  return NextResponse.json(dealScore);
}
