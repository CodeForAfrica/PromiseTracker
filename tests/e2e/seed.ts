// Puts the countries the browser tests need in the database, or takes them
// out again with --remove. Run with tsx, from Playwright's set-up and tear-down.
import '../load-env'

import { getPayload } from '@promisetracker/cms'

const COUNTRIES = [
  { code: 'zx', en: 'Testland', fr: 'Pays de test' },
  { code: 'zw', en: 'English only', fr: null },
] as const

const payload = await getPayload()
const codes = COUNTRIES.map((c) => c.code)
// Test set-up writes as the system.
await payload.delete({
  collection: 'countries',
  where: { code: { in: codes } },
  overrideAccess: true,
})
if (!process.argv.includes('--remove')) {
  for (const country of COUNTRIES) {
    const doc = await payload.create({
      collection: 'countries',
      locale: 'en',
      data: {
        code: country.code,
        name: country.en,
        recordStatus: 'ready',
        about: `About ${country.en}.`,
      },
      overrideAccess: true,
    })
    if (country.fr) {
      await payload.update({
        collection: 'countries',
        id: doc.id,
        locale: 'fr',
        data: { name: country.fr, about: `À propos de ${country.fr}.` },
        overrideAccess: true,
      })
    }
  }
}
await payload.destroy()
// Payload's database pool closes above, but other handles can keep Node running.
process.exit(0)
