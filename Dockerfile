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

# Build-time env vars (placeholders for standalone build)
ENV AUTH_SECRET=build-placeholder
ENV NEXTAUTH_URL=http://localhost:8080
ENV WORKER_URL=http://placeholder
ENV WORKER_TOKEN=placeholder

RUN bun run build

# ── Stage 3: Runner ──
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080

CMD ["bun", "server.js"]
