import { Tab } from 'payload'

export const GeneralTab: Tab = {
  label: {
    en: 'General',
    fr: 'Général',
  },
  fields: [
    {
      type: 'collapsible',
      label: {
        en: 'Title & Description',
        fr: 'Titre et description',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'richText',
          required: true,
        },
      ],
    },
    {
      type: 'collapsible',
      label: {
        en: 'Logo',
        fr: 'Logo',
      },
      fields: [
        {
          name: 'primaryLogo',
          required: true,
          admin: {
            description: 'Shown on main navigation bar.',
          },
          type: 'relationship',
          relationTo: 'media',
          hasMany: false,
        },
        {
          name: 'secondaryLogo',
          required: true,
          admin: {
            description: 'Shown on main footer. If not provided, primary logo will be reused.',
          },
          type: 'relationship',
          relationTo: 'media',
          hasMany: false,
        },
      ],
    },
  ],
}
