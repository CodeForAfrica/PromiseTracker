import { CollectionConfig } from 'payload'

export const AIExtractions: CollectionConfig = {
  slug: 'aiExtraction',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
    {
      name: 'document',
      type: 'relationship',
      relationTo: 'documents',
      required: true,
      hasMany: false,
    },
    {
      name: 'extractions',
      type: 'array',
      fields: [
        {
          name: 'category',
          type: 'text',
          required: true,
        },
        {
          name: 'summary',
          type: 'text',
          required: true,
        },
        {
          name: 'source',
          type: 'textarea',
          required: true,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'uniqueId',
              type: 'text',
              admin: {
                hidden: true,
              },
            },
            {
              name: 'checkMediaId',
              type: 'text',
              admin: {
                hidden: true,
              },
            },
            {
              name: 'checkMediaURL',
              label: 'CheckMedia URL',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
}
