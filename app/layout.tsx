import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "expaify — flight + hotel deal intelligence",
  description: "Flight + hotel prices ranked against 90 days of history.",
  keywords: ["flights", "hotels", "flight deals", "cheap flights", "hotel deals", "travel deals"],
  authors: [{ name: "expaify" }],
  metadataBase: new URL("https://expaify.com"),
  openGraph: {
    title: "expaify — flight + hotel deal intelligence",
    description: "Flight + hotel prices ranked against 90 days of history.",
    url: "https://expaify.com",
    siteName: "expaify",
    type: "website",
    images: [{ url: "https://expaify.com/og.svg", width: 1200, height: 630, alt: "expaify" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "expaify — flight + hotel deal intelligence",
    description: "Flight + hotel prices ranked against 90 days of history.",
    images: ["https://expaify.com/og.svg"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  alternates: { canonical: "https://expaify.com" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
