// Puts the countries and the super-admin the browser tests need in the database,
// and writes what it used to tests/e2e/.seed.json. With --remove it takes them out again.
// Run with tsx, from Playwright's set-up and tear-down.
import '../load-env'

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { getPayload } from '@promisetracker/cms'
import { countryName, csvImporter, guessMapping, runImportPlan } from '@promisetracker/plugin-core'

import { unusedCountryCodes } from '../countries'

export type Seed = {
  /** Published in English and French. */
  full: { id: string; code: string; en: string; fr: string }
  /** Published in English only. */
  englishOnly: { id: string; code: string; en: string }
  /** A super-admin to sign in to the admin as. */
  admin: { id: string; email: string; password: string }
}

const file = path.resolve(import.meta.dirname, '.seed.json')
const payload = await getPayload()

if (process.argv.includes('--remove')) {
  if (existsSync(file)) {
    const seed = JSON.parse(readFileSync(file, 'utf8')) as Seed
    // Test set-up writes as the system, and removes only what it added.
    for (const collection of ['terms', 'actors', 'areas', 'offices'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: seed.full.id } },
        overrideAccess: true,
      })
    }
    await payload.delete({
      collection: 'countries',
      where: { id: { in: [seed.full.id, seed.englishOnly.id] } },
      overrideAccess: true,
    })
    // The last super-admin cannot be deleted. Then it goes with the test database.
    await payload
      .delete({ collection: 'users', id: seed.admin.id, overrideAccess: true })
      .catch(() => {})
    rmSync(file)
  }
} else {
  const [full = 'st', englishOnly = 'km'] = await unusedCountryCodes(payload, 2)
  const make = (code: typeof full, about: string) =>
    payload.create({
      collection: 'countries',
      locale: 'en',
      data: { code, recordStatus: 'ready', about },
      overrideAccess: true,
    })
  const a = await make(full, `About ${countryName(full, 'en')}.`)
  await payload.update({
    collection: 'countries',
    id: a.id,
    locale: 'fr',
    data: { about: `À propos de ${countryName(full, 'fr')}.` },
    overrideAccess: true,
  })
  const b = await make(englishOnly, `About ${countryName(englishOnly, 'en')}.`)
  for (const locale of ['fr', 'pt', 'ar', 'sw'] as const) {
    await payload.update({
      collection: 'countries',
      id: b.id,
      locale,
      data: { name: null },
      overrideAccess: true,
    })
  }
  // The Kenyan areas and offices, so the full country has area pages, and
  // fictional office holders, one of whom has left office.
  const fixtures = path.resolve(import.meta.dirname, '../fixtures')
  for (const [target, name] of [
    ['offices', 'kenya-offices.csv'],
    ['areas', 'kenya-areas.csv'],
    ['actors', 'kenya-actors.csv'],
    ['terms', 'kenya-terms.csv'],
  ] as const) {
    const content = {
      filename: name,
      mimeType: 'text/csv',
      data: new Uint8Array(readFileSync(path.join(fixtures, name))),
    }
    const { headings } = await csvImporter.inspect(content, {} as never)
    const rows = []
    for await (const row of csvImporter.rows(content, {} as never)) rows.push(row)
    const mapping =
      target === 'areas'
        ? { name: 'Name', type: 'Type', parent: 'Parent' }
        : target === 'offices'
          ? {
              name: 'Name',
              shortName: 'Short name',
              slug: 'Slug',
              areaType: 'Area type',
              order: 'Order',
            }
          : guessMapping(target, headings)
    const { errors } = await runImportPlan(payload, {
      target,
      country: a.id,
      headings,
      rows,
      mapping,
      commit: true,
    })
    if (errors.length) throw new Error(`Seeding ${name} failed: ${JSON.stringify(errors)}`)
  }
  // An editor releases each actor. The seed releases them all.
  await payload.update({
    collection: 'actors',
    where: { country: { equals: a.id } },
    data: { recordStatus: 'ready' },
    overrideAccess: true,
  })
  const admin = {
    email: `e2e-admin-${crypto.randomUUID()}@example.org`,
    password: `pw-${crypto.randomUUID()}`,
  }
  const user = await payload.create({
    collection: 'users',
    data: { ...admin, name: 'Browser tests', roles: ['super-admin'] },
    overrideAccess: true,
  })
  const seed: Seed = {
    full: { id: a.id, code: full, en: countryName(full, 'en'), fr: countryName(full, 'fr') },
    englishOnly: { id: b.id, code: englishOnly, en: countryName(englishOnly, 'en') },
    admin: { id: user.id, ...admin },
  }
  writeFileSync(file, JSON.stringify(seed, null, 2))
}
await payload.destroy()
// Payload's database pool closes above, but other handles can keep Node running.
process.exit(0)
