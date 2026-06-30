import { Suspense } from 'react';
import { isBookingEnabled } from '@/lib/booking/config';
import BookingFlow from './BookingFlow';

export const metadata = { title: 'Book flight — expaify' };

type BookPageProps = {
  searchParams: Promise<{ offerId?: string | string[] }>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const params = await searchParams;
  const offerId = Array.isArray(params.offerId) ? params.offerId[0] : params.offerId;

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-400 text-sm animate-pulse">Loading booking…</p>
        </div>
      }>
        <BookingFlow bookingEnabled={isBookingEnabled()} offerId={offerId ?? ''} />
      </Suspense>
    </div>
  );
}
