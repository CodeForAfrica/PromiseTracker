import type { ImportRow } from '@promisetracker/kernel'
import type { Payload, PayloadRequest, TypedLocale } from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'

import { DEFAULT_LOCALE } from '../locales'
import { SLUG_PATTERN, slugify, slugProblem } from '../slugs'
import type { ImportTarget, PlannedRow } from './targets'
import { existingBySlug, localizedKeys, planRow } from './targets'

/** A problem with one row, by its row number in the spreadsheet, headings being row 1. */
export type RowError = { line: number; message: string }

export type ImportCounts = { create: number; update: number; skip: number; failed: number }

export type ImportResult = { counts: ImportCounts; errors: RowError[] }

type Input = {
  target: ImportTarget
  country: string
  headings: readonly string[]
  rows: readonly ImportRow[]
  mapping: Readonly<Record<string, string>>
  /** False for a preview, which saves nothing. */
  commit: boolean
  /**
   * Values a record the import creates starts with, such as a status. They
   * save with the record, in the same transaction. A record that exists
   * keeps its own.
   */
  onCreate?: Readonly<Record<string, unknown>>
}

/** How many row errors an import keeps. The count covers them all. */
const MAX_ERRORS = 500

/** Errors by row, and the counts, for one run. */
function tally() {
  const counts: ImportCounts = { create: 0, update: 0, skip: 0, failed: 0 }
  const errors: RowError[] = []
  return {
    counts,
    errors,
    fail(line: number, message: string) {
      counts.failed += 1
      if (errors.length < MAX_ERRORS) errors.push({ line, message })
    },
  }
}

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const id: unknown = Reflect.get(value, 'id')
    return typeof id === 'string' ? id : null
  }
  return null
}

const inLocale = (value: unknown, locale: string): unknown =>
  value && typeof value === 'object' ? Reflect.get(value, locale) : value

/** Whether a row would change nothing on the record it matches. */
/** Import columns that fill a field inside a group, by the group's name. */
const GROUPED: Readonly<Record<string, string>> = {
  verdict: 'verification',
  rationale: 'verification',
}

/** A row's values, with grouped columns moved into their group. */
function nest(values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    const group = GROUPED[key]
    if (group) out[group] = { ...(out[group] as Record<string, unknown> | undefined), [key]: value }
    else out[key] = value
  }
  return out
}

/** A stored value for an import column, looking inside its group. */
const storedValue = (record: Record<string, unknown>, key: string): unknown => {
  const group = GROUPED[key]
  if (!group) return record[key]
  const values: unknown = record[group]
  return values && typeof values === 'object' ? Reflect.get(values, key) : undefined
}

function unchanged(
  current: Record<string, unknown>,
  plan: PlannedRow,
  parentId: string | null,
  localized: ReadonlySet<string>,
): boolean {
  for (const [key, value] of Object.entries(plan.data)) {
    const stored = storedValue(current, key)
    const before = localized.has(key) ? inLocale(stored, DEFAULT_LOCALE) : stored
    if (before !== value) return false
  }
  for (const [locale, values] of Object.entries(plan.translations)) {
    for (const [key, value] of Object.entries(values ?? {})) {
      if (inLocale(storedValue(current, key), locale) !== value) return false
    }
  }
  return plan.parent === null || idOf(current.parent) === parentId
}

const isNational = (areaType: unknown): boolean => !areaType || areaType === 'country'

/**
 * The slug and whole-country rules a save enforces in the collection hooks
 * (sections 7.2 and 11.2). A preview saves nothing, so it runs no hooks: the
 * import checks them here too, so a preview refuses what the import would.
 * The messages match the hooks'.
 */
function ruleProblems(
  target: ImportTarget,
  plan: PlannedRow,
  others: ReadonlyMap<string, Record<string, unknown>>,
  wholeCountry: string | null,
): string[] {
  if (!plan.slug) return []
  if (target === 'actors' || target === 'claims') {
    return SLUG_PATTERN.test(plan.slug)
      ? []
      : ['Use lower-case letters, digits and single hyphens in the slug, such as achieng-wekesa.']
  }
  const problem = slugProblem(plan.slug)
  if (problem) return [problem]
  if (target === 'offices') {
    return isNational(plan.data.areaType) && others.has(plan.slug)
      ? [`"${plan.slug}" is an area's address in this country.`]
      : []
  }
  const problems: string[] = []
  const office = others.get(plan.slug)
  if (office && isNational(office.areaType)) {
    problems.push(`"${plan.slug}" is a national office's address in this country.`)
  }
  if (plan.data.type === 'country') {
    if (plan.parent) problems.push('The area for the whole country has no parent.')
    if (wholeCountry && wholeCountry !== plan.slug) {
      problems.push('This country already has an area for the whole country.')
    }
  }
  return problems
}

/**
 * Saves one row: its record in the default language, then its translations.
 * They save together or not at all, so a failed row leaves nothing
 * half-written. Returns the record's id.
 */
async function saveRow(
  payload: Payload,
  target: ImportTarget,
  id: string | null,
  data: Record<string, unknown>,
  plan: PlannedRow,
): Promise<string> {
  const req: Partial<PayloadRequest> & { payload: Payload } = { payload }
  await initTransaction(req)
  try {
    // The record's shape is checked by the collection's fields and hooks.
    // This plugin is built without the app's generated types, so the local
    // API cannot check it here.
    const record = id
      ? await payload.update({
          collection: target,
          id,
          locale: DEFAULT_LOCALE,
          data: nest(data) as never,
          overrideAccess: true,
          req,
        })
      : await payload.create({
          collection: target,
          locale: DEFAULT_LOCALE,
          data: nest(data) as never,
          overrideAccess: true,
          req,
        })
    const saved = idOf(record.id)
    if (!saved) throw new Error('The record was saved without an id.')
    for (const [locale, values] of Object.entries(plan.translations)) {
      await payload.update({
        collection: target,
        id: saved,
        // planRow takes languages only from the registered list.
        locale: locale as TypedLocale,
        data: nest(values) as never,
        overrideAccess: true,
        req,
      })
    }
    await commitTransaction(req)
    return saved
  } catch (error) {
    // The row's own error is the one to report, even if the rollback fails too.
    await killTransaction(req).catch(() => undefined)
    throw error
  }
}

/**
 * Runs an import, or previews it (section 9.6). Each row matches a record by
 * country and slug, so importing the same file twice updates rather than
 * duplicates. Areas must come after their parents in the file.
 *
 * It writes as the system: the person running the import was checked when
 * they asked for it.
 */
export async function runImportPlan(payload: Payload, input: Input): Promise<ImportResult> {
  if (input.target === 'terms') return runTermsPlan(payload, input)
  const existing = await existingBySlug(payload, input.target, input.country)
  // The other collection, whose slugs share a country's addresses. Actors
  // have addresses of their own, under /e/.
  const others =
    input.target === 'actors' || input.target === 'claims'
      ? new Map<string, Record<string, unknown>>()
      : await existingBySlug(payload, input.target === 'areas' ? 'offices' : 'areas', input.country)
  // The records a claim names: actors and areas in its country, topics and claim types everywhere.
  const named = input.target === 'claims' ? await claimLookups(payload, input.country) : null
  const root = [...existing.values()].find((record) => record.type === 'country')
  let wholeCountry = root ? String(root.slug) : null
  const localized = localizedKeys(input.target)
  // Slugs seen earlier in this file, with the record's id. A preview saves
  // nothing, so a record it would create gets a placeholder that matches no
  // stored id: a row moved under it then counts as an update, as in the import.
  const seen = new Map<string, string>()
  // Slugs of rows that failed, with their spreadsheet row, for their children's errors.
  const failedAt = new Map<string, number>()
  const { counts, errors, fail: failRow } = tally()
  const fail = (line: number, message: string, slug: string) => {
    if (slug && !failedAt.has(slug)) failedAt.set(slug, line)
    failRow(line, message)
  }

  for (const { row, values } of input.rows) {
    const line = row + 1
    const plan = planRow(input.target, input.headings, input.mapping, values, line)
    if (plan.slug && seen.has(plan.slug))
      plan.errors.push(`"${plan.slug}" appears earlier in the file.`)

    let parentId: string | null = null
    if (plan.parent) {
      const parentInDb = existing.get(plan.parent)
      if (parentInDb) parentId = idOf(parentInDb.id)
      else if (seen.has(plan.parent)) parentId = seen.get(plan.parent) ?? null
      else if (failedAt.has(plan.parent)) {
        plan.errors.push(
          `Parent "${plan.parent}" on row ${failedAt.get(plan.parent)} was not saved.`,
        )
      } else {
        plan.errors.push(
          `Parent "${plan.parent}" is not in this country. If it is in this file, put it above this row.`,
        )
      }
    }
    if (named) resolveClaimRefs(plan, named)
    plan.errors.push(...ruleProblems(input.target, plan, others, wholeCountry))
    if (plan.errors.length > 0) {
      fail(line, plan.errors.join(' '), plan.slug)
      continue
    }

    const current = existing.get(plan.slug)
    if (current && unchanged(current, plan, parentId, localized)) {
      counts.skip += 1
      seen.set(plan.slug, String(current.id))
      if (plan.data.type === 'country') wholeCountry = plan.slug
      continue
    }
    if (!input.commit) {
      counts[current ? 'update' : 'create'] += 1
      seen.set(plan.slug, current ? String(current.id) : `new:${plan.slug}`)
      if (plan.data.type === 'country') wholeCountry = plan.slug
      continue
    }

    const data = {
      ...plan.data,
      slug: plan.slug,
      country: input.country,
      ...(plan.parent ? { parent: parentId } : {}),
      ...(current ? {} : input.onCreate),
    }
    try {
      const id = await saveRow(
        payload,
        input.target,
        current ? String(current.id) : null,
        data,
        plan,
      )
      counts[current ? 'update' : 'create'] += 1
      seen.set(plan.slug, id)
      if (plan.data.type === 'country') wholeCountry = plan.slug
    } catch (error) {
      fail(line, error instanceof Error ? error.message : String(error), plan.slug)
    }
  }
  return { counts, errors }
}

/**
 * Records by slug, and also by their name made into a slug, so a cell can
 * name a record either way: "mp" or "Member of Parliament". A slug wins.
 */
function withNames(
  records: ReadonlyMap<string, Record<string, unknown>>,
): Map<string, Record<string, unknown>> {
  const all = new Map<string, Record<string, unknown>>()
  for (const record of records.values()) {
    const name = inLocale(record.name, DEFAULT_LOCALE)
    if (typeof name === 'string' && name) all.set(slugify(name), record)
  }
  for (const [slug, record] of records) all.set(slug, record)
  return all
}

type Lookup = ReadonlyMap<string, Record<string, unknown>>
type ClaimLookups = { actor: Lookup; area: Lookup; topic: Lookup; type: Lookup }

/** Every record of a type, by slug and by name, for those not kept per country. */
async function everywhereBySlug(
  payload: Payload,
  collection: 'topics' | 'claim-types',
): Promise<Map<string, Record<string, unknown>>> {
  const { docs } = await payload.find({
    collection,
    locale: 'all',
    depth: 0,
    pagination: false,
    // An import names topics and claim types, after the person running it was checked.
    overrideAccess: true,
  })
  return withNames(
    new Map(docs.map((doc) => [String(doc.slug), { ...doc } as Record<string, unknown>])),
  )
}

async function claimLookups(payload: Payload, country: string): Promise<ClaimLookups> {
  const [actor, area, topic, type] = await Promise.all([
    existingBySlug(payload, 'actors', country).then(withNames),
    existingBySlug(payload, 'areas', country).then(withNames),
    everywhereBySlug(payload, 'topics'),
    everywhereBySlug(payload, 'claim-types'),
  ])
  return { actor, area, topic, type }
}

/**
 * Turns the actor, topic, claim type and area a claim row names into ids.
 * One that names nothing known is a row error, so the row is not saved.
 */
function resolveClaimRefs(plan: PlannedRow, named: ClaimLookups): void {
  const hints: Record<keyof ClaimLookups, string> = {
    actor: 'is not an actor in this country. Import the actors first.',
    area: 'is not an area in this country.',
    topic: 'is not a topic. Add it under Claims > Topics first.',
    type: 'is not a claim type.',
  }
  for (const key of ['actor', 'area', 'topic', 'type'] as const) {
    const slug = plan.refs[key]
    if (!slug) continue
    const found = named[key].get(slug)
    if (found) plan.data[key] = idOf(found.id)
    else plan.errors.push(`${key[0]?.toUpperCase()}${key.slice(1)} "${slug}" ${hints[key]}`)
  }
}

const dateOf = (value: unknown): string => (typeof value === 'string' ? value.slice(0, 10) : '')

/** A term's natural key: its actor, office, area and start date. */
const termKey = (actor: unknown, office: unknown, area: unknown, startsOn: unknown): string =>
  [idOf(actor) ?? '', idOf(office) ?? '', idOf(area) ?? '', dateOf(startsOn)].join('|')

/**
 * Imports terms (section 9.6). A term has no slug: each row matches a term by
 * its actor, office, area and start date. The actors, offices and areas it
 * names must exist already, so import those first. Checks the rules the
 * term's hooks enforce, so a preview refuses what the import would.
 */
async function runTermsPlan(payload: Payload, input: Input): Promise<ImportResult> {
  const [actors, offices, areas] = await Promise.all([
    existingBySlug(payload, 'actors', input.country).then(withNames),
    existingBySlug(payload, 'offices', input.country).then(withNames),
    existingBySlug(payload, 'areas', input.country).then(withNames),
  ])
  const { docs } = await payload.find({
    collection: 'terms',
    where: { country: { equals: input.country } },
    locale: 'all',
    depth: 0,
    pagination: false,
    // An import reads the terms it may update, after the person running it was checked.
    overrideAccess: true,
  })
  const existing = new Map(
    docs.map((doc) => [
      termKey(doc.actor, doc.office, doc.area, doc.startsOn),
      { ...doc } as Record<string, unknown>,
    ]),
  )
  const localized = localizedKeys('terms')
  const seen = new Set<string>()
  const { counts, errors, fail } = tally()

  for (const { row, values } of input.rows) {
    const line = row + 1
    const plan = planRow('terms', input.headings, input.mapping, values, line)
    const find = (
      records: ReadonlyMap<string, Record<string, unknown>>,
      key: string,
      what: string,
      hint: string,
    ) => {
      const slug = plan.refs[key]
      if (!slug) return null
      const found = records.get(slug)
      if (!found) plan.errors.push(`${what} "${slug}" is not in this country. ${hint}`)
      return found ?? null
    }
    const actor = find(actors, 'actor', 'Actor', 'Import the actors first.')
    const office = find(offices, 'office', 'Office', 'Add it under Places first.')
    const area = find(areas, 'area', 'Area', 'Add it under Places first.')
    const party = find(actors, 'party', 'Party', 'Import it as an actor of kind party first.')
    const successor = find(actors, 'successor', 'Successor', 'Import the actors first.')
    if (office) {
      const needsArea = Boolean(office.areaType) && office.areaType !== 'country'
      if (needsArea && !plan.refs.area) {
        plan.errors.push(`Area is empty, and ${String(office.name ?? 'this office')} needs one.`)
      }
      if (!needsArea && plan.refs.area) {
        plan.errors.push('This office answers for the whole country, so leave the area empty.')
      }
      if (area && needsArea && area.type !== office.areaType) {
        plan.errors.push(`This office answers for a ${String(office.areaType)}.`)
      }
    }
    if (party && party.kind !== 'party') plan.errors.push('The party must be a party.')
    if (successor && actor && successor.id === actor.id) {
      plan.errors.push('An actor cannot succeed themselves.')
    }
    const { startsOn, endsOn } = plan.data
    if (typeof startsOn === 'string' && typeof endsOn === 'string' && endsOn < startsOn) {
      plan.errors.push('The term must end after it starts.')
    }
    const key = termKey(actor?.id, office?.id, area?.id, startsOn)
    if (plan.errors.length === 0 && seen.has(key)) {
      plan.errors.push('The same term appears earlier in the file.')
    }
    if (plan.errors.length > 0) {
      fail(line, plan.errors.join(' '))
      continue
    }
    seen.add(key)

    const refs = {
      actor: idOf(actor?.id),
      office: idOf(office?.id),
      area: idOf(area?.id),
      party: idOf(party?.id),
      successor: idOf(successor?.id),
    }
    const data: Record<string, unknown> = { ...plan.data }
    for (const [name, id] of Object.entries(refs)) {
      if (plan.refs[name]) data[name] = id
    }
    const current = existing.get(key)
    if (current && termUnchanged(current, data, plan, localized)) {
      counts.skip += 1
      continue
    }
    if (!input.commit) {
      counts[current ? 'update' : 'create'] += 1
      continue
    }
    try {
      const values = current ? data : { ...data, ...input.onCreate }
      await saveRow(payload, 'terms', current ? String(current.id) : null, values, plan)
      counts[current ? 'update' : 'create'] += 1
    } catch (error) {
      fail(line, error instanceof Error ? error.message : String(error))
    }
  }
  return { counts, errors }
}

/** Whether a term row would change nothing. Dates compare by day. */
function termUnchanged(
  current: Record<string, unknown>,
  data: Record<string, unknown>,
  plan: PlannedRow,
  localized: ReadonlySet<string>,
): boolean {
  for (const [key, value] of Object.entries(data)) {
    const before = localized.has(key) ? inLocale(current[key], DEFAULT_LOCALE) : current[key]
    const same =
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
        ? dateOf(before) === dateOf(value)
        : (idOf(before) ?? before) === value
    if (!same) return false
  }
  for (const [locale, values] of Object.entries(plan.translations)) {
    for (const [key, value] of Object.entries(values ?? {})) {
      if (inLocale(current[key], locale) !== value) return false
    }
  }
  return true
}
