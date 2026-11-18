import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
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
          setupFiles: ['tests/load-env.ts'],
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
