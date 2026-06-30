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
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm text-[color:var(--text-3)] animate-pulse">Loading booking...</p>
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
