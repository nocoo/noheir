# ── Stage 1: Dependencies ──
FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production=false

# ── Stage 2: Build ──
FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (placeholders for standalone build)
ENV AUTH_SECRET=build-placeholder
ENV NEXTAUTH_URL=http://localhost:7016
ENV WORKER_URL=http://placeholder
ENV WORKER_TOKEN=placeholder

RUN bun run build

# ── Stage 3: Runner ──
FROM oven/bun:1.3-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=7016

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 7016

CMD ["bun", "server.js"]
