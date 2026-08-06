ARG BUN_STABLE_IMAGE=oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
# Bun 1.3.14 can crash after a Next.js 16.3 build when next-swc workers exit.
# The fix is only in canary until the next stable release (oven-sh/bun#36866).
ARG BUN_BUILD_IMAGE=oven/bun:canary@sha256:dd2479e914bd3ec71f26e6498d84efabd2d13581387c47d76a39814d89f03eb1

# ── Stage 1: Dependencies ──
FROM ${BUN_STABLE_IMAGE} AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build ──
FROM ${BUN_BUILD_IMAGE} AS build-runtime

FROM ${BUN_STABLE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Keep dependency resolution on stable Bun so the frozen 1.3 lockfile remains
# unchanged; use the fixed runtime only while Next.js executes its build.
COPY --from=build-runtime /usr/local/bin/bun /usr/local/bin/bun

# Build-time placeholders only for libs that read env at module-init (next-auth).
# Real secrets (WORKER_TOKEN, GOOGLE_*, ALLOWED_EMAILS, real AUTH_SECRET/NEXTAUTH_URL)
# are injected at runtime via the container's env — never baked into the image.
ENV AUTH_SECRET=build-placeholder
ENV NEXTAUTH_URL=http://localhost:7004

RUN bun run build

# ── Stage 3: Runner ──
FROM ${BUN_STABLE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7004
ENV HOSTNAME=0.0.0.0

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 7004

CMD ["bun", "server.js"]
