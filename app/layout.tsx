import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import { AttributionCapture } from "./components/AttributionCapture";
import { OpinlyIdentify } from "./components/OpinlyIdentify";
import { Providers } from "./Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "expaify — Never overpay for a hotel again",
    template: "%s | expaify",
  },
  description:
    "We track 20 destinations daily and alert you the moment a hotel drops 30%+ below its normal price.",
  applicationName: "expaify",
  keywords: ["flights", "hotels", "flight deals", "cheap flights", "hotel deals", "travel deals"],
  authors: [{ name: "expaify" }],
  creator: "expaify",
  publisher: "expaify",
  metadataBase: new URL("https://expaify.com"),
  openGraph: {
    title: "Never overpay for a hotel again | expaify",
    description:
      "We track 20 destinations daily and flag hotels 30%+ below their 60-day median. Book direct on Expedia, Booking.com, Kiwi, or Trip.com. Zero fees from us.",
    url: "https://expaify.com",
    siteName: "expaify",
    type: "website",
    locale: "en_US",
    images: [{ url: "https://expaify.com/og.svg", width: 1200, height: 630, alt: "expaify" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@Expaifycom",
    title: "Never overpay for a hotel again | expaify",
    description:
      "We track 20 destinations daily and flag hotels 30%+ below their 60-day median. Book direct on Expedia, Booking.com, Kiwi, or Trip.com. Zero fees from us.",
    images: ["https://expaify.com/og.svg"],
  },
  robots: { index: true, follow: true },
  formatDetection: { email: false, address: false, telephone: false },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  alternates: { canonical: "https://expaify.com" },
  category: "travel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  // Browser chrome cannot read CSS custom properties; must mirror --bg in app/globals.css.
  themeColor: "#FAF7F2",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "expaify",
  url: "https://expaify.com",
  logo: "https://expaify.com/favicon.svg",
  description:
    "We track 20 destinations daily and alert you the moment a hotel drops 30%+ below its normal price.",
  sameAs: [
    "https://x.com/Expaifycom",
    "https://www.tiktok.com/@expaify",
    "https://www.facebook.com/expaify",
    "https://www.instagram.com/expaify",
    "https://www.youtube.com/@expaify",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[color:var(--bg)] text-[color:var(--ink)] antialiased">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Providers>
          <AttributionCapture />
          <OpinlyIdentify />
          {children}
        </Providers>
        <Script
          id="opinly-pixel"
          src="https://static.opinly.ai/p.js"
          strategy="afterInteractive"
          data-key="pk-3EnFysSvAHFsb135saxW5BVX4DPLk9FnXnvgQXk"
        />
        <Script
          src="https://app.zipchat.ai/widget/zipchat.js?id=YsPi3MJVzlI9TOdDBU2D"
          strategy="lazyOnload"
          data-no-optimize="1"
        />
      </body>
    </html>
  );
}
