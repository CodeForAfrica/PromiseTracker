import { CollectionConfig } from 'payload'

export const PageLayout: CollectionConfig = {
  slug: 'layout',
  labels: {
    singular: {
      en: 'Layout',
      fr: 'Mise en page',
    },
    plural: {
      en: 'Layouts',
      fr: 'Mises en page',
    },
  },
  admin: {
    group: {
      en: 'Settings',
      fr: 'Paramètres',
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
  ],
}
