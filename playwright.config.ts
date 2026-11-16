import { defineConfig, devices } from '@playwright/test'

// Point at a running server with PT_E2E_URL, or let Playwright start the dev server.
const externalUrl = process.env.PT_E2E_URL
const baseURL = externalUrl ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.spec.ts',
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
          command: 'pnpm --filter @promisetracker/site exec next dev -p 3000',
          url: `${baseURL}/api/health/ready`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
})
