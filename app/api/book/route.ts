export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { BOOKING_FORM_PASSENGER_LIMIT, isBookingEnabled, validateBookingFareContext, type BookingFareContext } from '@/lib/booking/config';
import { cache } from '@/lib/cache/redis';
import {
  computeBookingIdempotencyKey,
  type BookingIdempotencyRecord,
  BOOKING_IDEMPOTENCY_LOCK_TTL_SECONDS,
  BOOKING_IDEMPOTENCY_RESULT_TTL_SECONDS,
} from '@/lib/booking/idempotency';

const BASE_URL = 'https://api.duffel.com';

interface PassengerData {
  given_name: string;
  family_name: string;
  born_on: string;        // YYYY-MM-DD
  email: string;
  phone_number: string;   // with country code e.g. +12125551234
  gender: 'm' | 'f';
  title: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
}

interface DuffelOfferResponse {
  data: {
    passengers: Array<{ id: string }>;
    total_amount: string;
    total_currency: string;
  };
}

interface DuffelOrderResponse {
  data?: {
    id: string;
    booking_reference: string;
  };
  errors?: Array<{ message: string; type?: string; title?: string }>;
}

type ApiResult = { httpStatus: number; body: Record<string, unknown> };

function result(httpStatus: number, body: Record<string, unknown>): ApiResult {
  return { httpStatus, body };
}

function decimalStringToCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(`${whole}${fraction.padEnd(2, '0')}`);
}

const AMBIGUOUS_RESULT: ApiResult = result(202, {
  ok: false,
  ambiguous: true,
  reason: 'expaify could not confirm whether this booking completed. Check your email for a confirmation before submitting again — resubmitting could create a second booking.',
});

/**
 * Everything from "we have a validated offerId + passenger" through Duffel
 * order creation. Split out from POST so the idempotency wrapper below can
 * gate it behind a Redis lock and cache its (non-ambiguous) result.
 */
async function createDuffelOrder(offerId: string, selectedFare: BookingFareContext, p: PassengerData): Promise<ApiResult> {
  const apiKey = process.env.DUFFEL_KEY ?? '';
  if (!apiKey) return result(500, { ok: false, reason: 'Duffel not configured' });

  const duffelHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Duffel-Version': 'v2',
    'Content-Type': 'application/json',
  };

  // Step 2: Fetch offer details to get the passenger id. This happens BEFORE
  // any order is attempted, so any failure here -- including a thrown network
  // error, not just a non-ok response -- is safe to return as a normal,
  // cacheable 'done' result. Only a failure reaching Duffel's order-creation
  // call itself (below) is genuinely ambiguous.
  let offerRes: Response;
  try {
    offerRes = await fetch(`${BASE_URL}/air/offers/${offerId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Duffel-Version': 'v2',
      },
    });
  } catch {
    return result(502, { ok: false, reason: 'Failed to reach the provider. Try again.' });
  }

  if (!offerRes.ok) {
    const text = await offerRes.text().catch(() => '');
    return result(502, { ok: false, reason: `Failed to fetch offer: ${text.slice(0, 200)}` });
  }

  let offerJson: DuffelOfferResponse;
  try {
    offerJson = (await offerRes.json()) as DuffelOfferResponse;
  } catch {
    return result(502, { ok: false, reason: 'Provider returned an unreadable offer response. Try again.' });
  }
  const offerPassengers = offerJson.data.passengers;
  const passengerId = offerPassengers[0]?.id;
  const offerPriceCents = decimalStringToCents(offerJson.data.total_amount);

  if (!passengerId) {
    return result(502, { ok: false, reason: 'Could not extract passenger ID from offer' });
  }

  if (offerPassengers.length !== selectedFare.passengerCount) {
    return result(409, { ok: false, reason: 'Fare passenger count changed. Return to search and choose the current fare.' });
  }

  if (
    offerPriceCents === null ||
    offerPriceCents !== selectedFare.priceCents ||
    offerJson.data.total_currency !== selectedFare.currency
  ) {
    return result(409, { ok: false, reason: 'Fare price changed. Return to search and choose the current fare.' });
  }

  // Step 4: Create order. Everything above this point is safe to cache as a
  // "done" (non-ambiguous) result -- no order was ever attempted. From here
  // on, a thrown exception means we genuinely don't know Duffel's outcome;
  // the caller (POST, below) catches that case separately and marks the
  // idempotency record 'ambiguous' rather than 'done'.
  const orderRes = await fetch(`${BASE_URL}/air/orders`, {
    method: 'POST',
    headers: {
      ...duffelHeaders,
      // Best-effort defense in depth: if Duffel's API recognizes this header
      // for order creation, it gives us a second, provider-side idempotency
      // guarantee independent of our own Redis lock. If it doesn't, this is
      // simply ignored -- our Redis lock remains the primary protection.
      'Idempotency-Key': computeBookingIdempotencyKey(offerId, p),
    },
    body: JSON.stringify({
      data: {
        type: 'instant',
        selected_offers: [offerId],
        passengers: [
          {
            id: passengerId,
            given_name: p.given_name,
            family_name: p.family_name,
            born_on: p.born_on,
            email: p.email,
            phone_number: p.phone_number,
            gender: p.gender,
            title: p.title,
          },
        ],
        payments: [
          {
            type: 'balance',
            amount: offerJson.data.total_amount,
            currency: offerJson.data.total_currency,
          },
        ],
      },
    }),
  });

  const orderJson = (await orderRes.json()) as DuffelOrderResponse;

  if (!orderRes.ok) {
    const firstError = orderJson.errors?.[0];
    const errorMsg = firstError?.message ?? firstError?.title ?? 'Booking failed';
    const errorType = firstError?.type ?? '';

    // Balance / payment errors get a user-friendly message
    if (
      errorType === 'balance_error' ||
      errorMsg.toLowerCase().includes('balance') ||
      errorMsg.toLowerCase().includes('payment')
    ) {
      return result(402, { ok: false, reason: 'Payment failed — contact airline directly', bookingReference: null });
    }

    return result(502, { ok: false, reason: errorMsg });
  }

  // Success
  return result(200, {
    ok: true,
    bookingReference: orderJson.data?.booking_reference,
    orderId: orderJson.data?.id,
  });
}

export async function POST(request: Request) {
  try {
    if (!isBookingEnabled()) {
      return NextResponse.json(
        { ok: false, reason: 'In-app booking is not available yet. Please use the provider link when available.' },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { offerId?: unknown; fareContext?: unknown; passenger?: unknown };

    const { offerId, fareContext, passenger } = body;

    // Validate offerId
    if (!offerId || typeof offerId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'offerId is required' }, { status: 400 });
    }

    if (!fareContext || typeof fareContext !== 'object' || Array.isArray(fareContext)) {
      return NextResponse.json({ ok: false, reason: 'fareContext is required' }, { status: 400 });
    }

    const selectedFare = validateBookingFareContext(fareContext as Partial<Record<string, unknown>>);
    if (!selectedFare || selectedFare.offerId !== offerId || selectedFare.provider !== 'duffel') {
      return NextResponse.json({ ok: false, reason: 'valid Duffel fare context is required' }, { status: 400 });
    }

    if (selectedFare.passengerCount > BOOKING_FORM_PASSENGER_LIMIT) {
      return NextResponse.json(
        { ok: false, reason: 'Multi-passenger booking review is not supported yet because expaify collects one passenger only. Return to search and choose one passenger.' },
        { status: 400 }
      );
    }

    // Validate passenger object present
    if (!passenger || typeof passenger !== 'object' || Array.isArray(passenger)) {
      return NextResponse.json({ ok: false, reason: 'passenger data is required' }, { status: 400 });
    }

    const p = passenger as Partial<PassengerData>;
    const required = [
      'given_name',
      'family_name',
      'born_on',
      'email',
      'phone_number',
      'gender',
      'title',
    ] as const;

    for (const field of required) {
      if (!p[field]) {
        return NextResponse.json(
          { ok: false, reason: `passenger.${field} is required` },
          { status: 400 }
        );
      }
    }

    const passengerData = p as PassengerData;

    // From here, offerId + passenger identity are validated enough to derive
    // a stable idempotency key. Everything above is pure input validation --
    // no order risk, no need to gate it behind the lock.
    const idempotencyKey = computeBookingIdempotencyKey(offerId, passengerData);

    const acquired = await cache.setIfAbsent<BookingIdempotencyRecord>(
      idempotencyKey,
      { status: 'in_progress' },
      BOOKING_IDEMPOTENCY_LOCK_TTL_SECONDS
    );

    if (!acquired) {
      const existing = await cache.get<BookingIdempotencyRecord>(idempotencyKey);
      if (!existing || existing.status === 'in_progress') {
        return NextResponse.json(
          { ok: false, reason: 'A booking request for this fare is already being processed. Please wait a moment before retrying.' },
          { status: 409 }
        );
      }
      if (existing.status === 'ambiguous') {
        return NextResponse.json(AMBIGUOUS_RESULT.body, { status: AMBIGUOUS_RESULT.httpStatus });
      }
      // 'done' -- replay the exact prior outcome instead of attempting another order.
      return NextResponse.json(existing.body, { status: existing.httpStatus });
    }

    let outcome: ApiResult;
    try {
      outcome = await createDuffelOrder(offerId, selectedFare, passengerData);
    } catch {
      // Thrown from inside createDuffelOrder -- we cannot tell whether that
      // happened before or after the order-creation call reached Duffel, so
      // this must be treated as ambiguous, never as "safe to retry".
      await cache.set<BookingIdempotencyRecord>(idempotencyKey, { status: 'ambiguous' }, BOOKING_IDEMPOTENCY_RESULT_TTL_SECONDS);
      return NextResponse.json(AMBIGUOUS_RESULT.body, { status: AMBIGUOUS_RESULT.httpStatus });
    }

    await cache.set<BookingIdempotencyRecord>(
      idempotencyKey,
      { status: 'done', httpStatus: outcome.httpStatus, body: outcome.body },
      BOOKING_IDEMPOTENCY_RESULT_TTL_SECONDS
    );
    return NextResponse.json(outcome.body, { status: outcome.httpStatus });
  } catch (err) {
    // NEVER throw — always return Result shape. Reached only for failures
    // before/outside order creation (e.g. malformed request JSON), where no
    // idempotency key was ever computed and no order was ever attempted.
    return NextResponse.json(
      { ok: false, reason: 'Booking unavailable. Please try again later.' },
      { status: 500 }
    );
  }
}
