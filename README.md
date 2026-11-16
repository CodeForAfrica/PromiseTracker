# PromiseTracker

PromiseTracker records what people in power promise and claim, checks each claim against its
source, and follows what happens to it over time.

> [!IMPORTANT]
> **This is PromiseTracker v3, under construction.** It runs on PostgreSQL and Payload 4 and
> needs no Airtable.
>
> - Read the [product specification](docs/spec/promisetracker-v3-product-spec.md) and the
>   [system specification](docs/spec/promisetracker-v3-system-specification.md).
> - The work is tracked in the [v3: version 1 milestone](https://github.com/CodeForAfrica/PromiseTracker/milestone/1).
> - v2 is kept on the [`v2` branch](https://github.com/CodeForAfrica/PromiseTracker/tree/v2) and the
>   [`v2-final` tag](https://github.com/CodeForAfrica/PromiseTracker/tree/v2-final).

## What you need

- Node.js 24.22.3 or later. The version is in `.nvmrc`.
- pnpm 11. The version is in `package.json`.
- Docker, for Postgres, file storage and Tika.

## Run it locally

1. Install dependencies. This also installs the Git hooks.

   ```bash
   pnpm install
   ```

2. Create your settings. Use `.env.local` for your own machine, or `.env`. When both exist,
   `.env.local` wins. Set `PAYLOAD_SECRET`, which you can generate with `openssl rand -hex 32`.

   ```bash
   cp .env.example .env.local
   ```

   Every other value has a default that matches the Compose services. If a port is already taken
   on your machine, change it in the file, for example `PT_POSTGRES_PORT=55432`. The database
   and storage addresses follow it.

3. Start Postgres, file storage (RustFS) and Tika.

   ```bash
   pnpm services
   ```

4. Apply the migrations and start the site.

   ```bash
   pnpm dev
   ```

The site is at http://localhost:3000 and the admin at http://localhost:3000/admin. The first visit
to the admin asks you to create a user.

To run everything in Docker instead, the app and the worker included, use `pnpm stack`.

## Commands

| Task                                        | Command                               |
| ------------------------------------------- | ------------------------------------- |
| Start the services                          | `pnpm services`                       |
| Stop the services                           | `pnpm services:down`                  |
| Run the site                                | `pnpm dev`                            |
| Run the whole stack in Docker               | `pnpm stack`                          |
| Create a migration                          | `pnpm payload migrate:create <name>`  |
| Check migrations match the config           | `pnpm migrate:check`                  |
| Regenerate Payload types and the import map | `pnpm generate`                       |
| Lint and check formatting                   | `pnpm lint`                           |
| Format and fix                              | `pnpm format`                         |
| Type check                                  | `pnpm typecheck`                      |
| Unit tests, no services needed              | `pnpm test:unit`                      |
| Integration tests, needs Postgres           | `pnpm test:int`                       |
| Browser tests, needs Postgres               | `pnpm test:e2e`                       |
| Build the image                             | `docker build -f docker/Dockerfile .` |

## How the code is laid out

| Folder                         | Holds                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `apps/site`                    | The Next.js app: the public site, with Payload's admin and API mounted in it |
| `apps/cms`                     | The Payload config, migrations, API handlers and health checks               |
| `packages/kernel`              | Ports, the plugin loader and start-up checks                                 |
| `packages/contract`            | The API's response schemas, written with Zod                                 |
| `packages/sdk`                 | The typed client the site reads data through                                 |
| `packages/ui`                  | Components from the redesign                                                 |
| `plugins/core`, `plugins/site` | Payload plugins: the data model, and the public site's settings              |
| `docker`                       | The Dockerfile and the Compose file                                          |
| `tests`                        | Unit, integration and browser tests                                          |

The public site reads data only through `@promisetracker/sdk`. Biome stops site code from
importing Payload or the platform. The exceptions are `apps/site/src/platform`, which connects the
SDK to the platform, and `apps/site/src/app/(payload)`, where the admin is mounted.

## Checks before code lands

Git hooks, run by Lefthook:

- **Before each commit:** Biome formats and lints the staged files, the TypeScript check runs,
  and the unit tests run.
- **Before each push:** the migration check and the integration tests run. They need
  `pnpm services` and a `.env.local`.

`pnpm install` installs the hooks for everyone who clones the repository, worktrees included. To
skip them once, for example to push work in progress, set `LEFTHOOK=0`. CI runs the same checks
either way.

CI runs all of these, plus the browser tests and the Docker build, on every pull request. Merges
to `main` publish the image to Docker Hub as `codeforafrica/promisetracker-v3`.

## Docker image

One image runs the web app by default, or the job worker with the `worker` command.

```bash
docker run -p 3000:3000 -e DATABASE_URL=postgres://user:pass@db-host:5432/promisetracker -e PAYLOAD_SECRET=... codeforafrica/promisetracker-v3
```

```bash
docker run -e DATABASE_URL=... -e PAYLOAD_SECRET=... codeforafrica/promisetracker-v3 worker
```

Both apply pending migrations when they start, before they take traffic. Replicas take turns,
so only one migrates. Each waits up to five minutes for the others, which
`PT_STARTUP_LOCK_TIMEOUT_SECONDS` changes. Workers can be scaled, since Payload claims each job
before running it. Set `S3_*` the same way
to store files in S3. `docker/compose.yaml` shows a full set of variables.

## Licence

MIT. See [LICENSE](LICENSE).
