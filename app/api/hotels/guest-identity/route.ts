import { NextResponse } from 'next/server';
import { validateBookingHotelContext } from '@/lib/booking/config';
import {
  HOTEL_GUEST_IDENTITY_UNSUPPORTED,
  normalizeHotelGuestIdentity,
} from '@/lib/providers/hotelGuestIdentity';
import { hotellook } from '@/lib/providers/hotellook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { hotelContext?: unknown; locale?: unknown };
    if (!body.hotelContext || typeof body.hotelContext !== 'object' || Array.isArray(body.hotelContext)) {
      return NextResponse.json({ ok: false, reason: 'hotelContext is required' }, { status: 400 });
    }
    const context = validateBookingHotelContext(body.hotelContext as Partial<Record<string, unknown>>);
    if (!context) return NextResponse.json({ ok: false, reason: 'valid hotel context is required' }, { status: 400 });
    if (body.locale !== undefined && body.locale !== 'en-US') {
      return NextResponse.json({ ok: false, reason: 'supported locale is required' }, { status: 400 });
    }
    if (context.provider !== 'hotellook') {
      return NextResponse.json({ ok: false, reason: 'Hotel guest identity check is not supported for this provider' }, { status: 422 });
    }

    const result = await hotellook.checkGuestIdentityRequirements({
      id: context.offerId,
      source: context.provider,
      guestIdentity: context.guestIdentity,
      guestIdentityCapability: context.guestIdentityCapability,
    }, 'en-US');
    if (!result.ok) return NextResponse.json(result, { status: 502 });

    return NextResponse.json({
      ok: true,
      data: normalizeHotelGuestIdentity(
        result.data,
        // Capability is an adapter-owned contract, never client-carried evidence.
        // Hotellook has no structured guest-identity capability in production.
        HOTEL_GUEST_IDENTITY_UNSUPPORTED,
        { propertyId: context.offerId, offerId: context.offerId, supplier: context.provider, locale: 'en-US' },
      ),
    });
  } catch {
    return NextResponse.json({ ok: false, reason: 'Hotel guest identity requirements could not be checked' }, { status: 500 });
  }
}
