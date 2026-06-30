import { type NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db/client';

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
    destination?: unknown;
    targetPrice?: unknown;
    hotelId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, origin, destination, targetPrice, hotelId } = body;

  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  if (typeof origin !== 'string' || !isValidIATA(origin.toUpperCase())) {
    return NextResponse.json(
      { error: 'origin must be a 3-letter IATA code (e.g. JFK)' },
      { status: 400 },
    );
  }

  if (typeof destination !== 'string' || !isValidIATA(destination.toUpperCase())) {
    return NextResponse.json(
      { error: 'destination must be a 3-letter IATA code (e.g. LAX)' },
      { status: 400 },
    );
  }

  if (typeof targetPrice !== 'number' || targetPrice < 50 || targetPrice > 5000) {
    return NextResponse.json(
      { error: 'targetPrice must be a number between 50 and 5000' },
      { status: 400 },
    );
  }

  if (hotelId !== undefined && (typeof hotelId !== 'string' || hotelId.trim().length === 0)) {
    return NextResponse.json({ error: 'hotelId must be a non-empty string' }, { status: 400 });
  }

  const originUpper = origin.toUpperCase();
  const destUpper = destination.toUpperCase();
  const targetCents = Math.round(targetPrice * 100);
  const hotelIdValue = typeof hotelId === 'string' ? hotelId.trim() : null;

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO price_alerts (email, origin, destination, target_cents, currency, hotel_id)
       VALUES ($1, $2, $3, $4, 'USD', $5)
       RETURNING id`,
      [email, originUpper, destUpper, targetCents, hotelIdValue],
    );

    const id = result.rows[0]?.id ?? '';
    const message =
      hotelIdValue === null
        ? `Alert set! We'll email you when ${originUpper}→${destUpper} drops below $${targetPrice}.`
        : `Alert set! We'll email you when hotel ${hotelIdValue} drops below $${targetPrice}.`;

    return NextResponse.json({
      id,
      message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[alerts] INSERT error:', message);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

// ─── DELETE /api/alerts?email=X&id=Y — unsubscribe ───────────────────────────

export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const email = params.get('email');
  const id = params.get('id');

  if (!email || !id) {
    return NextResponse.json({ error: 'email and id are required' }, { status: 400 });
  }

  try {
    await query(
      `UPDATE price_alerts SET active = false WHERE id = $1 AND email = $2`,
      [id, email],
    );
    return NextResponse.json({ message: 'Alert cancelled.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[alerts] DELETE error:', message);
    return NextResponse.json({ error: 'Failed to cancel alert' }, { status: 500 });
  }
}
