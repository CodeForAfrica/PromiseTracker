import { readFileSync } from 'node:fs'
import path from 'node:path'

import { areaFamily, getPayload } from '@promisetracker/cms'
import type { CountryCode, ImportTarget } from '@promisetracker/plugin-core'
import { csvImporter, runImportPlan } from '@promisetracker/plugin-core'
import { createSdk } from '@promisetracker/sdk'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'
import { testTransport } from './transport'

/**
 * Areas, offices and spreadsheet import (sections 7.2, 9.6, 11.2 and 16.2),
 * with the Kenyan fixtures loaded into a small country no one tracks.
 */
describe('areas, offices and import', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  const users: string[] = []
  const boundaries: string[] = []
  const sdk = createSdk(testTransport())

  const file = (name: string) =>
    readFileSync(path.resolve(import.meta.dirname, '../fixtures', name))
  const read = async (name: string) => {
    const content = { filename: name, mimeType: 'text/csv', data: new Uint8Array(file(name)) }
    const { headings } = await csvImporter.inspect(content, {} as never)
    const rows = []
    for await (const row of csvImporter.rows(content, {} as never)) rows.push(row)
    return { headings, rows }
  }
  const OFFICES = {
    name: 'Name',
    shortName: 'Short name',
    slug: 'Slug',
    areaType: 'Area type',
    holdersPerSeat: 'Holders per seat',
    order: 'Order',
    'name:fr': 'Name (fr)',
    'shortName:fr': 'Short name (fr)',
  }
  const AREAS = { name: 'Name', type: 'Type', parent: 'Parent', externalCode: 'Code' }
  const run = async (
    target: ImportTarget,
    name: string,
    mapping: Record<string, string>,
    commit: boolean,
  ) => runImportPlan(payload, { target, country, mapping, commit, ...(await read(name)) })
  const areaId = async (slug: string) =>
    (
      await payload.find({
        collection: 'areas',
        where: { and: [{ country: { equals: country } }, { slug: { equals: slug } }] },
        overrideAccess: true,
      })
    ).docs[0]?.id ?? ''

  beforeAll(async () => {
    payload = await getPayload()
    ;[code = 'st'] = await unusedCountryCodes(payload, 1)
    // Test set-up writes as the system.
    country = (
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
  })

  afterAll(async () => {
    for (const collection of ['imports', 'areas', 'offices'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: country } },
        overrideAccess: true,
      })
    }
    await payload.delete({
      collection: 'import-mappings',
      where: { name: { like: 'test-' } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    for (const id of boundaries)
      await payload.delete({ collection: 'boundaries', id, overrideAccess: true })
    for (const id of users) await payload.delete({ collection: 'users', id, overrideAccess: true })
    await payload.destroy()
  })

  describe('importing the Kenyan fixtures', () => {
    it('previews without saving anything', async () => {
      const preview = await run('offices', 'kenya-offices.csv', OFFICES, false)
      expect(preview).toEqual({ counts: { create: 5, update: 0, skip: 0, failed: 0 }, errors: [] })
      const { totalDocs } = await payload.count({
        collection: 'offices',
        where: { country: { equals: country } },
        overrideAccess: true,
      })
      expect(totalDocs).toBe(0)
    })

    it('imports the offices, with their French names', async () => {
      expect((await run('offices', 'kenya-offices.csv', OFFICES, true)).counts.create).toBe(5)
      const governor = (
        await payload.find({
          collection: 'offices',
          where: { and: [{ country: { equals: country } }, { slug: { equals: 'governor' } }] },
          locale: 'all',
          overrideAccess: true,
        })
      ).docs[0]
      expect(governor?.name).toMatchObject({ en: 'Governor', fr: 'Gouverneur' })
      expect(governor?.areaType).toBe('county')
    })

    it('imports the areas, parents before children', async () => {
      const result = await run('areas', 'kenya-areas.csv', AREAS, true)
      expect(result).toEqual({ counts: { create: 71, update: 0, skip: 0, failed: 0 }, errors: [] })
    })

    it('updates rather than duplicates when the same file is imported again', async () => {
      expect((await run('areas', 'kenya-areas.csv', AREAS, true)).counts).toEqual({
        create: 0,
        update: 0,
        skip: 71,
        failed: 0,
      })
      const { totalDocs } = await payload.count({
        collection: 'areas',
        where: { country: { equals: country } },
        overrideAccess: true,
      })
      expect(totalDocs).toBe(71)
    })

    it('links the whole-country area as the country’s root area', async () => {
      const doc = await payload.findByID({
        collection: 'countries',
        id: country,
        depth: 0,
        overrideAccess: true,
      })
      expect(doc.rootArea).toBe(await areaId('kenya'))
    })

    it('reports a row whose parent comes later, by its spreadsheet row', async () => {
      const result = await runImportPlan(payload, {
        target: 'areas',
        country,
        commit: false,
        headings: ['Name', 'Type', 'Parent'],
        rows: [
          { row: 1, values: ['Westlands Ward', 'ward', 'Unknown Constituency'] },
          { row: 2, values: ['Another', 'region', ''] },
        ],
        mapping: { name: 'Name', type: 'Type', parent: 'Parent' },
      })
      expect(result.counts).toEqual({ create: 1, update: 0, skip: 0, failed: 1 })
      expect(result.errors).toEqual([
        {
          line: 2,
          message: expect.stringContaining('Parent "unknown-constituency" is not in this country'),
        },
      ])
    })

    it('previews a move under a parent from the same file as an update, as the import does', async () => {
      // An area with no parent, made by hand.
      const loose = await payload.create({
        collection: 'areas',
        locale: 'en',
        data: { name: 'Coast Basin', type: 'region', country, page: 'automatic' },
        overrideAccess: true,
      })
      const result = await runImportPlan(payload, {
        target: 'areas',
        country,
        commit: false,
        headings: ['Name', 'Type', 'Parent'],
        rows: [
          { row: 1, values: ['Lake Region', 'region', 'Kenya'] },
          // A new parent, not yet saved, is still a change.
          { row: 2, values: ['Coast Basin', 'region', 'Lake Region'] },
        ],
        mapping: { name: 'Name', type: 'Type', parent: 'Parent' },
      })
      await payload.delete({ collection: 'areas', id: loose.id, overrideAccess: true })
      expect(result.counts).toEqual({ create: 1, update: 1, skip: 0, failed: 0 })
    })

    it('previews the rules a save enforces, and names the failed row a child depends on', async () => {
      const result = await runImportPlan(payload, {
        target: 'areas',
        country,
        commit: false,
        headings: ['Name', 'Type', 'Parent'],
        rows: [
          { row: 1, values: ['President', 'region', 'Kenya'] },
          { row: 2, values: ['State House', 'ward', 'President'] },
          { row: 3, values: ['Search', 'region', 'Kenya'] },
          { row: 4, values: ['Another Kenya', 'country', ''] },
        ],
        mapping: { name: 'Name', type: 'Type', parent: 'Parent' },
      })
      expect(result.counts).toEqual({ create: 0, update: 0, skip: 0, failed: 4 })
      expect(result.errors.map((e) => e.message)).toEqual([
        '"president" is a national office\'s address in this country.',
        'Parent "president" on row 2 was not saved.',
        '"search" is used by the site\'s own addresses.',
        'This country already has an area for the whole country.',
      ])
    })

    it('applies the slug rules to imported rows, and saves nothing for a refused row', async () => {
      const result = await runImportPlan(payload, {
        target: 'areas',
        country,
        commit: true,
        headings: ['Name', 'Type', 'Name (fr)'],
        rows: [{ row: 1, values: ['President', 'region', 'Président'] }],
        mapping: { name: 'Name', type: 'Type', 'name:fr': 'Name (fr)' },
      })
      expect(result.counts).toEqual({ create: 0, update: 0, skip: 0, failed: 1 })
      expect(result.errors[0]?.line).toBe(2)
      expect(await areaId('president')).toBe('')
    })

    it('refuses a national office whose slug is an area, in the preview too', async () => {
      const result = await runImportPlan(payload, {
        target: 'offices',
        country,
        commit: false,
        headings: ['Name', 'Area type'],
        rows: [{ row: 1, values: ['Kibra', 'country'] }],
        mapping: { name: 'Name', areaType: 'Area type' },
      })
      expect(result.errors).toEqual([
        { line: 2, message: '"kibra" is an area\'s address in this country.' },
      ])
    })
  })

  describe('rules', () => {
    it('refuses a parent chain that loops', async () => {
      await expect(
        payload.update({
          collection: 'areas',
          id: await areaId('nairobi-county'),
          data: { parent: await areaId('kibra') },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('makes a slug from the name when none is given', async () => {
      const area = await payload.create({
        collection: 'areas',
        locale: 'en',
        data: {
          name: 'Lang’ata Ward',
          type: 'ward',
          parent: await areaId('langata'),
          country,
          page: 'automatic',
        },
        overrideAccess: true,
      })
      expect(area.slug).toBe('langata-ward')
      // Removed, so the tree tests below see only the fixture.
      await payload.delete({ collection: 'areas', id: area.id, overrideAccess: true })
    })

    it('keeps a GeoJSON outline with its source and licence, and refuses other files', async () => {
      const outline = Buffer.from(
        JSON.stringify({
          type: 'Polygon',
          coordinates: [
            [
              [36.7, -1.3],
              [36.8, -1.3],
              [36.8, -1.2],
              [36.7, -1.3],
            ],
          ],
        }),
      )
      const boundary = await payload.create({
        collection: 'boundaries',
        data: { source: 'Test data', licence: 'CC BY 4.0' },
        file: {
          data: outline,
          mimetype: 'application/geo+json',
          name: 'test-kibra.geojson',
          size: outline.length,
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'areas',
        id: await areaId('kibra'),
        data: { geo: { outline: boundary.id, latitude: -1.31, longitude: 36.78 } },
        overrideAccess: true,
      })
      boundaries.push(boundary.id)

      const notGeo = Buffer.from(JSON.stringify({ name: 'Kibra' }))
      await expect(
        payload.create({
          collection: 'boundaries',
          data: { source: 'Test data', licence: 'CC BY 4.0' },
          file: {
            data: notGeo,
            mimetype: 'application/json',
            name: 'test-not-geo.json',
            size: notGeo.length,
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow('not a GeoJSON outline')
    })

    it('refuses an area slug that is a site word or a national office', async () => {
      for (const slug of ['officials', 'president']) {
        await expect(
          payload.create({
            collection: 'areas',
            locale: 'en',
            data: { name: 'x', slug, type: 'region', country, page: 'automatic' },
            overrideAccess: true,
          }),
          slug,
        ).rejects.toThrow()
      }
    })

    it('refuses a national office whose slug is an area’s address', async () => {
      await expect(
        payload.create({
          collection: 'offices',
          locale: 'en',
          data: {
            name: 'Kibra office',
            slug: 'kibra',
            areaType: 'country',
            country,
            holdersPerSeat: 1,
            order: 9,
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow('area')
    })

    it('lets only a super-admin import areas', async () => {
      const editor = await payload.create({
        collection: 'users',
        data: {
          email: `editor-${crypto.randomUUID()}@example.org`,
          password: crypto.randomUUID(),
          roles: ['editor'],
        },
        overrideAccess: true,
      })
      users.push(editor.id)
      const data = file('kenya-areas.csv')
      await expect(
        payload.create({
          collection: 'imports',
          data: { country, recordType: 'areas' },
          file: { data, mimetype: 'text/csv', name: 'kenya-areas.csv', size: data.length },
          user: { ...editor, collection: 'users' },
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })
  })

  describe('the area tree (section 16.2)', () => {
    it('finds every area above and below an area in one query', async () => {
      const nairobi = await areaFamily(payload, await areaId('nairobi-county'))
      expect(nairobi.ancestors).toEqual([await areaId('kenya')])
      expect(nairobi.descendants).toHaveLength(17)
      const kibra = await areaFamily(payload, await areaId('kibra'))
      expect(kibra.ancestors).toEqual([await areaId('nairobi-county'), await areaId('kenya')])
      expect(kibra.descendants).toEqual([])
      expect((await areaFamily(payload, await areaId('kenya'))).descendants).toHaveLength(70)
    })
  })

  describe('the API (section 12)', () => {
    it('lists the offices, highest first, in the language asked for', async () => {
      const en = await sdk.getOffices('en', code)
      expect(en.items.map((o) => o.slug)).toEqual([
        'president',
        'governor',
        'senator',
        'woman-representative',
        'mp',
      ])
      const fr = await sdk.getOffices('fr', code)
      expect(fr.items[0]).toMatchObject({
        name: 'Président',
        areaType: 'country',
        holdersPerSeat: 1,
      })
    })

    it('lists areas one level at a time', async () => {
      expect((await sdk.getAreas('en', code)).items.map((a) => a.slug)).toEqual(['kenya'])
      expect((await sdk.getAreas('en', code, 'kenya')).total).toBe(47)
      expect((await sdk.getAreas('en', code, 'mombasa-county')).items.map((a) => a.name)).toEqual([
        'Changamwe',
        'Jomvu',
        'Kisauni',
        'Likoni',
        'Mvita',
        'Nyali',
      ])
    })

    it('returns a county with its seats, and a page of its own', async () => {
      const area = await sdk.getArea('en', code, 'nairobi-county')
      expect(area).toMatchObject({
        name: 'Nairobi County',
        type: 'county',
        hasPage: true,
        children: 17,
        ancestors: [{ slug: 'kenya', name: 'Kenya', type: 'country' }],
      })
      expect('seats' in area && area.seats.map((s) => s.office.slug)).toEqual([
        'governor',
        'senator',
        'woman-representative',
      ])
    })

    it('gives a constituency with one seat no page, as "automatic" says', async () => {
      const area = await sdk.getArea('en', code, 'kibra')
      expect(area).toMatchObject({ hasPage: false, seats: [{ office: { slug: 'mp' } }] })
      expect('ancestors' in area && area.ancestors.map((a) => a.slug)).toEqual([
        'kenya',
        'nairobi-county',
      ])
    })

    it('says an area without a French name is not available in French', async () => {
      await expect(sdk.getArea('fr', code, 'kibra')).resolves.toMatchObject({
        error: 'not-available',
        availableIn: [{ code: 'en' }],
      })
    })
  })

  describe('the import steps in the admin (section 9.6)', () => {
    let importId: string

    it('reads an uploaded file and guesses the mapping', async () => {
      const data = file('kenya-offices.csv')
      const doc = await payload.create({
        collection: 'imports',
        data: { country, recordType: 'offices' },
        file: { data, mimetype: 'text/csv', name: 'kenya-offices.csv', size: data.length },
        overrideAccess: true,
      })
      importId = doc.id
      expect(doc.status).toBe('mapping')
      expect(doc.headings).toContain('Area type')
      expect(doc.mapping?.map((m) => m.field)).toEqual(
        expect.arrayContaining(['name', 'areaType', 'name:fr']),
      )
    })

    it('previews, then imports in a background job, and saves the mapping', async () => {
      const preview = await payload.update({
        collection: 'imports',
        id: importId,
        data: { nextStep: 'preview', saveMappingAs: 'test-kenya-offices' },
        overrideAccess: true,
      })
      expect(preview).toMatchObject({
        status: 'previewed',
        preview: { create: 0, update: 0, skip: 5, failed: 0 },
      })

      await payload.update({
        collection: 'imports',
        id: importId,
        data: { nextStep: 'import' },
        overrideAccess: true,
      })
      const done = await payload.findByID({
        collection: 'imports',
        id: importId,
        overrideAccess: true,
      })
      expect(done).toMatchObject({ status: 'done', result: { skip: 5, failed: 0 } })

      const saved = await payload.find({
        collection: 'import-mappings',
        where: { name: { equals: 'test-kenya-offices' } },
        overrideAccess: true,
      })
      expect(saved.docs[0]?.columns).toMatchObject({ name: 'Name', areaType: 'Area type' })
    })
  })
})
