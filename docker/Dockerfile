# PromiseTracker v3: one image for the web app and the job worker.
#   docker build -f docker/Dockerfile -t codeforafrica/promisetracker-v3 .
#   docker run codeforafrica/promisetracker-v3          # web (default)
#   docker run codeforafrica/promisetracker-v3 worker   # background jobs

FROM node:24.22.3-alpine AS base
# Corepack installs the pnpm version named in package.json's packageManager.
RUN apk add --no-cache libc6-compat && corepack enable
ENV NEXT_TELEMETRY_DISABLED=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/site/package.json apps/site/
COPY apps/cms/package.json apps/cms/
COPY packages/kernel/package.json packages/kernel/
COPY packages/contract/package.json packages/contract/
COPY packages/sdk/package.json packages/sdk/
COPY packages/ui/package.json packages/ui/
COPY plugins/core/package.json plugins/core/
COPY plugins/site/package.json plugins/site/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @promisetracker/site build

FROM node:24.22.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/site/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/site/public ./apps/site/public
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/promisetracker
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health/ready" >/dev/null || exit 1
ENTRYPOINT ["promisetracker"]
CMD ["web"]
