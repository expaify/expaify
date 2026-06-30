import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'expaify — flight deal intelligence',
  description: 'Flight prices scored against 90 days of history. Find deals worth booking.',
  keywords: ['flights', 'flight deals', 'cheap flights', 'flight prices', 'travel deals'],
  authors: [{ name: 'expaify' }],
  metadataBase: new URL('https://expaify.com'),
  openGraph: {
    title: 'expaify — flight deal intelligence',
    description: 'Flight prices scored against 90 days of history. Find deals worth booking.',
    url: 'https://expaify.com',
    siteName: 'expaify',
    type: 'website',
    images: [
      {
        url: 'https://expaify.com/og.svg',
        width: 1200,
        height: 630,
        alt: 'expaify — flight deal intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'expaify — flight deal intelligence',
    description: 'Flight prices scored against 90 days of history. Find deals worth booking.',
    images: ['https://expaify.com/og.svg'],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  alternates: {
    canonical: 'https://expaify.com',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
