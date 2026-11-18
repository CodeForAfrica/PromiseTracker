# Repository guidelines

PromiseTracker v3. The system specification in `docs/spec/promisetracker-v3-system-specification.md`
is the source of truth for behaviour. Work is tracked as issues in the "v3: version 1" milestone.
Issue #672 gives the build order and the owner of each issue.

## Layout

- `apps/site`: the Next.js app. Public routes in `src/app/(site)`. Payload's admin, its REST routes,
  `/api/v1` and `/api/health` in `src/app/(payload)`. GraphQL is switched off.
- `apps/cms`: the Payload config, migrations, generated types, `/api/v1` handlers and health checks.
- `packages/kernel`, `packages/contract`, `packages/sdk`, `packages/ui`: see the README.
- `plugins/*`: Payload plugins. Each adds its collections, globals and fields to the config.
- `tests/unit`, `tests/int`, `tests/e2e`: Vitest unit and integration tests, and Playwright tests.
- `seed`: seed data for development, one folder of spreadsheets per country. `pnpm seed` loads it.

## Commands

- Install: `pnpm install`. Services: `pnpm services`. Dev: `pnpm dev`. Seed data: `pnpm seed`.
- Lint: `pnpm lint`. Format: `pnpm format`. Types: `pnpm typecheck`.
- Tests: `pnpm test:unit`, `pnpm test:int` and `pnpm test:e2e`. The last two need Postgres.
- Migrations: `pnpm payload migrate:create <name>`, then `pnpm migrate:check`.
- After changing collections or fields: `pnpm generate`, then create a migration.

## Rules

- **The site never imports Payload.** Site code reads data through `@promisetracker/sdk`. Only
  `apps/site/src/platform` and `apps/site/src/app/(payload)` may import the platform. Biome
  enforces this, and `tests/unit/boundary.unit.spec.ts` proves the rule works.
- **Strict TypeScript.** No `any`, no non-null assertions, `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` are on.
- **Erasable syntax only**, so Node can strip types. No enums, namespaces or parameter
  properties. Use `as const` objects or union types instead. Import types with `import type`.
- **Use Payload's generated types.** Collections, globals and their documents are typed in
  `apps/cms/src/payload-types.ts`. Do not write a second type for the same shape. Derive from the
  generated one with `Pick`, `Omit` or an intersection when you need something narrower or wider.
  The Zod schemas in `@promisetracker/contract` describe the public API, which the site uses. Map
  generated types to them in one typed function, as `apps/cms/src/api/v1.ts` does.
- **Every feature brings seed data.** A feature that adds a record type, or a field the site
  shows, adds real, public data for it in `seed/data` in the same pull request, so collaborators
  see it working without entering anything. `seed/README.md` says how.
- **Every schema change has a committed migration.** `push` is off, in development too.
- **Access rules apply by default.** Code that passes `overrideAccess: true` says why in a
  comment.
- **One version per dependency.** Versions live in the `catalog` in `pnpm-workspace.yaml`, and
  every `package.json` refers to them with `catalog:`. Add a dependency with
  `pnpm add <name>@catalog:` after adding it to the catalog.
- Next.js 16 ships its own docs in `apps/site/node_modules/next/dist/docs/`. Read them before
  relying on remembered APIs.

## Working on an issue

1. Find the issue. Issue #672 lists every issue in build order, with its owner. Work only on
   issues assigned to the person you are working for, and only on ones labelled `status: ready`.
2. Read the issue's "Start here" section. It names the specification sections to read, where the
   code goes, what already exists, and any v2 code to reuse. Read v2 code with
   `git show v2-final:<path>`. v2 is not in the working tree.
3. Read those specification sections before writing code. If the issue and the specification
   disagree, the specification wins. Say so in the pull request.
4. Branch from `main`: `feat/v3-<short-name>`, or `docs/...`, `fix/...`, `chore/...`.
5. Build only what the acceptance criteria ask for. Each criterion needs a test, or a line in the
   pull request saying how it was checked.
6. After changing collections or fields: `pnpm generate`, then `pnpm payload migrate:create <name>`,
   then `pnpm migrate:check`.
7. Add seed data for what the feature adds, in `seed/data`, and check `pnpm seed` loads it. See
   `seed/README.md`, "Adding seed data with a feature".
8. Before opening the pull request: `pnpm lint`, `pnpm typecheck` and `pnpm test`. The last needs
   `pnpm services` running.
9. The pull request says `Closes #<issue>` and follows the format of #663 and #664: what it does,
   decisions made while building, environment and config changes, migrations, seed data, how to
   test.
10. A decision that changes behaviour also goes in the specification's decision register, section
    20.1, with the PDFs rebuilt.
11. A change to what editors do in the admin also goes in `docs/admin-guide.md`.
12. After the merge, look at the issue's "Unblocks" section. Move each issue listed there to
    `status: ready` if nothing else open blocks it.

Where things are:

| What                                             | Where                         |
| ------------------------------------------------ | ----------------------------- |
| Ports, the plugin helper, start-up checks        | `packages/kernel/src`         |
| Record types and default adapters                | `plugins/core/src`            |
| Settings for the default public site             | `plugins/site/src`            |
| Payload config, migrations, generated types      | `apps/cms/src`                |
| `/api/v1` handlers                               | `apps/cms/src/api/v1.ts`      |
| Public API response schemas                      | `packages/contract/src`       |
| The typed client the site uses                   | `packages/sdk/src`            |
| Components, props only                           | `packages/ui/src`             |
| Public pages                                     | `apps/site/src/app/(site)`    |
| Admin, REST, `/api/v1`, health and plugin routes | `apps/site/src/app/(payload)` |
| Registered languages                             | `apps/cms/src/locales.ts`     |
| Every environment key                            | `.env.example`                |
| Seed data and its loader                         | `seed`                        |

A new plugin is a package in `plugins/`. It is also added to `firstPartyPlugins` in
`apps/cms/src/kernel.ts`, to `transpilePackages` in `apps/site/next.config.ts`, and to the `COPY`
lines for `package.json` files in `docker/Dockerfile`.

## Style

- Biome formats and lints: two spaces, single quotes, no semicolons, 100 columns.
- Components in PascalCase. Files that hold one component are named after it.
- Comments say why, not what.

## Commits and pull requests

- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `build(deps): ...`.
- Lefthook runs Biome, the type check and the unit tests before each commit, and the migration
  check and integration tests before each push.
- Pull requests link their issue, list environment or config changes, note migrations, and include
  screenshots for UI changes.

## Configuration

- The root `.env` and `.env.local` serve the site, the Payload CLI, the tests and Compose, with
  `.env.local` winning. Run Compose through `pnpm services` or `scripts/compose.mjs` so it reads
  them. `.env.example` documents every key. Never commit secrets.
- Host ports for Compose services are set in `.env` (`PT_POSTGRES_PORT` and so on).
  `DATABASE_URL` and `S3_ENDPOINT` are built from them.
