import type { Metadata } from 'next'
import { LandingNav } from '@/app/components/LandingNav'

export const metadata: Metadata = {
  title: 'Terms of Service — expaify',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <LandingNav />
      <main className="mx-auto max-w-[760px] px-5 py-12">
        <h1 className="font-display text-[36px] font-bold text-[color:var(--ink)]">Terms of Service</h1>
        <p className="mt-1 mb-10 text-[13px] text-[color:var(--ink-faint)]">Last updated July 2, 2026</p>

        <Section title="What expaify is">
          <p>We track hotel prices across 20 destinations and alert members when a price drops significantly below its historical average. expaify is a deal discovery service. We do not sell hotel rooms, process bookings, or hold any payment for travel. All bookings happen directly on third-party provider sites.</p>
        </Section>

        <Section title="Your subscription">
          <p>Premium membership is billed monthly ($12/mo) or annually ($96/yr, equivalent to $8/mo). A 7-day free trial applies to new subscribers — your card is not charged during the trial. Cancel before day 7 and you owe nothing.</p>
          <p className="mt-3">After the trial, your subscription renews automatically until canceled. You may cancel at any time from your <a href="/account" className="text-[color:var(--primary)] underline">account page</a>. No refunds are issued for partial billing periods.</p>
        </Section>

        <Section title="Prices and availability">
          <p>Prices shown on expaify are detected from third-party data sources and reflect prices observed at the time of detection. Prices change frequently. expaify makes no guarantee that a price shown will be available when you visit the booking site. <strong>Always confirm price and availability at checkout on the provider site.</strong></p>
        </Section>

        <Section title="Affiliate relationships">
          <p>expaify earns a commission when you click through to partner booking sites (Expedia, Booking.com, Kiwi, Trip.com). This does not affect the price you pay. We only surface deals we believe are genuine based on historical price data.</p>
        </Section>

        <Section title="Acceptable use">
          <p>You may not scrape, resell, or reproduce expaify deal data. One account per person. We may suspend accounts that abuse the service, attempt to circumvent the paywall, or violate these terms.</p>
        </Section>

        <Section title="Termination">
          <p>We may terminate your account for violations of these terms. You may cancel at any time. Upon termination, your data is retained for 30 days then permanently deleted.</p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>expaify is provided as-is. We make no warranty of uninterrupted service, price accuracy, deal availability, or fitness for a particular purpose. Your use of the service is at your own risk.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about these terms? Email us at <a href="mailto:questions@expaify.com" className="text-[color:var(--primary)] underline">questions@expaify.com</a>.</p>
        </Section>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-[20px] font-bold text-[color:var(--ink)]">{title}</h2>
      <div className="text-[15px] leading-relaxed text-[color:var(--ink-soft)]">{children}</div>
    </section>
  )
}
