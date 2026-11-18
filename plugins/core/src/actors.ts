import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
  PayloadRequest,
  Where,
} from 'payload'
import { APIError } from 'payload'

import { can, signedIn } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { refreshTags } from './cache'
import {
  countryCode,
  countryField,
  formerSlugsField,
  idOf,
  keepFormerSlug,
  slugField,
  slugFromName,
} from './places'
import { withPublishing } from './publishing'
import { SLUG_PATTERN } from './slugs'

/** What an actor is (section 7.3). */
export const ACTOR_KINDS = ['person', 'party', 'institution'] as const
export type ActorKind = (typeof ACTOR_KINDS)[number]

export const GENDERS = ['female', 'male', 'non-binary'] as const

export const INSTITUTION_TYPES = [
  'ministry',
  'agency',
  'department',
  'commission',
  'state-corporation',
  'other',
] as const

export const LINK_TYPES = [
  'website',
  'facebook',
  'x',
  'instagram',
  'youtube',
  'tiktok',
  'linkedin',
  'other',
] as const

/** Where a term stands today (section 7.3). */
export const TERM_STAGES = ['candidate', 'current', 'past'] as const
export type TermStage = (typeof TERM_STAGES)[number]

type Dated = { startsOn?: string | null; endsOn?: string | null }

/**
 * A term's stage on a day: candidate before it starts, current during it,
 * past once it has ended. Worked out when read, never stored, because it
 * changes with the date and not with an edit.
 */
export function termStage(term: Dated, now: Date = new Date()): TermStage {
  const starts = term.startsOn ? new Date(term.startsOn) : null
  if (!starts || starts > now) return 'candidate'
  if (term.endsOn && new Date(term.endsOn) < now) return 'past'
  return 'current'
}

/** Terms at the current stage on a day, as a query. */
export const currentTerms = (now: Date = new Date()): Where => ({
  and: [
    { startsOn: { less_than_equal: now.toISOString() } },
    { or: [{ endsOn: { exists: false } }, { endsOn: { greater_than_equal: now.toISOString() } }] },
  ],
})

/** Terms at the past stage on a day, as a query. */
export const pastTerms = (now: Date = new Date()): Where => ({
  endsOn: { less_than: now.toISOString() },
})

/**
 * Actors who may be public on a day. A person is, once their first term has
 * started: one with only candidate terms never is (sections 7.3 and 8.1).
 * Parties and institutions hold no terms, so the rule does not apply to them.
 */
export const onRecord = (now: Date = new Date()): Where => ({
  or: [
    { kind: { not_equals: 'person' } },
    { onRecordSince: { less_than_equal: now.toISOString() } },
  ],
})

/** Staff read every actor. A guest reads those marked ready, in a country marked ready. */
const readActors = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || {
    and: [{ recordStatus: { equals: 'ready' } }, { 'country.recordStatus': { equals: 'ready' } }],
  }

/** A guest reads the terms of actors they can read. */
const readTerms = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || {
    and: [
      { 'actor.recordStatus': { equals: 'ready' } },
      { 'country.recordStatus': { equals: 'ready' } },
    ],
  }

/** A change to an actor or a term refreshes every page of its country that shows actors (section 17). */
const refreshActors = async (req: PayloadRequest, ...countries: unknown[]) => {
  const codes = new Set<string>()
  for (const country of countries) {
    const code = await countryCode(req, country)
    if (code) codes.add(code)
  }
  if (codes.size > 0)
    await refreshTags(
      [...codes].map((code) => `actors:${code}`),
      req,
    )
}

const refreshOnActorChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  await refreshActors(req, doc.country, previousDoc?.country)
  return doc
}

const refreshOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await refreshActors(req, doc.country)
  return doc
}

/** An actor's slug is unique in its country, across every kind (section 7.3). */
const checkActorSlug: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const slug: unknown = data.slug ?? originalDoc?.slug
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new APIError(
      'Use lower-case letters, digits and single hyphens in the slug, such as achieng-wekesa.',
      400,
    )
  }
  const country = idOf(data.country ?? originalDoc?.country)
  if (!country) return data
  const { totalDocs } = await req.payload.count({
    collection: 'actors',
    where: {
      and: [
        { country: { equals: country } },
        { slug: { equals: slug } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    // Checks whether a slug is taken, whoever is asking. No record is returned.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  if (totalDocs > 0) {
    throw new APIError(`Another actor in this country already uses "${slug}".`, 400)
  }
  return data
}

/** Terms hold an actor's history, so an actor with terms is not deleted. */
const keepActorWithTerms: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const { totalDocs } = await req.payload.count({
    collection: 'terms',
    where: {
      or: [{ actor: { equals: id } }, { party: { equals: id } }, { successor: { equals: id } }],
    },
    // Counts the terms that name this actor, whoever is deleting it.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  if (totalDocs > 0) {
    throw new APIError(
      'This actor is named in terms. Delete or change those terms first, or archive the actor.',
      400,
    )
  }
}

/** People, parties and institutions (section 7.3). */
export const Actors: CollectionConfig = withPublishing(
  {
    slug: 'actors',
    admin: {
      group: ADMIN_GROUPS.people,
      useAsTitle: 'name',
      defaultColumns: ['name', 'kind', 'country', 'recordStatus'],
    },
    access: {
      read: readActors,
      create: can.editRecords,
      update: can.editRecords,
      delete: can.deleteRecords,
    },
    indexes: [{ fields: ['country', 'slug'], unique: true }],
    hooks: {
      beforeValidate: [slugFromName],
      beforeChange: [checkActorSlug, keepFormerSlug],
      beforeDelete: [keepActorWithTerms],
      afterChange: [refreshOnActorChange],
      afterDelete: [refreshOnDelete],
    },
    fields: [
      { name: 'name', type: 'text', required: true },
      {
        type: 'row',
        fields: [
          {
            name: 'kind',
            type: 'select',
            required: true,
            defaultValue: 'person',
            options: ACTOR_KINDS.map((value) => ({ label: value, value })),
          },
          { name: 'shortName', type: 'text' },
        ],
      },
      {
        type: 'row',
        admin: { condition: (data) => data?.kind === 'person' },
        fields: [
          { name: 'honorific', type: 'text', admin: { placeholder: 'Hon., Dr., H.E.' } },
          {
            name: 'gender',
            type: 'select',
            options: GENDERS.map((value) => ({ label: value, value })),
          },
        ],
      },
      {
        name: 'institutionType',
        type: 'select',
        options: INSTITUTION_TYPES.map((value) => ({ label: value, value })),
        admin: { condition: (data) => data?.kind === 'institution' },
      },
      {
        type: 'row',
        fields: [
          { name: 'image', type: 'upload', relationTo: 'media' },
          { name: 'imageCredit', type: 'text' },
        ],
      },
      { name: 'biography', type: 'textarea', localized: true },
      {
        name: 'links',
        type: 'array',
        admin: { initCollapsed: true },
        fields: [
          {
            type: 'row',
            fields: [
              {
                name: 'type',
                type: 'select',
                required: true,
                defaultValue: 'website',
                options: LINK_TYPES.map((value) => ({ label: value, value })),
              },
              { name: 'url', type: 'text', required: true },
            ],
          },
        ],
      },
      slugField,
      countryField,
      formerSlugsField,
      {
        name: 'onRecordSince',
        type: 'date',
        index: true,
        admin: {
          position: 'sidebar',
          readOnly: true,
          date: { pickerAppearance: 'dayOnly' },
          description: 'When the first term starts. The actor is public from then.',
        },
        // Only the terms' hook writes it.
        access: { create: () => false, update: () => false },
      },
    ],
  },
  [],
)

type Ref = { id: string; country?: unknown; kind?: unknown; type?: unknown; areaType?: unknown }

/** One record by id, read as the system, for the checks on a term. */
async function load(
  req: PayloadRequest,
  collection: 'actors' | 'offices' | 'areas',
  value: unknown,
): Promise<Ref | null> {
  const id = idOf(value)
  if (!id) return null
  const doc = await req.payload.findByID({
    collection,
    id,
    depth: 0,
    locale: req.locale ?? 'en',
    // Reads the records a term names, to check they fit together.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return doc as Ref
}

const valueIn = <T>(data: Record<string, unknown>, original: unknown, key: string): T | undefined =>
  (key in data
    ? data[key]
    : original && typeof original === 'object'
      ? Reflect.get(original, key)
      : undefined) as T | undefined

/**
 * A term's actor, office, area, party and successor are all in one country,
 * and the area is the kind its office answers for (section 7.2). The term
 * takes its country from its actor.
 */
const checkTerm: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const get = (key: string) => valueIn<unknown>(data, originalDoc, key)
  const actor = await load(req, 'actors', get('actor'))
  if (!actor) throw new APIError('Choose the actor who holds this term.', 400)
  const country = idOf(actor.country)
  const office = await load(req, 'offices', get('office'))
  if (!office) throw new APIError('Choose the office.', 400)
  const sameCountry = (ref: Ref | null, what: string) => {
    if (ref && idOf(ref.country) !== country) {
      throw new APIError(`The ${what} must be in the actor's country.`, 400)
    }
  }
  sameCountry(office, 'office')
  const area = await load(req, 'areas', get('area'))
  sameCountry(area, 'area')
  const needsArea = Boolean(office.areaType) && office.areaType !== 'country'
  if (needsArea && !area) {
    throw new APIError(`Choose the ${String(office.areaType)} this office answers for.`, 400)
  }
  if (!needsArea && area) {
    throw new APIError('This office answers for the whole country, so leave the area empty.', 400)
  }
  if (area && area.type !== office.areaType) {
    throw new APIError(`This office answers for a ${String(office.areaType)}.`, 400)
  }
  const party = await load(req, 'actors', get('party'))
  sameCountry(party, 'party')
  if (party && party.kind !== 'party') throw new APIError('The party must be a party.', 400)
  const successor = await load(req, 'actors', get('successor'))
  sameCountry(successor, 'successor')
  if (successor && successor.id === actor.id) {
    throw new APIError('An actor cannot succeed themselves.', 400)
  }
  const startsOn = get('startsOn')
  const endsOn = get('endsOn')
  if (typeof startsOn === 'string' && typeof endsOn === 'string' && endsOn < startsOn) {
    throw new APIError('The term must end after it starts.', 400)
  }
  return { ...data, country }
}

/** Sets an actor's `onRecordSince` from the start of their earliest term. */
async function updateOnRecordSince(req: PayloadRequest, actorId: string): Promise<void> {
  const { docs } = await req.payload.find({
    collection: 'terms',
    where: { actor: { equals: actorId } },
    sort: 'startsOn',
    limit: 1,
    depth: 0,
    // Reads the actor's earliest term, whoever saved the term.
    overrideAccess: true,
    req,
  })
  const first = docs[0]?.startsOn ?? null
  const actor = await req.payload.findByID({
    collection: 'actors',
    id: actorId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if ((actor.onRecordSince ?? null) === first) return
  await req.payload.update({
    collection: 'actors',
    id: actorId,
    data: { onRecordSince: first },
    // The system keeps this date in step with the terms.
    overrideAccess: true,
    req,
  })
}

const afterTermChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const actors = new Set([idOf(doc.actor), idOf(previousDoc?.actor)])
  for (const actor of actors) if (actor) await updateOnRecordSince(req, actor)
  await refreshActors(req, doc.country, previousDoc?.country)
  return doc
}

const afterTermDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const actor = idOf(doc.actor)
  if (actor) await updateOnRecordSince(req, actor)
  await refreshActors(req, doc.country)
  return doc
}

/** A label for the term in the admin's lists, such as "Achieng Wekesa, Governor". */
const titleTerm: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const actor = await load(req, 'actors', valueIn(data, originalDoc, 'actor'))
  const office = await load(req, 'offices', valueIn(data, originalDoc, 'office'))
  const name = (ref: Ref | null) => {
    const value: unknown = ref ? Reflect.get(ref, 'name') : null
    return typeof value === 'string' ? value : ''
  }
  const startsOn = valueIn<string>(data, originalDoc, 'startsOn')
  const year = startsOn ? ` (${startsOn.slice(0, 4)})` : ''
  return { ...data, title: `${name(actor)}, ${name(office)}${year}` }
}

/** An actor's time in a seat (section 7.3). */
export const Terms: CollectionConfig = {
  slug: 'terms',
  admin: {
    group: ADMIN_GROUPS.people,
    useAsTitle: 'title',
    defaultColumns: ['title', 'office', 'area', 'startsOn', 'endsOn'],
  },
  defaultSort: '-startsOn',
  access: {
    read: readTerms,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  hooks: {
    beforeChange: [checkTerm, titleTerm],
    afterChange: [afterTermChange],
    afterDelete: [afterTermDelete],
  },
  fields: [
    { name: 'actor', type: 'relationship', relationTo: 'actors', required: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'office',
          type: 'relationship',
          relationTo: 'offices',
          required: true,
          index: true,
        },
        {
          name: 'area',
          type: 'relationship',
          relationTo: 'areas',
          index: true,
          admin: { description: 'Empty for an office that answers for the whole country.' },
        },
      ],
    },
    {
      name: 'party',
      type: 'relationship',
      relationTo: 'actors',
      index: true,
      filterOptions: { kind: { equals: 'party' } },
      admin: { description: 'The party during this term.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'electedOn', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
        {
          name: 'startsOn',
          type: 'date',
          required: true,
          index: true,
          admin: { date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'endsOn',
          type: 'date',
          index: true,
          admin: {
            date: { pickerAppearance: 'dayOnly' },
            description: 'Empty while in office.',
          },
        },
      ],
    },
    {
      name: 'stage',
      type: 'text',
      // Not stored: it changes with the date.
      virtual: true,
      admin: { position: 'sidebar', readOnly: true },
      hooks: {
        afterRead: [({ siblingData }) => termStage(siblingData as Dated)],
      },
    },
    {
      name: 'closingSummary',
      type: 'textarea',
      localized: true,
      admin: { description: 'What the term delivered. Written when it ends.' },
    },
    {
      name: 'successor',
      type: 'relationship',
      relationTo: 'actors',
      admin: { description: 'Who took the seat next.' },
    },
    {
      name: 'title',
      type: 'text',
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
    },
    {
      ...countryField,
      admin: { position: 'sidebar', readOnly: true, description: 'The actor’s country.' },
      // Set from the actor.
      required: false,
      access: { create: () => false, update: () => false },
    },
  ],
}
