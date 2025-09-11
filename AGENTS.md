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
- Component library: MUI (Material UI v7) with Emotion; prefer MUI components and theming for UI, extending with custom components in `src/components/` as needed.
- Linting: ESLint (`eslint.config.mjs`, Next + TS rules); Formatting: Prettier defaults.
- Paths: Prefer TS path aliases (see `tsconfig.json`).

## MUI Grid (v7)

- Docs: https://mui.com/material-ui/llms.txt
- Use the new, stable Grid (formerly Grid v2 in MUI 6).
  - Import: `import Grid from '@mui/material/Grid'`
  - No `item` prop; child Grids are items by default. Use `container` on parent Grids.
  - Breakpoints: use `size` and `offset` objects — not `xs|sm|md|lg|xl` props.
    - Example: `<Grid size={{ xs: 12, md: 6 }} />`
    - Offset: `<Grid offset={{ md: 1 }} />`
  - Spacing: prefer `rowSpacing` and `columnSpacing` for responsive control.
- Do NOT use `Grid2` imports. If you must use the legacy API, it lives at `@mui/material/GridLegacy`.

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
