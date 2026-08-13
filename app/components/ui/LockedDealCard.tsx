import { PropertyPhoto } from './PropertyPhoto'
import { Icon } from './icons/Icon'

type LockedDealCardProps = {
  placeholderName: string
  placeholderCity: string
  stars: number
  photoUrl?: string
  joinHref?: string
}

function starChars(stars: number): string {
  const n = Math.max(0, Math.min(5, Math.round(stars)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

export function LockedDealCard({
  placeholderName,
  placeholderCity,
  stars,
  photoUrl,
  joinHref = '/join',
}: LockedDealCardProps) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <span className="rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-3 py-1 font-display text-body font-bold leading-none text-[color:var(--text-inverse)]">
          Members
        </span>
        <span className="rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-none text-[color:var(--text-2)]">
          Deal found today
        </span>
      </div>

      {/* Blurred, not just decorative filler: an unblurred real hotel photo
          next to an invented placeholder name/city would read as a specific
          claim about that property. Blurred, it's honestly just "there's
          more behind the paywall" texture. */}
      <div className="px-4 pt-3 blur-[5px]" aria-hidden>
        <PropertyPhoto src={photoUrl} size="card" />
      </div>

      <div className="relative space-y-3 px-4 pb-4 pt-3">
        <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
          <h3 className="text-body font-display font-bold leading-snug text-[color:var(--ink)]">{placeholderName}</h3>
          <p className="text-caption mt-0.5 leading-snug text-[color:var(--ink-faint)]">
            {starChars(stars)} · {placeholderCity}
          </p>
        </div>
        <div className="pointer-events-none select-none space-y-0.5 blur-[5px]" aria-hidden>
          <div className="flex items-baseline gap-2">
            <div className="h-7 w-16 rounded-[var(--radius-pill)] bg-[color:var(--primary)]" />
            <div className="h-4 w-10 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" />
            <div className="h-4 w-20 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" />
          </div>
        </div>
        <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
            {['Expedia', 'Booking', 'Kiwi', 'Trip.com'].map(name => (
              <div key={name} className="rounded-[var(--radius-input)] border-[0.5px] border-[color:var(--line-white)] py-2 text-center text-caption font-medium text-[color:var(--ink)]">
                {name}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 rounded-[var(--radius-input)] bg-[color:var(--bg-overlay)] px-4 py-4 text-center shadow-[var(--shadow-card-hover)] backdrop-blur-[2px]">
          <Icon name="premium_unlocked" size={24} className="text-[color:var(--gold-deep)]" />
          <p className="text-caption font-medium text-[color:var(--ink-soft)]">Members-only deal</p>
          <a href={joinHref} className="btn btn-conversion btn-sm">Unlock with Premium</a>
        </div>
      </div>
    </article>
  )
}
