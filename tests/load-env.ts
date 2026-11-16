import path from 'node:path'

import nextEnv from '@next/env'

/**
 * Loads the root env files the way the app does: `.env.local` over `.env`,
 * with `${VAR}` expansion. Variables already set, as in CI, always win.
 *
 * Next.js skips `.env.local` when NODE_ENV is `test`, which Vitest sets, so
 * NODE_ENV is lifted for the duration of the load.
 */
const root = path.resolve(import.meta.dirname, '..')
const nodeEnv = process.env.NODE_ENV
Reflect.deleteProperty(process.env, 'NODE_ENV')
nextEnv.loadEnvConfig(root, true, { info: () => {}, error: console.error })
if (nodeEnv !== undefined) Reflect.set(process.env, 'NODE_ENV', nodeEnv)
