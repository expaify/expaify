import { Suspense } from 'react';
import {
  isBookingEnabled,
  isDuffelSandboxMode,
  parseBookingFareContext,
  parseBookingHotelContext,
  validateInternalReturnPath,
} from '@/lib/booking/config';
import { resolveBookingHotelContext } from '@/lib/booking/hotelContextStore';
import BookingFlow from './BookingFlow';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Booking review — expaify',
  robots: { index: false, follow: false },
};

type BookPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const params = await searchParams;
  const fareContext = parseBookingFareContext(params);
  const hotelContextRef = Array.isArray(params.hotelContextRef)
    ? params.hotelContextRef[0]
    : params.hotelContextRef;
  const referencedHotelContext = hotelContextRef
    ? await resolveBookingHotelContext(hotelContextRef)
    : null;
  const hotelContext = referencedHotelContext?.ok
    ? referencedHotelContext.data
    : parseBookingHotelContext(params);
  const requestedHotelReview = params.kind === 'hotel' || (Array.isArray(params.kind) && params.kind[0] === 'hotel');
  // Raw pass-through only — this server component never reads localStorage,
  // so it cannot resolve a stay stub itself. BookingFlow resolves it
  // client-side when the hotel-context reference above has expired. See
  // docs/pipeline/hotel-booking-confirmation/03-design.md section 5.6.
  const recoveryOfferId = Array.isArray(params.offerId) ? params.offerId[0] : params.offerId;
  // Independent of `fareContext`: a malformed or expired fare should not
  // also cost the traveler their "Back to search" link. `parseBookingFareContext`
  // already validates `returnTo` the same way when the rest of the fare
  // context is valid; this covers the states where it isn't (see
  // `audits/AUDIT-BOOKING-REVIEW-BROWSER-NAVIGATION-RECOVERY-01.md`, P1
  // "Visible return links discard result context").
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = validateInternalReturnPath(rawReturnTo);

  return (
    <div className="min-h-screen bg-[color:var(--bg-base)]">
      <Suspense fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="w-full max-w-lg rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-5 shadow-[var(--shadow-card)] sm:p-6"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">Checkout review</p>
            <h1 className="mt-2 text-2xl font-medium leading-tight text-[color:var(--text-1)]">Loading booking review</h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">Preparing the selected fare and recovery options.</p>
            <div className="mt-6 space-y-3" aria-hidden="true">
              <div className="h-3 w-2/3 rounded-full bg-[color:var(--bg-muted)]" />
              <div className="h-3 w-full rounded-full bg-[color:var(--bg-muted)]" />
              <div className="h-3 w-5/6 rounded-full bg-[color:var(--bg-muted)]" />
            </div>
          </div>
        </main>
      }>
        <BookingFlow
          bookingEnabled={isBookingEnabled()}
          duffelSandbox={isDuffelSandboxMode()}
          fareContext={fareContext}
          hotelContext={hotelContext}
          hotelSmokingPolicy={hotelContext?.smokingPolicy}
          invalidHotelSelection={requestedHotelReview && !hotelContext}
          recoveryOfferId={recoveryOfferId}
          returnTo={returnTo}
        />
      </Suspense>
    </div>
  );
}

