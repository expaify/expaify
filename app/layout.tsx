import type { Metadata, Viewport } from "next";
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

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark')document.documentElement.classList.add('light')}catch(e){document.documentElement.classList.add('light')}})()`;

export const metadata: Metadata = {
  title: {
    default: "expaify Deal Desk",
    template: "%s | expaify",
  },
  description:
    "Search live flight and hotel pricing, compare each option to recent route baselines, and review deal confidence before booking.",
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
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1311" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-[color:var(--bg-base)] text-[color:var(--text-1)] antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
