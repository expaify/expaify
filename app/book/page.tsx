import { Suspense } from 'react';
import { isBookingEnabled, isDuffelSandboxMode, parseBookingFareContext } from '@/lib/booking/config';
import BookingFlow from './BookingFlow';

export const metadata = { title: 'Book flight — expaify' };

type BookPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const params = await searchParams;
  const fareContext = parseBookingFareContext(params);

  return (
    <div className="min-h-screen bg-[color:var(--bg-base)]">
      <Suspense fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--brand)]">Checkout review</p>
            <p className="mt-2 text-lg font-bold text-[color:var(--text-1)]">Loading booking review</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Preparing the fare details and continuation state.</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[color:var(--bg-muted)]">
              <div className="h-full w-2/3 rounded-full bg-[color:var(--brand)] animate-pulse" />
            </div>
          </div>
        </div>
      }>
        <BookingFlow
          bookingEnabled={isBookingEnabled()}
          duffelSandbox={isDuffelSandboxMode()}
          fareContext={fareContext}
        />
      </Suspense>
    </div>
  );
}
