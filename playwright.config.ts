import './tests/load-env'

import { defineConfig, devices } from '@playwright/test'

import { switchToTestDatabase } from './tests/database'

// Point at a running server with PT_E2E_URL, or let Playwright start one of its own.
const externalUrl = process.env.PT_E2E_URL
const port = Number(process.env.PT_E2E_PORT || 3100)
const baseURL = externalUrl ?? `http://localhost:${port}`

// The server Playwright starts uses its own database, never the one `pnpm dev`
// uses. A server named in PT_E2E_URL brings its own, as the Compose stack in CI does.
if (!externalUrl) switchToTestDatabase('e2e')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(externalUrl
    ? {}
    : {
        webServer: {
          command:
            'pnpm exec tsx tests/e2e/prepare-database.ts && ' +
            `pnpm --filter @promisetracker/site exec next dev -p ${port}`,
          url: `${baseURL}/api/health/ready`,
          // A server already on this port may use another database, so never reuse one.
          reuseExistingServer: false,
          timeout: 180_000,
          // Next.js allows one dev server per build folder, so this one runs
          // beside `pnpm dev` without stopping it.
          env: {
            // French and Arabic too, so the tests cover a second language and a right-to-left one.
            PT_LOCALES: 'en,fr,ar',
            PT_NEXT_DIST_DIR: '.next-e2e',
            // Email from the browser tests goes to Mailpit, never a real inbox.
            SMTP_HOST: 'localhost',
            SMTP_PORT: process.env.PT_SMTP_PORT || '1025',
            SMTP_USER: '',
            SMTP_PASSWORD: '',
          },
        },
      }),
})
