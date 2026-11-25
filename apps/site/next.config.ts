import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvConfig } from '@next/env'
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dirname, '../..')

// The root .env and .env.local serve the site, the Payload CLI, the tests and
// Compose. Next.js has already loaded env files from this folder and caches
// them, so force a reload from the repository root.
loadEnvConfig(repoRoot, process.env.NODE_ENV !== 'production', console, true)

const nextConfig: NextConfig = {
  // The repository's own AGENTS.md covers agent guidance.
  agentRules: false,
  // The browser tests run their own dev server in a separate folder, since
  // Next.js allows one dev server per folder.
  distDir: process.env.PT_NEXT_DIST_DIR || '.next',
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  transpilePackages: [
    '@promisetracker/cms',
    '@promisetracker/contract',
    '@promisetracker/kernel',
    '@promisetracker/plugin-core',
    '@promisetracker/plugin-site',
    '@promisetracker/plugin-tika',
    '@promisetracker/sdk',
    '@promisetracker/ui',
  ],
  turbopack: { root: repoRoot },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
