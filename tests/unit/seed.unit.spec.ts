import { guessMapping, planRow, slugify } from '@promisetracker/plugin-core'
import { describe, expect, it } from 'vitest'

import { readSeed, readTopics, SEED_COUNTRIES, SEED_ORDER, seedSlugs } from '../../seed/seed'

/**
 * The seed data (seed/README.md) is checked here without a database: every
 * row reads cleanly, and every record a term names is in the seed too.
 */
describe.each(SEED_COUNTRIES)('seed data for %s', (code) => {
  const plans = (target: (typeof SEED_ORDER)[number]) => {
    const { headings, rows } = readSeed(code, target)
    const mapping = guessMapping(target, headings)
    return rows.map((row) => planRow(target, headings, mapping, row.values, row.row + 1))
  }

  it.each(SEED_ORDER)('has %s rows with no problems', (target) => {
    const rows = plans(target)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.flatMap((row) => row.errors.map((e) => `row ${row.line}: ${e}`))).toEqual([])
  })

  it.each(['actors', 'areas', 'offices'] as const)(
    'gives every one of its %s its own slug',
    (target) => {
      const slugs = seedSlugs(code, target)
      expect(slugs.filter((slug, i) => slugs.indexOf(slug) !== i)).toEqual([])
    },
  )

  it('names, in each term, only actors, offices and areas it seeds', () => {
    const known = (target: 'actors' | 'offices' | 'areas') =>
      new Set(
        plans(target).flatMap((row) => {
          const name = typeof row.data.name === 'string' ? slugify(row.data.name) : ''
          return [row.slug, name]
        }),
      )
    const actors = known('actors')
    const offices = known('offices')
    const areas = known('areas')
    const missing = plans('terms').flatMap((term) =>
      Object.entries(term.refs).flatMap(([key, slug]) => {
        const pool = key === 'office' ? offices : key === 'area' ? areas : actors
        return pool.has(slug) ? [] : [`row ${term.line}: ${key} "${slug}"`]
      }),
    )
    expect(missing).toEqual([])
  })

  it('names, in each claim, only actors, areas and topics it seeds', () => {
    const actors = new Set(
      plans('actors').flatMap((row) => [row.slug, slugify(String(row.data.name))]),
    )
    const areas = new Set(
      plans('areas').flatMap((row) => [row.slug, slugify(String(row.data.name))]),
    )
    const topics = new Set(readTopics().map((topic) => slugify(topic.name.en ?? '')))
    const missing = plans('claims').flatMap((claim) =>
      Object.entries(claim.refs).flatMap(([key, slug]) => {
        if (key === 'type') return slug === 'promise' ? [] : [`row ${claim.line}: type "${slug}"`]
        const pool = key === 'topic' ? topics : key === 'area' ? areas : actors
        return pool.has(slug) ? [] : [`row ${claim.line}: ${key} "${slug}"`]
      }),
    )
    expect(missing).toEqual([])
  })

  it('has one area for the whole country, and every other area inside one it seeds', () => {
    const areas = plans('areas')
    expect(areas.filter((area) => area.data.type === 'country')).toHaveLength(1)
    const known = new Set(areas.map((area) => area.slug))
    for (const area of areas) if (area.parent) expect(known, area.slug).toContain(area.parent)
  })
})

describe('shared seed topics', () => {
  it('nest one level, under topics the seed has', () => {
    const topics = readTopics()
    const names = new Set(topics.map((topic) => topic.name.en))
    for (const topic of topics) {
      if (!topic.parent) continue
      expect(names, topic.name.en).toContain(topic.parent)
      expect(topics.find((t) => t.name.en === topic.parent)?.parent, topic.name.en).toBe('')
    }
  })
})
