import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Keep async CMS metadata in the initial head for every share client.
  // Next.js otherwise streams it into the body for unrecognized user agents.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
