// Runs docker compose with the root env files, so Compose sees the same
// settings as the app: .env first, then .env.local over it. Either may be
// missing, since docker/compose.yaml has a default for everything.
//   node scripts/compose.mjs up -d
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFiles = ['.env', '.env.local']
  .map((file) => path.join(root, file))
  .filter((file) => existsSync(file))
  .flatMap((file) => ['--env-file', file])

const { status } = spawnSync(
  'docker',
  ['compose', ...envFiles, '-f', path.join(root, 'docker/compose.yaml'), ...process.argv.slice(2)],
  { stdio: 'inherit' },
)
process.exit(status ?? 1)
