import { NextResponse } from 'next/server';
import { validateBookingHotelContext } from '@/lib/booking/config';
import { normalizeHotelDocumentReadiness } from '@/lib/providers/hotelDocumentReadiness';
import { hotellook } from '@/lib/providers/hotellook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { hotelContext?: unknown };
    if (!body.hotelContext || typeof body.hotelContext !== 'object' || Array.isArray(body.hotelContext)) {
      return NextResponse.json({ ok: false, reason: 'hotelContext is required' }, { status: 400 });
    }

    const context = validateBookingHotelContext(body.hotelContext as Partial<Record<string, unknown>>);
    if (!context) {
      return NextResponse.json({ ok: false, reason: 'valid hotel context is required' }, { status: 400 });
    }

    if (context.provider !== 'hotellook') {
      return NextResponse.json({ ok: false, reason: 'Hotel document check is not supported for this provider' }, { status: 422 });
    }

    const result = await hotellook.checkDocumentReadiness({
      id: context.offerId,
      source: context.provider,
      deeplink: context.providerUrl,
      documentReadiness: context.documentReadiness,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      data: normalizeHotelDocumentReadiness(result.data, 'Hotellook'),
    });
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'Hotel document information could not be checked' },
      { status: 500 },
    );
  }
}
