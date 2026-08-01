# syntax=docker/dockerfile:1

# Build context is the REPO ROOT, not backend/ — npm workspaces keeps the only
# lockfile there, and `npm ci` refuses to run without it.
#   docker build -f backend/Dockerfile -t renki-api .

# ---------- Stage 1: install every dependency and compile TypeScript ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Manifests first, source later: this layer is cached and only reinstalls when a
# dependency actually changes, not on every edit to src/.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci

COPY backend/tsconfig*.json ./backend/
COPY backend/src ./backend/src
RUN npm run build -w @renki/backend

# ---------- Stage 2: production dependencies only ----------
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev

# ---------- Stage 3: the image that actually ships ----------
# No TypeScript, no dev dependencies, no source — just Node and dist/.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Workspaces hoist dependencies to the root node_modules. Node resolves upward
# from backend/dist, so this is the only node_modules the app needs.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY package.json ./
COPY backend/package.json ./backend/

# The node image ships a non-root `node` user; use it.
USER node

EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
