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
  /** Topics the seed added, to remove again. */
  topics: string[]
}

const file = path.resolve(import.meta.dirname, '.seed.json')
const payload = await getPayload()

if (process.argv.includes('--remove')) {
  if (existsSync(file)) {
    const seed = JSON.parse(readFileSync(file, 'utf8')) as Seed
    // Test set-up writes as the system, and removes only what it added.
    await payload.update({
      collection: 'actors',
      where: { country: { equals: seed.full.id } },
      data: { keyClaim: null },
      overrideAccess: true,
    })
    for (const collection of ['claims', 'terms', 'actors', 'areas', 'offices'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: seed.full.id } },
        overrideAccess: true,
      })
    }
    for (const id of seed.topics ?? []) {
      await payload.delete({ collection: 'topics', id, overrideAccess: true })
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
  // The topics the claims below name.
  const topics: string[] = []
  for (const name of ['Health', 'Housing']) {
    const { docs } = await payload.find({
      collection: 'topics',
      where: { slug: { equals: name.toLowerCase() } },
      overrideAccess: true,
    })
    if (docs.length > 0) continue
    const topic = await payload.create({
      collection: 'topics',
      locale: 'en',
      data: { name },
      overrideAccess: true,
    })
    topics.push(topic.id)
  }
  // The Kenyan areas and offices, so the full country has area pages,
  // fictional office holders, one of whom has left office, and their claims.
  const fixtures = path.resolve(import.meta.dirname, '../fixtures')
  for (const [target, name] of [
    ['offices', 'kenya-offices.csv'],
    ['areas', 'kenya-areas.csv'],
    ['actors', 'kenya-actors.csv'],
    ['terms', 'kenya-terms.csv'],
    ['claims', 'kenya-claims.csv'],
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
  // An editor releases each actor and claim. The seed releases them all.
  for (const collection of ['actors', 'claims'] as const) {
    await payload.update({
      collection,
      where: { country: { equals: a.id } },
      data: { recordStatus: 'ready' },
      overrideAccess: true,
    })
  }
  // The governor's key claim, as an editor would choose it.
  const [keyClaim] = (
    await payload.find({
      collection: 'claims',
      where: { and: [{ country: { equals: a.id } }, { slug: { equals: 'kibra-housing' } }] },
      overrideAccess: true,
    })
  ).docs
  await payload.update({
    collection: 'actors',
    where: { and: [{ country: { equals: a.id } }, { slug: { equals: 'achieng-wekesa' } }] },
    locale: 'en',
    data: { keyClaim: keyClaim?.id ?? null, keyClaimNote: 'Her flagship housing pledge.' },
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
    topics,
  }
  writeFileSync(file, JSON.stringify(seed, null, 2))
}
await payload.destroy()
// Payload's database pool closes above, but other handles can keep Node running.
process.exit(0)
