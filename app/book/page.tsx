import { Suspense } from 'react';
import { isBookingEnabled, isDuffelSandboxMode, parseBookingFareContext, parseBookingHotelContext } from '@/lib/booking/config';
import BookingFlow from './BookingFlow';

export const metadata = { title: 'Booking review — expaify' };

type BookPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const params = await searchParams;
  const fareContext = parseBookingFareContext(params);
  const hotelContext = parseBookingHotelContext(params);
  const requestedHotelReview = params.kind === 'hotel' || (Array.isArray(params.kind) && params.kind[0] === 'hotel');

  return (
    <div className="min-h-screen bg-[color:var(--bg-base)]">
      <Suspense fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="w-full max-w-lg rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-5 shadow-[var(--shadow-card)] sm:p-6"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--brand)]">Checkout review</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-[color:var(--text-1)]">Loading booking review</h1>
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
        />
      </Suspense>
    </div>
  );
}
