import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Keep async CMS metadata in the initial head for every share client.
  // Next.js otherwise streams it into the body for unrecognized user agents.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
};

export default nextConfig;
