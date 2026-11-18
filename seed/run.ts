// Loads the seed data into the database in .env: `pnpm seed`, or
// `pnpm seed ke` for one country. See seed/README.md.
//
// The refresh at the end covers every tag a seed touches: `country:` and
// `countries` for the country, `places:` for its areas and offices, and
// `actors:` for its actors and terms.
import '../tests/load-env'

import { createHttpRefresher, getPayload } from '@promisetracker/cms'
import { setTagRefresher } from '@promisetracker/plugin-core'

import type { SeedCountry } from './seed'
import { SEED_COUNTRIES, seedCountry } from './seed'

// Seed data is for development. A production database holds an editor's work.
if (process.env.NODE_ENV === 'production') {
  console.error('Seed data is for development only. NODE_ENV is production, so nothing was loaded.')
  process.exit(1)
}

// A database on another host may be a shared or live one, so seeding it needs `--remote`.
// A host without a dot, such as Compose's `postgres`, is on this machine's network.
const REMOTE_FLAG = '--remote'
const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {
    return ''
  }
})()
const local = ['', 'localhost', '127.0.0.1', '[::1]'].includes(host) || !host.includes('.')
if (!local && !process.argv.includes(REMOTE_FLAG)) {
  console.error(
    `DATABASE_URL points at ${host}, which is not this machine. Add ${REMOTE_FLAG} to seed it anyway.`,
  )
  process.exit(1)
}

const asked = process.argv.slice(2).filter((arg) => arg !== REMOTE_FLAG)
const unknown = asked.filter((code) => !(SEED_COUNTRIES as readonly string[]).includes(code))
if (unknown.length > 0) {
  console.error(`No seed data for ${unknown.join(', ')}. Choose from ${SEED_COUNTRIES.join(', ')}.`)
  process.exit(1)
}
const codes = (asked.length > 0 ? asked : SEED_COUNTRIES) as readonly SeedCountry[]

const payload = await getPayload()
// Each saved row would ask the site to refresh its cache. One refresh per
// country at the end does the same, without hundreds of requests.
setTagRefresher(async () => {})
const refresh = createHttpRefresher()
let failed = false
for (const code of codes) {
  try {
    const { counts, notes } = await seedCountry(payload, code)
    const summary = Object.entries(counts)
      .map(([target, c]) => `${target}: ${c.create} new, ${c.update} changed, ${c.skip} unchanged`)
      .join('; ')
    console.log(`${code}: ${summary}`)
    for (const note of notes) console.log(`${code}: ${note}`)
  } catch (error) {
    failed = true
    console.error(`${code}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    // Rows saved before a failure are in the database too, so the refresh always runs.
    await refresh(['countries', `country:${code}`, `places:${code}`, `actors:${code}`], { payload })
  }
}
await payload.destroy()
// Payload closes its database pool above, but other open handles, such as
// sockets, can keep Node running, so the script exits on its own.
process.exit(failed ? 1 : 0)
