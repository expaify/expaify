import type { Metadata } from 'next'
import { LandingNav } from '@/app/components/LandingNav'

export const metadata: Metadata = {
  title: 'Privacy Policy — expaify',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <LandingNav />
      <main className="mx-auto max-w-[760px] px-5 py-12">
        <h1 className="font-display text-[36px] font-bold text-[color:var(--ink)]">Privacy Policy</h1>
        <p className="mt-1 mb-10 text-[13px] text-[color:var(--ink-faint)]">Last updated July 2, 2026</p>

        <Section title="What we collect">
          <p>When you create an account: your email address. When you subscribe: billing address and payment method (handled by Stripe — we never see raw card numbers). When you use expaify: pages visited, deals clicked, alert preferences, and city watchlist.</p>
        </Section>

        <Section title="How we use it">
          <p>We use your email to send deal alerts you opted into and service notifications (billing, account). We use usage data to improve deal detection and the product. We do not use your data for advertising, and we do not build advertising profiles.</p>
        </Section>

        <Section title="Data processors">
          <p>We share your data with the following processors to operate the service:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li><strong>Stripe</strong> — payments and billing. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[color:var(--primary)] underline">Stripe Privacy Policy</a>.</li>
            <li><strong>Resend</strong> — transactional email delivery.</li>
            <li><strong>Neon</strong> — PostgreSQL database, hosted on AWS.</li>
          </ul>
          <p className="mt-3">We do not sell your data to any third party.</p>
        </Section>

        <Section title="Cookies">
          <p>We use a single session cookie to keep you logged in. No advertising cookies. No third-party trackers. If you block cookies, you will not be able to stay signed in.</p>
        </Section>

        <Section title="Your rights">
          <p>You may request a copy of the data we hold about you, or ask for your account to be deleted, by emailing <a href="mailto:questions@expaify.com" className="text-[color:var(--primary)] underline">questions@expaify.com</a>. We will respond within 30 days. EU and California residents have additional rights under GDPR and CCPA respectively — email us to exercise them.</p>
        </Section>

        <Section title="Retention">
          <p>We retain your data while your account is active. When you delete your account, we permanently delete your data within 30 days. Anonymized aggregate data (e.g., deal click counts) may be retained indefinitely.</p>
        </Section>

        <Section title="Children">
          <p>expaify is not directed at users under 16. We do not knowingly collect personal data from minors. If we learn we have done so, we will delete it promptly.</p>
        </Section>

        <Section title="Changes">
          <p>We will notify you of material changes to this policy via email before they take effect. Continued use of the service after changes take effect constitutes acceptance.</p>
        </Section>

        <Section title="Contact">
          <p>Privacy questions or requests: <a href="mailto:questions@expaify.com" className="text-[color:var(--primary)] underline">questions@expaify.com</a>.</p>
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
