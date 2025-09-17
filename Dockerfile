# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.mjs file.
# Based on https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

ARG PNPM_VERSION=10.16.1

FROM node:22.12.0-alpine AS base
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

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=http://localhost:3000

RUN --mount=type=secret,id=database_uri,env=DATABASE_URI \
    --mount=type=secret,id=payload_secret,env=PAYLOAD_SECRET \
    --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=sentry_org,env=SENTRY_ORG \
    --mount=type=secret,id=sentry_project,env=SENTRY_PROJECT \
    NODE_OPTIONS="--no-deprecation" pnpm exec next build

# Production image, copy all the files and run next
FROM base AS runner
ARG TIKA_VERSION=3.2.3
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

RUN mkdir -p /opt/tika \
  && curl -fsSL "https://archive.apache.org/dist/tika/${TIKA_VERSION}/tika-server-standard-${TIKA_VERSION}.jar" -o "${TIKA_SERVER_JAR}" \
  && chmod 644 "${TIKA_SERVER_JAR}"

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
