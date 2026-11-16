import type { CollectionConfig, Config, Plugin } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email' },
  auth: true,
  fields: [{ name: 'name', type: 'text' }],
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  fields: [{ name: 'alt', type: 'text', required: true }],
  upload: true,
}

/**
 * plugin-core: the data model and admin. This first version holds the users
 * and media collections. The rest of the data model comes in later issues.
 */
export function corePlugin(): Plugin {
  return (config: Config): Config => ({
    ...config,
    collections: [...(config.collections ?? []), Users, Media],
  })
}
