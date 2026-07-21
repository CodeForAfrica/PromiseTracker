import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Load the DEDICATED test environment (never .env / .env.local) so E2E runs
// use isolated configuration. CI overrides DATABASE_URI to point at its
// MongoDB service container.
loadEnv({ path: ".env.test" })

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Enforce the isolated-DB guard and reset the database before the suite.
  globalSetup: './tests/e2e/globalSetup.ts',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    // `next dev` compiles each route lazily on first request; on CI a cold
    // compile of the block-heavy pages can take a while. Give navigations and
    // actions a wide margin so the first hit to a route is not a flake.
    navigationTimeout: 90 * 1000,
    actionTimeout: 30 * 1000,
  },
  // Per-test timeout, also generous to cover first-request compilation.
  timeout: 120 * 1000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Run the app in dev mode: the E2E suite exercises /dev/update-dialog,
    // which is deliberately disabled (notFound) in production builds, so a
    // production `next start` cannot serve these tests. `next dev` keeps
    // NODE_ENV development and that route available.
    command: 'pnpm dev',
    reuseExistingServer: !process.env.CI,
    // Readiness probe: wait on the dev-only, DB-free /dev/update-dialog route,
    // which returns 200. The homepage is NOT a valid readiness signal — on an
    // empty database it resolves to notFound() (HTTP 404), which Playwright's
    // webServer never treats as "ready", so the run would time out even though
    // the server is up.
    url: 'http://localhost:3000/dev/update-dialog',
    // Pass the isolated test database, secret, and locale set to the app.
    env: {
      DATABASE_URI: process.env.DATABASE_URI ?? '',
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? '',
      PT_ASSERT_TEST_DB: 'true',
      NEXT_PUBLIC_LOCALES: process.env.NEXT_PUBLIC_LOCALES ?? 'en,fr',
      NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en',
    },
    // Wide window to cover a cold `next dev` boot + first compile on CI.
    timeout: 240 * 1000,
  },
})
