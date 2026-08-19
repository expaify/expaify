import { DealCard } from './ui/DealCard'
import { LandingNav } from './LandingNav'
import { FaqAccordion } from './FaqAccordion'
import { TrackedLink } from './TrackedLink'
import { TRACKED_MARKETS } from '@/lib/trackedMarkets'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'
import { DEAL_THRESHOLD, MIN_SNAPSHOTS } from '@/lib/pipeline/dealRules'
import type { DealCardDeal } from '@/app/page'

const FREE_HERO_URL = '/login?intent=free&utm_source=homepage&utm_medium=hero&utm_campaign=free_alerts'

export function HomepageRedesign({ deals }: { deals: DealCardDeal[] }) {
  const hero = deals[0]
  const featured = TRACKED_MARKETS.slice(0, 8)
  const marketCount = TRACKED_MARKETS.length
  return (
    <>
      <LandingNav homepageRedesign />
      <main>
        <section className="relative mx-auto max-w-[1200px] px-5 py-16 min-[1024px]:py-24">
          <div className="hero-atmosphere" aria-hidden />
          <div className="relative z-[1] grid items-center gap-12 min-[1024px]:grid-cols-[0.45fr_0.55fr] min-[1024px]:gap-16">
            <div className="max-w-[520px]">
              <p className="mb-5 text-small font-semibold uppercase tracking-[0.08em] text-[color:var(--primary)]">{marketCount} cities · 60-day median · 30%+ only</p>
              <h1 className="text-display text-[color:var(--ink)] min-[640px]:text-[52px]">Never overpay for a hotel again.</h1>
              <p className="text-body mt-6 text-[color:var(--ink-soft)]">We watch hotel prices daily and flag the moment a stay drops 30%+ below normal.</p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <TrackedLink href={FREE_HERO_URL} analyticsEvent="free_alert_cta_click" analyticsProps={{ placement: 'homepage_hero' }} className="btn btn-conversion btn-lg">Get free alerts</TrackedLink>
                <a href="/deals" className="font-medium text-[color:var(--primary)] underline-offset-4 hover:underline">See live deals →</a>
              </div>
            </div>
            <div className="mx-auto w-full max-w-[460px]">
              {hero ? <DealCard deal={hero} href="/deals" photoLoading="eager" /> : (
                <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-card-hover)]">
                  <p className="text-h3 text-[color:var(--ink)]">No qualifying deal right now</p>
                  <p className="text-body mt-2 text-[color:var(--ink-soft)]">We’ll show the next verified 30%+ drop here as soon as it lands.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-y border-[color:var(--line-ivory)] bg-[color:var(--surface)] py-7">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 text-center">
            <span className="font-display text-body font-bold text-[color:var(--ink-soft)]">Booking.com</span>
            <span className="text-small text-[color:var(--ink-soft)]">Flagged only at ≥30% below 60-day median · ≥8 checks</span>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-16 min-[1024px]:py-24">
          <div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-small font-semibold uppercase tracking-[0.08em] text-[color:var(--primary)]">Verified drops</p><h2 className="text-h2 mt-2 text-[color:var(--ink)]">Live deals right now</h2></div><a href="/deals" className="text-small font-semibold text-[color:var(--primary)]">See all →</a></div>
          {deals.length ? <div className="grid gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3">{deals.slice(0, 3).map(deal => <DealCard key={deal.id} deal={deal} href="/deals" />)}</div> : <p className="text-body text-[color:var(--ink-soft)]">No verified live deals at this moment. Check back after the next price scan.</p>}
        </section>

        <section className="border-y border-[color:var(--line-ivory)] bg-[color:var(--surface)] py-16 min-[1024px]:py-24">
          <div className="mx-auto max-w-[1200px] px-5"><h2 className="text-h2 text-[color:var(--ink)]">Explore destinations</h2><p className="text-body mt-3 text-[color:var(--ink-soft)]">See the places we scan for hotel price drops every day.</p>
            <div className="-mx-5 mt-8 flex snap-x gap-4 overflow-x-auto px-5 pb-3 min-[1024px]:mx-0 min-[1024px]:grid min-[1024px]:grid-cols-8 min-[1024px]:overflow-visible min-[1024px]:px-0">
              {featured.map(market => <a key={market.city} href={`/destinations/${CITY_DISPLAY_TO_SLUG[market.city]}`} className="group relative aspect-[4/5] w-[180px] flex-none snap-start overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--primary)] shadow-[var(--shadow-card-rest)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] min-[1024px]:w-auto"><img src={market.photoUrl} alt={market.photoAlt} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none" /><span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" aria-hidden /><span className="absolute inset-x-0 bottom-0 p-4 font-display text-body font-bold text-white">{market.city}</span></a>)}
            </div>
            <a href="/destinations" className="mt-6 inline-block font-semibold text-[color:var(--primary)]">All {marketCount} destinations →</a>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-[1200px] px-5 py-16 min-[1024px]:py-24"><h2 className="text-h2 text-center text-[color:var(--ink)]">How it works</h2><div className="mt-12 grid gap-10 min-[640px]:grid-cols-3">{[
          ['01','We track prices daily',`Our pipeline snapshots hotel rates across ${marketCount} destinations every 24 hours, building a 60-day price history per property.`],
          ['02','We detect real drops',`A deal is only flagged when a price drops to ${Math.round(DEAL_THRESHOLD * 100)}% or below its rolling 60-day median — with at least ${MIN_SNAPSHOTS} price checks behind it.`],
          ['03','You book directly','We send you to Booking.com to complete the booking. You get the deal; they handle the stay.'],
        ].map(([n,title,body]) => <div key={n}><span className="text-numeral" aria-hidden>{n}</span><h3 className="text-h3 mt-5 text-[color:var(--ink)]">{title}</h3><p className="text-body mt-3 text-[color:var(--ink-soft)]">{body}</p>{n === '02' ? <div className="mt-6 w-40 space-y-2 text-caption text-[color:var(--ink-soft)]" aria-label="Example comparison: median price is higher than the current price"><div className="flex items-center gap-2"><span className="w-12">Median</span><span className="h-3 w-24 rounded-[var(--radius-pill)] bg-[color:var(--primary-soft)]" /></div><div className="flex items-center gap-2"><span className="w-12">Now</span><span className="h-3 w-14 rounded-[var(--radius-pill)] bg-[color:var(--accent)]" /></div></div> : null}</div>)}</div></section>

        <section id="pricing" className="border-y border-[color:var(--line-ivory)] bg-[color:var(--surface)] py-16 min-[1024px]:py-24"><div className="mx-auto max-w-[760px] px-5"><h2 className="text-h2 text-center text-[color:var(--ink)]">Simple pricing</h2><p className="text-body mt-3 text-center text-[color:var(--ink-soft)]">Start free. Upgrade when a deal pays for itself.</p><PricingCards /></div></section>
        <section id="faq" className="py-16 min-[1024px]:py-24"><div className="mx-auto max-w-[640px] px-5"><h2 className="text-h2 mb-10 text-center text-[color:var(--ink)]">Questions</h2><FaqAccordion /></div></section>
      </main>
    </>
  )
}

function PricingCards() {
  const plans = [{name:'Free',price:'$0',suffix:'/ month',features:['3 unlocked deals per week','Browse full feed (blurred)','Daily digest for 1 watchlist city']},{name:'Premium',price:'$8',suffix:'/ month, billed annually',features:['Unlimited unlocked deals','Instant + daily email alerts','Destination watchlist','Filter by discount, stars, price','7-day free trial']}]
  return <div className="mt-12 grid gap-6 min-[640px]:grid-cols-2">{plans.map((plan,i) => <div key={plan.name} className={`flex flex-col gap-6 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-7 ${i===0?'border-2 border-[color:var(--primary)] shadow-[var(--shadow-card-hover)]':'border border-[color:var(--line-ivory)] shadow-[var(--shadow-card-rest)]'}`}><div><p className="text-small font-semibold uppercase tracking-wider text-[color:var(--ink-faint)]">{plan.name}</p><p className="mt-2"><span className="text-stat text-tabular">{plan.price}</span> <span className="text-body text-[color:var(--ink-faint)]">{plan.suffix}</span></p></div><ul className="flex flex-col gap-3">{plan.features.map(f=><li key={f} className="text-small text-[color:var(--ink-soft)]">— {f}</li>)}</ul>{i===0?<TrackedLink href="/login?intent=free&utm_source=homepage&utm_medium=pricing_free_card&utm_campaign=free_alerts" analyticsEvent="free_alert_cta_click" analyticsProps={{placement:'homepage_pricing_free'}} className="btn btn-conversion mt-auto justify-center">Get free alerts — no card</TrackedLink>:<><a href="/join?plan=annual" className="btn btn-outline mt-auto justify-center">Start free trial</a><p className="text-caption text-center text-[color:var(--ink-faint)]">Cancel anytime before day 7 — no charge.</p></>}</div>)}</div>
}
