import { countriesByContinent } from '@/data/countries'
import { CollectionConfig } from 'payload'

const africanCountries = countriesByContinent('Africa')

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    read: ({ req }) => Boolean(req.user),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'locale'],
    group: {
      en: 'Settings',
      fr: 'Paramètres',
    },
  },
  labels: {
    singular: {
      en: 'Tenant',
      fr: 'Locataire',
    },
    plural: {
      en: 'Tenants',
      fr: 'Locataires',
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: {
        en: 'Name',
        fr: 'Nom',
      },
      required: true,
    },
    {
      name: 'locale',
      type: 'select',
      label: {
        en: 'Locale',
        fr: 'Lieu',
      },
      required: true,
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
    {
      name: 'country',
      type: 'select',
      options: africanCountries,
      unique: true,
      required: true,
      label: {
        en: 'Country',
        fr: 'Pays',
      },
    },
  ],
}
