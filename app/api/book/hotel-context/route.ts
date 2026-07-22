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
      href: `/book?kind=hotel&hotelContextRef=${encodeURIComponent(result.data.reference)}`,
    },
  });
}
