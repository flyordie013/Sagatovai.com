# syntax=docker/dockerfile:1

# ---- deps: install with pnpm ----
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# AUTH_SECRET is required at import time by session-token.ts even during build;
# a throwaway value is fine here — the real one is injected at runtime.
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
# Public origin baked into prerendered metadata (og:url, canonical, OG image).
# Passed by docker-compose from .env; the default matches the live domain.
ARG APP_URL=https://sagatovai.com
ENV APP_URL=$APP_URL
RUN pnpm build

# ---- runtime: minimal standalone server ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Audience is in Kazakhstan (UTC+5) — keep day boundaries (streaks, admin
# dates) on local time instead of the container default UTC.
ENV TZ=Asia/Almaty
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output + static assets + public files.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations are read from disk at boot (self-migrate on hosted Postgres).
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/http-timeouts.mjs ./http-timeouts.mjs

# Uploaded videos live here on a persistent volume (see docker-compose).
RUN mkdir -p storage/videos && chown -R nextjs:nodejs storage
USER nextjs

EXPOSE 3000
# Next.js standalone binds to $HOSTNAME; Docker sets it to the container id by
# default, leaving nothing on loopback. Force all-interfaces so the healthcheck
# (and any localhost probe) can reach the server.
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "./http-timeouts.mjs", "server.js"]
