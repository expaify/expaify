import Link from "next/link";
import { CITY_SLUGS } from "@/lib/cities";

const productLinks = [
  { href: "/", label: "Home" },
  { href: "/deals", label: "All deals" },
  { href: "/login?intent=free", label: "Get free alerts" },
  { href: "/join", label: "Premium" },
];

const companyLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

const socialLinks = [
  { href: "https://x.com/Expaifycom", label: "X / Twitter" },
  { href: "https://www.tiktok.com/@expaify", label: "TikTok" },
  { href: "https://www.facebook.com/expaify", label: "Facebook" },
  { href: "https://www.instagram.com/expaify", label: "Instagram" },
  { href: "https://www.youtube.com/@expaify", label: "YouTube" },
];

const linkClassName =
  "text-small text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[color:var(--border)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-1">
            <div>
              <Link href="/" className="font-display text-h3 font-bold text-[color:var(--ink)] no-underline">
                expaify
              </Link>
              <p className="mt-2 text-small text-[color:var(--ink-soft)]">
                Never overpay for a hotel again.
              </p>
            </div>

            <div>
              <h2 className="text-caption font-semibold uppercase tracking-wider text-[color:var(--ink)]">
                Product
              </h2>
              <ul className="mt-3 space-y-1">
                {productLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className={linkClassName}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-caption font-semibold uppercase tracking-wider text-[color:var(--ink)]">
              Destinations
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(CITY_SLUGS).map(([slug, name]) => (
                <li key={slug}>
                  <Link href={`/destinations/${slug}`} className={linkClassName}>
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-[color:var(--border)] pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Company and legal">
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {companyLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className={linkClassName}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Social media">
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {socialLinks.map(({ href, label }) => (
                  <li key={href}>
                    <a href={href} className={linkClassName} rel="me">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <p className="mt-4 text-caption text-[color:var(--ink-soft)]">
            © {currentYear} expaify. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
