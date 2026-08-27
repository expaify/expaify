import { TRACKED_MARKETS } from '@/lib/trackedMarkets'

export function ColdSampleFeedIntro() {
  return (
    <div className="mb-8 space-y-6">
      <section role="status" className="mx-auto max-w-[480px] pt-10 text-center">
        <h3 className="text-h3 text-[color:var(--ink)]">
          We&apos;re building your feed.
        </h3>
        <p className="mt-2 text-body leading-6 text-[color:var(--ink-soft)]">
          Our tracker sweeps hotel prices across {TRACKED_MARKETS.length} destinations once a day. Real deals appear here after the next sweep — check back soon.
        </p>
      </section>
      <div className="border-t border-[color:var(--line-ivory)] pt-6">
        <h3 className="text-h3 text-[color:var(--ink)]">Example deals</h3>
        <p className="mt-1 text-small leading-5 text-[color:var(--ink-soft)]">
          Here&apos;s what expaify surfaces once tracking completes. These use sample hotels and prices — they&apos;re not bookable.
        </p>
      </div>
    </div>
  )
}
