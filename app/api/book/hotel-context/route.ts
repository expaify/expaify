import { NextResponse } from 'next/server';
import { persistBookingHotelContext } from '@/lib/booking/hotelContextStore';

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid request body' }, { status: 400 });
  }

  const result = await persistBookingHotelContext(input);
  if (!result.ok) {
    const status = result.reason === 'Invalid hotel booking context' ? 400 : 503;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({
    ok: true,
    data: {
      reference: result.data.reference,
      // The offer id is carried alongside the reference so that if this
      // reference later expires (HOTEL_CONTEXT_TTL_SECONDS), the client can
      // still look up a traveler-declared stay stub for the same offer
      // instead of hitting a dead end. See
      // docs/pipeline/hotel-booking-confirmation/03-design.md section 5.6.
      href: `/book?kind=hotel&hotelContextRef=${encodeURIComponent(result.data.reference)}&offerId=${encodeURIComponent(result.data.offerId)}`,
    },
  });
}
