import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Emits .next/standalone — a self-contained server plus only the node_modules
   * actually reached by the build. Without it the production image has to carry
   * the entire workspace node_modules, which is an order of magnitude larger
   * and includes every backend dependency for no reason.
   *
   * In a workspace the traced output lands at .next/standalone/frontend/, and
   * the Dockerfile copies from there.
   */
  output: 'standalone',

  /**
   * File tracing has to start at the repo root, not frontend/ — npm workspaces
   * hoists dependencies to the root node_modules, and a trace rooted here would
   * miss every one of them.
   */
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
