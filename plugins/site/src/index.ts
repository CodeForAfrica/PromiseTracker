import { STRING_KEYS } from '@promisetracker/contract'
import { definePromiseTrackerPlugin } from '@promisetracker/kernel'
import { ADMIN_GROUPS, can, refreshTags } from '@promisetracker/plugin-core'
import type { Field, GlobalConfig } from 'payload'

import { DEFAULT_STRINGS } from './strings'

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

/**
 * Settings only the default public site uses (section 10.6). A replacement
 * site brings its own. Picks, section overrides and the theme arrive with
 * the issues that need them.
 */
export const Site: GlobalConfig = {
  slug: 'site',
  label: 'Site settings',
  admin: { group: ADMIN_GROUPS.site },
  // The public reads these through /api/v1/site. Editors change them.
  access: { read: () => true, update: can.editEditorial },
  hooks: {
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
              type: 'group',
              fields: STRING_KEYS.map(
                (key): Field => ({
                  name: key,
                  type: 'text',
                  localized: true,
                  admin: { placeholder: DEFAULT_STRINGS.en[key] },
                }),
              ),
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
