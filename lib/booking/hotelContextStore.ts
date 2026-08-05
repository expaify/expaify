import { randomBytes } from 'node:crypto';
import { cache } from '../cache/redis';
import type { Result } from '../types';
import {
  type BookingHotelContext,
  validateStructuredBookingHotelContext,
} from './config';

const HOTEL_CONTEXT_TTL_SECONDS = 30 * 60;
const HOTEL_CONTEXT_KEY_PREFIX = 'booking:hotel-context:';
const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{24}$/;

function cacheKey(reference: string): string {
  return `${HOTEL_CONTEXT_KEY_PREFIX}${reference}`;
}

export async function persistBookingHotelContext(
  input: unknown,
): Promise<Result<{ reference: string; offerId: string }>> {
  const context = validateStructuredBookingHotelContext(input);
  if (!context) return { ok: false, reason: 'Invalid hotel booking context' };

  const reference = randomBytes(18).toString('base64url');
  try {
    await cache.set(cacheKey(reference), context, HOTEL_CONTEXT_TTL_SECONDS);
    return { ok: true, data: { reference, offerId: context.offerId } };
  } catch {
    return { ok: false, reason: 'Hotel booking review could not be prepared' };
  }
}

export async function resolveBookingHotelContext(
  reference: string,
): Promise<Result<BookingHotelContext>> {
  if (!REFERENCE_PATTERN.test(reference)) {
    return { ok: false, reason: 'Invalid hotel booking context reference' };
  }

  try {
    const stored = await cache.get<unknown>(cacheKey(reference));
    if (stored === null) return { ok: false, reason: 'Hotel booking context expired' };
    const context = validateStructuredBookingHotelContext(stored);
    return context
      ? { ok: true, data: context }
      : { ok: false, reason: 'Stored hotel booking context is invalid' };
  } catch {
    return { ok: false, reason: 'Hotel booking review could not be loaded' };
  }
}
