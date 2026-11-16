// Fails when the Payload config and the committed migrations disagree.
// It asks Payload to create a migration and skip it if empty. If a file
// appears, a schema change has no migration, so the check removes the file
// and fails.
import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/migrations')
const before = new Set(readdirSync(dir))

execFileSync('pnpm', ['exec', 'payload', 'migrate:create', 'schema_check', '--skip-empty'], {
  cwd: path.resolve(dir, '../..'),
  stdio: 'inherit',
  env: { PAYLOAD_SECRET: 'migrate-check', ...process.env },
})

const created = readdirSync(dir).filter((f) => !before.has(f))
if (created.length) {
  for (const f of created) rmSync(path.join(dir, f))
  // Payload also rewrites the index to include the new file.
  execFileSync('git', ['checkout', '--', path.join(dir, 'index.ts')])
  console.error(
    '\nThe Payload config has changes with no migration. Run `pnpm payload migrate:create <name>` and commit the result.',
  )
  process.exit(1)
}
console.log('Migrations match the Payload config.')
