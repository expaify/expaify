export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db/client';
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
  };
  try {
    body = await request.json();
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
      `INSERT INTO price_alerts (email, origin, destination, target_cents, currency, hotel_id, created_at)
       VALUES ($1, $2, $3, $4, 'USD', $5, now())
       RETURNING id`,
      [email, originUpper, destUpper, targetCents, hotelIdValue],
    );

    const id = result.rows[0]?.id ?? '';
    if (!id) {
      return resultJson(
        { ok: false, reason: 'Alert storage did not confirm creation, so no active alert was created.' },
        503,
      );
    }

    const targetDollars = Math.round(targetCents / 100);
    const message =
      hotelIdValue === null
        ? `Alert set! We'll email you when ${originUpper}→${destUpper} drops below $${targetDollars}.`
        : `Alert set! We'll email you when hotel ${hotelIdValue} drops below $${targetDollars}.`;

    return resultJson<AlertCreated>({
      ok: true,
      data: {
        id,
        message,
        active: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[alerts] INSERT error:', message);
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
