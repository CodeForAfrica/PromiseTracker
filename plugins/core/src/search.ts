import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { searchPlugin } from '@payloadcms/plugin-search'
import type { BeforeSync, SearchPluginConfig } from '@payloadcms/plugin-search/types'
import type { SearchProvider, SearchResultKind, SearchResults } from '@promisetracker/kernel'
import type {
  CollectionAfterChangeHook,
  CollectionConfig,
  CollectionSlug,
  Config,
  Field,
  Payload,
  PayloadRequest,
  Plugin,
} from 'payload'
import { definePlugin } from 'payload'

import type { Rule } from './access'
import { can } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { afterCommit } from './afterCommit'
import { hasRole } from './roles'

/**
 * Search (section 7.11, D44), on Payload's search plugin. The plugin keeps a
 * `search` collection with one entry per record and a title in each
 * language. The publishing rules decide which languages: a record is in the
 * index in a language only while it is published in that language.
 *
 * The plugin syncs the language being saved, and a skipped language keeps
 * whatever title it had. A save can change where a record is live in every
 * language, and the cascade changes records without a save. So every change
 * also reconciles the record's entry in every language, once it commits.
 */

export const SEARCH_SLUG = 'search'
export const SEARCH_LOG_SLUG = 'search-log'

/** The record types in the index, and what each is in a result. */
export const SEARCHED = {
  areas: 'area',
  actors: 'actor',
  claims: 'claim',
  topics: 'topic',
} as const satisfies Record<string, SearchResultKind>

type Searched = keyof typeof SEARCHED

const isSearched = (slug: string): slug is Searched => Object.hasOwn(SEARCHED, slug)

/** Higher first: a place search lists the place and who represents it before claims. */
export const SEARCH_PRIORITY: Record<Searched, number> = {
  areas: 30,
  actors: 20,
  claims: 10,
  topics: 5,
}

type Doc = Record<string, unknown>

const asRecord = (value: unknown): Doc => (value && typeof value === 'object' ? (value as Doc) : {})

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  const id = asRecord(value).id
  return typeof id === 'string' ? id : null
}

/** A field's text in one language, from a record read in that language or in all of them. */
const textIn = (value: unknown, locale: string): string | null => {
  const text = typeof value === 'string' ? value : asRecord(value)[locale]
  return typeof text === 'string' && text.trim() ? text.trim() : null
}

/**
 * Whether a record is live in a language: from its computed published status
 * (section 8.1), or for a topic, which has no publishing rules, from having a
 * name in that language, as the API's topics do.
 */
export const liveIn = (collection: string, doc: unknown, locale: string | undefined): boolean => {
  const record = asRecord(doc)
  if (!locale || record.deletedAt) return false
  if (collection === 'topics') return textIn(record.name, locale) !== null
  const published = record.publishedIn
  return Array.isArray(published) && published.includes(locale)
}

type Entry = { title: string; kind: SearchResultKind; country: string | null; url: string }

async function countryCode(
  payload: Payload,
  id: string | null,
  req?: Partial<PayloadRequest>,
): Promise<string | null> {
  if (!id) return null
  const { docs } = await payload.find({
    collection: 'countries',
    where: { id: { equals: id } },
    select: { code: true },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the country's code only, for the entry's address.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
  const code = docs[0]?.code
  return typeof code === 'string' ? code : null
}

/**
 * What the index keeps for a record in one language: its title, the kind of
 * record, its country's code and its address without the language, so a
 * result needs no second query. Null when it has no title in that language.
 */
export async function entryOf(
  payload: Payload,
  collection: string,
  doc: Doc,
  locale: string,
  req?: Partial<PayloadRequest>,
): Promise<Entry | null> {
  if (!isSearched(collection)) return null
  const slug = typeof doc.slug === 'string' ? doc.slug : null
  const title = textIn(collection === 'claims' ? doc.title : doc.name, locale)
  if (!slug || !title) return null
  const kind = SEARCHED[collection]
  if (collection === 'topics') return { title, kind, country: null, url: `/topics/${slug}` }
  const country = await countryCode(payload, idOf(doc.country), req)
  if (!country) return null
  const path = { areas: '', actors: '/e', claims: '/p' }[collection]
  return { title, kind, country, url: `/${country}${path}/${slug}` }
}

/** The plugin indexes a record in a language only where it is live. */
export const skipSync: NonNullable<SearchPluginConfig['skipSync']> = ({
  collectionSlug,
  doc,
  locale,
}) => !liveIn(collectionSlug, doc, locale ?? undefined)

export const beforeSync: BeforeSync = async ({
  collectionSlug,
  originalDoc,
  payload,
  req,
  searchDoc,
}) => {
  // The plugin reads the record in the language it syncs, so its fields are
  // that language's text already. A reindex syncs every language with the
  // admin's request, whose own language may be another.
  const entry = await entryOf(payload, collectionSlug, originalDoc, String(req.locale ?? ''), req)
  return entry ? { ...searchDoc, ...entry } : searchDoc
}

const ENTRY_FIELDS: Field[] = [
  {
    name: 'kind',
    type: 'select',
    options: Object.values(SEARCHED),
    index: true,
    admin: { readOnly: true, position: 'sidebar' },
  },
  {
    name: 'country',
    type: 'text',
    index: true,
    admin: { readOnly: true, position: 'sidebar', description: "The country's code." },
  },
  {
    name: 'url',
    type: 'text',
    admin: {
      readOnly: true,
      position: 'sidebar',
      description: 'The address on the public site, without the language.',
    },
  },
]

/**
 * Who may read the search log: the editors the dashboard widget is for
 * (section 16.4). People type names and numbers into search boxes, so the log
 * is closed to everyone else.
 */
export const readSearchLog: Rule = ({ req }) => hasRole(req.user, 'super-admin', 'editor')

/** Searches as they came in, for the measure in section 18. Nothing about the person. */
export const SearchLog: CollectionConfig = {
  slug: SEARCH_LOG_SLUG,
  labels: { singular: 'Search', plural: 'Search log' },
  admin: {
    group: ADMIN_GROUPS.administration,
    useAsTitle: 'query',
    defaultColumns: ['query', 'locale', 'country', 'results', 'createdAt'],
    description:
      'Every search on the public site: the words, the language, the country and how many ' +
      'results it found. Nothing about who searched.',
  },
  access: {
    read: readSearchLog,
    // Only the API writes it. Kept for 12 months (section 15).
    create: () => false,
    update: () => false,
    delete: can.manageUsers,
  },
  // A log, not a record anyone edits.
  versions: false,
  authorship: false,
  fields: [
    { name: 'query', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'locale', type: 'text', required: true, index: true, admin: { readOnly: true } },
    { name: 'country', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'results', type: 'number', required: true, index: true, admin: { readOnly: true } },
  ],
}

/** The longest search kept, in characters. Longer text is cut, not refused. */
export const MAX_QUERY = 100

/** Logs a search. It runs as the system: guests search, and only the system writes the log. */
export async function logSearch(
  payload: Payload,
  search: { query: string; locale: string; country: string | null; results: number },
): Promise<void> {
  await payload.create({
    collection: SEARCH_LOG_SLUG as CollectionSlug,
    data: { ...search, query: search.query.slice(0, MAX_QUERY) },
    overrideAccess: true,
  })
}

// Keeping the index current.

type IndexRecord = (payload: Payload, record: { collection: string; id: string }) => Promise<void>

let indexer: IndexRecord = (payload, record) => indexRecord(payload, record)

/** Sets how a change reaches the index: through the search port's adapter. */
export function setSearchIndexer(next: IndexRecord): void {
  indexer = next
}

/**
 * Brings a record's entry up to date once the change commits. Before, the
 * index would read the record on another connection and miss the change.
 */
export function indexLater(
  req: { payload: Payload; transactionID?: PayloadRequest['transactionID'] | undefined },
  record: { collection: string; id: string },
): Promise<void> {
  if (!isSearched(record.collection)) return Promise.resolve()
  return afterCommit(req as PayloadRequest, () => indexer(req.payload, record))
}

type SearchDoc = { id: string; title?: unknown; kind?: unknown; country?: unknown; url?: unknown }

/**
 * Makes a record's entry match where it is live: a title in each language it
 * is published in, none in the others, and no entry when it is live nowhere
 * or in the trash. Writes only what differs.
 */
export async function indexRecord(
  payload: Payload,
  record: { collection: string; id: string },
): Promise<void> {
  const { collection, id } = record
  if (!isSearched(collection)) return
  if (!(await indexExists(payload))) return
  // A save and the cascade it starts can reach the same record at once. One
  // at a time, the second finds the first one's entry instead of adding
  // another.
  const key = `${collection}:${id}`
  const previous = running.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(() => reconcile(payload, { collection, id }))
  running.set(key, next)
  try {
    await next
  } finally {
    if (running.get(key) === next) running.delete(key)
  }
}

const running = new Map<string, Promise<void>>()
const ready = new WeakSet<object>()

/**
 * Whether the index's table exists. An upgrade runs earlier migrations, such
 * as the publishing cascade's, before the one that adds it, and they change
 * records. Reindex fills the index once the upgrade is done.
 */
async function indexExists(payload: Payload): Promise<boolean> {
  if (ready.has(payload.db)) return true
  const { drizzle } = payload.db as unknown as PostgresAdapter
  const result = await drizzle.execute(sql`SELECT to_regclass('search') IS NOT NULL AS found`)
  const found = (result.rows[0] as { found?: unknown } | undefined)?.found === true
  if (found) ready.add(payload.db)
  return found
}

async function reconcile(
  payload: Payload,
  record: { collection: Searched; id: string },
): Promise<void> {
  const { collection, id } = record
  const locales = payload.config.localization
    ? payload.config.localization.localeCodes
    : ([] as string[])
  const found = await payload
    .findByID({
      collection,
      id,
      locale: 'all',
      depth: 0,
      // The published record, not a draft saved since.
      draft: false,
      trash: true,
      disableErrors: true,
      // The index is the system's own work, and it reads where the record is live.
      overrideAccess: true,
    })
    .catch(() => null)
  const doc = asRecord(found)
  const { docs } = await payload.find({
    collection: SEARCH_SLUG as CollectionSlug,
    where: {
      and: [{ 'doc.relationTo': { equals: collection } }, { 'doc.value': { equals: id } }],
    },
    locale: 'all',
    depth: 0,
    pagination: false,
    // The index is the system's own.
    overrideAccess: true,
  })
  const [existing, ...extra] = docs as unknown as SearchDoc[]
  const remove = async (entries: readonly SearchDoc[]) => {
    if (entries.length === 0) return
    await payload.delete({
      collection: SEARCH_SLUG as CollectionSlug,
      where: { id: { in: entries.map((e) => e.id) } },
      overrideAccess: true,
    })
  }
  await remove(extra)

  const entries = new Map<string, Entry>()
  for (const locale of locales) {
    if (!found || !liveIn(collection, doc, locale)) continue
    const entry = await entryOf(payload, collection, doc, locale)
    if (entry) entries.set(locale, entry)
  }
  const [first] = entries.values()
  if (!first) {
    await remove(existing ? [existing] : [])
    return
  }
  const shared = { kind: first.kind, country: first.country, url: first.url }
  let target = existing
  if (!target) {
    const [locale] = entries.keys()
    target = (await payload.create({
      collection: SEARCH_SLUG as CollectionSlug,
      data: {
        doc: { relationTo: collection, value: id },
        priority: SEARCH_PRIORITY[collection],
        title: first.title,
        ...shared,
      } as never,
      ...(locale ? { locale: locale as never } : {}),
      depth: 0,
      overrideAccess: true,
    })) as unknown as SearchDoc
  }
  const titles = asRecord(target.title)
  const sameShared =
    target.kind === shared.kind && target.country === shared.country && target.url === shared.url
  for (const locale of locales) {
    const title = entries.get(locale)?.title ?? null
    const current = typeof titles[locale] === 'string' ? titles[locale] : null
    if (current === title && sameShared) continue
    await payload.update({
      collection: SEARCH_SLUG as CollectionSlug,
      id: target.id,
      data: { title, ...shared } as never,
      locale: locale as never,
      depth: 0,
      overrideAccess: true,
    })
  }
}

const reconcileOnChange: CollectionAfterChangeHook = async ({ collection, doc, req }) => {
  const id = idOf(doc)
  if (id) await indexLater(req, { collection: collection.slug, id })
  return doc
}

/**
 * Payload's search plugin, set up for the publishing rules, plus the step
 * that reconciles every language after a change. It runs after every
 * PromiseTracker plugin, so the record types it indexes exist.
 */
export function searchIndex(): Plugin {
  return definePlugin({
    slug: 'promisetracker-search',
    // After every PromiseTracker plugin, and before the final rules.
    order: 900_000,
    plugin: async ({ config }) => {
      const indexed = await searchPlugin({
        collections: Object.keys(SEARCHED),
        defaultPriorities: SEARCH_PRIORITY,
        skipSync,
        beforeSync,
        // The publishing rules already require the language to be published in Payload.
        deleteDrafts: true,
        syncDrafts: false,
        searchOverrides: {
          slug: SEARCH_SLUG,
          labels: { singular: 'Search entry', plural: 'Search index' },
          admin: {
            group: ADMIN_GROUPS.administration,
            defaultColumns: ['title', 'kind', 'country', 'priority'],
            description:
              'Filled in by the system: one entry for each area, actor, claim and topic, with ' +
              'its title in each language it is published in. "Reindex" rebuilds it.',
          },
          access: {
            // The API reads it as a guest. It holds only what is public.
            read: () => true,
            // Reindexing deletes and rewrites entries, so only a super-admin may.
            update: can.manageUsers,
            delete: can.manageUsers,
          },
          fields: ({ defaultFields }) => [...defaultFields, ...ENTRY_FIELDS],
        },
      })(config)
      return {
        ...indexed,
        collections: (indexed.collections ?? []).map((collection) =>
          isSearched(collection.slug)
            ? {
                ...collection,
                hooks: {
                  ...collection.hooks,
                  afterChange: [...(collection.hooks?.afterChange ?? []), reconcileOnChange],
                },
              }
            : collection,
        ),
      } satisfies Config
    },
  })()
}

// Querying the index.

/** How many results of each kind a search returns. */
export const SEARCH_LIMIT = 10
/** How many places a search resolves, each with everyone who represents it. */
export const PLACE_LIMIT = 3

type Row = {
  kind: SearchResultKind
  title: string
  url: string
  country: string | null
  record: string
  score: number
}

/** How close a title must be to the words searched for, from 0 to 1 (pg_trgm's word similarity). */
export const MATCH_THRESHOLD = 0.45
/**
 * A place brings everyone who represents it, so only the best matches do:
 * "Kibra" should not also bring a constituency that merely looks like it.
 */
export const PLACE_MARGIN = 0.15

/**
 * Entries whose title matches the text in this language, best first, up to
 * `limit` of each kind. `unaccent` makes "Senegal" find "Sénégal", and
 * `pg_trgm`'s word similarity lets a misspelt or partial name still match
 * (section 16.2). `pt_unaccent` is the migration's immutable wrapper, which
 * the trigram index is built on.
 */
async function matching(
  payload: Payload,
  text: string,
  scope: { locale: string; country?: string | undefined; kinds?: readonly SearchResultKind[] },
  limit: number,
): Promise<Row[]> {
  const query = text.trim().slice(0, MAX_QUERY)
  if (!query) return []
  const { drizzle } = payload.db as unknown as PostgresAdapter
  const country = scope.country ?? null
  const kinds = scope.kinds ? scope.kinds.join(',') : null
  // pg_trgm's default, 0.6, misses a letter dropped from a short name:
  // "nairbi" scores 0.57 against "Nairobi County". Set for this query only.
  const result = await drizzle.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL pg_trgm.word_similarity_threshold = ${sql.raw(String(MATCH_THRESHOLD))}`,
    )
    return tx.execute(sql`
    WITH found AS (
      SELECT s.kind, s.url, s.country, s.priority, l.title,
        COALESCE(r.areas_id, r.actors_id, r.claims_id, r.topics_id) AS record,
        word_similarity(pt_unaccent(${query}), pt_unaccent(l.title)) AS score,
        similarity(pt_unaccent(${query}), pt_unaccent(l.title)) AS whole
      FROM search s
      JOIN search_locales l ON l._parent_id = s.id AND l._locale = ${scope.locale}
      JOIN search_rels r ON r.parent_id = s.id AND r.path = 'doc'
      WHERE l.title IS NOT NULL
        AND pt_unaccent(${query}) <% pt_unaccent(l.title)
        AND (${country}::text IS NULL OR s.country = ${country} OR s.country IS NULL)
        AND (${kinds}::text IS NULL OR s.kind::text = ANY(string_to_array(${kinds}, ',')))
    ),
    ranked AS (
      SELECT *, row_number() OVER (
        PARTITION BY kind ORDER BY score DESC, whole DESC, priority DESC NULLS LAST, title
      ) AS place
      FROM found
    )
    SELECT kind, title, url, country, record, score FROM ranked
    WHERE place <= ${limit}
    ORDER BY priority DESC NULLS LAST, score DESC, whole DESC, title
  `)
  })
  return (result.rows as Row[]).map((row) => ({
    ...row,
    record: String(row.record),
    score: Number(row.score),
  }))
}

const KIND_ORDER: readonly SearchResultKind[] = ['area', 'actor', 'claim', 'topic']

export const payloadSearch: SearchProvider = {
  id: 'payload-search',
  health: async () => ({ healthy: true }),
  async search(query, scope, ctx): Promise<SearchResults> {
    const rows = await matching(ctx.payload, query, scope, scope.limit ?? SEARCH_LIMIT)
    return {
      groups: KIND_ORDER.map((kind) => ({
        kind,
        items: rows
          .filter((row) => row.kind === kind)
          .map((row) => ({
            id: row.record,
            title: row.title,
            url: row.url,
            country: row.country,
          })),
      })).filter((group) => group.items.length > 0),
    }
  },
  async resolvePlace(text, scope, ctx) {
    const rows = await matching(
      ctx.payload,
      text,
      { ...scope, kinds: ['area'] },
      scope.limit ?? PLACE_LIMIT,
    )
    const best = rows[0]?.score ?? 0
    return rows
      .filter((row) => row.score >= best - PLACE_MARGIN)
      .map((row) => ({ id: row.record, name: row.title }))
  },
  index: (record, ctx) => indexRecord(ctx.payload, record),
}

/** How far back the widget looks, in days. */
export const EMPTY_SEARCH_DAYS = 30
/** How many searches it lists. */
export const EMPTY_SEARCH_ROWS = 10

export type EmptySearch = { query: string; times: number; last: string }

type EmptySearchRow = { query: string; times: number | string; last: Date | string }

/**
 * Searches that found nothing, most often first, with when each was last
 * tried (section 18). They test whether location search works, and list the
 * places the record is missing. Searches differing only in case or spacing
 * count as one. The database counts them, so every search in the period counts.
 */
export async function emptySearches(
  payload: Payload,
  user: PayloadRequest['user'],
  now: Date = new Date(),
): Promise<EmptySearch[]> {
  // The log's own read rule, applied here because the count is one SQL query.
  if (!readSearchLog({ req: { user } as PayloadRequest })) return []
  const since = new Date(now.getTime() - EMPTY_SEARCH_DAYS * 24 * 60 * 60 * 1000)
  const { drizzle } = payload.db as unknown as PostgresAdapter
  const result = await drizzle.execute(sql`
    SELECT
      (array_agg(btrim("query") ORDER BY "created_at" DESC))[1] AS "query",
      count(*)::int AS "times",
      max("created_at") AS "last"
    FROM "search_log"
    WHERE "results" = 0 AND "created_at" > ${since.toISOString()}
    GROUP BY lower(regexp_replace(btrim("query"), '\\s+', ' ', 'g'))
    ORDER BY "times" DESC, "last" DESC
    LIMIT ${EMPTY_SEARCH_ROWS}`)
  return (result.rows as EmptySearchRow[]).map((row) => ({
    query: row.query,
    times: Number(row.times),
    last: new Date(row.last).toISOString(),
  }))
}
