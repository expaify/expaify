export function isBookingEnabled(): boolean {
  return process.env.BOOKING_ENABLED === 'true';
}
