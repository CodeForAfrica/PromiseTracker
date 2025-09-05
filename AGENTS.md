# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (Next.js + Payload CMS)
  - App routes: `src/app/` (frontend and admin payload segments)
  - CMS: `src/collections/`, `src/globals/`, `src/blocks/`, `src/fields/`
  - Utilities & libs: `src/utils/`, `src/lib/`, `src/types/`
  - Jobs & workflows: `src/tasks/`, `src/workflows/`
  - Config: `src/payload.config.ts`, `next.config.mjs`
- Tests: `tests/int` (Vitest) and `tests/e2e` (Playwright)
- Assets/media: `media/`

## Build, Test, and Development Commands
- Install: `pnpm i`
- Dev server: `pnpm dev` (Next.js + Payload; use `.env` or `.env.local`)
- Clean dev cache: `pnpm devsafe`
- Build: `pnpm build`; Start: `pnpm start`
- Lint: `pnpm lint`
- Tests (all): `pnpm test` → runs `test:int` and `test:e2e`
- Int tests: `pnpm test:int` (Vitest, JSDOM)
- E2E tests: `pnpm test:e2e` (Playwright, auto-starts dev server)
- Payload types/import map: `pnpm generate:all`
- Airtable typings: `pnpm generate:airtable` (requires `AIRTABLE_*` envs)
- Optional: Start Apache Tika for document processing: `docker compose up -d`

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`, `.tsx`), 2-space indent.
- Framework: Next.js App Router; React components in `src/components/` use PascalCase.
- Linting: ESLint (`eslint.config.mjs`, Next + TS rules); Formatting: Prettier defaults.
- Paths: Prefer TS path aliases (see `tsconfig.json`).

## Testing Guidelines
- Frameworks: Vitest (integration) and Playwright (e2e).
- Naming: `tests/int/**/*.int.spec.ts`, `tests/e2e/**/*.e2e.spec.ts`.
- Run locally before PR: `pnpm test:int && pnpm test:e2e`.
- Write tests for new collections, fields, and critical flows.

## Commit & Pull Request Guidelines
- Commit style follows Conventional Commits seen in history: `feat(...)`, `fix(...)`, `refactor(...)`, `build(deps)`, etc.
- PRs: clear description, link issues, include screenshots for UI, list env/config changes, and note any migrations.
- CI hygiene: ensure `pnpm lint` and all tests pass; update docs when behavior changes.

## Security & Configuration Tips
- Env files: `.env.example` documents required keys (Airtable, CheckDesk, Gemini). Do not commit secrets.
- Engines: Node `^18.20.2 || >=20.9.0`, PNPM `^9 || ^10`.
