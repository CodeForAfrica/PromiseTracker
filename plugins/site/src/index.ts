import { SECTION_IDS, STRING_KEYS } from '@promisetracker/contract'
import { definePromiseTrackerPlugin } from '@promisetracker/kernel'
import { ADMIN_GROUPS, can, refreshTags } from '@promisetracker/plugin-core'
import type { Field, GlobalBeforeChangeHook, GlobalConfig } from 'payload'
import { APIError } from 'payload'

const link = (name: string, label: string): Field => ({
  name,
  type: 'array',
  label,
  fields: [
    { name: 'label', type: 'text', required: true, localized: true },
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: { description: 'A path on this site, such as /methodology, or a full address.' },
    },
  ],
})

/** What each section is called in the admin. */
const SECTION_LABELS: Record<(typeof SECTION_IDS)[number], string> = {
  'home.featured-claim': 'Home: a real claim',
  'home.in-focus': 'Home: In focus',
  'home.how-ratings-work': 'Home: how a rating is decided',
  'home.tracked': 'Home: what we have tracked',
  'home.choose-country': 'Home: choose a country',
  'home.partners': 'Home: who we work with',
  'home.sister-tools': 'Home: other tools from PesaCheck',
  'country.in-focus': 'Country: In focus',
  'country.snapshot': 'Country: snapshot',
  'country.who-is-delivering': 'Country: who is delivering',
  'country.officials': 'Country: officials',
  'country.past-administrations': 'Country: past administrations',
  'actor.latest-changes': 'Actor: latest changes',
  'actor.latest-analysis': 'Actor: latest analysis',
  'actor.closing-summary': 'Actor: closing summary',
  'claim.latest-analysis': 'Claim: latest analysis',
}

/** The field a section's setting is stored in: `home.in-focus` becomes `homeInFocus`. */
export const sectionField = (id: string): string =>
  id.replace(/[.-]([a-z])/g, (_match, letter: string) => letter.toUpperCase())

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value
  const id: unknown = value && typeof value === 'object' ? Reflect.get(value, 'id') : null
  return typeof id === 'string' ? id : null
}

type PickRow = { country?: unknown; actors?: unknown[] | null; claims?: unknown[] | null }

/**
 * Each country's picks must be in that country. Checked on save, reading as
 * the system, rather than with a filter on the fields: Payload checks a
 * filter by reading as whoever saves, and the system may not read a claim
 * still on hold, which an editor may well pick.
 */
const picksInTheirCountry: GlobalBeforeChangeHook = async ({ data, req }) => {
  const rows = Array.isArray(data.countryPicks) ? (data.countryPicks as PickRow[]) : []
  for (const row of rows) {
    const country = idOf(row.country)
    if (!country) continue
    for (const collection of ['actors', 'claims'] as const) {
      const ids = (row[collection] ?? []).map(idOf).filter((id): id is string => Boolean(id))
      if (ids.length === 0) continue
      const { totalDocs } = await req.payload.count({
        collection,
        where: { and: [{ id: { in: ids } }, { country: { equals: country } }] },
        // Whether the picks are in the country, whoever saves.
        overrideAccess: true,
        req,
      })
      if (totalDocs !== ids.length) {
        throw new APIError(`Each country's picks must be ${collection} in that country.`, 400)
      }
    }
  }
  return data
}

/**
 * Settings only the default public site uses (section 10.6). A replacement
 * site brings its own. The theme arrives with the issue that needs it.
 */
export const Site: GlobalConfig = {
  slug: 'site',
  label: 'Site settings',
  admin: { group: ADMIN_GROUPS.site },
  // The public reads these through /api/v1/site. Editors change them.
  access: { read: () => true, update: can.editEditorial },
  hooks: {
    beforeChange: [picksInTheirCountry],
    afterChange: [
      async ({ doc, req }) => {
        await refreshTags(['site'], req)
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, defaultValue: 'PromiseTracker' },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Explainer',
          fields: [
            {
              name: 'description',
              type: 'text',
              localized: true,
              admin: { description: 'One line under the name on every page.' },
            },
            {
              name: 'explainer',
              type: 'textarea',
              localized: true,
              admin: { description: 'The longer explanation, collapsed by default.' },
            },
          ],
        },
        {
          label: 'Navigation and footer',
          fields: [
            link('navigation', 'Navigation links'),
            {
              name: 'footer',
              type: 'group',
              fields: [
                { name: 'about', type: 'textarea', localized: true },
                link('links', 'Footer links'),
              ],
            },
          ],
        },
        {
          label: 'Homepage picks',
          description:
            'What the homepage features. A pick that is not published in a language is left out there.',
          fields: [
            {
              name: 'picks',
              type: 'group',
              label: false,
              fields: [
                {
                  name: 'featuredClaim',
                  label: 'A real claim',
                  type: 'relationship',
                  relationTo: 'claims',
                  admin: { description: 'Shown with its rating and sources.' },
                },
                {
                  name: 'inFocus',
                  label: 'In focus',
                  type: 'relationship',
                  relationTo: 'themes',
                  admin: {
                    description:
                      'A theme. It shows when it spans two or more countries, or the site has one country.',
                  },
                },
                {
                  name: 'featuredArea',
                  label: 'Featured place',
                  type: 'relationship',
                  relationTo: 'areas',
                  admin: { description: 'Shown in In focus with who answers for it.' },
                },
              ],
            },
          ],
        },
        {
          label: 'Country picks',
          description: 'The actors and claims each country page shows under In focus.',
          fields: [
            {
              name: 'countryPicks',
              label: 'Countries',
              type: 'array',
              fields: [
                {
                  name: 'country',
                  type: 'relationship',
                  relationTo: 'countries',
                  // Checked here rather than required: the settings keep their
                  // history, and a required column would stop a picked country
                  // ever being deleted.
                  validate: (value: unknown) => (value ? true : 'Choose the country.'),
                },
                {
                  name: 'actors',
                  type: 'relationship',
                  relationTo: 'actors',
                  hasMany: true,
                },
                {
                  name: 'claims',
                  type: 'relationship',
                  relationTo: 'claims',
                  hasMany: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Sections',
          description:
            'Each section shows only when it has something to show (section 10.3). Force one on or off here. A section forced on still never shows empty.',
          fields: [
            {
              name: 'sections',
              type: 'group',
              label: false,
              fields: SECTION_IDS.map(
                (id): Field => ({
                  name: sectionField(id),
                  label: SECTION_LABELS[id],
                  type: 'select',
                  defaultValue: 'auto',
                  options: [
                    { label: 'When it has something to show', value: 'auto' },
                    { label: 'Always', value: 'on' },
                    { label: 'Never', value: 'off' },
                  ],
                }),
              ),
            },
          ],
        },
        {
          label: 'Figures',
          fields: [
            {
              name: 'figuresThreshold',
              label: 'Show percentages from',
              type: 'number',
              required: true,
              defaultValue: 20,
              min: 1,
              admin: {
                description:
                  'Below this many claims, figures show as counts, such as "1 of 3 completed", rather than percentages (section 10.4).',
              },
            },
          ],
        },
        {
          label: 'Interface text',
          description:
            'The words on buttons, menus and notices. Leave a box empty to use the default shown.',
          fields: [
            {
              name: 'strings',
              // One value per language, not a column per string: the strings
              // outnumber the hundred columns a Postgres query may name (D109).
              type: 'json',
              localized: true,
              admin: {
                components: { Field: '@promisetracker/plugin-site/client#InterfaceText' },
              },
              validate: (value: unknown) => {
                if (value === null || value === undefined) return true
                if (typeof value !== 'object' || Array.isArray(value))
                  return 'Interface text is a list of words.'
                const wrong = Object.entries(value).find(
                  ([key, text]) =>
                    !(STRING_KEYS as readonly string[]).includes(key) || typeof text !== 'string',
                )
                return wrong ? `"${wrong[0]}" is not interface text this site has.` : true
              },
            },
          ],
        },
      ],
    },
  ],
}

/** plugin-site: settings that only the default public site uses (section 6.3). */
export const sitePlugin = definePromiseTrackerPlugin({
  slug: 'site',
  version: '0.1.0',
  order: 10,
  dependsOn: ['core'],
  globals: [Site],
})

export { DEFAULT_STRINGS, resolveStrings } from './strings'
