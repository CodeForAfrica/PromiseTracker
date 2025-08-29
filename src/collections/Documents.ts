import { CollectionConfig } from 'payload'

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: {
    singular: {
      en: 'Document',
      fr: 'Document',
    },
    plural: {
      en: 'Documents',
      fr: 'Documents',
    },
  },
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['title', 'country', 'region', 'type', 'language'],
    useAsTitle: 'title',
    group: {
      en: 'Documents',
      fr: 'Documents',
    },
  },
  fields: [
    {
      name: 'title',
      label: {
        en: 'Title',
        fr: 'Titre',
      },
      type: 'text',
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      label: {
        en: 'URL',
        fr: 'URL',
      },
    },
    {
      name: 'docURL', // only used to download file from airtable
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      label: {
        en: 'File',
        fr: 'Déposer',
      },
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
          label: {
            en: 'Political Entity',
            fr: 'Entité Politique',
          },
        },
        {
          name: 'country',
          type: 'text',
          label: {
            en: 'Country',
            fr: 'Pays',
          },
        },
        {
          name: 'region',
          type: 'text',
          label: {
            en: 'Region',
            fr: 'Région',
          },
        },
        {
          name: 'language',
          type: 'select',
          label: {
            en: 'Language',
            fr: 'Langue',
          },
          options: [
            {
              value: 'en',
              label: {
                en: 'English',
                fr: 'Anglais',
              },
            },
            {
              value: 'fr',
              label: {
                en: 'French',
                fr: 'Français',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'type',
      type: 'select',
      label: {
        en: 'Type',
        fr: 'Taper',
      },
      admin: {
        position: 'sidebar',
      },
      options: [
        {
          value: 'promise',
          label: {
            en: 'Promise',
            fr: 'Promesse',
          },
        },
        {
          value: 'evidence',
          label: {
            en: 'Evidence',
            fr: 'Preuve',
          },
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
          label: {
            en: 'Year From',
            fr: 'Année à partir de',
          },
        },
        {
          name: 'yearTo',
          type: 'number',
          label: {
            en: 'Year To',
            fr: 'Année à',
          },
        },
      ],
    },
    {
      name: 'airtableID',
      label: {
        en: 'Airtable ID',
        fr: 'ID Airtable ',
      },
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
      label: {
        en: 'Processed',
        fr: 'Traité',
      },
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      type: 'tabs',
      admin: {
        readOnly: true,
      },
      tabs: [
        {
          label: {
            en: 'Extracted Text',
            fr: 'Texte extrait',
          },
          fields: [
            {
              name: 'extractedText',
              label: {
                en: 'Text',
                fr: 'Texte',
              },
              type: 'richText',
              admin: {
                readOnly: true,
              },
            },
          ],
        },
      ],
    },
  ],
}
