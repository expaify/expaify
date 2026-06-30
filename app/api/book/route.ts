import { NextResponse } from 'next/server';
import { BOOKING_FORM_PASSENGER_LIMIT, isBookingEnabled, validateBookingFareContext } from '@/lib/booking/config';

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

function decimalStringToCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(`${whole}${fraction.padEnd(2, '0')}`);
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

    // Read env var at call time (not module load)
    const apiKey = process.env.DUFFEL_KEY ?? '';
    if (!apiKey) {
      return NextResponse.json({ ok: false, reason: 'Duffel not configured' }, { status: 500 });
    }

    const duffelHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
    };

    // Step 2: Fetch offer details to get the passenger id
    const offerRes = await fetch(`${BASE_URL}/air/offers/${offerId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Duffel-Version': 'v2',
      },
    });

    if (!offerRes.ok) {
      const text = await offerRes.text().catch(() => '');
      return NextResponse.json(
        { ok: false, reason: `Failed to fetch offer: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const offerJson = (await offerRes.json()) as DuffelOfferResponse;
    const offerPassengers = offerJson.data.passengers;
    const passengerId = offerPassengers[0]?.id;
    const offerPriceCents = decimalStringToCents(offerJson.data.total_amount);

    if (!passengerId) {
      return NextResponse.json(
        { ok: false, reason: 'Could not extract passenger ID from offer' },
        { status: 502 }
      );
    }

    if (offerPassengers.length !== selectedFare.passengerCount) {
      return NextResponse.json(
        { ok: false, reason: 'Fare passenger count changed. Return to search and choose the current fare.' },
        { status: 409 }
      );
    }

    if (
      offerPriceCents === null ||
      offerPriceCents !== selectedFare.priceCents ||
      offerJson.data.total_currency !== selectedFare.currency
    ) {
      return NextResponse.json(
        { ok: false, reason: 'Fare price changed. Return to search and choose the current fare.' },
        { status: 409 }
      );
    }

    // Step 4: Create order
    const orderRes = await fetch(`${BASE_URL}/air/orders`, {
      method: 'POST',
      headers: duffelHeaders,
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
        return NextResponse.json(
          { ok: false, reason: 'Payment failed — contact airline directly', bookingReference: null },
          { status: 402 }
        );
      }

      return NextResponse.json({ ok: false, reason: errorMsg }, { status: 502 });
    }

    // Success
    return NextResponse.json({
      ok: true,
      bookingReference: orderJson.data?.booking_reference,
      orderId: orderJson.data?.id,
    });
  } catch (err) {
    // NEVER throw — always return Result shape
    return NextResponse.json(
      { ok: false, reason: 'Booking unavailable. Please try again later.' },
      { status: 500 }
    );
  }
}
