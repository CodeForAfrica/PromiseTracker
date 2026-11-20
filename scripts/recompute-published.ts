// Works out every record's published status again (section 8.1):
// `pnpm publishing:recompute`, or `pnpm publishing:recompute claims` for one
// record type. A save works out only its own record, so run this after a
// change to the required fields or to PT_LOCALES. Parents go first, so each
// record sees its parents' new status.
import '../tests/load-env'

import { getPayload } from '@promisetracker/cms'
import { publishedTypes, recomputeAll } from '@promisetracker/plugin-core'

const payload = await getPayload()
const asked = process.argv.slice(2)
const known = publishedTypes()
const unknown = asked.filter((slug) => !known.includes(slug))
if (unknown.length > 0) {
  console.error(`No publishing rules for ${unknown.join(', ')}. Choose from ${known.join(', ')}.`)
  process.exit(1)
}
const result = await recomputeAll(payload, asked.length > 0 ? asked : undefined)
for (const [slug, { recomputed, changed }] of Object.entries(result)) {
  console.log(`${slug}: ${recomputed} worked out, ${changed} changed`)
}
await payload.destroy()
process.exit(0)
