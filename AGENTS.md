# Repository guidelines

PromiseTracker v3. The system specification in `docs/spec/promisetracker-v3-system-specification.md`
is the source of truth for behaviour. Work is tracked as issues in the "v3: version 1" milestone.

## Layout

- `apps/site`: the Next.js app. Public routes in `src/app/(site)`. Payload's admin, its REST routes,
  `/api/v1` and `/api/health` in `src/app/(payload)`. GraphQL is switched off.
- `apps/cms`: the Payload config, migrations, generated types, `/api/v1` handlers and health checks.
- `packages/kernel`, `packages/contract`, `packages/sdk`, `packages/ui`: see the README.
- `plugins/*`: Payload plugins. Each adds its collections, globals and fields to the config.
- `tests/unit`, `tests/int`, `tests/e2e`: Vitest unit and integration tests, and Playwright tests.

## Commands

- Install: `pnpm install`. Services: `pnpm services`. Dev: `pnpm dev`.
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
- **Every schema change has a committed migration.** `push` is off, in development too.
- **Access rules apply by default.** Code that passes `overrideAccess: true` says why in a
  comment.
- **One version per dependency.** Versions live in the `catalog` in `pnpm-workspace.yaml`, and
  every `package.json` refers to them with `catalog:`. Add a dependency with
  `pnpm add <name>@catalog:` after adding it to the catalog.
- Next.js 16 ships its own docs in `apps/site/node_modules/next/dist/docs/`. Read them before
  relying on remembered APIs.

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
