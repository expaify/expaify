import type { Metadata } from 'next'
import { AppShell } from '@/app/components/AppShell'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'
import { TRACKED_MARKETS } from '@/lib/trackedMarkets'

export const metadata: Metadata = {
  title: 'Hotel deal destinations | expaify',
  description: `Explore all ${TRACKED_MARKETS.length} destinations expaify tracks for hotel price drops.`,
}

export default function DestinationsPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1200px] px-5 py-16 min-[1024px]:py-24">
        <p className="text-small font-semibold uppercase tracking-[0.08em] text-[color:var(--primary)]">Daily price tracking</p>
        <h1 className="text-display mt-3 text-[color:var(--ink)]">All {TRACKED_MARKETS.length} destinations</h1>
        <p className="text-body mt-5 max-w-[640px] text-[color:var(--ink-soft)]">Explore every city we scan for verified hotel price drops.</p>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {TRACKED_MARKETS.map(market => (
            <a key={market.city} href={`/destinations/${CITY_DISPLAY_TO_SLUG[market.city]}`} className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--primary)] shadow-[var(--shadow-card-rest)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
              <img src={market.photoUrl} alt={market.photoAlt} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" aria-hidden />
              <span className="absolute inset-x-0 bottom-0 p-4 font-display text-body font-bold text-white">{market.city}</span>
            </a>
          ))}
        </div>
      </main>
    </AppShell>
  )
}
