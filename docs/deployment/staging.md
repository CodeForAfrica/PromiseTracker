# Staging

Staging runs the image built from `main` at https://promisetracker-v3.dev.codeforafrica.org, so
editors can review each piece as it lands (section 16.1 of the specification). It runs on Dokku on
Code for Africa's development server, `ui-1.dev.codeforafrica.org`, beside v2's development site.

## How a change reaches staging

1. A pull request merges into `main`.
2. CI runs the checks, builds the image, runs the browser tests against it and publishes it to
   Docker Hub as `codeforafrica/promisetracker-v3`.
3. The `staging` job in `.github/workflows/ci.yml` tells Dokku to run that image, by digest.
4. Dokku starts a new web process and a new worker beside the old ones. Each applies pending
   migrations as it starts, one at a time, under a lock. The new web process takes traffic only
   once `/api/health/ready` passes (`docker/app.json`). If it never does, the old version keeps
   serving and the job fails.
5. The job checks `/api/health/ready` on the public address.

The job runs only once the repository variable `STAGING_URL` is set, so `main` stays green until
the server is ready. A deploy is never cut off by the next push: the next one waits.

## What runs

Each is a Dokku app on one Docker network, `promisetracker-v3`. Only the first has a public
address.

| Dokku app                            | Image                             | Reached at, inside the network              |
| ------------------------------------ | --------------------------------- | ------------------------------------------- |
| `promisetracker-v3`                  | `codeforafrica/promisetracker-v3` | Public, through Dokku's proxy               |
| Postgres service `promisetracker-v3` | `postgres:18.7-alpine`            | `DATABASE_URL`, set by `postgres:link`      |
| `promisetracker-v3-storage`          | `rustfs/rustfs:1.0.5`             | `http://promisetracker-v3-storage.web:9000` |
| `promisetracker-v3-tika`             | `apache/tika:3.2.3.0-full`        | `http://promisetracker-v3-tika.web:9998`    |
| `promisetracker-v3-mail`             | `axllent/mailpit:v1.33.0`         | `promisetracker-v3-mail.web`, port 1025     |

The app runs two processes from the `Procfile` in the image: `web` and `worker`. Version 1 runs
one web process (section 17), so keep `web=1`.

No email provider is chosen yet (D40), so staging sends to Mailpit, which keeps every message and
delivers none. The versions match `docker/compose.yaml`; keep them in step.

## Setting up the server, once

Run these on the server as a user who can run `dokku`. Replace each `…` with a value from a
password manager, never one written here.

### The network and the app

```bash
dokku network:create promisetracker-v3

dokku apps:create promisetracker-v3
dokku network:set promisetracker-v3 attach-post-create promisetracker-v3
dokku domains:set promisetracker-v3 promisetracker-v3.dev.codeforafrica.org
```

### Postgres

The official image includes `unaccent` and `pg_trgm` (section 16.2).

```bash
dokku postgres:create promisetracker-v3 --image postgres --image-version 18.7-alpine
dokku postgres:link promisetracker-v3 promisetracker-v3
```

`postgres:link` sets `DATABASE_URL` on the app.

### File storage

```bash
dokku apps:create promisetracker-v3-storage
dokku network:set promisetracker-v3-storage attach-post-create promisetracker-v3
dokku proxy:disable promisetracker-v3-storage
dokku storage:ensure-directory promisetracker-v3-storage
dokku storage:mount promisetracker-v3-storage /var/lib/dokku/data/storage/promisetracker-v3-storage:/data
dokku config:set --no-restart promisetracker-v3-storage RUSTFS_ACCESS_KEY=… RUSTFS_SECRET_KEY=…
dokku git:from-image promisetracker-v3-storage rustfs/rustfs:1.0.5
```

Then create the bucket, as `storage-init` does in Compose:

```bash
docker run --rm --network promisetracker-v3 \
  -e AWS_ACCESS_KEY_ID=… -e AWS_SECRET_ACCESS_KEY=… -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli:2.40.3 --endpoint-url http://promisetracker-v3-storage.web:9000 \
  s3 mb s3://promisetracker
```

### Tika and Mailpit

Tika is not used until plugin-tika (#653), but runs from the start, as section 16.1 lists it.

```bash
for app in promisetracker-v3-tika promisetracker-v3-mail; do
  dokku apps:create "$app"
  dokku network:set "$app" attach-post-create promisetracker-v3
  dokku proxy:disable "$app"
done
dokku git:from-image promisetracker-v3-tika apache/tika:3.2.3.0-full
dokku git:from-image promisetracker-v3-mail axllent/mailpit:v1.33.0
```

### The app's settings

`.env.example` explains each one.

```bash
dokku config:set --no-restart promisetracker-v3 \
  PAYLOAD_SECRET="$(openssl rand -hex 32)" \
  PT_NOINDEX=true \
  PT_LOCALES=en,fr \
  PT_WEB_URL=https://promisetracker-v3.dev.codeforafrica.org \
  S3_BUCKET=promisetracker \
  S3_REGION=us-east-1 \
  S3_ENDPOINT=http://promisetracker-v3-storage.web:9000 \
  S3_ACCESS_KEY_ID=… \
  S3_SECRET_ACCESS_KEY=… \
  SMTP_HOST=promisetracker-v3-mail.web \
  SMTP_PORT=1025 \
  PT_EMAIL_FROM=noreply@promisetracker-v3.dev.codeforafrica.org \
  SENTRY_ENVIRONMENT=staging \
  PT_ADMIN_EMAIL=… \
  PT_ADMIN_PASSWORD=…
```

- `PT_NOINDEX=true` keeps staging out of search engines.
- `PT_WEB_URL` is where the worker asks the web process to refresh cached pages. The request is
  signed with `PAYLOAD_SECRET`, so the public address is safe to use.
- `PT_ADMIN_EMAIL` and `PT_ADMIN_PASSWORD` create the first super-admin at the first start (D48).
  Remove them once it exists, below.
- Add `SENTRY_DSN` if staging errors should reach Sentry.

### The first deploy

```bash
dokku git:from-image promisetracker-v3 codeforafrica/promisetracker-v3:main
dokku ports:set promisetracker-v3 http:80:3000
dokku letsencrypt:enable promisetracker-v3
dokku ps:scale promisetracker-v3 web=1 worker=1
```

Check `dokku ports:report promisetracker-v3` maps port 80, and 443 after Let's Encrypt, to 3000,
where the image listens. Then:

```bash
curl -fsS https://promisetracker-v3.dev.codeforafrica.org/api/health/ready
curl -sI https://promisetracker-v3.dev.codeforafrica.org/en | grep -i x-robots-tag
```

The second should print `x-robots-tag: noindex, nofollow`.

Sign in at `/admin` as the first super-admin, then remove its settings:

```bash
dokku config:unset promisetracker-v3 PT_ADMIN_EMAIL PT_ADMIN_PASSWORD
```

### Deploys from GitHub

In the repository's settings, under Secrets and variables > Actions > Variables, add:

| Variable               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `STAGING_DOKKU_REMOTE` | `ssh://azureuser@ui-1.dev.codeforafrica.org/promisetracker-v3`, the user v2's deploy uses |
| `STAGING_URL`          | `https://promisetracker-v3.dev.codeforafrica.org`                                         |

The job uses the repository secret `SSH_PRIVATE_KEY`, which v2's deploy already uses for this
server. Its public key must be allowed to push to Dokku (`dokku ssh-keys:list`). The image is
public on Docker Hub, so Dokku pulls it without signing in.

Re-run the latest CI run on `main`, or merge anything, and the `staging` job deploys it.

### Editors

A super-admin adds each PesaCheck editor in Administration > Users, with the role they need, and
sends them the address. Staging's accounts are its own.

## Backups

Section 16.5: from the day real editorial data is entered, staging's database is backed up daily.
The backup goes to a bucket off this server, so losing the server does not lose both.

```bash
dokku postgres:backup-auth promisetracker-v3 <access-key> <secret-key> <region> v4 <endpoint>
dokku postgres:backup-schedule promisetracker-v3 "0 2 * * *" <bucket>
dokku postgres:backup promisetracker-v3 <bucket>
```

The last line takes one now, to check it works. Give the bucket a rule that removes backups after
30 days. Every quarter, restore the latest into a scratch database and check it opens:

```bash
dokku postgres:create promisetracker-v3-restore-check --image postgres --image-version 18.7-alpine
# Download the latest backup from the bucket, then:
dokku postgres:import promisetracker-v3-restore-check < backup.dump
dokku postgres:destroy promisetracker-v3-restore-check
```

## When something goes wrong

- **A deploy fails its readiness check.** The old version keeps serving. Read the new one's logs
  with `dokku logs promisetracker-v3 --tail 200`.
- **A migration fails.** The new version never takes traffic. Fix the migration in a pull
  request; the next merge deploys it.
- **Roll back.** `dokku git:from-image promisetracker-v3 codeforafrica/promisetracker-v3:sha-<short sha>`,
  with an earlier commit on `main`. A rollback does not undo migrations, so only roll back past
  ones that remove nothing.
- **Read the staging mailbox.** Mailpit has no public address. To open it, give it one behind a
  password: `dokku domains:set promisetracker-v3-mail <address>`, `dokku proxy:enable`,
  `dokku ports:set promisetracker-v3-mail http:80:8025` and `dokku http-auth:enable`.
