# Rollback and database restore runbook

This runbook covers reverting a bad production release: rolling the running
image back to a known-good digest, and restoring the database from a backup.
Because releases promote images **by digest** (see
[release-pipeline.md](./release-pipeline.md)), rollback is deterministic — every
prior release is an immutable, addressable artifact.

## Before every release with migrations

Take a database backup so a destructive migration can be undone:

```sh
# On the database host (or any host with network access + mongo tools):
mongodump --uri="$DATABASE_URI" --archive="pt-$(date -u +%Y%m%dT%H%M%SZ).gz" --gzip
```

Keep the archive until the release has been confirmed healthy.

## Image rollback

Every deployed release is `codeforafrica/promisetracker-v2@sha256:<digest>`.
Find the previous good digest from the release run summary (or the registry /
`dokku` deploy history), then redeploy it:

```sh
# Redeploy a specific known-good digest (no rebuild required):
dokku git:from-image promisetracker-v2 \
  codeforafrica/promisetracker-v2@sha256:<previous-digest>
```

The new (bad) instance is only serving traffic if it passed the readiness gate;
rolling back re-promotes the previous digest and Dokku's zero-downtime checks
(from [`app.json`](../../app.json)) hold traffic until the rolled-back instance
is ready again.

## Database restore

If a migration corrupted or destructively changed data, restore from the
pre-release backup:

```sh
mongorestore --uri="$DATABASE_URI" --gzip --archive="pt-<timestamp>.gz" --drop
```

`--drop` replaces each collection in the archive so the restore is clean. Do the
image rollback and the database restore together when the bad release included a
schema/data migration.

## Rehearsal

These procedures were rehearsed locally on 2026-07-20 against `mongo:7` and the
Docker digest mechanism:

**Database dump → simulated loss → restore**

```
seeded: 1
dump OK
after drop: 0
restore OK
after restore: 1
{ title: 'pledge-1', v: 1 }
```

The seeded document survived a full `mongodump` → `drop` → `mongorestore --drop`
cycle — data was recovered exactly.

**Image-by-digest rollback**

```
pinned digest ref: alpine@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
ran exact image by digest: OK
```

Running a container by immutable digest reference succeeds, confirming that any
prior release digest can be re-run deterministically without a rebuild.

> The rehearsal validated the mechanics (backup/restore fidelity and digest
> pinning). A full production rehearsal should additionally exercise the Dokku
> `git:from-image` redeploy against the staging app before relying on it for a
> real incident.

## Post-rollback checklist

1. Confirm `GET /api/health/ready` returns `200` on the rolled-back instance.
2. Confirm the database document counts / spot-checks match the backup.
3. Open a follow-up to forward-fix the migration before re-attempting release.
