// Loads the seed data into the database in .env: `pnpm seed`, or
// `pnpm seed ke` for one country. See seed/README.md.
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

const asked = process.argv.slice(2)
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
