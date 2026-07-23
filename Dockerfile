# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.mjs file.
# Based on https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

ARG PNPM_VERSION=10.33.0

FROM node:24.18.0-alpine AS base
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# The build imports payload.config (which requires DATABASE_URI/PAYLOAD_SECRET
# to be present) but never opens a database connection. Both default to
# build-time placeholders, so producing the production artifact does NOT
# require a reachable — or even real — application database. Real runtime
# values are supplied to the container at deploy time, not baked into the image.
RUN --mount=type=secret,id=database_uri,env=DATABASE_URI \
    --mount=type=secret,id=payload_secret,env=PAYLOAD_SECRET \
    --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=sentry_org,env=SENTRY_ORG \
    --mount=type=secret,id=sentry_project,env=SENTRY_PROJECT \
    : "${DATABASE_URI:=mongodb://build-placeholder:27017/build}"; \
    : "${PAYLOAD_SECRET:=build-time-placeholder-secret}"; \
    export DATABASE_URI PAYLOAD_SECRET; \
    NODE_OPTIONS="--no-deprecation" pnpm exec next build

# Migrator image: the same source and dependencies as the build, but retaining
# the Payload CLI and migrations/ directory (which the slim standalone runner
# prunes). Run as a single one-off container during the release to execute
# `payload migrate` exactly once before traffic switches — never in every
# runtime replica.
FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TIKA_ENABLED=0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "migrate"]

# Production image, copy all the files and run next
FROM base AS runner
ARG TIKA_VERSION=3.2.3
# SHA-256 of tika-server-standard-${TIKA_VERSION}.jar. MUST be updated together
# with TIKA_VERSION. To get it for a new version:
#   curl -sSL https://repo1.maven.org/maven2/org/apache/tika/tika-server-standard/<v>/tika-server-standard-<v>.jar | sha256sum
ARG TIKA_SHA256=c00898065af088925ba4b65856db66e6140e4c750d28219b61b96885885e7593
WORKDIR /app

ENV NODE_ENV=production \
    TIKA_VERSION=${TIKA_VERSION} \
    TIKA_PORT=9998 \
    TIKA_HOST=0.0.0.0 \
    TIKA_SERVER_JAR=/opt/tika/tika-server.jar \
    TIKA_ENABLED=1 \
    AX_APACHE_TIKA_URL=http://127.0.0.1:9998/ \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN apk add --no-cache openjdk17-jre-headless curl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Pull the Tika server jar from Maven Central rather than archive.apache.org:
# the archive host is throttled to ~200KB/s and this 66MB download took ~8.5min
# on cold-cache builds; Maven Central is a fast CDN (~20s) and keeps every
# version permanently. The checksum is verified so a corrupt/tampered download
# fails the build.
RUN mkdir -p /opt/tika \
  && curl -fsSL "https://repo1.maven.org/maven2/org/apache/tika/tika-server-standard/${TIKA_VERSION}/tika-server-standard-${TIKA_VERSION}.jar" -o "${TIKA_SERVER_JAR}" \
  && echo "${TIKA_SHA256}  ${TIKA_SERVER_JAR}" | sha256sum -c - \
  && chmod 644 "${TIKA_SERVER_JAR}"

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /app/temp /app/media \
  && chown nextjs:nodejs /app/temp /app/media \
  && chmod 775 /app/temp /app/media

USER nextjs

EXPOSE 3000

# Liveness probe: process is up and serving. Intentionally hits the
# dependency-free /api/health/live endpoint so a Mongo/Tika outage never
# causes the container to be killed. Readiness (Mongo + Tika) is checked
# separately by the platform via /api/health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl --silent --fail --max-time 4 "http://127.0.0.1:${PORT}/api/health/live" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
