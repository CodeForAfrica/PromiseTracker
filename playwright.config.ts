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
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: !process.env.CI,
    url: 'http://localhost:3000',
    // Pass the isolated test database and secret through to the app process.
    env: {
      DATABASE_URI: process.env.DATABASE_URI ?? '',
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? '',
      PT_ASSERT_TEST_DB: 'true',
    },
    timeout: 120 * 1000,
  },
})
