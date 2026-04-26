# ── Stage 1: Dependencies ──
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build ──
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time placeholders only for libs that read env at module-init (next-auth).
# Real secrets (WORKER_TOKEN, GOOGLE_*, ALLOWED_EMAILS, real AUTH_SECRET/NEXTAUTH_URL)
# are injected at runtime via the container's env — never baked into the image.
ENV AUTH_SECRET=build-placeholder
ENV NEXTAUTH_URL=http://localhost:7004

RUN bun run build

# ── Stage 3: Runner ──
FROM oven/bun:1 AS runner
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
