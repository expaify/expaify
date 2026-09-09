export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db/client';
import { completeAlert, type AlertContract } from '../../../lib/alerts/contract';
import type { Result } from '../../../lib/types';

type AlertCreated = {
  id: string;
  message: string;
  active: true;
};

function resultJson<T>(result: Result<T>, status = result.ok ? 200 : 400) {
  return NextResponse.json(result, { status });
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidIATA(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ─── POST /api/alerts — create a price alert ──────────────────────────────────

export async function POST(request: Request) {
  let body: {
    email?: unknown;
    origin?: unknown;
    dest?: unknown;
    destination?: unknown;
    thresholdCents?: unknown;
    targetPrice?: unknown;
    hotelId?: unknown;
    currency?: unknown;
    travelStart?: unknown;
    travelEnd?: unknown;
    tripType?: unknown;
    passengerCount?: unknown;
    hotelProvider?: unknown;
  };
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  } catch {
    return resultJson({ ok: false, reason: 'Invalid JSON body' }, 400);
  }

  const { email, origin, hotelId } = body;
  const destination = body.destination ?? body.dest;
  const targetCents =
    typeof body.thresholdCents === 'number'
      ? body.thresholdCents
      : typeof body.targetPrice === 'number'
        ? Math.round(body.targetPrice * 100)
        : null;

  if (typeof email !== 'string' || !isValidEmail(email)) {
    return resultJson({ ok: false, reason: 'Invalid email address' }, 400);
  }

  if (typeof origin !== 'string' || !isValidIATA(origin.toUpperCase())) {
    return resultJson({ ok: false, reason: 'origin must be a 3-letter IATA code (e.g. JFK)' }, 400);
  }

  if (typeof destination !== 'string' || !isValidIATA(destination.toUpperCase())) {
    return resultJson({ ok: false, reason: 'destination must be a 3-letter IATA code (e.g. LAX)' }, 400);
  }

  if (typeof targetCents !== 'number' || !Number.isInteger(targetCents) || targetCents < 5000 || targetCents > 500000) {
    return resultJson(
      { ok: false, reason: 'thresholdCents must be an integer between 5000 and 500000' },
      400,
    );
  }

  if (hotelId !== undefined && (typeof hotelId !== 'string' || hotelId.trim().length === 0)) {
    return resultJson({ ok: false, reason: 'hotelId must be a non-empty string' }, 400);
  }

  const contract = {
    currency: body.currency,
    travel_start: body.travelStart,
    travel_end: body.travelEnd,
    trip_type: body.tripType,
    passenger_count: body.passengerCount,
    hotel_id: hotelId ?? null,
    hotel_provider: body.hotelProvider ?? null,
  } as AlertContract;
  if (!completeAlert(contract) || contract.travel_start < new Date().toISOString().slice(0, 10)) {
    return resultJson({ ok: false, reason: 'A price alert requires currency, exact future travel dates, trip type, passenger count, and Booking.com identity for hotels.' }, 400);
  }

  if (!process.env.RESEND_API_KEY) {
    return resultJson(
      { ok: false, reason: 'Price alert emails are not configured, so no active alert was created.' },
      503,
    );
  }

  const originUpper = origin.toUpperCase();
  const destUpper = destination.toUpperCase();
  const hotelIdValue = typeof hotelId === 'string' ? hotelId.trim() : null;

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO price_alerts (email, origin, destination, target_cents, currency, hotel_id, travel_start, travel_end, trip_type, passenger_count, hotel_provider, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
       RETURNING id`,
      [email, originUpper, destUpper, targetCents, contract.currency, hotelIdValue, contract.travel_start, contract.travel_end, contract.trip_type, contract.passenger_count, contract.hotel_provider],
    );

    const id = result.rows[0]?.id ?? '';
    if (!id) {
      return resultJson(
        { ok: false, reason: 'Alert storage did not confirm creation, so no active alert was created.' },
        503,
      );
    }

    const target = `${contract.currency} ${(targetCents / 100).toFixed(2)}`;
    const dates = `${contract.travel_start}${contract.travel_end ? ` to ${contract.travel_end}` : ''}`;
    const message = `Alert set! We'll email you when ${hotelIdValue === null ? `${originUpper}→${destUpper}` : `hotel ${hotelIdValue}`} on ${dates} costs ${target} or less${hotelIdValue ? ' per night (2 adults, 1 room)' : ` for ${contract.passenger_count} traveler(s)`}.`;

    return resultJson<AlertCreated>({
      ok: true,
      data: {
        id,
        message,
        active: true,
      },
    });
  } catch {
    console.warn('[alerts] INSERT unavailable');
    return resultJson(
      { ok: false, reason: 'Alert storage is unavailable, so no active alert was created.' },
      503,
    );
  }
}

// ─── DELETE /api/alerts?email=X&id=Y — unsubscribe ───────────────────────────

export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const email = params.get('email');
  const id = params.get('id');

  if (!email || !id) {
    return resultJson({ ok: false, reason: 'email and id are required' }, 400);
  }

  if (!isValidEmail(email)) {
    return resultJson({ ok: false, reason: 'Invalid email address' }, 400);
  }

  if (!isValidUuid(id)) {
    return resultJson({ ok: false, reason: 'id must be a valid UUID' }, 400);
  }

  try {
    await query(
      `UPDATE price_alerts SET active = false WHERE id = $1 AND email = $2`,
      [id, email],
    );
    return resultJson({ ok: true, data: { message: 'Alert cancelled.' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[alerts] DELETE error:', message);
    return resultJson({ ok: false, reason: 'Alert storage is unavailable. Please try again later.' }, 503);
  }
}
