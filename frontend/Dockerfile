# syntax=docker/dockerfile:1

# Build context is the REPO ROOT, not frontend/ — npm workspaces keeps the only
# lockfile there, and `npm ci` refuses to run without it.
#   docker build -f frontend/Dockerfile -t renki-web .

# ---------- Stage 1: install and build ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Manifests first, source later: this layer is cached and only reinstalls when a
# dependency actually changes, not on every edit to app/.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci

COPY frontend ./frontend

# NEXT_PUBLIC_* values are INLINED INTO THE BROWSER BUNDLE AT BUILD TIME. They
# are not read at runtime, so setting them in `environment:` on the running
# container does nothing at all — a mistake that produces a working container
# serving a client that cannot reach the API. They must arrive as build args.
#
# Neither is a secret: a Google client ID is public by design, and anything
# prefixed NEXT_PUBLIC_ is readable by anyone who opens devtools. Never put a
# real secret here.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Skips the anonymous build-time ping to Vercel. Offline builders would
# otherwise wait on a network call that can never succeed.
ENV NEXT_TELEMETRY_DISABLED=1

# Activates `output: 'standalone'` in next.config.ts (which is gated behind
# this variable so that Vercel builds — which don't set it — are unaffected).
ENV BUILD_TARGET=docker

RUN npm run build -w @renki/frontend

# ---------- Stage 2: the image that actually ships ----------
# No source, no dev dependencies, no full node_modules — `output: standalone`
# traced exactly the files the server reaches and nothing else.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Three copies, and all three are required:
#   standalone/         the traced server and its node_modules
#   static/             JS/CSS chunks, which tracing does NOT include
#   public/             images and fonts, likewise not traced
# Omitting either of the last two yields a server that boots cleanly and then
# serves a page with no styles and no assets.
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public

# The node image ships a non-root `node` user; use it.
USER node

EXPOSE 3000

# Workspace builds nest the server one level down, under the workspace name.
CMD ["node", "frontend/server.js"]
