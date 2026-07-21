# Production release pipeline

PromiseTracker uses an **approval-gated, build-once/promote-by-digest** release
flow. The same immutable image that CI builds and verifies is the exact image
that runs in staging and production — nothing is rebuilt between environments.

## Pipeline shape

```
verify ──▶ build (once) ──▶ staging ──▶ production (approval)
             │                 │              │
             │                 │              ├─ migrate once
             │                 │              ├─ promote runtime digest
             │                 │              └─ readiness gate
             │                 └─ migrate once → promote digest → readiness
             └─ runtime + migrator images, pinned by digest
```

Workflows:

- [`verify.yml`](../../.github/workflows/verify.yml) — lint, type-check,
  integration + E2E tests, dependency scan. Mandatory gate.
- [`build-image.yml`](../../.github/workflows/build-image.yml) — builds the
  `runner` and `migrator` images **once** and outputs each pinned by digest
  (`image@sha256:…`).
- [`promote.yml`](../../.github/workflows/promote.yml) — reusable deploy: run
  migrations once, promote the runtime digest, verify readiness. Bound to a
  GitHub environment.
- [`release.yml`](../../.github/workflows/release.yml) — orchestrates
  verify → build → staging → production for `v*` tags (or manual dispatch).
- [`deploy-dev.yml`](../../.github/workflows/deploy-dev.yml) — the same pattern
  for the auto-deployed dev environment on pushes to `main`.

## Invariants

### Build does not require a database

`next build` imports `payload.config.ts` (which requires `DATABASE_URI` and
`PAYLOAD_SECRET` to be *present*) but never opens a connection. The Dockerfile
defaults both to build-time placeholders, so **producing the artifact needs no
reachable — or even real — database**. Real values are injected into the
container at deploy time, never baked into the image.

### One immutable image, promoted by digest

`build-image.yml` pushes `codeforafrica/promisetracker-v2:<sha>` and resolves
its content digest. Every downstream deploy references
`codeforafrica/promisetracker-v2@sha256:<digest>`, so staging and production
run bit-for-bit identical artifacts. Mutable tags are never deployed.

### Production requires human approval

The `production` job runs in the GitHub `production` environment. Configure
**Settings → Environments → production → Required reviewers** so the job pauses
for approval before any production change (including migrations).

### Migrations run once, before traffic switches

Migrations run as a **single one-off container** from the `migrator` image
(`pnpm migrate`), never inside every runtime replica (the entrypoint does not
run migrations). The migrate step runs *before* the promote step in the same
job; a migration failure fails the job and **traffic is never switched**.

### Bounded liveness and readiness probes

- `GET /api/health/live` — process-only liveness; no dependency calls. Wired to
  the Docker `HEALTHCHECK` and the Dokku `liveness` probe.
- `GET /api/health/ready` — checks MongoDB (mongoose ping) and Apache Tika
  (HTTP, when `TIKA_ENABLED != 0`), each time-bounded. Returns `503` until the
  instance can serve. Wired to the Dokku `readiness`/`startup` probes in
  [`app.json`](../../app.json) and used as the post-deploy gate in `promote.yml`.

## On migration failure

The promote job stops at the migrate step; the runtime image is **not**
promoted, so live traffic continues to run the previous release against the
unchanged (or partially-changed) database.

1. **Forward-fix (preferred for additive migrations):** correct the migration,
   cut a new tag, and re-run the release. Additive changes (new fields,
   backfills that are safe to re-run) should be idempotent.
2. **Rollback (for destructive/failed migrations):** restore the database from
   the pre-release backup and redeploy the previous image digest. See
   [rollback-and-restore.md](./rollback-and-restore.md).

Always take a database backup immediately before approving a production release
that includes migrations (the rollback runbook shows the command).

## Required repository configuration

Secrets: `DOCKER_HUB_USERNAME`, `DOCKER_HUB_ACCESS_TOKEN`, `SSH_PRIVATE_KEY`,
`DATABASE_URI`, `PAYLOAD_SECRET` (production), `STAGING_DATABASE_URI`,
`STAGING_PAYLOAD_SECRET`, and the `SENTRY_*` set. Environments: `development`,
`staging`, `production` (with required reviewers on `production`).

> Note: the migrate step and readiness gate assume the GitHub runner can reach
> the target database and app URL. If the environments are network-isolated,
> run the migrator image via `dokku run` on the host instead — see the runbook.
