// Puts the countries and the super-admin the browser tests need in the database,
// and writes what it used to tests/e2e/.seed.json. With --remove it takes them out again.
// Run with tsx, from Playwright's set-up and tear-down.
import '../load-env'

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { getPayload } from '@promisetracker/cms'
import { countryName, csvImporter, guessMapping, runImportPlan } from '@promisetracker/plugin-core'

import { richText } from '../../seed/seed'
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
  /** Editorial records the seed added, to remove again. */
  editorial: { collection: 'themes' | 'pages' | 'partners' | 'sister-tools'; id: string }[]
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
    await payload.updateGlobal({
      slug: 'site',
      data: {
        picks: { featuredClaim: null, inFocus: null, featuredArea: null },
        countryPicks: [],
      },
      overrideAccess: true,
    })
    for (const { collection, id } of seed.editorial ?? []) {
      await payload.delete({ collection, id, overrideAccess: true, trash: true }).catch(() => {})
    }
    await payload.delete({
      collection: 'articles',
      where: { country: { equals: seed.full.id } },
      overrideAccess: true,
      trash: true,
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
    ['claim-updates', 'kenya-claim-updates.csv'],
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
      // An editor releases each update. The seed releases them as it adds them.
      ...(target === 'claim-updates' ? { onCreate: { recordStatus: 'ready' } } : {}),
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
  // The editorial layer (#657): a theme across both countries, an article on
  // the key claim, the methodology, a partner, a sister tool and the picks.
  const editorial: Seed['editorial'] = []
  const slugged = async (slug: string) =>
    (
      await payload.find({
        collection: 'claims',
        where: { and: [{ country: { equals: a.id } }, { slug: { equals: slug } }] },
        overrideAccess: true,
      })
    ).docs[0]?.id ?? ''
  const water = await slugged('clean-water-for-every-ward')
  const theme = await payload.create({
    collection: 'themes',
    locale: 'en',
    data: {
      title: 'Homes and water',
      slug: 'e2e-homes-and-water',
      introduction: 'Housing and water pledges, followed across countries.',
      claims: [keyClaim?.id ?? '', water].filter(Boolean),
      countries: [a.id, b.id],
      recordStatus: 'ready',
    },
    overrideAccess: true,
  })
  editorial.push({ collection: 'themes', id: theme.id })
  const methodology = await payload.create({
    collection: 'pages',
    locale: 'en',
    data: {
      title: 'Methodology',
      slug: 'methodology',
      summary: 'How claims are checked and rated.',
      body: richText([
        { h2: 'Rating a claim' },
        { p: 'An editor rates each claim against evidence.' },
      ]),
      recordStatus: 'ready',
    } as never,
    overrideAccess: true,
  })
  editorial.push({ collection: 'pages', id: methodology.id })
  await payload.create({
    collection: 'articles',
    locale: 'en',
    data: {
      title: 'Why the Kibra homes are late',
      slug: 'why-the-kibra-homes-are-late',
      standfirst: 'The land was ready. The money was not.',
      body: richText([{ p: 'The first phase was funded in the second budget.' }]),
      date: '2024-05-02',
      byline: 'A. Reporter',
      about: { relationTo: 'claims', value: keyClaim?.id ?? '' },
      country: a.id,
      recordStatus: 'ready',
    } as never,
    overrideAccess: true,
  })
  const partner = await payload.create({
    collection: 'partners',
    data: { name: 'Code for Africa', url: 'https://codeforafrica.org' },
    overrideAccess: true,
  })
  editorial.push({ collection: 'partners', id: partner.id })
  const tool = await payload.create({
    collection: 'sister-tools',
    locale: 'en',
    data: {
      name: 'PesaCheck',
      url: 'https://pesacheck.org',
      description: 'Fact-checks across Africa.',
    },
    overrideAccess: true,
  })
  editorial.push({ collection: 'sister-tools', id: tool.id })
  const wekesa = (
    await payload.find({
      collection: 'actors',
      where: { and: [{ country: { equals: a.id } }, { slug: { equals: 'achieng-wekesa' } }] },
      overrideAccess: true,
    })
  ).docs[0]?.id
  await payload.updateGlobal({
    slug: 'site',
    data: {
      picks: { featuredClaim: keyClaim?.id ?? null, inFocus: theme.id },
      countryPicks: [{ country: a.id, actors: wekesa ? [wekesa] : [], claims: [water] }],
    },
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
    editorial,
  }
  writeFileSync(file, JSON.stringify(seed, null, 2))
}
await payload.destroy()
// Payload's database pool closes above, but other handles can keep Node running.
process.exit(0)
