import { CollectionConfig } from 'payload'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    group: { en: 'Publication', fr: 'Publication' },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
  ],
}
