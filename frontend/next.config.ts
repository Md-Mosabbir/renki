import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No special output mode needed — Vercel handles deployment automatically.
  // NOTE: If deploying via Docker instead, restore:
  //   output: 'standalone',
  //   outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
