import path from 'node:path';

import type { NextConfig } from 'next';

/**
 * `output: 'standalone'` and `outputFileTracingRoot` are only needed when
 * building a self-hosted Docker image. Vercel has its own output pipeline and
 * does not need standalone mode — setting `outputFileTracingRoot` on Vercel
 * shifts where NFT writes its trace files, which causes Vercel's build to
 * crash with ENOENT on next-server.js.nft.json.
 *
 * Set BUILD_TARGET=docker in the Dockerfile (before `next build`) to opt in.
 * Vercel never sets this variable, so it gets the default output and works fine.
 */
const isDocker = process.env.BUILD_TARGET === 'docker';

const nextConfig: NextConfig = {
  ...(isDocker && {
    /**
     * Emits .next/standalone — a self-contained server plus only the
     * node_modules actually reached by the build. Without it the production
     * image has to carry the entire workspace node_modules, which is an order
     * of magnitude larger and includes every backend dependency for no reason.
     *
     * In a workspace the traced output lands at .next/standalone/frontend/,
     * and the Dockerfile copies from there.
     */
    output: 'standalone',

    /**
     * File tracing has to start at the repo root, not frontend/ — npm
     * workspaces hoists dependencies to the root node_modules, and a trace
     * rooted here would miss every one of them.
     */
    outputFileTracingRoot: path.join(__dirname, '..'),
  }),
};

export default nextConfig;
