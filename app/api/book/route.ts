import { type NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await request.json()) as { offerId?: unknown; passenger?: unknown };

    const { offerId, passenger } = body;

    // Validate offerId
    if (!offerId || typeof offerId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'offerId is required' }, { status: 400 });
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
    const passengerId = offerJson.data.passengers[0]?.id;

    if (!passengerId) {
      return NextResponse.json(
        { ok: false, reason: 'Could not extract passenger ID from offer' },
        { status: 502 }
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
      { ok: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
