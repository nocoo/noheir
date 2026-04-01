# ── Stage 1: Dependencies ──
FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build ──
FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (placeholders for standalone build)
ENV AUTH_SECRET=build-placeholder
ENV NEXTAUTH_URL=http://localhost:7004
ENV WORKER_URL=http://placeholder
ENV WORKER_TOKEN=placeholder

RUN bun run build

# ── Stage 3: Runner ──
FROM oven/bun:1.3-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=7004

# Create non-root user (using base commands available in slim images)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 7004

CMD ["bun", "server.js"]
