import Link from 'next/link'
import type { DestinationContent } from '@/lib/destinationContent'
import { TrackedLink } from '@/app/components/TrackedLink'
import { Reveal } from '@/app/components/ui/Reveal'

type RelatedDestination = [slug: string, name: string]

export function HowDealsAreScored({ city }: { city: string }) {
  const steps = [
    ['Daily snapshots', 'We check hotel prices daily across Expedia, Booking.com, Kiwi and Trip.com.'],
    ['60-day median', `Each ${city} hotel is compared with its own rolling 60-day median, not a citywide average.`],
    ['At least 8 checks', 'A price needs at least eight recorded checks and a drop of 30% or more before we call it a deal.'],
    ['Book direct', 'You finish the booking on the marketplace that posted the rate. expaify adds no booking fee.'],
  ]

  return (
    <section className="mt-12 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-6 sm:p-8" aria-labelledby="deal-scoring-heading">
      <h2 id="deal-scoring-heading" className="text-h2 text-[color:var(--text-1)]">How expaify scores a {city} deal</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, body], index) => (
          <div key={title}>
            <p className="text-sm font-bold text-[color:var(--brand)]">{index + 1}. {title}</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function DestinationSeoContent({
  city,
  content,
  relatedDestinations,
}: {
  city: string
  content: DestinationContent
  relatedDestinations: RelatedDestination[]
}) {
  return (
    <>
      <Reveal>
        <HowDealsAreScored city={city} />
      </Reveal>

      <Reveal>
        <section className="mt-12 max-w-[820px]" aria-labelledby="seasonality-heading">
          <h2 id="seasonality-heading" className="text-h2 text-[color:var(--text-1)]">When {city} rates usually move</h2>
          <p className="mt-4 text-body leading-7 text-[color:var(--text-2)]">{content.seasonality}</p>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-12 max-w-[900px]" aria-labelledby="destination-faq-heading">
          <h2 id="destination-faq-heading" className="text-h2 text-[color:var(--text-1)]">{city} hotel deal questions</h2>
          <div className="mt-6 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
            {content.faqs.map((faq) => (
              <div key={faq.question} className="py-6">
                <h3 className="text-body font-bold text-[color:var(--text-1)]">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-12 rounded-[var(--radius-card)] bg-[color:var(--ink)] px-6 py-8 text-[color:var(--text-inverse)] sm:px-8" aria-labelledby="destination-cta-heading">
          <h2 id="destination-cta-heading" className="text-h2 text-inherit">Track the next {city} price drop</h2>
          <p className="mt-2 max-w-[680px] text-sm leading-6 text-[color:var(--ink-faint-on-dark)]">Get free daily alerts for one watchlist city, or start Premium for instant alerts and a full destination watchlist.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <TrackedLink href="/login?intent=free" analyticsEvent="destination_cta_free_alerts" analyticsProps={{ city }} className="btn btn-conversion min-h-11 px-5">Get free alerts for {city}</TrackedLink>
            <TrackedLink href="/join" analyticsEvent="destination_cta_premium" analyticsProps={{ city }} className="btn btn-outline min-h-11 px-5 text-[color:var(--text-inverse)]">Start Premium trial</TrackedLink>
            <Link href="/deals" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[color:var(--text-inverse)] underline underline-offset-4">See all deals</Link>
          </div>
        </section>
      </Reveal>

      <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm" aria-label="Destination hub links">
        <Link href="/" className="font-medium text-[color:var(--brand)] hover:underline">Home</Link>
        <Link href="/deals" className="font-medium text-[color:var(--brand)] hover:underline">All deals</Link>
        {relatedDestinations.map(([slug, name]) => (
          <Link key={slug} href={`/destinations/${slug}`} className="font-medium text-[color:var(--brand)] hover:underline">{name}</Link>
        ))}
      </nav>
    </>
  )
}
