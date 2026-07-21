import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globalSetup: ['./vitest.globalSetup.ts'],
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Share one worker so every file connects to the same ephemeral MongoDB
    // (the URI is dynamic per run and provided from globalSetup).
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
