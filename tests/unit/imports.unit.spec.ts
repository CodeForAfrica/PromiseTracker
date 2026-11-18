import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { ImportRow, SourceContent } from '@promisetracker/kernel'
import {
  csvImporter,
  guessMapping,
  MAX_IMPORT_BYTES,
  planRow,
  slugify,
  slugProblem,
  xlsxImporter,
} from '@promisetracker/plugin-core'
import { describe, expect, it } from 'vitest'

const fixture = (name: string, mimeType: string): SourceContent => ({
  filename: name,
  mimeType,
  data: new Uint8Array(readFileSync(path.resolve(import.meta.dirname, '../fixtures', name))),
})
const CSV = 'text/csv'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ctx = {} as never

async function allRows(importer: typeof csvImporter, content: SourceContent): Promise<ImportRow[]> {
  const rows: ImportRow[] = []
  for await (const row of importer.rows(content, ctx)) rows.push(row)
  return rows
}

describe('reading spreadsheets (section 9.6)', () => {
  it('reads the same offices from CSV and from Excel', async () => {
    const csv = fixture('kenya-offices.csv', CSV)
    const xlsx = fixture('kenya-offices.xlsx', XLSX)
    const [a, b] = await Promise.all([
      csvImporter.inspect(csv, ctx),
      xlsxImporter.inspect(xlsx, ctx),
    ])
    expect(b.headings).toEqual(a.headings)
    expect(a.headings).toEqual([
      'Name',
      'Short name',
      'Slug',
      'Area type',
      'Holders per seat',
      'Order',
      'Name (fr)',
      'Short name (fr)',
    ])
    expect(await allRows(xlsxImporter, xlsx)).toEqual(await allRows(csvImporter, csv))
  })

  it('numbers rows from 1 after the headings, and shows a sample', async () => {
    const areas = fixture('kenya-areas.csv', CSV)
    const rows = await allRows(csvImporter, areas)
    expect(rows).toHaveLength(71)
    expect(rows[0]).toEqual({ row: 1, values: ['Kenya', 'country', '', 'KE'] })
    expect((await csvImporter.inspect(areas, ctx)).sampleRows).toHaveLength(5)
  })

  it('skips empty rows, keeps accents, and ignores a byte-order mark', async () => {
    const text = '﻿Name,Type\n\nSénégal,country\n,\n'
    const content = { filename: 'a.csv', mimeType: CSV, data: new TextEncoder().encode(text) }
    expect((await csvImporter.inspect(content, ctx)).headings).toEqual(['Name', 'Type'])
    expect(await allRows(csvImporter, content)).toEqual([
      { row: 2, values: ['Sénégal', 'country'] },
    ])
  })

  it('refuses a file over the size limit', async () => {
    const big = { filename: 'a.csv', mimeType: CSV, data: new Uint8Array(MAX_IMPORT_BYTES + 1) }
    await expect(csvImporter.inspect(big, ctx)).rejects.toThrow('larger than')
  })
})

describe('mapping columns to fields', () => {
  it('guesses the mapping from headings named like the fields', () => {
    expect(
      guessMapping('offices', [
        'Name',
        'Short name',
        'Area type',
        'Name (fr)',
        'Holders per seat',
        'Notes',
      ]),
    ).toEqual({
      name: 'Name',
      shortName: 'Short name',
      areaType: 'Area type',
      'name:fr': 'Name (fr)',
      holdersPerSeat: 'Holders per seat',
    })
    expect(guessMapping('areas', ['Name', 'Type', 'Parent', 'Code'])).toEqual({
      name: 'Name',
      type: 'Type',
      parent: 'Parent',
      externalCode: 'Code',
    })
  })
})

describe('checking a row', () => {
  const headings = ['Name', 'Type', 'Parent', 'Name (fr)']
  const mapping = { name: 'Name', type: 'Type', parent: 'Parent', 'name:fr': 'Name (fr)' }

  it('turns a row into a record, with its slug and translations', () => {
    expect(
      planRow(
        'areas',
        headings,
        mapping,
        ['Murang’a County', 'County', 'Kenya', 'Comté de Murang’a'],
        4,
      ),
    ).toEqual({
      line: 4,
      slug: 'muranga-county',
      data: { name: 'Murang’a County', type: 'county' },
      translations: { fr: { name: 'Comté de Murang’a' } },
      parent: 'kenya',
      errors: [],
    })
  })

  it('says what is wrong with a row', () => {
    expect(planRow('areas', headings, mapping, ['', 'province', '', ''], 2).errors).toEqual([
      'Name is empty.',
      'Type "province" is not one of country, region, county, constituency, ward, city, other.',
    ])
    const office = planRow(
      'offices',
      ['Name', 'Order'],
      { name: 'Name', order: 'Order' },
      ['MP', 'first'],
      3,
    )
    expect(office.errors).toEqual(['Order "first" is not a whole number.'])
  })
})

describe('slugs in addresses (section 11.2)', () => {
  it('are made from names', () => {
    expect(slugify('Lang’ata')).toBe('langata')
    expect(slugify('Taita-Taveta County')).toBe('taita-taveta-county')
    expect(slugify('Thiès  Région')).toBe('thies-region')
  })

  it('cannot be one of the site’s own words, or badly formed', () => {
    for (const word of ['officials', 'e', 'p', 'a', 'search', 'opengraph-image']) {
      expect(slugProblem(word), word).toContain('site')
    }
    expect(slugProblem('Nairobi County')).toContain('lower-case')
    expect(slugProblem('nairobi-county')).toBeNull()
  })
})
