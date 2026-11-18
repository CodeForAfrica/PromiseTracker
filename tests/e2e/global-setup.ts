import { execFileSync } from 'node:child_process'

import type { FullConfig } from '@playwright/test'

/**
 * Adds the browser tests' countries, and returns the step that removes them.
 * The seed refreshes the cached pages of the server under test.
 */
export default function setup(config: FullConfig): () => void {
  const baseURL = config.projects[0]?.use.baseURL
  const seed = (...args: string[]) =>
    execFileSync(
      'pnpm',
      ['--filter', '@promisetracker/cms', 'exec', 'tsx', '../../tests/e2e/seed.ts', ...args],
      { stdio: 'inherit', env: { ...process.env, ...(baseURL ? { PT_WEB_URL: baseURL } : {}) } },
    )
  seed()
  return () => seed('--remove')
}
