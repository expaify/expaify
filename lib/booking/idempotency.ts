import { createHash } from 'crypto'

/**
 * Deterministic idempotency key for a booking submission -- NOT a client-
 * generated attempt id, and nothing new for the client to persist across a
 * refresh. Derived entirely from data already sent on every submit: the
 * offer plus the passenger identity fields the reservation is actually
 * made under. Identical inputs (a genuine double-click, a network retry, or
 * a refreshed resubmit of the same review) always produce the same key, so
 * the server can recognize "this exact attempt" regardless of which client
 * request happens to arrive. See AUDIT-BOOKING-ACTION-IDEMPOTENCY-01 /
 * REPAIR-BOOKING-SUBMIT-IDEMPOTENCY-01.
 */
export function computeBookingIdempotencyKey(
  offerId: string,
  passenger: { email: string; born_on: string; given_name: string; family_name: string }
): string {
  const fingerprint = [
    offerId,
    passenger.email.trim().toLowerCase(),
    passenger.born_on.trim(),
    passenger.given_name.trim().toLowerCase(),
    passenger.family_name.trim().toLowerCase(),
  ].join('|')
  const hash = createHash('sha256').update(fingerprint).digest('hex')
  return `booking:idempotency:${hash}`
}

export type BookingIdempotencyRecord =
  | { status: 'in_progress' }
  // A definitive outcome -- no order was created (validation/offer-fetch
  // failure) or one clearly was/wasn't (a clean Duffel response, success or
  // error). Safe to replay verbatim; never re-attempts the order call.
  | { status: 'done'; httpStatus: number; body: Record<string, unknown> }
  // The Duffel order call was made but its outcome could not be confirmed
  // (network error, timeout, malformed response). We do NOT know whether an
  // order was created, so this must never be treated as "safe to retry" --
  // seeing this status is itself the correct, honest answer.
  | { status: 'ambiguous' }

export const BOOKING_IDEMPOTENCY_LOCK_TTL_SECONDS = 120
export const BOOKING_IDEMPOTENCY_RESULT_TTL_SECONDS = 24 * 60 * 60
