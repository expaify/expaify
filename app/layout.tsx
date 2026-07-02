import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Space_Grotesk } from "next/font/google";
import { Providers } from "./Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "700"],
});

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
    title: "expaify Deal Desk",
    description:
      "Search live flight and hotel pricing, compare each option to recent route baselines, and review deal confidence before booking.",
    url: "https://expaify.com",
    siteName: "expaify",
    type: "website",
    locale: "en_US",
    images: [{ url: "https://expaify.com/og.svg", width: 1200, height: 630, alt: "expaify" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "expaify Deal Desk",
    description:
      "Search live flight and hotel pricing, compare each option to recent route baselines, and review deal confidence before booking.",
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
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[color:var(--bg)] text-[color:var(--ink)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
