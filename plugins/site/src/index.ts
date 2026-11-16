import { definePromiseTrackerPlugin } from '@promisetracker/kernel'
import { can } from '@promisetracker/plugin-core'
import type { GlobalConfig } from 'payload'

export const Site: GlobalConfig = {
  slug: 'site',
  // The site's name and tagline are public. Editors change them.
  access: { read: () => true, update: can.editEditorial },
  fields: [
    { name: 'name', type: 'text', required: true, defaultValue: 'PromiseTracker' },
    { name: 'tagline', type: 'text' },
  ],
}

/**
 * plugin-site: settings that only the default public site uses (section 6.3).
 * This first version holds the site's name and tagline.
 */
export const sitePlugin = definePromiseTrackerPlugin({
  slug: 'site',
  version: '0.1.0',
  order: 10,
  dependsOn: ['core'],
  globals: [Site],
})
