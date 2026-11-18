import { defineConfig } from 'vitest/config'

// Section 15: 85% for the pipeline, publishing rules and plugin loading, 70%
// for everything else. Vitest leaves files matched by a glob out of the
// overall numbers, so `overall` covers only the rest. Add the pipeline's and
// the publishing rules' files here as they land.
const overall = { lines: 70, statements: 70, functions: 70, branches: 70 }
const strict = { lines: 85, statements: 85, functions: 85, branches: 85 }
const strictPaths = [
  // Plugin loading, ports and start-up checks.
  'packages/kernel/src/**',
]

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Platform code and the packages. The site's pages are covered by the browser tests.
      include: [
        'apps/cms/src/**/*.ts',
        'packages/*/src/**/*.{ts,tsx}',
        'plugins/*/src/**/*.{ts,tsx}',
      ],
      exclude: ['**/migrations/**', '**/payload-types.ts'],
      reporter: ['text', 'text-summary', 'html'],
      thresholds: {
        ...overall,
        ...Object.fromEntries(strictPaths.map((glob) => [glob, strict])),
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.unit.spec.ts'],
        },
      },
      {
        test: {
          name: 'int',
          environment: 'node',
          include: ['tests/int/**/*.int.spec.ts'],
          globalSetup: ['tests/int/global-setup.ts'],
          setupFiles: ['tests/int/setup.ts'],
          // French and Arabic too, so the tests cover a second language and a right-to-left one.
          env: { PT_LOCALES: 'en,fr,ar' },
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
