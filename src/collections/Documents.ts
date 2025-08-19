import { CollectionConfig } from 'payload'

export const Documents: CollectionConfig = {
  slug: 'documents',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['title', 'country', 'region', 'type', 'language'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'url',
      type: 'text',
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
    },
    {
      type: 'row',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'politicalEntity',
          type: 'text',
        },
        {
          name: 'country',
          type: 'text',
        },
        {
          name: 'region',
          type: 'text',
        },
        {
          name: 'language',
          type: 'select',
          options: [
            {
              value: 'en',
              label: 'English',
            },
            {
              value: 'fr',
              label: 'French',
            },
            {
              value: 'es',
              label: 'Spanish',
            },
          ],
        },
      ],
    },
    {
      name: 'type',
      type: 'select',
      admin: {
        position: 'sidebar',
      },
      options: [
        {
          value: 'promise',
          label: 'Promise',
        },
        {
          value: 'evidence',
          label: 'Evidence',
        },
      ],
    },
    {
      type: 'row',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'yearFrom',
          type: 'number',
        },
        {
          name: 'yearTo',
          type: 'number',
        },
      ],
    },
    {
      name: 'airtableID',
      label: 'Airtable ID',
      type: 'text',
      unique: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'fullyProcessed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Extracted Text',
          fields: [
            {
              name: 'extractedText',
              type: 'richText',
            },
          ],
        },
        {
          label: 'AI Extraction',
          fields: [
            {
              name: 'aiTitle',
              type: 'text',
            },
            {
              name: 'aiExtraction',
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
                  admin: {
                    readOnly: true,
                  },
                  fields: [
                    {
                      name: 'uniqueId',
                      type: 'text',
                      // admin: {
                      //   readOnly: true,
                      // },
                    },
                    {
                      name: 'checkMediaId',
                      type: 'text',
                      // admin: {
                      //   readOnly: true,
                      // },
                    },
                    {
                      name: 'checkMediaURL',
                      label: 'CheckMedia URL',
                      type: 'text',
                      // admin: {
                      //   readOnly: true,
                      // },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
