import { Suspense } from 'react';
import BookingFlow from './BookingFlow';

export const metadata = { title: 'Book flight — expaify' };

export default function BookPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-400 text-sm animate-pulse">Loading booking…</p>
        </div>
      }>
        <BookingFlow />
      </Suspense>
    </div>
  );
}
