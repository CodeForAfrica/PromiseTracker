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
   migrations as it starts. A Postgres advisory lock (`apps/cms/src/startup.ts`) makes the second
   wait for the first, so a migration never runs twice. The new web process takes traffic only
   once `/api/health/ready` passes (`docker/app.json`). If it never does, the old version keeps
   serving and the job fails. The worker has no such check, so a worker that fails to start does
   not fail the job: see "When something goes wrong".
5. The job checks `/api/health/ready` on the public address.

The job runs only once the repository variable `STAGING_URL` is set, so `main` stays green until
the server is ready. A deploy is never cut off by the next push: the next one waits.

## What runs

Each is a Dokku app on one Docker network, `promisetracker-v3`. Only the first has a public
address.

| Dokku app                            | Image                             | Reached at, inside the network              |
| ------------------------------------ | --------------------------------- | ------------------------------------------- |
| `promisetracker-v3`                  | `codeforafrica/promisetracker-v3` | Public, through Dokku's proxy               |
| Postgres service `promisetracker-v3` | `postgres:18.7`                   | `DATABASE_URL`, set by `postgres:link`      |
| `promisetracker-v3-storage`          | `rustfs/rustfs:1.0.5`             | `http://promisetracker-v3-storage.web:9000` |
| `promisetracker-v3-tika`             | `apache/tika:3.2.3.0-full`        | `http://promisetracker-v3-tika.web:9998`    |
| `promisetracker-v3-mail`             | `axllent/mailpit:v1.33.0`         | `promisetracker-v3-mail.web`, port 1025     |

The app runs two processes from the `Procfile` in the image: `web` and `worker`. Version 1 runs
one web process (section 17), so keep `web=1`.

No email provider is chosen yet (D40), so staging sends to Mailpit, which keeps every message and
delivers none. The versions match `docker/compose.yaml`; keep them in step. Postgres is the same
version on Debian rather than Alpine, for the Dokku plugin (below).

## Setting up the server, once

Run these on the server as a user who can run `dokku`. Replace each `…` with a value from a
password manager, never one written here.

The server is arm64. CI publishes the image for amd64 and arm64 as one image, and Docker pulls the
arm64 one. Every other image here has an arm64 build too.

### The Postgres plugin

The server's Dokku had the MongoDB, MySQL and Redis service plugins but not Postgres. Version
2.7.0 is the first that mounts Postgres 18's data folder, `/var/lib/postgresql`.

```bash
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git --committish 2.7.0 --name postgres
```

### The network and the app

```bash
dokku network:create promisetracker-v3

dokku apps:create promisetracker-v3
dokku network:set promisetracker-v3 attach-post-create promisetracker-v3
dokku domains:set promisetracker-v3 promisetracker-v3.dev.codeforafrica.org
```

### Postgres

The official image includes `unaccent` and `pg_trgm` (section 16.2). Use the Debian image, not
`-alpine`: the plugin makes the service's TLS certificate with `openssl` inside the image and gives
it to uid 999, and the Alpine image has no `openssl` and another uid.

```bash
dokku postgres:create promisetracker-v3 --image postgres --image-version 18.7
dokku postgres:link promisetracker-v3 promisetracker-v3
```

`postgres:link` sets `DATABASE_URL` on the app.

Check data survives a restart before any real data goes in:

```bash
dokku postgres:enter promisetracker-v3 psql -U postgres -d promisetracker_v3 -c "CREATE TABLE restart_check (x int); INSERT INTO restart_check VALUES (1);"
dokku postgres:restart promisetracker-v3
dokku postgres:enter promisetracker-v3 psql -U postgres -d promisetracker_v3 -c "SELECT x FROM restart_check;"
dokku postgres:enter promisetracker-v3 psql -U postgres -d promisetracker_v3 -c "DROP TABLE restart_check;"
```

### File storage

```bash
dokku apps:create promisetracker-v3-storage
dokku network:set promisetracker-v3-storage attach-post-create promisetracker-v3
dokku proxy:disable promisetracker-v3-storage
# RustFS runs as uid 10001, so its folder must belong to it.
dokku storage:ensure-directory --chown 10001 promisetracker-v3-storage
dokku storage:mount promisetracker-v3-storage /var/lib/dokku/data/storage/promisetracker-v3-storage:/data
dokku config:set --no-restart promisetracker-v3-storage RUSTFS_ACCESS_KEY=… RUSTFS_SECRET_KEY=…
dokku git:from-image promisetracker-v3-storage rustfs/rustfs:1.0.5
```

Choose one access key and one secret key for the store. They are used three times: here, to create
the bucket below, and as the app's `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.

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
  PT_PUBLIC_URL=https://promisetracker-v3.dev.codeforafrica.org \
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
- `PT_PUBLIC_URL` makes links in emails absolute, such as a failed document's or a password reset.
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
where the image listens. Check `dokku ps:report promisetracker-v3` shows one web and one worker
running: Dokku passes each `Procfile` command (`web`, `worker`) to the image's entrypoint. Then:

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

### Turning on a plugin

Deploy first, then switch it on. `dokku config:set` restarts the app on the image it already
runs, and an image built before a plugin existed refuses to start with that plugin in
`PT_PLUGINS`: "PT_PLUGINS names unknown plugins". Dokku keeps the old containers serving, but the
setting stays saved, so the next restart fails the same way. Once the GitHub variables above are
set, every merge to `main` deploys the new image before anyone needs its plugins.

To deploy by hand, use the digest the CI run published, so Dokku cannot reuse a cached image:

```bash
dokku git:from-image promisetracker-v3 codeforafrica/promisetracker-v3@sha256:<digest>
```

Then switch the plugin on and set what it needs in the admin:

| Plugin  | `PT_PLUGINS` adds | Then                                                                                             |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `tika`  | `tika`            | Administration > Settings > Tika: `http://promisetracker-v3-tika.web:9998`                       |
| `ai`    | `ai`              | Set `PT_LLM_MODEL`, such as `google:gemini-2.5-pro`, and paste the vendor's key in Settings > AI |
| `check` | `check`           | Only if editors verify in Meedan Check. Its settings are in Settings > Check                     |

```bash
dokku config:set promisetracker-v3 PT_PLUGINS=core,site,tika
```

`/api/health` shows the plugin as degraded until its settings are saved, and healthy after.

After a deploy that brings search to a database that already has records, rebuild the index once:
Administration > Search index > Reindex.

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
dokku postgres:create promisetracker-v3-restore-check --image postgres --image-version 18.7
# Download the latest backup from the bucket, then:
dokku postgres:import promisetracker-v3-restore-check < backup.dump
dokku postgres:destroy promisetracker-v3-restore-check
```

## When something goes wrong

- **A deploy fails its readiness check.** The old version keeps serving. Read the new one's logs
  with `dokku logs promisetracker-v3 -p web -n 200`.
- **The worker is down.** Jobs stop and cached pages stop refreshing, but the deploy job still
  passes, as only the web process is checked. After a deploy, `dokku ps:report promisetracker-v3`
  should show the worker running. If not, read its logs with
  `dokku logs promisetracker-v3 -p worker -n 200`.
- **A migration fails.** The new version never takes traffic. Fix the migration in a pull
  request; the next merge deploys it.
- **Roll back.** `dokku git:from-image promisetracker-v3 codeforafrica/promisetracker-v3:sha-<short sha>`,
  with an earlier commit on `main`. CI tags each image `sha-` and the commit's first seven
  characters (`type=sha,format=short` in `ci.yml`). A rollback does not undo migrations, so only
  roll back past ones that remove nothing.
- **Read the staging mailbox.** Mailpit has no public address. To open it, give it one behind a
  password: `dokku domains:set promisetracker-v3-mail <address>`, `dokku proxy:enable`,
  `dokku ports:set promisetracker-v3-mail http:80:8025` and `dokku http-auth:enable`.
